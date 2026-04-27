"""POST /optimize-route -- fully orchestrated routing flow.

Pipeline:
1. Pull named routes from the graph (Mombasa->Mumbai)
2. For each route, fetch weather + traffic (mock or real), score risk + quality
3. Pick primary (lowest composite weight) and alternative
4. Run decision engine on the primary to derive an action
5. Ask Gemini (or template fallback) for a natural-language explanation
6. Persist the resulting shipment
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Tuple

from fastapi import APIRouter

from models.schemas import OptimizeRequest, OptimizeResponse, QualityResult, RiskResult, Route
from services import (
    decision_engine,
    firestore as fs_service,
    gemini,
    graph as graph_service,
    quality_engine,
    risk_engine,
    weather as weather_service,
)

router = APIRouter(tags=["routing"])
log = logging.getLogger("chainguard.routing")


def _enrich_route(route: dict, temp_c: float, day_of_week: int) -> Tuple[Route, RiskResult, QualityResult]:
    """Score a graph route with risk + quality and return Pydantic Route + sub-results."""

    last_node_name = route["waypoints"][-1]["name"] if route["waypoints"] else ""
    weather = weather_service.get_weather(last_node_name) if last_node_name else {"score": 40}
    weather_score = weather.get("score", 40)
    congestion = 30.0  # baseline; perturbed by disruptions/risk_factors below
    if "monsoon_season" in route["risk_factors"] or "port_congestion" in route["risk_factors"]:
        congestion += 35
    if "canal_congestion" in route["risk_factors"]:
        congestion += 45
    if "airport_handling" in route["risk_factors"]:
        congestion += 10
    congestion = min(100.0, congestion)
    if route.get("uses_disrupted_node"):
        congestion = 100.0
        weather_score = max(weather_score, 90)

    final_risk, delay_prob, rule_score, level, factors = risk_engine.score(
        distance_km=route["distance_km"],
        base_eta_hrs=route["base_eta_hrs"],
        weather_score=weather_score,
        congestion_level=congestion,
        day_of_week=day_of_week,
        transport_mode=route["transport_mode"],
    )

    quality, status, loss, remaining, curve = quality_engine.predict(
        elapsed_hours=route["base_eta_hrs"],
        delay_hours=0.0,
        temp_celsius=temp_c,
        initial_quality=100.0,
    )

    pyd_route = Route(
        name=route["name"],
        waypoints=route["waypoints"],
        distance_km=route["distance_km"],
        base_eta_hrs=route["base_eta_hrs"],
        risk_factors=route["risk_factors"] + factors,
        risk_score=final_risk,
        delay_prob=delay_prob,
        quality_at_arrival=quality,
        composite_weight=route["composite_weight"],
        cost_usd=route["cost_usd"],
        transport_mode=route["transport_mode"],
    )
    risk_obj = RiskResult(
        route_id=route["name"],
        risk_score=final_risk,
        delay_prob=delay_prob,
        risk_level=level,  # type: ignore[arg-type]
        factors=factors,
        rule_score=rule_score,
        ml_score=delay_prob * 100.0,
    )
    quality_obj = QualityResult(
        cargo_type="avocados",
        quality_score=quality,
        status=status,  # type: ignore[arg-type]
        economic_loss_pct=loss,
        remaining_shelf_life_hrs=remaining,
        decay_curve=curve,
    )
    return pyd_route, risk_obj, quality_obj


@router.post("/optimize-route", response_model=OptimizeResponse)
def optimize_route(req: OptimizeRequest) -> OptimizeResponse:
    routes = graph_service.get_named_routes()
    if not routes:
        raise RuntimeError("Graph has no named routes between origin/destination")

    day_of_week = datetime.now(timezone.utc).weekday()
    enriched = [_enrich_route(r, req.current_temp_celsius, day_of_week) for r in routes]
    enriched.sort(key=lambda t: t[0].composite_weight)

    primary_route, primary_risk, primary_quality = enriched[0]
    alt_route = enriched[1][0] if len(enriched) > 1 else None

    action, primary_factor, rationale = decision_engine.decide(
        quality_score=primary_quality.quality_score,
        risk_score=primary_risk.risk_score,
    )

    # If we're rerouting, swap primary->"alternative for the recommendation
    chosen_route = primary_route
    if action in {"AUTO_REROUTE", "EMERGENCY_REROUTE"} and alt_route is not None:
        chosen_route = alt_route
        primary_route, alt_route = alt_route, primary_route
        primary_risk = enriched[1][1] if enriched[1][0] is chosen_route else primary_risk
        primary_quality = enriched[1][2] if enriched[1][0] is chosen_route else primary_quality

    explanation_text, source, key_factors = gemini.explain_decision(
        route_a=primary_route.model_dump(),
        route_b=alt_route.model_dump() if alt_route else None,
        decision=action,
        primary_factor=primary_factor,
        cargo_type=req.cargo_type,
        current_quality=primary_quality.quality_score,
    )

    shipment_id = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "shipment_id": shipment_id,
        "origin": req.origin,
        "destination": req.destination,
        "cargo_type": req.cargo_type,
        "weight_kg": req.weight_kg,
        "deadline_hours": req.deadline_hours,
        "current_temp_celsius": req.current_temp_celsius,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "routes": [primary_route.model_dump()] + ([alt_route.model_dump()] if alt_route else []),
        "selected_route": primary_route.name,
        "decision": action,
        "explanation": explanation_text,
        "explanation_source": source,
        "disruptions": [],
    }
    fs_service.set_doc("shipments", shipment_id, payload)
    log.info(
        "Optimised %s: chose %s (action=%s, source=%s)",
        shipment_id,
        primary_route.name,
        action,
        source,
    )

    return OptimizeResponse(
        shipment_id=shipment_id,
        primary_route=primary_route,
        alternative_route=alt_route,
        recommendation=explanation_text,
        decision=action,
        quality=primary_quality,
        risk=primary_risk,
    )
