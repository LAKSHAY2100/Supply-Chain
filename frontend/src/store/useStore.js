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

const initialBuilder = {
  source: { lat: 0, lng: 0, nodeType: "factory", readyTime: "", initialDelayRisk: 0 },
  destinationPoint: { lat: 0, lng: 0, nodeType: "distribution_hub", deliveryDeadlineHours: 72, demandLevel: "medium", fromNode: "" },
  stages: [
    {
      id: "stage-1",
      name: "Stage 1",
      lat: 0,
      lng: 0,
      stageType: "port",
      congestionLevel: "low",
      averageDelayHours: 2,
      customsClearanceHours: 1,
      weatherCondition: "normal",
      capacityUtilizationPct: 65,
      processingDelayHours: 2,
      temperatureStatus: "safe",
      demandLevel: "medium",
      dispatchDelayHours: 2,
      localTrafficLevel: "medium",
      disrupted: false,
      fromNode: "",
      toNode: "",
      subStages: [],
    },
  ],
};

export const useStore = create((set, get) => ({
  form: { ...initialForm },
  builder: { ...initialBuilder },
  setForm: (patch) => set((s) => ({ form: { ...s.form, ...patch } })),
  setBuilder: (patch) => set((s) => ({ builder: { ...s.builder, ...patch } })),

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
  routeGraph: null,

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
        routeGraph: data.route_graph || null,
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
      builder: { ...initialBuilder },
      shipmentId: null,
      decision: null,
      recommendation: null,
      primaryRoute: null,
      alternativeRoute: null,
      risk: null,
      quality: null,
      disruptions: [],
      impact: null,
      routeGraph: null,
      error: null,
    });
  },

  async optimizeWithStages() {
    const { form, builder } = get();
    const stages = (builder.stages || [])
      .filter((s) => s.name && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
      .map((s) => ({
        name: s.name,
        lat: Number(s.lat),
        lng: Number(s.lng),
        stage_type: s.stageType || "port",
        congestion_level: s.congestionLevel,
        average_delay_hours: s.averageDelayHours,
        customs_clearance_hours: s.customsClearanceHours,
        weather_condition: s.weatherCondition,
        capacity_utilization_pct: s.capacityUtilizationPct,
        processing_delay_hours: s.processingDelayHours,
        temperature_status: s.temperatureStatus,
        demand_level: s.demandLevel,
        dispatch_delay_hours: s.dispatchDelayHours,
        local_traffic_level: s.localTrafficLevel,
        disrupted: Boolean(s.disrupted),
        sub_stages: (s.subStages || []).map((sub) => ({
          id: sub.id,
          name: sub.name,
          lat: Number(sub.lat),
          lng: Number(sub.lng),
          disrupted: Boolean(sub.disrupted),
          route_mode: sub.routeMode || "follow_main",
          route_target: sub.routeTarget || "",
          stage_type: sub.stageType || "distribution",
          congestion_level: sub.congestionLevel,
          average_delay_hours: sub.averageDelayHours,
          customs_clearance_hours: sub.customsClearanceHours,
          weather_condition: sub.weatherCondition,
          capacity_utilization_pct: sub.capacityUtilizationPct,
          processing_delay_hours: sub.processingDelayHours,
          temperature_status: sub.temperatureStatus,
          demand_level: sub.demandLevel,
          dispatch_delay_hours: sub.dispatchDelayHours,
          local_traffic_level: sub.localTrafficLevel,
        })),
      }));
    if (!form?.origin || !form?.destination || stages.length === 0) {
      set({ error: "Shipment origin/destination and at least one stage are required." });
      return;
    }
    const srcFallback = stages[0]
      ? { lat: Number(stages[0].lat) - 0.3, lng: Number(stages[0].lng) - 0.3 }
      : { lat: 0, lng: 0 };
    const dstFallback = stages[stages.length - 1]
      ? { lat: Number(stages[stages.length - 1].lat) + 0.3, lng: Number(stages[stages.length - 1].lng) + 0.3 }
      : { lat: 0, lng: 0 };
    const src = {
      lat: Number(builder.source?.lat) || srcFallback.lat,
      lng: Number(builder.source?.lng) || srcFallback.lng,
    };
    const dst = {
      lat: Number(builder.destinationPoint?.lat) || dstFallback.lat,
      lng: Number(builder.destinationPoint?.lng) || dstFallback.lng,
    };

    set({ loadingOptimize: true, error: null });
    try {
      await api.clearDisruptions().catch(() => {});
      const data = await api.optimize({
        ...form,
        source: {
          name: form.origin,
          lat: Number(src.lat),
          lng: Number(src.lng),
          node_type: builder.source?.nodeType || "factory",
          ready_time: builder.source?.readyTime || "",
          initial_delay_risk: Number(builder.source?.initialDelayRisk || 0),
        },
        destination_point: {
          name: form.destination,
          lat: Number(dst.lat),
          lng: Number(dst.lng),
          node_type: builder.destinationPoint?.nodeType || "distribution_hub",
          delivery_deadline_hours: Number(builder.destinationPoint?.deliveryDeadlineHours || form.deadline_hours || 72),
          demand_level: builder.destinationPoint?.demandLevel || "medium",
        },
        stages,
      });
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
        routeGraph: data.route_graph || null,
      });
    } catch (e) {
      set({ loadingOptimize: false, error: e.message || "Failed to optimise staged route." });
    }
  },
}));
