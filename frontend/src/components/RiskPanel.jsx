import React from "react";
import { useStore } from "../store/useStore.js";

export default function RiskPanel() {
  const risk = useStore((s) => s.risk);
  const primary = useStore((s) => s.primaryRoute);
  const alt = useStore((s) => s.alternativeRoute);

  if (!risk || !primary) {
    return (
      <div className="cg-card p-5">
        <h3 className="cg-title mb-1 text-sm font-semibold">Risk panel</h3>
        <p className="cg-muted text-xs">Run an optimisation to see risk scoring.</p>
      </div>
    );
  }

  return (
    <div className="cg-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">Risk overview</h3>
        <Pill level={risk.risk_level}>{risk.risk_level.toUpperCase()}</Pill>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Risk score" value={`${risk.risk_score.toFixed(0)}/100`} accent={riskColor(risk.risk_score)} />
        <Stat label="Delay prob" value={`${(risk.delay_prob * 100).toFixed(0)}%`} />
        <Stat label="ETA" value={`${primary.base_eta_hrs.toFixed(0)}h`} />
      </div>

      <div>
        <p className="cg-muted mb-1.5 text-[11px] uppercase tracking-wider">Risk factors</p>
        <div className="flex flex-wrap gap-1.5">
          {(risk.factors || []).map((f) => (
            <span key={f} className="rounded border border-[var(--cg-border)] bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              {f.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-[var(--cg-border)] pt-3 text-xs">
        <Mini label="Rule score" value={risk.rule_score.toFixed(1)} />
        <Mini label="ML delay" value={`${risk.ml_score.toFixed(1)}%`} />
      </div>

      {alt && (
        <div className="border-t border-[var(--cg-border)] pt-3">
          <p className="cg-muted mb-1.5 text-[11px] uppercase tracking-wider">
            Alternative route
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700">{alt.name}</span>
            <span className="cg-muted">
              {alt.base_eta_hrs.toFixed(0)}h, q {alt.quality_at_arrival.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${accent || "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
      <p className="cg-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Pill({ level, children }) {
  const styles = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    high: "border-rose-200 bg-rose-50 text-rose-700",
  }[level] || "border-slate-300 bg-slate-50 text-slate-700";
  return <span className={`text-[10px] font-semibold uppercase border rounded px-2 py-0.5 ${styles}`}>{children}</span>;
}

function riskColor(score) {
  if (score >= 70) return "text-rose-600";
  if (score >= 40) return "text-amber-600";
  return "text-emerald-600";
}
