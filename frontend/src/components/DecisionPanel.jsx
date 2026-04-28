import React from "react";
import { useStore } from "../store/useStore.js";

const DECISION_META = {
  CONTINUE: { label: "Continue", color: "emerald", icon: "check" },
  MONITOR: { label: "Monitor", color: "sky", icon: "eye" },
  PREPARE_ALTERNATE: { label: "Prepare alternate", color: "amber", icon: "shuffle" },
  AUTO_REROUTE: { label: "Auto reroute", color: "amber", icon: "shuffle" },
  EMERGENCY_REROUTE: { label: "Emergency reroute", color: "rose", icon: "alert" },
};

export default function DecisionPanel() {
  const decision = useStore((s) => s.decision);
  const primary = useStore((s) => s.primaryRoute);
  const quality = useStore((s) => s.quality);
  const recommendation = useStore((s) => s.recommendation);

  if (!decision) {
    return (
      <div className="cg-card p-5">
        <h3 className="cg-title mb-1 text-sm font-semibold">Decision</h3>
        <p className="cg-muted text-xs">No decision yet. Optimise a route to start.</p>
      </div>
    );
  }

  const meta = DECISION_META[decision] || { label: decision, color: "slate" };

  return (
    <div className="cg-card space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">Decision engine</h3>
        <Badge color={meta.color}>{meta.label.toUpperCase()}</Badge>
      </div>

      <div className="rounded border border-[var(--cg-border)] bg-[var(--cg-primary-soft)] p-3 text-xs leading-relaxed text-slate-700">
        {recommendation || "Awaiting Gemini reasoning..."}
      </div>

      {primary && (
        <div className="flex items-center justify-between border-t border-[var(--cg-border)] pt-2 text-xs">
          <div>
            <p className="cg-muted text-[10px] uppercase tracking-wider">Selected route</p>
            <p className="font-medium text-slate-700">{primary.name}</p>
          </div>
          <div className="text-right">
            <p className="cg-muted text-[10px] uppercase tracking-wider">Q at arrival</p>
            <p className="font-semibold text-emerald-600">
              {primary.quality_at_arrival.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {quality && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Mini label="Status" value={quality.status} />
          <Mini label="Loss" value={`${quality.economic_loss_pct.toFixed(0)}%`} />
          <Mini label="Shelf life" value={`${quality.remaining_shelf_life_hrs.toFixed(0)}h`} />
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }) {
  const map = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-300 bg-slate-50 text-slate-700",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase border rounded px-2 py-0.5 ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
      <p className="cg-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className="truncate text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
