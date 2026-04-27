import { create } from "zustand";
import { api } from "../api/client.js";

const initialForm = {
  origin: "Mombasa, Kenya",
  destination: "Mumbai, India",
  cargo_type: "avocados",
  weight_kg: 2000,
  deadline_hours: 72,
  current_temp_celsius: 9,
};

export const useStore = create((set, get) => ({
  form: { ...initialForm },
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),

  capabilities: null,
  loadingOptimize: false,
  loadingDisruption: false,
  loadingSimulate: false,
  error: null,

  shipmentId: null,
  decision: null,
  recommendation: null,
  primaryRoute: null,
  alternativeRoute: null,
  risk: null,
  quality: null,
  disruptions: [],
  impact: null,

  async loadCapabilities() {
    try {
      const meta = await api.rootMeta();
      set({ capabilities: meta.capabilities });
    } catch (e) {
      set({ error: "Backend unreachable. Is uvicorn running on port 8000?" });
    }
  },

  async optimize() {
    set({ loadingOptimize: true, error: null });
    try {
      await api.clearDisruptions().catch(() => {});
      const data = await api.optimize(get().form);
      set({
        loadingOptimize: false,
        shipmentId: data.shipment_id,
        decision: data.decision,
        recommendation: data.recommendation,
        primaryRoute: data.primary_route,
        alternativeRoute: data.alternative_route,
        risk: data.risk,
        quality: data.quality,
        disruptions: [],
        impact: null,
      });
    } catch (e) {
      set({ loadingOptimize: false, error: e.message || "Failed to optimise route." });
    }
  },

  async injectDisruption(payload) {
    const sid = get().shipmentId;
    if (!sid) return;
    set({ loadingDisruption: true, error: null });
    try {
      const data = await api.injectDisruption({ shipment_id: sid, ...payload });
      set((s) => ({
        loadingDisruption: false,
        decision: data.new_decision.action,
        recommendation: data.new_decision.rationale,
        primaryRoute: data.new_route,
        risk: data.updated_risk,
        quality: data.updated_quality,
        disruptions: [...s.disruptions, data.disruption],
      }));
      // Auto-fetch impact estimate after disruption.
      await get().simulateImpact(payload.node_name);
    } catch (e) {
      set({ loadingDisruption: false, error: e.message || "Failed to inject disruption." });
    }
  },

  async simulateImpact(nodeName) {
    const map = {
      "Colombo Port": "colombo_port",
      "Mombasa, Kenya": "mombasa_port",
      Dubai: "dubai_hub",
      Suez: "suez_canal",
      "Mumbai, India": "mumbai_port",
    };
    const node_id = map[nodeName] || "colombo_port";
    set({ loadingSimulate: true });
    try {
      const data = await api.simulateImpact({ disrupted_node_id: node_id, delay_hours: 12 });
      set({ loadingSimulate: false, impact: data });
    } catch (e) {
      set({ loadingSimulate: false });
    }
  },

  resetScenario() {
    set({
      form: { ...initialForm },
      shipmentId: null,
      decision: null,
      recommendation: null,
      primaryRoute: null,
      alternativeRoute: null,
      risk: null,
      quality: null,
      disruptions: [],
      impact: null,
      error: null,
    });
  },
}));
