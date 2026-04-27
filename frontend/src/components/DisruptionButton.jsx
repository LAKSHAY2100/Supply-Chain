import React, { useState } from "react";
import { useStore } from "../store/useStore.js";

const NODES = ["Colombo Port", "Dubai", "Suez", "Mombasa, Kenya"];
const TYPES = ["port_congestion", "weather", "customs_delay", "mechanical", "strike"];

export default function DisruptionButton() {
  const inject = useStore((s) => s.injectDisruption);
  const loading = useStore((s) => s.loadingDisruption);
  const shipmentId = useStore((s) => s.shipmentId);
  const disruptions = useStore((s) => s.disruptions);

  const [open, setOpen] = useState(false);
  const [node, setNode] = useState("Colombo Port");
  const [dtype, setType] = useState("port_congestion");
  const [hrs, setHrs] = useState(12);

  const submit = async (e) => {
    e.preventDefault();
    await inject({ node_name: node, disruption_type: dtype, duration_hrs: Number(hrs) });
    setOpen(false);
  };

  return (
    <div className="glass p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Disruption simulator</h3>
        {disruptions.length > 0 && (
          <span className="text-[10px] uppercase tracking-wider text-amber-400">
            {disruptions.length} active
          </span>
        )}
      </div>

      {!open ? (
        <button
          disabled={!shipmentId}
          onClick={() => setOpen(true)}
          className="w-full py-2.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Inject disruption
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              Node
            </label>
            <select
              value={node}
              onChange={(e) => setNode(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200"
            >
              {NODES.map((n) => (
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
                className="w-full px-2 py-1.5 rounded bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                Hours
              </label>
              <input
                type="number"
                min="1"
                value={hrs}
                onChange={(e) => setHrs(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-500 text-sm text-white font-medium disabled:opacity-50"
            >
              {loading ? "Applying..." : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded border border-slate-700 text-sm text-slate-300 hover:bg-slate-800/40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {disruptions.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-400 max-h-32 overflow-y-auto scrollbar-thin">
          {disruptions.map((d, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-slate-900/40 border border-slate-800/50 rounded px-2 py-1"
            >
              <span>
                <span className="text-rose-300">{d.disruption_type}</span> @ {d.node_name}
              </span>
              <span className="text-slate-500">{d.duration_hrs}h</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
