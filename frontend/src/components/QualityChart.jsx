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
    <div className="glass p-5 h-[320px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Quality decay forecast</h3>
          <p className="text-xs text-slate-500">
            Avocado quality vs. hours in transit at current temp
          </p>
        </div>
        <span className="text-xs text-slate-400">
          status:{" "}
          <span className={statusColor(quality.status)}>{quality.status}</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="hour"
            tick={{ fill: "#64748b", fontSize: 11 }}
            stroke="#1e293b"
            label={{ value: "hours", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#64748b", fontSize: 11 }}
            stroke="#1e293b"
          />
          <Tooltip
            contentStyle={{
              background: "#0b1120",
              border: "1px solid #1e293b",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v) => [`${v}%`, "quality"]}
            labelFormatter={(h) => `${h}h elapsed`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
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
            stroke="#10b981"
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
    <div className="glass p-5 h-[320px] flex flex-col items-center justify-center text-center">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function statusColor(status) {
  if (status === "fresh") return "text-primary-400";
  if (status === "acceptable") return "text-amber-400";
  return "text-rose-400";
}
