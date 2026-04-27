import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const client = axios.create({
  baseURL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  health: () => client.get("/health").then((r) => r.data),
  rootMeta: () => client.get("/").then((r) => r.data),

  optimize: (payload) => client.post("/optimize-route", payload).then((r) => r.data),

  predictRisk: (payload) => client.post("/predict-risk", payload).then((r) => r.data),
  predictQuality: (payload) => client.post("/predict-quality", payload).then((r) => r.data),

  injectDisruption: (payload) =>
    client.post("/inject-disruption", payload).then((r) => r.data),
  clearDisruptions: () => client.post("/clear-disruptions").then((r) => r.data),

  simulateImpact: (payload) =>
    client.post("/simulate-impact", payload).then((r) => r.data),

  explain: (payload) => client.post("/explain", payload).then((r) => r.data),

  listShipments: () => client.get("/shipments").then((r) => r.data),
  getShipment: (id) => client.get(`/shipments/${id}`).then((r) => r.data),
};

export { baseURL };
export default client;
