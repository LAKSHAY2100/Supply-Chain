import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { useStore } from "../store/useStore.js";

export default function QualityChart() {
  const quality = useStore((s) => s.quality);
  const primary = useStore((s) => s.primaryRoute);

  const data = useMemo(() => {
    if (!quality?.decay_curve?.length) return [];
    return quality.decay_curve.map((p) => ({
      hour: p.hour,
      quality: p.quality,
    }));
  }, [quality]);

  if (!quality) {
    return (
      <Empty title="Quality decay" subtitle="Run an optimisation to see quality forecast." />
    );
  }

  return (
    <div className="cg-card flex h-[320px] flex-col p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="cg-title text-sm font-semibold">Quality decay forecast</h3>
          <p className="cg-muted text-xs">
            Avocado quality vs. hours in transit at current temp
          </p>
        </div>
        <span className="cg-muted text-xs">
          status:{" "}
          <span className={statusColor(quality.status)}>{quality.status}</span>
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Metric label="Arrival quality" value={`${quality.quality_score.toFixed(1)}%`} tone={statusColor(quality.status)} />
        <Metric label="No-delay quality" value={`${Number(quality.baseline_quality_score || quality.quality_score).toFixed(1)}%`} />
        <Metric
          label="Quality lost due to delay"
          value={`${Number(quality.quality_drop_from_delay || 0).toFixed(1)} pts`}
          tone={Number(quality.quality_drop_from_delay || 0) > 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <Metric
          label="Extra value loss"
          value={`${Number(quality.economic_loss_increase_pct || 0).toFixed(1)}%`}
          tone={Number(quality.economic_loss_increase_pct || 0) > 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      <div className="mb-3 rounded border border-[var(--cg-border)] bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
        {delayNarrative(quality, primary)}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde3f2" />
          <XAxis
            dataKey="hour"
            tick={{ fill: "#66728f", fontSize: 11 }}
            stroke="#dde3f2"
            label={{ value: "hours", position: "insideBottom", offset: -2, fill: "#66728f", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#66728f", fontSize: 11 }}
            stroke="#dde3f2"
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #dde3f2",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#66728f" }}
            formatter={(v) => [`${v}%`, "quality"]}
            labelFormatter={(h) => `${h}h elapsed`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#66728f" }} />
          <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" label={{ value: "fresh", fill: "#10b981", fontSize: 10, position: "right" }} />
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "acceptable", fill: "#f59e0b", fontSize: 10, position: "right" }} />
          {primary?.base_eta_hrs && (
            <ReferenceLine
              x={Math.round(primary.base_eta_hrs)}
              stroke="#38bdf8"
              strokeDasharray="2 2"
              label={{ value: "ETA", fill: "#38bdf8", fontSize: 10, position: "top" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="quality"
            stroke="#1f9960"
            strokeWidth={2.5}
            dot={false}
            name="Quality %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ title, subtitle }) {
  return (
    <div className="cg-card flex h-[320px] flex-col items-center justify-center p-5 text-center">
      <h3 className="cg-title mb-1 text-sm font-semibold">{title}</h3>
      <p className="cg-muted text-xs">{subtitle}</p>
    </div>
  );
}

function statusColor(status) {
  if (status === "fresh") return "text-emerald-600";
  if (status === "acceptable") return "text-amber-600";
  return "text-rose-600";
}

function Metric({ label, value, tone = "text-slate-800" }) {
  return (
    <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
      <p className="cg-muted text-[10px] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function delayNarrative(quality, primary) {
  const delay = Number(quality.delay_hours_applied || 0);
  const qualityDrop = Number(quality.quality_drop_from_delay || 0);
  const valueLoss = Number(quality.economic_loss_increase_pct || 0);
  if (delay <= 0 || qualityDrop <= 0) {
    return `At the current ETA of ${primary?.base_eta_hrs?.toFixed?.(1) || 0} hours, the cargo is projected to arrive at ${quality.quality_score.toFixed(1)}% quality without additional delay impact.`;
  }
  return `An added delay of ${delay.toFixed(1)} hours reduces projected avocado quality from ${Number(quality.baseline_quality_score || 0).toFixed(1)}% to ${quality.quality_score.toFixed(1)}%, a compromise of ${qualityDrop.toFixed(1)} quality points. That same delay increases estimated economic loss by ${valueLoss.toFixed(1)}%.`;
}
