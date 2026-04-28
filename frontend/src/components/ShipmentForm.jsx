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
    <form onSubmit={onSubmit} className="cg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="cg-title text-sm font-semibold uppercase tracking-wider">
          Shipment
        </h2>
        <span className="cg-badge cg-muted">live optimization</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Origin">
          <input
            name="origin"
            value={form.origin}
            onChange={handle}
            className="cg-input"
          />
        </Field>
        <Field label="Destination">
          <input
            name="destination"
            value={form.destination}
            onChange={handle}
            className="cg-input"
          />
        </Field>
        <Field label="Cargo">
          <select
            name="cargo_type"
            value={form.cargo_type}
            onChange={handle}
            className="cg-input"
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
            className="cg-input"
          />
        </Field>
        <Field label="Deadline (h)">
          <input
            name="deadline_hours"
            type="number"
            min="12"
            value={form.deadline_hours}
            onChange={handle}
            className="cg-input"
          />
        </Field>
        <Field label="Truck temp (deg C)">
          <input
            name="current_temp_celsius"
            type="number"
            step="0.5"
            value={form.current_temp_celsius}
            onChange={handle}
            className="cg-input"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="cg-btn-primary w-full rounded-lg py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Optimising..." : "Optimise route"}
      </button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="cg-muted mb-1 block text-[11px] uppercase tracking-wider">
        {label}
      </span>
      {children}
    </label>
  );
}
