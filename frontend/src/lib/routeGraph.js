export function buildLiveGraph(builder, form = null) {
  const stages = builder?.stages || [];
  const srcFallback = stages[0]
    ? { lat: Number(stages[0].lat) - 0.3, lng: Number(stages[0].lng) - 0.3 }
    : { lat: 0, lng: 0 };
  const dstFallback = stages[stages.length - 1]
    ? { lat: Number(stages[stages.length - 1].lat) + 0.3, lng: Number(stages[stages.length - 1].lng) + 0.3 }
    : { lat: 0, lng: 0 };

  const sourceName = form?.origin || builder?.source?.name || "";
  const destName = form?.destination || builder?.destinationPoint?.name || "";
  if (!sourceName || !destName) return null;

  const sourceCoords = {
    lat: Number(builder?.source?.lat) || srcFallback.lat,
    lng: Number(builder?.source?.lng) || srcFallback.lng,
  };
  const destCoords = {
    lat: Number(builder?.destinationPoint?.lat) || dstFallback.lat,
    lng: Number(builder?.destinationPoint?.lng) || dstFallback.lng,
  };

  const nodes = [];
  const edges = [];
  const stageChain = [];
  const profileByNode = {};
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const lvl = (value) => {
    const v = String(value || "").toLowerCase();
    if (v === "high") return 1;
    if (v === "medium") return 0.5;
    return 0;
  };
  const edgeScore = (delay, congestion, weather, tempRisk = 0) =>
    Number((0.4 * clamp01(delay) + 0.3 * clamp01(congestion) + 0.2 * clamp01(weather) + 0.1 * clamp01(tempRisk)).toFixed(4));
  const sourceProfile = builder?.source || {};
  const destinationProfile = builder?.destinationPoint || {};

  nodes.push({
    id: "src",
    name: sourceName,
    lat: Number(sourceCoords.lat) || 0,
    lng: Number(sourceCoords.lng) || 0,
    kind: "source",
    disrupted: false,
  });

  stages.forEach((stage, idx) => {
    const sid = stage.id || `stage-${idx}`;
    nodes.push({
      id: sid,
      name: stage.name || `Stage ${idx + 1}`,
      lat: Number(stage.lat) || 0,
      lng: Number(stage.lng) || 0,
      kind: "stage",
      disrupted: Boolean(stage.disrupted),
    });
    stageChain.push(sid);
    profileByNode[sid] = stage;

    const subStages = stage.subStages || [];
    subStages.forEach((sub, sidx) => {
      const subId = sub.id || `${sid}-sub-${sidx}`;
      nodes.push({
        id: subId,
        name: sub.name || `Substage ${sidx + 1}`,
        lat: Number(sub.lat) || Number(stage.lat) || 0,
        lng: Number(sub.lng) || Number(stage.lng) || 0,
        kind: "substage",
        disrupted: Boolean(sub.disrupted),
      });
      edges.push({
        id: `${sid}->${subId}`,
        source: sid,
        target: subId,
        type: "substage_attach",
        score: null,
      });
      profileByNode[subId] = sub;
    });
  });

  nodes.push({
    id: "dst",
    name: destName,
    lat: Number(destCoords.lat) || 0,
    lng: Number(destCoords.lng) || 0,
    kind: "destination",
    disrupted: false,
  });

  const scoreByUpcomingNode = (node) => {
    if (!node) return 0;
    const type = String(node.stageType || "distribution").toLowerCase();
    let delay = 0;
    let congestion = 0;
    let weather = 0;
    let tempRisk = 0;
    if (type === "port") {
      delay = (Number(node.averageDelayHours || 0) + Number(node.customsClearanceHours || 0)) / 24;
      congestion = lvl(node.congestionLevel);
      weather = String(node.weatherCondition || "normal").toLowerCase() === "risky" ? 1 : 0;
    } else if (type === "warehouse") {
      delay = Number(node.processingDelayHours || 0) / 24;
      congestion = Number(node.capacityUtilizationPct || 0) / 100;
      weather = 0;
      tempRisk = String(node.temperatureStatus || "safe").toLowerCase() === "unsafe" ? 1 : 0;
    } else if (type === "distribution") {
      delay = Number(node.dispatchDelayHours || 0) / 24;
      congestion = (lvl(node.demandLevel) + lvl(node.localTrafficLevel)) / 2;
      weather = 0;
    } else {
      delay = Number(node.dispatchDelayHours || 0) / 24;
      congestion = (lvl(node.demandLevel) + lvl(node.localTrafficLevel)) / 2;
      weather = 0;
    }
    return edgeScore(delay, congestion, weather, tempRisk);
  };
  const scoreByDestination = () => {
    const deadline = Number(destinationProfile.deliveryDeadlineHours || form?.deadline_hours || 72);
    const delay = clamp01((72 - Math.min(Math.max(deadline, 1), 72)) / 72);
    const congestion = lvl(destinationProfile.demandLevel || "medium");
    return edgeScore(delay, congestion, 0, 0);
  };

  const chain = ["src", ...stageChain, "dst"];
  const stageOrder = chain.filter((id) => id !== "src" && id !== "dst");
  const validNode = (id) => nodes.some((n) => n.id === id);
  const addEdge = (edge) => {
    if (!edge.source || !edge.target || edge.source === edge.target) return;
    if (!validNode(edge.source) || !validNode(edge.target)) return;
    if (edges.some((e) => e.id === edge.id)) return;
    edges.push(edge);
  };

  // Manual source connection override
  const sourceTarget = builder?.source?.toNode;
  if (sourceTarget && validNode(sourceTarget) && sourceTarget !== "src") {
    addEdge({
      id: `src->${sourceTarget}`,
      source: "src",
      target: sourceTarget,
      type: "route_path",
      score: sourceTarget === "dst" ? scoreByDestination() : scoreByUpcomingNode(profileByNode[sourceTarget]),
    });
  }

  // Stage-level editable from/to routing
  stageOrder.forEach((sid, idx) => {
    const st = profileByNode[sid];
    const defaultFrom = idx === 0 ? "src" : stageOrder[idx - 1];
    const defaultTo = idx === stageOrder.length - 1 ? "dst" : stageOrder[idx + 1];
    const from = st?.fromNode && validNode(st.fromNode) ? st.fromNode : defaultFrom;
    let to = st?.toNode && validNode(st.toNode) ? st.toNode : defaultTo;
    if (to === "dst" && st?.enableSubstages && !st?.toNode) to = "";

    addEdge({
      id: `${from}->${sid}`,
      source: from,
      target: sid,
      type: "route_path",
      score: scoreByUpcomingNode(profileByNode[sid]),
    });
    if (to) {
      addEdge({
        id: `${sid}->${to}`,
        source: sid,
        target: to,
        type: "route_path",
        score: to === "dst" ? scoreByDestination() : scoreByUpcomingNode(profileByNode[to]),
      });
    }
  });

  // Manual destination incoming override
  const destFrom = builder?.destinationPoint?.fromNode;
  if (destFrom && validNode(destFrom) && destFrom !== "dst") {
    addEdge({
      id: `${destFrom}->dst`,
      source: destFrom,
      target: "dst",
      type: "route_path",
      score: scoreByDestination(),
    });
  }

  // Legacy auto-chain fallback (kept when no stage overrides exist)
  for (let i = 0; i < chain.length - 1; i += 1) {
    // Rule: a stage converted to substage flow must not connect directly to destination.
    if (chain[i + 1] === "dst") {
      const prevNode = profileByNode[chain[i]];
      if (prevNode && Boolean(prevNode.enableSubstages)) {
        continue;
      }
    }
    const isIntoDestination = chain[i + 1] === "dst";
    const upcoming = profileByNode[chain[i + 1]];
    addEdge({
      id: `${chain[i]}->${chain[i + 1]}`,
      source: chain[i],
      target: chain[i + 1],
      type: "route_path",
      score: isIntoDestination ? scoreByDestination() : scoreByUpcomingNode(upcoming),
    });
  }

  const nextStageById = {};
  stageOrder.forEach((id, i) => {
    nextStageById[id] = stageOrder[i + 1] || "dst";
  });

  stages.forEach((stage, idx) => {
    const sid = stage.id || `stage-${idx}`;
    (stage.subStages || []).forEach((sub, sidx) => {
      const subId = sub.id || `${sid}-sub-${sidx}`;
      const mode = sub.routeMode || "follow_main";
      let target = "";
      if (mode === "follow_main") target = nextStageById[sid] || "dst";
      if (mode === "to_destination") target = "dst";
      if (mode === "to_stage") target = sub.routeTarget || "";
      if (mode === "to_substage") target = sub.routeTarget || "";
      if (!target) return;
      addEdge({
        id: `${subId}->${target}`,
        source: subId,
        target,
        type: "substage_route",
        score: target === "dst" ? scoreByDestination() : scoreByUpcomingNode(profileByNode[target]),
      });
    });
  });

  // Score substage attachment edges using upcoming substage profile.
  for (const e of edges) {
    if (e.type === "substage_attach") {
      e.score = scoreByUpcomingNode(profileByNode[e.target]);
    }
  }

  // Apply source initial delay risk to outgoing source edges (as delay component)
  const srcRisk = clamp01(sourceProfile.initialDelayRisk || 0);
  for (const e of edges) {
    if (e.source === "src" && typeof e.score === "number") {
      // Recompute using same formula by injecting source risk into delay term.
      e.score = Number((0.4 * srcRisk + 0.6 * clamp01(e.score)).toFixed(4));
    }
  }

  return { nodes, edges };
}
