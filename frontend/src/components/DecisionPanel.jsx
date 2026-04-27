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
      <div className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Decision</h3>
        <p className="text-xs text-slate-500">No decision yet. Optimise a route to start.</p>
      </div>
    );
  }

  const meta = DECISION_META[decision] || { label: decision, color: "slate" };

  return (
    <div className="glass p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Decision engine</h3>
        <Badge color={meta.color}>{meta.label.toUpperCase()}</Badge>
      </div>

      <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 border border-slate-800/50 rounded p-3">
        {recommendation || "Awaiting Gemini reasoning..."}
      </div>

      {primary && (
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Selected route</p>
            <p className="font-medium text-slate-200">{primary.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Q at arrival</p>
            <p className="font-semibold text-primary-400">
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
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    slate: "bg-slate-700/50 text-slate-200 border-slate-600/40",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase border rounded px-2 py-0.5 ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded p-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-200 truncate">{value}</p>
    </div>
  );
}
