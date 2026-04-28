import React from "react";
import { useStore } from "../store/useStore.js";
import { buildLiveGraph } from "../lib/routeGraph.js";

export default function StageGraphSection() {
  const builder = useStore((s) => s.builder);
  const form = useStore((s) => s.form);
  const loadingOptimize = useStore((s) => s.loadingOptimize);
  const routeGraph = useStore((s) => s.routeGraph);
  const liveGraph = buildLiveGraph(builder, form);
  const graph = React.useMemo(
    () => normalizeGraph(routeGraph || liveGraph),
    [routeGraph, liveGraph],
  );
  const [animProgress, setAnimProgress] = React.useState(0);
  const [showTraverse, setShowTraverse] = React.useState(false);
  const prevLoadingRef = React.useRef(false);
  const orderedNodes = React.useMemo(() => sortNodes(graph?.nodes || []), [graph]);
  const width = 760;
  const height = 280;
  const xStep = orderedNodes.length > 1 ? (width - 80) / (orderedNodes.length - 1) : width - 80;
  const points = orderedNodes.map((node, index) => {
    const y =
      node.kind === "source"
        ? 74
        : node.kind === "destination"
          ? 206
          : node.disrupted
            ? 194
            : 108 + (index % 3) * 40;
    return { ...node, x: 40 + index * xStep, y };
  });
  const byId = Object.fromEntries(points.map((p) => [p.id, p]));
  const { pathNodeIds, pathEdgeIds, pathSegments, totalPathScore } = React.useMemo(
    () => shortestPath(graph),
    [graph],
  );

  if (!graph) {
    return (
      <div className="cg-card p-5">
        <h3 className="cg-title text-sm font-semibold">Stage graph</h3>
        <p className="cg-muted mt-1 text-xs">
          Add stages in builder to generate nodes and edges.
        </p>
      </div>
    );
  }

  React.useEffect(() => {
    setAnimProgress(0);
  }, [graph?.nodes?.length, graph?.edges?.length]);

  React.useEffect(() => {
    if (!pathSegments.length) return undefined;
    let raf = 0;
    let start = 0;
    const duration = 1800;
    const step = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(1, elapsed / duration);
      setAnimProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pathSegments.length, graph, showTraverse]);
  const isInputMode = loadingOptimize || pathSegments.length === 0;

  React.useEffect(() => {
    if (loadingOptimize && !prevLoadingRef.current) {
      setAnimProgress(0);
      setShowTraverse(true);
    }
    if (!loadingOptimize && prevLoadingRef.current) {
      const t = setTimeout(() => setShowTraverse(false), 1800);
      prevLoadingRef.current = loadingOptimize;
      return () => clearTimeout(t);
    }
    prevLoadingRef.current = loadingOptimize;
    return undefined;
  }, [loadingOptimize]);

  const pointer = React.useMemo(
    () => pointAlongPath(pathSegments, animProgress),
    [pathSegments, animProgress],
  );

  return (
    <div className="cg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="cg-title text-sm font-semibold">Stage score graph</h3>
          <p className="cg-muted text-[11px]">
            Nodes and edges are built live from source, stages, substages, and destination.
          </p>
        </div>
          <div className="cg-badge cg-muted">
            nodes {graph.nodes.length} | edges {graph.edges.length} | best path {totalPathScore.toFixed(2)}
          </div>
      </div>

      <div className="overflow-x-auto rounded border border-[var(--cg-border)] bg-white p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[700px]">
          {graph.edges.map((edge) => {
            const a = byId[edge.source];
            const b = byId[edge.target];
            if (!a || !b) return null;
            const isPath = edge.type === "route_path";
            const isBranch = edge.type === "substage_route";
            const isBest = !isInputMode && pathEdgeIds.has(edge.id);
            return (
              <g key={edge.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={edge.is_disrupted ? "#dc2626" : isPath ? "#94a3b8" : isBranch ? "#bfdbfe" : "#cbd5e1"}
                  strokeWidth={isPath ? 2 : isBranch ? 1.7 : 1.2}
                  strokeDasharray={isPath ? "6 4" : isBranch ? "7 3" : "4 3"}
                  opacity={isInputMode ? 0.9 : isBest ? 0.9 : 0.45}
                />
                {typeof edge.score === "number" ? (
                  <g transform={`translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 11})`}>
                    <rect x="-20" y="-10" width="40" height="20" rx="7" fill="white" stroke={edge.is_disrupted ? "#fecaca" : "#d6deef"} />
                    <text textAnchor="middle" y="4" fontSize="9.5" fill="#334155" fontWeight="700">
                      {edge.score.toFixed(2)}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {showTraverse && pathNodeIds.length > 1 ? (
            <polyline
              points={pathNodeIds
                .map((id) => byId[id])
                .filter(Boolean)
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.4"
              strokeDasharray="9 7"
              style={{ animation: "pathTraverse 0.9s linear infinite" }}
              opacity="0.9"
            />
          ) : null}

          {points.map((p) => (
            <g key={p.id} transform={`translate(${p.x},${p.y})`}>
              {p.disrupted ? <circle r="16" fill="#ffeaea" /> : null}
              <circle
                r="10"
                fill={
                  p.kind === "source"
                    ? "#1f9960"
                    : p.kind === "destination"
                      ? "#426eff"
                      : p.disrupted
                        ? "#c04949"
                        : "#dfe7fb"
                }
                stroke="#fff"
                strokeWidth="2.5"
              />
              <text x="0" y="26" textAnchor="middle" fontSize="10" fill="#334155" fontWeight="600">
                {truncate(p.name, 14)}
              </text>
            </g>
          ))}

          {pointer && showTraverse ? (
            <g transform={`translate(${pointer.x},${pointer.y})`}>
              <circle r="8" fill="#dbeafe" opacity="0.8" />
              <circle r="4.5" fill="#2563eb" stroke="white" strokeWidth="1.5" />
            </g>
          ) : null}
        </svg>
      </div>
      <style>{`
        @keyframes pathTraverse {
          to { stroke-dashoffset: -32; }
        }
      `}</style>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-3">
          <div className="cg-muted mb-2 text-[11px] uppercase tracking-wider">Nodes</div>
          <div className="max-h-36 space-y-1 overflow-y-auto text-xs">
            {orderedNodes.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded bg-white px-2 py-1">
                <span className="text-slate-700">{n.name}</span>
                <span className="cg-muted">{n.kind}{n.disrupted ? " | disrupted" : ""}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-3">
          <div className="cg-muted mb-2 text-[11px] uppercase tracking-wider">Edges</div>
          <div className="max-h-36 space-y-1 overflow-y-auto text-xs">
            {graph.edges.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded bg-white px-2 py-1">
                <span className="text-slate-700">
                  {byId[e.source]?.name || e.source} -&gt; {byId[e.target]?.name || e.target}
                </span>
                <span className="cg-muted">
                  {e.type === "route_path" ? "main path" : e.type === "substage_route" ? "branch route" : "attach"}
                  {typeof e.score === "number" ? ` | score ${e.score.toFixed(2)}` : ""}
                  {e.disruption_penalty ? ` | penalty +${Number(e.disruption_penalty).toFixed(2)}` : ""}
                  {pathEdgeIds.has(e.id) ? " | selected" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function truncate(value, max = 12) {
  return value.length > max ? `${value.slice(0, max - 2)}...` : value;
}

function shortestPath(graph) {
  if (!graph) {
    return { pathNodeIds: [], pathEdgeIds: new Set(), pathSegments: [], totalPathScore: 0 };
  }
  const nodes = graph.nodes || [];
  const edges = (graph.edges || []).filter((e) => Number.isFinite(Number(e.score)));
  const src = nodes.find((n) => n.kind === "source")?.id || "src";
  const dst = nodes.find((n) => n.kind === "destination")?.id || "dst";
  const adj = {};
  nodes.forEach((n) => {
    adj[n.id] = [];
  });
  edges.forEach((e) => {
    adj[e.source]?.push(e);
  });

  const dist = {};
  const prevNode = {};
  const prevEdge = {};
  nodes.forEach((n) => {
    dist[n.id] = Number.POSITIVE_INFINITY;
  });
  dist[src] = 0;
  const unvisited = new Set(nodes.map((n) => n.id));

  while (unvisited.size) {
    let u = null;
    let best = Number.POSITIVE_INFINITY;
    for (const id of unvisited) {
      if (dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (!u || best === Number.POSITIVE_INFINITY) break;
    unvisited.delete(u);
    if (u === dst) break;

    for (const e of adj[u] || []) {
      const v = e.target;
      if (!unvisited.has(v)) continue;
      const w = Number(e.score);
      const alt = dist[u] + w;
      if (alt < dist[v]) {
        dist[v] = alt;
        prevNode[v] = u;
        prevEdge[v] = e.id;
      }
    }
  }

  if (!Number.isFinite(dist[dst])) {
    return { pathNodeIds: [], pathEdgeIds: new Set(), pathSegments: [], totalPathScore: 0 };
  }

  const pathNodeIds = [];
  const pathEdgeIdsArr = [];
  let cur = dst;
  while (cur) {
    pathNodeIds.push(cur);
    if (!prevNode[cur]) break;
    pathEdgeIdsArr.push(prevEdge[cur]);
    cur = prevNode[cur];
  }
  pathNodeIds.reverse();
  pathEdgeIdsArr.reverse();

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const pathSegments = [];
  for (let i = 0; i < pathNodeIds.length - 1; i += 1) {
    const a = byId[pathNodeIds[i]];
    const b = byId[pathNodeIds[i + 1]];
    if (!a || !b) continue;
    pathSegments.push({ a, b });
  }
  return {
    pathNodeIds,
    pathEdgeIds: new Set(pathEdgeIdsArr),
    pathSegments,
    totalPathScore: dist[dst],
  };
}

function sortNodes(nodes) {
  return [...(nodes || [])].sort((a, b) => {
    const rank = { source: 0, stage: 1, substage: 2, destination: 3 };
    const diff = (rank[a.kind] ?? 1) - (rank[b.kind] ?? 1);
    if (diff !== 0) return diff;
    return Number(a.lng || 0) - Number(b.lng || 0);
  });
}

function pointAlongPath(pathSegments, progress) {
  if (!pathSegments.length) return null;
  const lens = pathSegments.map((s) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y));
  const total = lens.reduce((a, b) => a + b, 0);
  if (total <= 0) return { x: pathSegments[0].a.x, y: pathSegments[0].a.y };
  let d = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < pathSegments.length; i += 1) {
    const segLen = lens[i];
    if (d <= segLen) {
      const t = segLen === 0 ? 0 : d / segLen;
      return {
        x: pathSegments[i].a.x + (pathSegments[i].b.x - pathSegments[i].a.x) * t,
        y: pathSegments[i].a.y + (pathSegments[i].b.y - pathSegments[i].a.y) * t,
      };
    }
    d -= segLen;
  }
  const last = pathSegments[pathSegments.length - 1];
  return { x: last.b.x, y: last.b.y };
}

function normalizeGraph(graph) {
  if (!graph) return null;
  return {
    nodes: graph.nodes || [],
    edges: (graph.edges || []).map((edge) => ({
      ...edge,
      id: edge.id || `${edge.source}->${edge.target}`,
      type: edge.type || "route_path",
      score:
        typeof edge.score === "number"
          ? edge.score
          : Number.isFinite(Number(edge.composite_weight))
            ? Number(edge.composite_weight)
            : null,
    })),
  };
}
