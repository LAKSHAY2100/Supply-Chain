import React, { useState } from "react";
import { useStore } from "../store/useStore.js";

const TYPES = ["port_congestion", "weather", "customs_delay", "mechanical", "strike"];

export default function DisruptionButton() {
  const inject = useStore((s) => s.injectDisruption);
  const loading = useStore((s) => s.loadingDisruption);
  const shipmentId = useStore((s) => s.shipmentId);
  const disruptions = useStore((s) => s.disruptions);
  const builder = useStore((s) => s.builder);
  const primaryRoute = useStore((s) => s.primaryRoute);

  const [open, setOpen] = useState(false);
  const dynamicNodes = [
    ...(builder?.stages || []).map((s) => s.name).filter(Boolean),
    ...(builder?.stages || [])
      .flatMap((s) => s.subStages || [])
      .map((sub) => sub.name)
      .filter(Boolean),
  ];
  const routeNodes = (primaryRoute?.waypoints || []).map((w) => w.name).filter(Boolean);
  const nodes = Array.from(new Set([...(dynamicNodes.length ? dynamicNodes : routeNodes)]));
  const [node, setNode] = useState(nodes[0] || "");
  React.useEffect(() => {
    if (!nodes.length) return;
    if (!nodes.includes(node)) setNode(nodes[0]);
  }, [nodes, node]);
  const [dtype, setType] = useState("port_congestion");
  const [hrs, setHrs] = useState(12);

  const submit = async (e) => {
    e.preventDefault();
    await inject({ node_name: node, disruption_type: dtype, duration_hrs: Number(hrs) });
    setOpen(false);
  };

  return (
    <div className="cg-card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">Disruption simulator</h3>
        {disruptions.length > 0 && (
          <span className="cg-badge" style={{ color: "var(--cg-warn)", borderColor: "#f2d18f", background: "var(--cg-warn-soft)" }}>
            {disruptions.length} active
          </span>
        )}
      </div>

      {!open ? (
        <button
          disabled={!shipmentId || nodes.length === 0}
          onClick={() => setOpen(true)}
            className="w-full rounded-lg bg-[var(--cg-critical)] py-2.5 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nodes.length === 0 ? "No stage nodes available" : "Inject disruption"}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="cg-muted mb-1 block text-[11px] uppercase tracking-wider">
              Node
            </label>
            <select
              value={node}
              onChange={(e) => setNode(e.target.value)}
              className="cg-input"
            >
              {nodes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                Type
              </label>
              <select
                value={dtype}
                onChange={(e) => setType(e.target.value)}
                className="cg-input"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cg-muted mb-1 block text-[11px] uppercase tracking-wider">
                Hours
              </label>
              <input
                type="number"
                min="1"
                value={hrs}
                onChange={(e) => setHrs(e.target.value)}
                className="cg-input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded bg-[var(--cg-critical)] py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-50"
            >
              {loading ? "Applying..." : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cg-muted rounded border border-[var(--cg-border)] px-3 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {disruptions.length > 0 && (
        <ul className="scrollbar-thin max-h-32 space-y-1 overflow-y-auto text-xs">
          {disruptions.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded border border-[var(--cg-border)] bg-slate-50 px-2 py-1 text-slate-700"
            >
              <span>
                <span style={{ color: "var(--cg-critical)" }}>{d.disruption_type}</span> @ {d.node_name}
              </span>
              <span className="cg-muted">{d.duration_hrs}h</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
