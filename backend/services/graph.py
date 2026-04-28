"""NetworkX-backed supply chain graph with composite edge weights.

Implements Dijkstra (primary) + Yen's K-shortest paths (alternatives) and a
disruption hook that sets disrupted edges' weights to 9999 so the algorithm
naturally avoids them, per spec §3.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Dict, List, Optional, Tuple

import networkx as nx
from models.schemas import RouteGraph, RouteGraphEdge, RouteGraphNode

log = logging.getLogger("chainguard.graph")

# Composite weight defaults (per spec §3 / §4.5)
W_TIME = 0.4
W_COST = 0.3
W_QUALITY = 0.3
DISRUPTED_WEIGHT = 9999.0
DISRUPTION_PENALTIES = {
    "port_congestion": 65.0,
    "weather": 80.0,
    "customs_delay": 45.0,
    "mechanical": 60.0,
    "strike": 95.0,
}

_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "seed_graph.json")

_graph: nx.DiGraph = nx.DiGraph()
_node_meta: Dict[str, dict] = {}
_named_routes: List[dict] = []
_dependencies: Dict[str, List[str]] = {}
_disruptions: Dict[str, dict] = {}  # node_id -> {duration_hrs, type}


def _composite(base_time_hrs: float, cost_usd: float, decay_rate: float) -> float:
    return (W_TIME * base_time_hrs) + (W_COST * (cost_usd / 1000.0)) + (W_QUALITY * decay_rate * 100.0)


def _refresh_edge_weight(edge_data: dict) -> None:
    base = _composite(edge_data["base_time_hrs"], edge_data["cost_usd"], edge_data["decay_rate"])
    edge_data["base_weight"] = round(base, 3)
    penalty = float(edge_data.get("disruption_penalty", 0.0) or 0.0)
    edge_data["weight"] = round(base + penalty, 3)


def _ensure_graph_loaded() -> None:
    if _graph.number_of_nodes() == 0 or not _node_meta:
        init_graph()


def init_graph() -> None:
    """Load the seed graph from JSON into a NetworkX DiGraph."""
    global _graph, _node_meta, _named_routes, _dependencies
    with open(_DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    g = nx.DiGraph()
    _node_meta = {n["id"]: n for n in data["nodes"]}
    for node in data["nodes"]:
        g.add_node(node["id"], **node)

    for edge in data["edges"]:
        weight = _composite(edge["base_time_hrs"], edge["cost_usd"], edge["decay_rate"])
        g.add_edge(
            edge["from"],
            edge["to"],
            weight=weight,
            base_weight=round(weight, 3),
            distance_km=edge["distance_km"],
            base_time_hrs=edge["base_time_hrs"],
            cost_usd=edge["cost_usd"],
            mode=edge["mode"],
            decay_rate=edge["decay_rate"],
            disruption_penalty=0.0,
            disrupted=False,
        )
        # Make graph effectively undirected for routing (return leg same metrics)
        g.add_edge(
            edge["to"],
            edge["from"],
            weight=weight,
            base_weight=round(weight, 3),
            distance_km=edge["distance_km"],
            base_time_hrs=edge["base_time_hrs"],
            cost_usd=edge["cost_usd"],
            mode=edge["mode"],
            decay_rate=edge["decay_rate"],
            disruption_penalty=0.0,
            disrupted=False,
        )

    _graph = g
    _named_routes = data.get("named_routes", [])
    _dependencies = data.get("dependencies", {})
    log.info("Graph loaded: %d nodes, %d edges", g.number_of_nodes(), g.number_of_edges())


# ---------- Disruption handling ----------


def inject_disruption(node_id: str, duration_hrs: float, dtype: str = "port_congestion") -> None:
    """Mark a node as disrupted by adding a typed penalty to incident edges."""
    _ensure_graph_loaded()
    if node_id not in _graph:
        log.warning("inject_disruption: unknown node %s", node_id)
        return
    _disruptions[node_id] = {"duration_hrs": duration_hrs, "type": dtype}
    base_penalty = DISRUPTION_PENALTIES.get(dtype, 50.0)
    duration_multiplier = max(1.0, float(duration_hrs) / 12.0)
    penalty = round(base_penalty * duration_multiplier, 3)
    for u, v in list(_graph.in_edges(node_id)) + list(_graph.out_edges(node_id)):
        _graph[u][v]["disruption_penalty"] = penalty
        _graph[u][v]["disrupted"] = True
        _graph[u][v]["disrupted_node"] = node_id
        _graph[u][v]["disruption_type"] = dtype
        _refresh_edge_weight(_graph[u][v])
    log.info("Disruption injected at %s for %.1fh (%s)", node_id, duration_hrs, dtype)


def clear_disruptions() -> None:
    """Restore original composite weights everywhere."""
    _ensure_graph_loaded()
    _disruptions.clear()
    for u, v, d in _graph.edges(data=True):
        d["disruption_penalty"] = 0.0
        d["disrupted"] = False
        d.pop("disrupted_node", None)
        d.pop("disruption_type", None)
        _refresh_edge_weight(d)


def is_disrupted(node_id: str) -> bool:
    return node_id in _disruptions


def active_disruptions() -> Dict[str, dict]:
    return dict(_disruptions)


# ---------- Routing ----------


def _path_metrics(path: List[str]) -> dict:
    distance = 0.0
    base_time = 0.0
    cost = 0.0
    decay = 0.0
    composite = 0.0
    modes: List[str] = []
    has_disrupted = False
    for u, v in zip(path[:-1], path[1:]):
        ed = _graph[u][v]
        distance += ed["distance_km"]
        base_time += ed["base_time_hrs"]
        cost += ed["cost_usd"]
        decay = max(decay, ed["decay_rate"])
        composite += ed["weight"]
        modes.append(ed["mode"])
        if ed.get("disrupted"):
            has_disrupted = True
    transport_mode = "multimodal"
    if modes and all(m == modes[0] for m in modes):
        transport_mode = modes[0]
    return {
        "distance_km": round(distance, 1),
        "base_eta_hrs": round(base_time, 1),
        "cost_usd": round(cost, 2),
        "max_decay_rate": round(decay, 3),
        "composite_weight": round(composite, 3),
        "transport_mode": transport_mode,
        "uses_disrupted_node": has_disrupted,
    }


def _hydrate_route(name: str, path: List[str], risk_factors: List[str]) -> dict:
    metrics = _path_metrics(path)
    waypoints = [
        {"name": _node_meta[n]["name"], "lat": _node_meta[n]["lat"], "lng": _node_meta[n]["lng"]}
        for n in path
    ]
    return {
        "name": name,
        "path": path,
        "waypoints": waypoints,
        "risk_factors": list(risk_factors),
        **metrics,
    }


def get_named_routes(origin_id: str = "mombasa_port", dest_id: str = "mumbai_port") -> List[dict]:
    """Return the curated set of named routes (Route A / B / C)."""
    _ensure_graph_loaded()
    return [
        _hydrate_route(r["name"], r["path"], r.get("risk_factors", []))
        for r in _named_routes
        if r["path"][0] == origin_id and r["path"][-1] == dest_id
    ]


def shortest_route(origin_id: str, dest_id: str) -> Optional[dict]:
    _ensure_graph_loaded()
    try:
        path = nx.shortest_path(_graph, origin_id, dest_id, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None
    return _hydrate_route("Optimised Path", path, [])


def k_shortest(origin_id: str, dest_id: str, k: int = 3) -> List[dict]:
    """Yen's K-shortest simple paths."""
    _ensure_graph_loaded()
    try:
        gen = nx.shortest_simple_paths(_graph, origin_id, dest_id, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return []
    out: List[dict] = []
    for i, path in enumerate(gen):
        if i >= k:
            break
        out.append(_hydrate_route(f"Path {i + 1}", path, []))
    return out


def primary_and_alternative(
    origin_id: str = "mombasa_port", dest_id: str = "mumbai_port"
) -> Tuple[Optional[dict], Optional[dict]]:
    """Return (primary, alternative) using the curated named routes ordered by composite weight."""
    routes = get_named_routes(origin_id, dest_id)
    routes.sort(key=lambda r: r["composite_weight"])
    primary = routes[0] if routes else None
    alternative = routes[1] if len(routes) >= 2 else None
    return primary, alternative


# ---------- Impact / dependencies ----------


def downstream(node_id: str) -> List[str]:
    """BFS-style downstream traversal using static dependency map."""
    _ensure_graph_loaded()
    visited: List[str] = []
    queue: List[str] = list(_dependencies.get(node_id, []))
    while queue:
        cur = queue.pop(0)
        if cur in visited:
            continue
        visited.append(cur)
        queue.extend(_dependencies.get(cur, []))
    return visited


def node_meta(node_id: str) -> Optional[dict]:
    _ensure_graph_loaded()
    return dict(_node_meta[node_id]) if node_id in _node_meta else None


def all_node_ids() -> List[str]:
    _ensure_graph_loaded()
    return list(_node_meta.keys())


def find_node_id_by_name(name: str) -> Optional[str]:
    _ensure_graph_loaded()
    for node_id, meta in _node_meta.items():
        if meta["name"].lower() == name.lower():
            return node_id
    return None


def export_route_graph(origin_id: str = "mombasa_port", dest_id: str = "mumbai_port") -> RouteGraph:
    """Expose the current graph state for route visualisation and shortest-path animation."""
    _ensure_graph_loaded()
    reachable = {origin_id, dest_id}
    for route in get_named_routes(origin_id, dest_id):
        reachable.update(route["path"])

    nodes: List[RouteGraphNode] = []
    for node_id in sorted(reachable, key=lambda nid: (_node_meta[nid]["lng"], _node_meta[nid]["lat"])):
        meta = _node_meta[node_id]
        kind = "stage"
        if node_id == origin_id:
            kind = "source"
        elif node_id == dest_id:
            kind = "destination"
        nodes.append(
            RouteGraphNode(
                id=node_id,
                name=meta["name"],
                lat=meta["lat"],
                lng=meta["lng"],
                kind=kind,
                disrupted=is_disrupted(node_id),
            )
        )

    edges: List[RouteGraphEdge] = []
    for u, v, data in _graph.edges(data=True):
        if u not in reachable or v not in reachable:
            continue
        edges.append(
            RouteGraphEdge(
                source=u,
                target=v,
                distance_km=round(float(data["distance_km"]), 1),
                base_eta_hrs=round(float(data["base_time_hrs"]), 1),
                composite_weight=round(float(data["weight"]), 3),
                disruption_penalty=round(float(data.get("disruption_penalty", 0.0) or 0.0), 3),
                is_disrupted=bool(data.get("disrupted")),
            )
        )
    return RouteGraph(nodes=nodes, edges=edges)
