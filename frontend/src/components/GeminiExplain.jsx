import React from "react";
import { useStore } from "../store/useStore.js";

export default function GeminiExplain() {
  const recommendation = useStore((s) => s.recommendation);
  const decision = useStore((s) => s.decision);
  const cap = useStore((s) => s.capabilities);
  const impact = useStore((s) => s.impact);

  if (!recommendation) {
    return (
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Gemini explanation</h3>
        <p className="text-xs text-slate-500">Optimise to get a natural-language reasoning.</p>
      </div>
    );
  }

  const source = cap?.gemini ? "Gemini Pro" : "Template fallback";

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">AI reasoning</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {source}
        </span>
      </div>

      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
        {recommendation}
      </div>

      {impact && (
        <div className="border-t border-slate-800/60 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
            Cascade impact
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
            <Mini label="Affected nodes" value={impact.affected_nodes.length} />
            <Mini label="Shipments" value={impact.affected_shipments} />
            <Mini label="USD exposure" value={`$${formatUSD(impact.economic_impact_usd)}`} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 border border-slate-800/50 rounded p-3">
            {impact.narrative}
          </p>
        </div>
      )}

      {decision && (
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">
          Action: <span className="text-slate-300">{decision}</span>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded p-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}

function formatUSD(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}
