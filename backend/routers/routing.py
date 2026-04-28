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
import math
import uuid
from datetime import datetime, timezone
from typing import Tuple

from fastapi import APIRouter

from models.schemas import (
    OptimizeRequest,
    OptimizeResponse,
    QualityResult,
    RiskResult,
    Route,
    RouteGraph,
    RouteGraphEdge,
    RouteGraphNode,
)
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

STAGE_DISRUPTION_PENALTY = 0.45


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _lvl_score(value: str | None, *, low: float = 0.0, medium: float = 0.5, high: float = 1.0) -> float:
    v = (value or "").lower()
    if v == "low":
        return low
    if v == "medium":
        return medium
    if v == "high":
        return high
    return 0.0


def _clamp01(v: float) -> float:
    return min(1.0, max(0.0, float(v)))


def _edge_score(delay: float, congestion: float, weather: float, temp_risk: float = 0.0) -> float:
    # Required minimal formula:
    # 0.4*delay + 0.3*congestion + 0.2*weather + 0.1*temp_risk
    return round(
        0.4 * _clamp01(delay)
        + 0.3 * _clamp01(congestion)
        + 0.2 * _clamp01(weather)
        + 0.1 * _clamp01(temp_risk),
        4,
    )


def _stage_edge_score(stage) -> tuple[float, list[str]]:
    stage_type = (stage.stage_type or "distribution").lower()
    delay = 0.0
    congestion = 0.0
    weather = 0.0
    temp_risk = 0.0
    factors: list[str] = []

    if stage_type == "port":
        delay = _clamp01((float(stage.average_delay_hours or 0.0) + float(stage.customs_clearance_hours or 0.0)) / 24.0)
        congestion = _lvl_score(stage.congestion_level)
        weather = 1.0 if (stage.weather_condition or "normal") == "risky" else 0.0
        if congestion >= 0.5:
            factors.append("port_congestion")
        if weather > 0:
            factors.append("risky_weather")
    elif stage_type == "warehouse":
        delay = _clamp01(float(stage.processing_delay_hours or 0.0) / 24.0)
        congestion = _clamp01(float(stage.capacity_utilization_pct or 0.0) / 100.0)
        weather = 0.0
        temp_risk = 1.0 if (stage.temperature_status or "safe") == "unsafe" else 0.0
        if temp_risk > 0:
            factors.append("cold_chain_risk")
    elif stage_type == "distribution":
        delay = _clamp01(float(stage.dispatch_delay_hours or 0.0) / 24.0)
        demand = _lvl_score(stage.demand_level)
        traffic = _lvl_score(stage.local_traffic_level)
        congestion = _clamp01((demand + traffic) / 2.0)
        weather = 0.0
        if traffic >= 0.5:
            factors.append("local_traffic")
    else:
        delay = _clamp01(float(stage.dispatch_delay_hours or 0.0) / 24.0)
        congestion = _clamp01((_lvl_score(stage.demand_level) + _lvl_score(stage.local_traffic_level)) / 2.0)
        weather = 0.0
        temp_risk = 0.0
    if stage.disrupted:
        factors.append("stage_disrupted")

    score = _edge_score(delay, congestion, weather, temp_risk)
    if stage.disrupted:
        score = round(score + STAGE_DISRUPTION_PENALTY, 4)
    return score, factors


def _destination_edge_score(destination, deadline_hours: int) -> float:
    demand = _lvl_score(destination.demand_level)
    deadline = float(destination.delivery_deadline_hours or deadline_hours or 72.0)
    # tighter deadline => higher delay pressure
    delay = _clamp01((72.0 - min(max(deadline, 1.0), 72.0)) / 72.0)
    congestion = demand
    weather = 0.0
    temp_risk = 0.0
    return _edge_score(delay, congestion, weather, temp_risk)


def _build_dynamic_route(req: OptimizeRequest) -> tuple[dict, RouteGraph]:
    source = req.source
    destination = req.destination_point
    stages = req.stages or []
    if source is None or destination is None or not stages:
        raise ValueError("source, destination_point and at least one stage are required")

    points = [source] + stages + [destination]
    node_ids = [f"n{i}" for i in range(len(points))]
    nodes: list[RouteGraphNode] = []
    edges: list[RouteGraphEdge] = []

    total_distance = 0.0
    total_eta = 0.0
    total_cost = 0.0
    composite = 0.0
    risk_factors: list[str] = []

    for i, p in enumerate(points):
        kind = "stage"
        if i == 0:
            kind = "source"
        elif i == len(points) - 1:
            kind = "destination"
        nodes.append(
            RouteGraphNode(
                id=node_ids[i],
                name=p.name,
                lat=p.lat,
                lng=p.lng,
                kind=kind,
                disrupted=bool(getattr(p, "disrupted", False)),
            )
        )

    for i in range(len(points) - 1):
        a = points[i]
        b = points[i + 1]
        stage = stages[i] if i < len(stages) else None
        is_to_destination = i == len(points) - 2
        dist = round(_haversine_km(a.lat, a.lng, b.lat, b.lng), 1)
        base_eta = max(2.0, dist / 38.0)
        stage_score = 0.0
        stage_factors: list[str] = []
        if is_to_destination and destination is not None:
            stage_score = _destination_edge_score(destination, req.deadline_hours)
            if (destination.demand_level or "low") in {"medium", "high"}:
                stage_factors.append("destination_demand")
        elif stage is not None:
            stage_score, stage_factors = _stage_edge_score(stage)
            risk_factors.extend(stage_factors)

        # stage_score (0..1) increases effective segment ETA
        eta = round(base_eta * (1.0 + stage_score), 1)
        cost = dist * 0.9
        segment_weight = stage_score

        total_distance += dist
        total_eta += eta
        total_cost += cost
        composite += segment_weight
        if dist > 1800:
            risk_factors.append("long_haul")

        edges.append(
            RouteGraphEdge(
                source=node_ids[i],
                target=node_ids[i + 1],
                distance_km=dist,
                base_eta_hrs=eta,
                composite_weight=round(segment_weight, 4),
                disruption_penalty=round(
                    STAGE_DISRUPTION_PENALTY if getattr(stage, "disrupted", False) and not is_to_destination else 0.0,
                    4,
                ),
                is_disrupted=bool(getattr(stage, "disrupted", False)) and not is_to_destination,
            )
        )

    route = {
        "name": "User Defined Route",
        "path": [n.id for n in nodes],
        "waypoints": [{"name": n.name, "lat": n.lat, "lng": n.lng} for n in nodes],
        "risk_factors": sorted(set(risk_factors)) or ["custom_stage_network"],
        "distance_km": round(total_distance, 1),
        "base_eta_hrs": round(total_eta, 1),
        "cost_usd": round(total_cost, 2),
        "max_decay_rate": 0.02,
        "composite_weight": round(composite, 3),
        "transport_mode": "multimodal",
        "uses_disrupted_node": False,
    }
    return route, RouteGraph(nodes=nodes, edges=edges)


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

    quality, status, loss, remaining, curve, delay_impact = quality_engine.predict(
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
        **delay_impact,
    )
    return pyd_route, risk_obj, quality_obj


@router.post("/optimize-route", response_model=OptimizeResponse)
def optimize_route(req: OptimizeRequest) -> OptimizeResponse:
    route_graph: RouteGraph | None = None
    if req.source and req.destination_point and req.stages:
        dynamic_route, route_graph = _build_dynamic_route(req)
        routes = [dynamic_route]
    else:
        routes = graph_service.get_named_routes()
        route_graph = graph_service.export_route_graph()
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
        route_graph=route_graph,
    )
