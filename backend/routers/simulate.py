"""POST /simulate-impact -- cascade-effect estimator."""

from __future__ import annotations

from fastapi import APIRouter

from models.schemas import SimulateRequest, SimulateResponse
from services import firestore as fs_service
from services import gemini
from services import graph as graph_service

router = APIRouter(tags=["simulate"])


@router.post("/simulate-impact", response_model=SimulateResponse)
def simulate_impact(req: SimulateRequest) -> SimulateResponse:
    downstream_ids = graph_service.downstream(req.disrupted_node_id)
    affected_nodes = [
        graph_service.node_meta(nid)["name"]
        for nid in downstream_ids
        if graph_service.node_meta(nid)
    ]

    # Estimate shipment impact: count active shipments touching the disrupted node.
    shipments = fs_service.list_docs("shipments")
    affected_shipments = 0
    for shp in shipments:
        for route in shp.get("routes", []) or []:
            for wp in route.get("waypoints", []) or []:
                if wp.get("name") == graph_service.node_meta(req.disrupted_node_id)["name"]:
                    affected_shipments += 1
                    break

    affected_operations = max(1, len(affected_nodes))
    total_delay = req.delay_hours * (1 + 0.4 * len(affected_nodes))
    economic_impact = affected_shipments * 35000.0 + total_delay * 1200.0

    narrative = gemini.explain_impact(
        disruption_type="port_congestion",
        node_name=graph_service.node_meta(req.disrupted_node_id)["name"],
        delay_hours=req.delay_hours,
        affected_nodes=affected_nodes,
        shipment_count=affected_shipments,
        total_delay_hrs=total_delay,
        economic_value=economic_impact,
    )

    return SimulateResponse(
        affected_nodes=affected_nodes,
        affected_shipments=affected_shipments,
        affected_operations=affected_operations,
        estimated_total_delay_hrs=round(total_delay, 1),
        economic_impact_usd=round(economic_impact, 2),
        narrative=narrative,
    )
