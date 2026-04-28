import React from "react";
import { useStore } from "../store/useStore.js";

export default function GeminiExplain() {
  const recommendation = useStore((s) => s.recommendation);
  const decision = useStore((s) => s.decision);
  const cap = useStore((s) => s.capabilities);
  const impact = useStore((s) => s.impact);

  if (!recommendation) {
    return (
      <div className="cg-card p-5">
        <h3 className="cg-title mb-1 text-sm font-semibold">Gemini explanation</h3>
        <p className="cg-muted text-xs">Optimise to get a natural-language reasoning.</p>
      </div>
    );
  }

  const source = cap?.gemini ? "Gemini Pro" : "Template fallback";

  return (
    <div className="cg-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">AI reasoning</h3>
        <span className="cg-badge cg-muted">
          {source}
        </span>
      </div>

      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {recommendation}
      </div>

      {impact && (
        <div className="border-t border-[var(--cg-border)] pt-4">
          <p className="cg-muted mb-2 text-[11px] uppercase tracking-wider">
            Cascade impact
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
            <Mini label="Affected nodes" value={impact.affected_nodes.length} />
            <Mini label="Shipments" value={impact.affected_shipments} />
            <Mini label="USD exposure" value={`$${formatUSD(impact.economic_impact_usd)}`} />
          </div>
          <p className="rounded border border-[var(--cg-border)] bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            {impact.narrative}
          </p>
        </div>
      )}

      {decision && (
        <div className="cg-muted text-[10px] uppercase tracking-wider">
          Action: <span className="text-slate-700">{decision}</span>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
      <p className="cg-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function formatUSD(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}
