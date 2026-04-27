"""POST /inject-disruption -- apply a disruption and re-evaluate the shipment."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.schemas import (
    Decision,
    DisruptionRequest,
    DisruptionResponse,
    QualityResult,
    RiskResult,
    Route,
)
from services import (
    decision_engine,
    firestore as fs_service,
    gemini,
    graph as graph_service,
    quality_engine,
    risk_engine,
)

router = APIRouter(tags=["disruption"])
log = logging.getLogger("chainguard.disruption")


@router.post("/inject-disruption", response_model=DisruptionResponse)
def inject_disruption(req: DisruptionRequest) -> DisruptionResponse:
    shipment = fs_service.get_doc("shipments", req.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment {req.shipment_id} not found")

    node_id = graph_service.find_node_id_by_name(req.node_name)
    if not node_id:
        raise HTTPException(status_code=400, detail=f"Unknown node: {req.node_name}")

    graph_service.inject_disruption(node_id, req.duration_hrs, req.disruption_type)

    # Re-evaluate routes with disruption applied
    routes = graph_service.get_named_routes()
    enriched = []
    for r in routes:
        last = r["waypoints"][-1]["name"] if r["waypoints"] else ""
        weather_score = 90 if r.get("uses_disrupted_node") else 35
        congestion = 100 if r.get("uses_disrupted_node") else 30
        risk_final, delay_prob, _, level, factors = risk_engine.score(
            distance_km=r["distance_km"],
            base_eta_hrs=r["base_eta_hrs"],
            weather_score=weather_score,
            congestion_level=congestion,
            day_of_week=datetime.now(timezone.utc).weekday(),
            transport_mode=r["transport_mode"],
        )
        extra_delay = req.duration_hrs if r.get("uses_disrupted_node") else 0.0
        q, status, loss, remaining, curve = quality_engine.predict(
            elapsed_hours=r["base_eta_hrs"],
            delay_hours=extra_delay,
            temp_celsius=shipment.get("current_temp_celsius", 9.0),
        )
        enriched.append(
            (
                Route(
                    name=r["name"],
                    waypoints=r["waypoints"],
                    distance_km=r["distance_km"],
                    base_eta_hrs=r["base_eta_hrs"] + extra_delay,
                    risk_factors=r["risk_factors"] + factors,
                    risk_score=risk_final,
                    delay_prob=delay_prob,
                    quality_at_arrival=q,
                    composite_weight=r["composite_weight"],
                    cost_usd=r["cost_usd"],
                    transport_mode=r["transport_mode"],
                ),
                RiskResult(
                    route_id=r["name"],
                    risk_score=risk_final,
                    delay_prob=delay_prob,
                    risk_level=level,  # type: ignore[arg-type]
                    factors=factors,
                    rule_score=risk_final,
                    ml_score=delay_prob * 100.0,
                ),
                QualityResult(
                    cargo_type=shipment.get("cargo_type", "avocados"),
                    quality_score=q,
                    status=status,  # type: ignore[arg-type]
                    economic_loss_pct=loss,
                    remaining_shelf_life_hrs=remaining,
                    decay_curve=curve,
                ),
            )
        )

    # Pick best (lowest composite weight + not disrupted preferred)
    enriched.sort(key=lambda t: (t[0].risk_factors.count("severe_weather"), t[0].composite_weight))
    new_primary, new_risk, new_quality = enriched[0]
    alt = enriched[1][0] if len(enriched) > 1 else None

    action, primary_factor, rationale = decision_engine.decide(
        quality_score=new_quality.quality_score,
        risk_score=new_risk.risk_score,
    )

    explanation_text, source, _factors = gemini.explain_decision(
        route_a=new_primary.model_dump(),
        route_b=alt.model_dump() if alt else None,
        decision=action,
        primary_factor=primary_factor,
        cargo_type=shipment.get("cargo_type", "avocados"),
        current_quality=new_quality.quality_score,
        disruption_desc=f"{req.disruption_type} at {req.node_name} for {req.duration_hrs:.0f}h",
    )

    disruption_record = {
        "disruption_type": req.disruption_type,
        "node_name": req.node_name,
        "duration_hrs": req.duration_hrs,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    shipment["disruptions"] = (shipment.get("disruptions") or []) + [disruption_record]
    shipment["routes"] = [new_primary.model_dump()] + ([alt.model_dump()] if alt else [])
    shipment["selected_route"] = new_primary.name
    shipment["decision"] = action
    shipment["explanation"] = explanation_text
    shipment["explanation_source"] = source
    fs_service.set_doc("shipments", req.shipment_id, shipment)

    log.info(
        "Disruption applied to %s: new decision=%s, route=%s",
        req.shipment_id,
        action,
        new_primary.name,
    )

    return DisruptionResponse(
        shipment_id=req.shipment_id,
        disruption=disruption_record,
        updated_risk=new_risk,
        updated_quality=new_quality,
        new_decision=Decision(
            action=action,  # type: ignore[arg-type]
            rationale=rationale,
            primary_factor=primary_factor,
        ),
        new_route=new_primary,
    )


@router.post("/clear-disruptions", tags=["disruption"])
def clear_disruptions() -> dict:
    graph_service.clear_disruptions()
    return {"status": "cleared", "active": graph_service.active_disruptions()}
