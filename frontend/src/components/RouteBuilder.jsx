import React from "react";
import { useStore } from "../store/useStore.js";
import { buildLiveGraph } from "../lib/routeGraph.js";

export default function RouteBuilder() {
  const form = useStore((s) => s.form);
  const builder = useStore((s) => s.builder);
  const setBuilder = useStore((s) => s.setBuilder);
  const optimizeWithStages = useStore((s) => s.optimizeWithStages);
  const loading = useStore((s) => s.loadingOptimize);
  const routeGraph = useStore((s) => s.routeGraph);
  const liveGraph = React.useMemo(() => buildLiveGraph(builder, form), [builder, form]);
  const linkInfo = React.useMemo(() => buildConnectionInfo(liveGraph), [liveGraph]);
  const nodeOptions = React.useMemo(() => buildNodeOptions(builder, form), [builder, form]);

  const updateStage = (id, patch) => {
    setBuilder({
      stages: builder.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };
  const updateSource = (patch) => setBuilder({ source: { ...(builder.source || {}), ...patch } });
  const updateDestination = (patch) =>
    setBuilder({ destinationPoint: { ...(builder.destinationPoint || {}), ...patch } });

  const addStage = () => {
    const next = builder.stages.length + 1;
    setBuilder({
      stages: [
        ...builder.stages,
        {
          id: `stage-${next}`,
          name: `Stage ${next}`,
          lat: 0,
          lng: 0,
          stageType: "port",
          enableSubstages: false,
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
          subStages: [],
        },
      ],
    });
  };

  const removeStage = (id) => {
    if (builder.stages.length <= 1) return;
    setBuilder({ stages: builder.stages.filter((s) => s.id !== id) });
  };
  const onGenerate = () => {
    const el = document.getElementById("stage-graph-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    optimizeWithStages();
  };

  return (
    <div className="cg-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="cg-title text-sm font-semibold">Build staged route</h3>
        <button type="button" onClick={addStage} className="cg-badge cg-muted">+ Stage</button>
      </div>

      <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2 text-xs">
        <div className="cg-muted mb-1 text-[11px] uppercase tracking-wider">Using shipment endpoints</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-700">{form.origin}</span>
          <span className="cg-muted">to</span>
          <span className="text-slate-700">{form.destination}</span>
        </div>
        <ConnectionMeta meta={linkInfo["src"]} />
      </div>
      <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
        <div className="cg-muted mb-2 text-[11px] uppercase tracking-wider">Source node data</div>
        <ConnectionMeta meta={linkInfo["src"]} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Latitude" value={builder.source?.lat ?? 0} onChange={(v) => updateSource({ lat: Number(v) })} />
          <Input label="Longitude" value={builder.source?.lng ?? 0} onChange={(v) => updateSource({ lng: Number(v) })} />
          <Select label="Type" value={builder.source?.nodeType || "factory"} options={["factory", "export_hub", "port"]} onChange={(v) => updateSource({ nodeType: v })} />
          <label>
            <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">Ready time</span>
            <input className="cg-input" type="datetime-local" value={builder.source?.readyTime || ""} onChange={(e) => updateSource({ readyTime: e.target.value })} />
          </label>
          <label className="col-span-2">
            <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">Initial delay risk (0-1)</span>
            <input className="cg-input" type="number" min="0" max="1" step="0.05" value={builder.source?.initialDelayRisk ?? 0} onChange={(e) => updateSource({ initialDelayRisk: Number(e.target.value) })} />
          </label>
          <label className="col-span-2">
            <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">Goes to node</span>
            <select className="cg-input" value={builder.source?.toNode || ""} onChange={(e) => updateSource({ toNode: e.target.value })}>
              <option value="">Auto</option>
              {nodeOptions.filter((o) => o.value !== "src").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
        <div className="cg-muted mb-2 text-[11px] uppercase tracking-wider">Destination node data</div>
        <ConnectionMeta meta={linkInfo["dst"]} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Latitude" value={builder.destinationPoint?.lat ?? 0} onChange={(v) => updateDestination({ lat: Number(v) })} />
          <Input label="Longitude" value={builder.destinationPoint?.lng ?? 0} onChange={(v) => updateDestination({ lng: Number(v) })} />
          <Select label="Type" value={builder.destinationPoint?.nodeType || "distribution_hub"} options={["distribution_hub", "warehouse"]} onChange={(v) => updateDestination({ nodeType: v })} />
          <Input label="Deadline (h)" value={builder.destinationPoint?.deliveryDeadlineHours ?? form.deadline_hours} onChange={(v) => updateDestination({ deliveryDeadlineHours: Number(v) })} />
          <Select label="Demand level" value={builder.destinationPoint?.demandLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => updateDestination({ demandLevel: v })} />
          <label className="col-span-2">
            <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">Comes from node</span>
            <select className="cg-input" value={builder.destinationPoint?.fromNode || ""} onChange={(e) => updateDestination({ fromNode: e.target.value })}>
              <option value="">Auto</option>
              {nodeOptions.filter((o) => o.value !== "dst").map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {builder.stages.map((s, idx) => (
          <div key={s.id} className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="cg-muted text-[11px] uppercase tracking-wider">Stage {idx + 1}</span>
              <button type="button" onClick={() => removeStage(s.id)} className="cg-muted text-xs">remove</button>
            </div>
            <ConnectionMeta meta={linkInfo[s.id]} />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label>
                <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">From node</span>
                <select className="cg-input" value={s.fromNode || ""} onChange={(e) => updateStage(s.id, { fromNode: e.target.value })}>
                  <option value="">Auto</option>
                  {nodeOptions.filter((o) => o.value !== s.id && o.value !== "dst").map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">To node</span>
                <select className="cg-input" value={s.toNode || ""} onChange={(e) => updateStage(s.id, { toNode: e.target.value })}>
                  <option value="">Auto</option>
                  {nodeOptions.filter((o) => o.value !== s.id && o.value !== "src").map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input className="cg-input col-span-3" value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} placeholder="Name" />
              <select
                className="cg-input col-span-3"
                value={s.stageType || "port"}
                onChange={(e) => updateStage(s.id, { stageType: e.target.value })}
              >
                <option value="port">Port</option>
                <option value="warehouse">Warehouse / Cold Storage</option>
                <option value="distribution">Distribution Center</option>
              </select>
              <input className="cg-input" type="number" value={s.lat} onChange={(e) => updateStage(s.id, { lat: Number(e.target.value) })} placeholder="Lat" />
              <input className="cg-input" type="number" value={s.lng} onChange={(e) => updateStage(s.id, { lng: Number(e.target.value) })} placeholder="Lng" />
              <label className="cg-muted col-span-1 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                <input type="checkbox" checked={Boolean(s.disrupted)} onChange={(e) => updateStage(s.id, { disrupted: e.target.checked })} />
                disrupted
              </label>
              <label className="cg-muted col-span-3 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={Boolean(s.enableSubstages)}
                  onChange={(e) =>
                    updateStage(s.id, {
                      enableSubstages: e.target.checked,
                      subStages: e.target.checked ? s.subStages || [] : [],
                    })
                  }
                />
                convert to substage flow
              </label>
            </div>

            <StageTypeFields stage={s} onChange={(patch) => updateStage(s.id, patch)} />
            {s.enableSubstages ? (
              <SubstageBuilder stage={s} allStages={builder.stages} onChange={(patch) => updateStage(s.id, patch)} />
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="cg-btn-primary w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Computing..." : "Generate staged route"}
      </button>

      {routeGraph && (
        <RouteGraphPanel
          routeGraph={routeGraph}
          title="Backend computed graph"
        />
      )}
    </div>
  );
}

function StageTypeFields({ stage, onChange }) {
  const set = (key, value) => onChange({ [key]: value });

  if (stage.stageType === "port") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select label="Congestion" value={stage.congestionLevel || "low"} options={["low", "medium", "high"]} onChange={(v) => set("congestionLevel", v)} />
        <Select label="Weather" value={stage.weatherCondition || "normal"} options={["normal", "risky"]} onChange={(v) => set("weatherCondition", v)} />
        <Input label="Avg delay (h)" value={stage.averageDelayHours ?? 0} onChange={(v) => set("averageDelayHours", Number(v))} />
        <Input label="Customs (h)" value={stage.customsClearanceHours ?? 0} onChange={(v) => set("customsClearanceHours", Number(v))} />
      </div>
    );
  }

  if (stage.stageType === "warehouse") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input label="Capacity (%)" value={stage.capacityUtilizationPct ?? 0} onChange={(v) => set("capacityUtilizationPct", Number(v))} />
        <Input label="Processing (h)" value={stage.processingDelayHours ?? 0} onChange={(v) => set("processingDelayHours", Number(v))} />
        <Select label="Temperature" value={stage.temperatureStatus || "safe"} options={["safe", "unsafe"]} onChange={(v) => set("temperatureStatus", v)} />
      </div>
    );
  }

  if (stage.stageType === "distribution") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select label="Demand" value={stage.demandLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => set("demandLevel", v)} />
        <Select label="Local traffic" value={stage.localTrafficLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => set("localTrafficLevel", v)} />
        <Input label="Dispatch delay (h)" value={stage.dispatchDelayHours ?? 0} onChange={(v) => set("dispatchDelayHours", Number(v))} />
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <Select label="Demand" value={stage.demandLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => set("demandLevel", v)} />
      <Select label="Local traffic" value={stage.localTrafficLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => set("localTrafficLevel", v)} />
      <Input label="Dispatch delay (h)" value={stage.dispatchDelayHours ?? 0} onChange={(v) => set("dispatchDelayHours", Number(v))} />
    </div>
  );
}

function SubstageBuilder({ stage, allStages, onChange }) {
  const subStages = stage.subStages || [];
  const setSubStages = (next) => onChange({ subStages: next });
  const addSubStage = () => {
    const idx = subStages.length + 1;
    setSubStages([
      ...subStages,
      {
        id: `${stage.id}-sub-${idx}`,
        name: `Substage ${idx}`,
        lat: stage.lat || 0,
        lng: stage.lng || 0,
        stageType: "distribution",
        disrupted: false,
        routeMode: "follow_main",
        routeTarget: "",
        congestionLevel: "low",
        averageDelayHours: 2,
        customsClearanceHours: 0,
        weatherCondition: "normal",
        capacityUtilizationPct: 60,
        processingDelayHours: 2,
        temperatureStatus: "safe",
        demandLevel: "medium",
        dispatchDelayHours: 2,
        localTrafficLevel: "medium",
      },
    ]);
  };
  const updateSubStage = (id, patch) => {
    setSubStages(subStages.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeSubStage = (id) => setSubStages(subStages.filter((s) => s.id !== id));

  return (
    <div className="mt-2 rounded border border-[var(--cg-border)] bg-white p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="cg-muted text-[11px] uppercase tracking-wider">Custom substages</span>
        <button type="button" onClick={addSubStage} className="cg-badge cg-muted">+ Substage</button>
      </div>
      <div className="space-y-2">
        {subStages.length === 0 && (
          <div className="cg-muted rounded border border-dashed border-[var(--cg-border)] p-2 text-xs">
            No substages added.
          </div>
        )}
        {subStages.map((sub) => (
          <div key={sub.id} className="rounded border border-[var(--cg-border)] bg-slate-50 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="cg-muted text-[10px] uppercase tracking-wider">{sub.name}</span>
              <button type="button" onClick={() => removeSubStage(sub.id)} className="cg-muted text-xs">remove</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input className="cg-input col-span-3" value={sub.name} onChange={(e) => updateSubStage(sub.id, { name: e.target.value })} />
              <select
                className="cg-input col-span-3"
                value={sub.stageType || "distribution"}
                onChange={(e) => updateSubStage(sub.id, { stageType: e.target.value })}
              >
                <option value="port">Port</option>
                <option value="warehouse">Warehouse / Cold Storage</option>
                <option value="distribution">Distribution Center</option>
              </select>
              <input className="cg-input" type="number" value={sub.lat} onChange={(e) => updateSubStage(sub.id, { lat: Number(e.target.value) })} />
              <input className="cg-input" type="number" value={sub.lng} onChange={(e) => updateSubStage(sub.id, { lng: Number(e.target.value) })} />
              <label className="cg-muted col-span-1 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                <input type="checkbox" checked={Boolean(sub.disrupted)} onChange={(e) => updateSubStage(sub.id, { disrupted: e.target.checked })} />
                disrupted
              </label>
            </div>
            <SubStageTypeFields
              sub={sub}
              onPatch={(patch) => updateSubStage(sub.id, patch)}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select
                label="Route behavior"
                value={sub.routeMode || "follow_main"}
                options={["follow_main", "to_destination", "to_stage", "to_substage"]}
                onChange={(v) =>
                  updateSubStage(sub.id, {
                    routeMode: v,
                    routeTarget: v === "to_stage" || v === "to_substage" ? sub.routeTarget || "" : "",
                  })
                }
              />
              {(sub.routeMode === "to_stage" || sub.routeMode === "to_substage") && (
                <label>
                  <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">Route target</span>
                  <select
                    className="cg-input"
                    value={sub.routeTarget || ""}
                    onChange={(e) => updateSubStage(sub.id, { routeTarget: e.target.value })}
                  >
                    <option value="">Select target</option>
                    {collectRouteTargets(allStages, stage.id, sub.id, sub.routeMode).map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubStageTypeFields({ sub, onPatch }) {
  const st = String(sub.stageType || "distribution").toLowerCase();
  if (st === "port") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select label="Congestion" value={sub.congestionLevel || "low"} options={["low", "medium", "high"]} onChange={(v) => onPatch({ congestionLevel: v })} />
        <Select label="Weather" value={sub.weatherCondition || "normal"} options={["normal", "risky"]} onChange={(v) => onPatch({ weatherCondition: v })} />
        <Input label="Avg delay (h)" value={sub.averageDelayHours ?? 0} onChange={(v) => onPatch({ averageDelayHours: Number(v) })} />
        <Input label="Customs (h)" value={sub.customsClearanceHours ?? 0} onChange={(v) => onPatch({ customsClearanceHours: Number(v) })} />
      </div>
    );
  }
  if (st === "warehouse") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input label="Capacity (%)" value={sub.capacityUtilizationPct ?? 0} onChange={(v) => onPatch({ capacityUtilizationPct: Number(v) })} />
        <Input label="Processing (h)" value={sub.processingDelayHours ?? 0} onChange={(v) => onPatch({ processingDelayHours: Number(v) })} />
        <Select label="Temperature" value={sub.temperatureStatus || "safe"} options={["safe", "unsafe"]} onChange={(v) => onPatch({ temperatureStatus: v })} />
      </div>
    );
  }
  if (st === "distribution") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select label="Demand" value={sub.demandLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => onPatch({ demandLevel: v })} />
        <Select label="Traffic" value={sub.localTrafficLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => onPatch({ localTrafficLevel: v })} />
        <Input label="Dispatch delay (h)" value={sub.dispatchDelayHours ?? 0} onChange={(v) => onPatch({ dispatchDelayHours: Number(v) })} />
      </div>
    );
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <Select label="Demand" value={sub.demandLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => onPatch({ demandLevel: v })} />
      <Select label="Traffic" value={sub.localTrafficLevel || "medium"} options={["low", "medium", "high"]} onChange={(v) => onPatch({ localTrafficLevel: v })} />
      <Input label="Dispatch delay (h)" value={sub.dispatchDelayHours ?? 0} onChange={(v) => onPatch({ dispatchDelayHours: Number(v) })} />
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label>
      <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">{label}</span>
      <input className="cg-input" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label>
      <span className="cg-muted mb-1 block text-[10px] uppercase tracking-wider">{label}</span>
      <select className="cg-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function collectRouteTargets(allStages, currentStageId, currentSubId, mode) {
  if (mode === "to_stage") {
    return (allStages || [])
      .filter((s) => s.id !== currentStageId)
      .map((s) => ({ value: s.id, label: s.name || s.id }));
  }
  if (mode === "to_substage") {
    const out = [];
    (allStages || []).forEach((stage) => {
      (stage.subStages || []).forEach((sub) => {
        if (sub.id === currentSubId) return;
        out.push({
          value: sub.id,
          label: `${stage.name || stage.id} / ${sub.name || sub.id}`,
        });
      });
    });
    return out;
  }
  return [];
}

function ConnectionMeta({ meta }) {
  if (!meta) return null;
  return (
    <div className="mb-2 rounded border border-[var(--cg-border)] bg-white px-2 py-1 text-[11px]">
      <span className="cg-muted">From:</span>{" "}
      <span className="text-slate-700">{meta.from || "-"}</span>
      <span className="cg-muted"> | To:</span>{" "}
      <span className="text-slate-700">{meta.to || "-"}</span>
    </div>
  );
}

function buildConnectionInfo(graph) {
  if (!graph || !graph.nodes?.length) return {};
  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const incoming = {};
  const outgoing = {};
  graph.nodes.forEach((n) => {
    incoming[n.id] = [];
    outgoing[n.id] = [];
  });
  (graph.edges || []).forEach((e) => {
    const src = byId[e.source]?.name || e.source;
    const dst = byId[e.target]?.name || e.target;
    if (incoming[e.target]) incoming[e.target].push(src);
    if (outgoing[e.source]) outgoing[e.source].push(dst);
  });
  const out = {};
  graph.nodes.forEach((n) => {
    out[n.id] = {
      from: uniqueCompact(incoming[n.id]).join(", "),
      to: uniqueCompact(outgoing[n.id]).join(", "),
    };
  });
  return out;
}

function uniqueCompact(arr = []) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function buildNodeOptions(builder, form) {
  const out = [];
  out.push({ value: "src", label: `Source (${form.origin})` });
  (builder.stages || []).forEach((s) => {
    out.push({ value: s.id, label: `Stage: ${s.name || s.id}` });
    (s.subStages || []).forEach((sub) => {
      out.push({ value: sub.id, label: `Substage: ${sub.name || sub.id}` });
    });
  });
  out.push({ value: "dst", label: `Destination (${form.destination})` });
  return out;
}

function RouteGraphPanel({ routeGraph, title = "Route graph" }) {
  const nodes = routeGraph.nodes || [];
  const edges = routeGraph.edges || [];
  if (!nodes.length) return null;

  const width = 360;
  const height = 180;
  const minLat = Math.min(...nodes.map((n) => n.lat));
  const maxLat = Math.max(...nodes.map((n) => n.lat));
  const minLng = Math.min(...nodes.map((n) => n.lng));
  const maxLng = Math.max(...nodes.map((n) => n.lng));
  const px = (lng) => 20 + ((lng - minLng) / Math.max(0.001, maxLng - minLng)) * (width - 40);
  const py = (lat) => height - (20 + ((lat - minLat) / Math.max(0.001, maxLat - minLat)) * (height - 40));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="rounded border border-[var(--cg-border)] bg-white p-2">
      <div className="cg-muted mb-1 text-[11px] uppercase tracking-wider">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full">
        {edges.map((e, i) => (
          <line key={i} x1={px(byId[e.source].lng)} y1={py(byId[e.source].lat)} x2={px(byId[e.target].lng)} y2={py(byId[e.target].lat)} stroke="#5b7dff" strokeWidth="2" />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={px(n.lng)} cy={py(n.lat)} r="4" fill={n.kind === "stage" ? "#1f9960" : "#426eff"} />
            <text x={px(n.lng) + 6} y={py(n.lat) - 6} fontSize="10" fill="#334155">{n.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
