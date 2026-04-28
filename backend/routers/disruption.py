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
)

router = APIRouter(tags=["disruption"])
log = logging.getLogger("chainguard.disruption")
CUSTOM_ROUTE_DISRUPTION_PENALTIES = {
    "port_congestion": 0.5,
    "weather": 0.7,
    "customs_delay": 0.4,
    "mechanical": 0.55,
    "strike": 0.8,
}


def _build_custom_route_graph(routes: list[dict], disrupted_name: str, disruption_type: str) -> RouteGraph | None:
    if not routes:
        return None

    nodes: list[RouteGraphNode] = []
    edges: list[RouteGraphEdge] = []
    node_index: dict[str, int] = {}
    penalty = CUSTOM_ROUTE_DISRUPTION_PENALTIES.get(disruption_type, 0.5)

    def ensure_node(wp: dict, idx: int, total: int) -> str:
        key = str(wp.get("name") or f"node-{idx}")
        if key in node_index:
            return f"n{node_index[key]}"
        node_index[key] = len(nodes)
        kind = "stage"
        if idx == 0:
            kind = "source"
        elif idx == total - 1:
            kind = "destination"
        nodes.append(
            RouteGraphNode(
                id=f"n{node_index[key]}",
                name=key,
                lat=float(wp.get("lat", 0.0) or 0.0),
                lng=float(wp.get("lng", 0.0) or 0.0),
                kind=kind,
                disrupted=key.lower() == disrupted_name.lower(),
            )
        )
        return nodes[-1].id

    for route in routes:
        waypoints = route.get("waypoints") or []
        if len(waypoints) < 2:
            continue
        per_edge_distance = float(route.get("distance_km", 0.0) or 0.0) / max(1, len(waypoints) - 1)
        per_edge_eta = float(route.get("base_eta_hrs", 0.0) or 0.0) / max(1, len(waypoints) - 1)
        per_edge_weight = float(route.get("composite_weight", 0.0) or 0.0) / max(1, len(waypoints) - 1)
        for idx in range(len(waypoints) - 1):
            src = ensure_node(waypoints[idx], idx, len(waypoints))
            dst = ensure_node(waypoints[idx + 1], idx + 1, len(waypoints))
            src_name = str(waypoints[idx].get("name", ""))
            dst_name = str(waypoints[idx + 1].get("name", ""))
            edge_disrupted = disrupted_name.lower() in {src_name.lower(), dst_name.lower()}
            edges.append(
                RouteGraphEdge(
                    source=src,
                    target=dst,
                    distance_km=round(per_edge_distance, 1),
                    base_eta_hrs=round(per_edge_eta, 1),
                    composite_weight=round(per_edge_weight + (penalty if edge_disrupted else 0.0), 3),
                    disruption_penalty=round(penalty if edge_disrupted else 0.0, 3),
                    is_disrupted=edge_disrupted,
                )
            )

    return RouteGraph(nodes=nodes, edges=edges) if nodes and edges else None


@router.post("/inject-disruption", response_model=DisruptionResponse)
def inject_disruption(req: DisruptionRequest) -> DisruptionResponse:
    shipment = fs_service.get_doc("shipments", req.shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail=f"Shipment {req.shipment_id} not found")

    node_id = graph_service.find_node_id_by_name(req.node_name)
    custom_route_mode = node_id is None
    route_graph = None
    if not custom_route_mode:
        graph_service.inject_disruption(node_id, req.duration_hrs, req.disruption_type)
        # Re-evaluate routes with disruption applied
        routes = graph_service.get_named_routes()
        route_graph = graph_service.export_route_graph()
    else:
        # Fallback for user-defined dynamic stage names that are not in seed graph.
        # Re-score currently stored shipment routes by adding disruption penalties
        # when the disrupted node appears in the route waypoints.
        routes = []
        for r in shipment.get("routes") or []:
            routes.append(
                {
                    "name": r.get("name", "User Defined Route"),
                    "waypoints": r.get("waypoints", []),
                    "distance_km": float(r.get("distance_km", 0.0)),
                    "base_eta_hrs": float(r.get("base_eta_hrs", 0.0)),
                    "risk_factors": list(r.get("risk_factors", [])),
                    "composite_weight": float(r.get("composite_weight", 0.0)),
                    "cost_usd": float(r.get("cost_usd", 0.0)),
                    "transport_mode": r.get("transport_mode", "multimodal"),
                    "uses_disrupted_node": any(
                        str(wp.get("name", "")).lower() == req.node_name.lower()
                        for wp in r.get("waypoints", [])
                    ),
                }
            )
        if not routes:
            raise HTTPException(status_code=400, detail=f"Unknown node: {req.node_name}")
        route_graph = _build_custom_route_graph(routes, req.node_name, req.disruption_type)
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
        q, status, loss, remaining, curve, delay_impact = quality_engine.predict(
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
                    **delay_impact,
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
        route_graph=route_graph,
    )


@router.post("/clear-disruptions", tags=["disruption"])
def clear_disruptions() -> dict:
    graph_service.clear_disruptions()
    return {"status": "cleared", "active": graph_service.active_disruptions()}
