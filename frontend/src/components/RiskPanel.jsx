import React from "react";
import { useStore } from "../store/useStore.js";

export default function RiskPanel() {
  const risk = useStore((s) => s.risk);
  const primary = useStore((s) => s.primaryRoute);
  const alt = useStore((s) => s.alternativeRoute);

  if (!risk || !primary) {
    return (
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Risk panel</h3>
        <p className="text-xs text-slate-500">Run an optimisation to see risk scoring.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Risk overview</h3>
        <Pill level={risk.risk_level}>{risk.risk_level.toUpperCase()}</Pill>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Risk score" value={`${risk.risk_score.toFixed(0)}/100`} accent={riskColor(risk.risk_score)} />
        <Stat label="Delay prob" value={`${(risk.delay_prob * 100).toFixed(0)}%`} />
        <Stat label="ETA" value={`${primary.base_eta_hrs.toFixed(0)}h`} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Risk factors</p>
        <div className="flex flex-wrap gap-1.5">
          {(risk.factors || []).map((f) => (
            <span key={f} className="text-xs bg-slate-800/60 border border-slate-700/50 rounded px-2 py-0.5 text-slate-300">
              {f.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-3 text-xs">
        <Mini label="Rule score" value={risk.rule_score.toFixed(1)} />
        <Mini label="ML delay" value={`${risk.ml_score.toFixed(1)}%`} />
      </div>

      {alt && (
        <div className="pt-3 border-t border-slate-800/60">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
            Alternative route
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">{alt.name}</span>
            <span className="text-slate-500">
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
      <p className={`text-lg font-semibold ${accent || "text-slate-100"}`}>{value}</p>
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

function Pill({ level, children }) {
  const styles = {
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    high: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  }[level] || "bg-slate-700 text-slate-300 border-slate-600";
  return <span className={`text-[10px] font-semibold uppercase border rounded px-2 py-0.5 ${styles}`}>{children}</span>;
}

function riskColor(score) {
  if (score >= 70) return "text-rose-400";
  if (score >= 40) return "text-amber-400";
  return "text-primary-400";
}
