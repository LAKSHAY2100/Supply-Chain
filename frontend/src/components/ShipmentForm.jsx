import React from "react";
import { useStore } from "../store/useStore.js";

const cargoOptions = ["avocados", "mangoes", "berries", "fish", "flowers", "vaccines"];

export default function ShipmentForm() {
  const form = useStore((s) => s.form);
  const setForm = useStore((s) => s.setForm);
  const optimize = useStore((s) => s.optimize);
  const loading = useStore((s) => s.loadingOptimize);

  const handle = (e) => {
    const { name, value } = e.target;
    const numeric = ["weight_kg", "deadline_hours", "current_temp_celsius"].includes(name);
    setForm({ [name]: numeric ? Number(value) : value });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    optimize();
  };

  return (
    <form onSubmit={onSubmit} className="glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm tracking-wide uppercase text-slate-300">
          Shipment
        </h2>
        <span className="text-xs text-slate-500">live optimisation</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Origin">
          <input
            name="origin"
            value={form.origin}
            onChange={handle}
            className="input"
          />
        </Field>
        <Field label="Destination">
          <input
            name="destination"
            value={form.destination}
            onChange={handle}
            className="input"
          />
        </Field>
        <Field label="Cargo">
          <select
            name="cargo_type"
            value={form.cargo_type}
            onChange={handle}
            className="input"
          >
            {cargoOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weight (kg)">
          <input
            name="weight_kg"
            type="number"
            min="100"
            value={form.weight_kg}
            onChange={handle}
            className="input"
          />
        </Field>
        <Field label="Deadline (h)">
          <input
            name="deadline_hours"
            type="number"
            min="12"
            value={form.deadline_hours}
            onChange={handle}
            className="input"
          />
        </Field>
        <Field label="Truck temp (deg C)">
          <input
            name="current_temp_celsius"
            type="number"
            step="0.5"
            value={form.current_temp_celsius}
            onChange={handle}
            className="input"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Optimising..." : "Optimise route"}
      </button>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.15);
          color: #e2e8f0;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: rgba(16, 185, 129, 0.6); }
      `}</style>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
