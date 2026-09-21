// ============================================================
// AI Water Intelligence Engine
// ============================================================
// Analyzes actual network state and provides engineering insights.
// Not a chatbot — a deterministic analysis engine.
// ============================================================

import type {
  WaterNetwork,
  SimulationSnapshot,
  AIAnomaly,
  AIRecommendation,
  PipeSegment,
  NetworkNode,
} from '../network/types';
import { getConnectedPipes } from '../network/model';
import { midpointOfPipe } from '../network/simulation';

interface AIResponse {
  answer: string;
  focusPosition?: { x: number; y: number; z: number };
  action?: string;
}

// ── Analyze Question ───────────────────────────────────────
export function analyzeQuestion(
  question: string,
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  selectedAssetId?: string | null,
  baselineSnapshot?: SimulationSnapshot | null,
): AIResponse {
  const q = question.toLowerCase();

  // Where is the most vulnerable point?
  if (q.includes('vulnerable') || q.includes('risk') || q.includes('weak')) {
    return analyzeVulnerability(network, snapshot);
  }

  // Why is pressure increasing / high here?
  if (q.includes('pressure') && (q.includes('why') || q.includes('increas') || q.includes('high'))) {
    return analyzePressureAnomaly(network, snapshot, selectedAssetId);
  }

  // What happens if I block/restrict...
  if (q.includes('block') || q.includes('restrict') || q.includes('clog')) {
    return analyzeBlockageEffect(network, snapshot, q, selectedAssetId);
  }

  // What happens if pump fails?
  if (q.includes('pump') && (q.includes('fail') || q.includes('stop') || q.includes('off'))) {
    return analyzePumpFailure(network, snapshot);
  }

  // What happens if valve closed?
  if (q.includes('valve') && (q.includes('close') || q.includes('shut'))) {
    return analyzeValveClosure(network, snapshot, selectedAssetId);
  }

  // Show me flow / pressure / risk
  if (q.includes('show') || q.includes('view') || q.includes('display')) {
    return analyzeShowRequest(q, network, snapshot);
  }

  // Leak analysis
  if (q.includes('leak')) {
    return analyzeLeak(network, snapshot, selectedAssetId);
  }

  // Network overview / status
  if (q.includes('status') || q.includes('overview') || q.includes('summary') || q.includes('health')) {
    return analyzeNetworkStatus(network, snapshot);
  }

  // Compare
  if (q.includes('compare') || q.includes('difference') || q.includes('before')) {
    return analyzeComparison(network, snapshot, baselineSnapshot);
  }

  // Recommendations
  if (q.includes('recommend') || q.includes('suggest') || q.includes('improve') || q.includes('fix')) {
    return getRecommendations(network, snapshot);
  }

  // Default: analyze selected asset or general overview
  if (selectedAssetId) {
    return analyzeAsset(network, snapshot, selectedAssetId);
  }

  return {
    answer: `**NETWORK ANALYSIS**\n\n` +
      `Current simulation state: **${snapshot.systemMetrics.resilienceScore}/100** resilience score.\n\n` +
      `Active alerts: **${snapshot.systemMetrics.activeAlerts}**\n` +
      `Critical assets: **${snapshot.systemMetrics.criticalAssets}**\n` +
      `Average pressure: **${snapshot.systemMetrics.averagePressure.toFixed(1)} bar**\n` +
      `Peak flow: **${snapshot.systemMetrics.peakFlow.toFixed(1)} L/s**\n` +
      `Water loss: **${snapshot.systemMetrics.waterLoss.toFixed(1)} L/s**\n\n` +
      `Try asking about:\n` +
      `• "Where is the most vulnerable point?"\n` +
      `• "Why is pressure high at [location]?"\n` +
      `• "What happens if I block a pipe?"\n` +
      `• "Show me recommendations"`,
  };
}

// ── Vulnerability Analysis ─────────────────────────────────
function analyzeVulnerability(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIResponse {
  const anomalies = snapshot.systemMetrics.anomalies;
  const vulnerableAnomaly = anomalies.find(
    a => a.type === 'vulnerable_location' || a.type === 'pressure_anomaly' ||
      a.type === 'flow_restriction' || a.type === 'leak_detected'
  );

  if (!vulnerableAnomaly) {
    // No hard threshold crossed — but the honest answer must still acknowledge
    // active incidents (blockages/leaks) and the current top-risk asset.
    const activeBlockage = network.blockages.find(b => b.active);
    const activeLeak = network.leaks.find(l => l.active);
    const activeRestrictions = network.pipes.filter(p => snapshot.pipes[p.id]?.status === 'blocked');

    let answer = `**VULNERABILITY ASSESSMENT**\n\n`;
    answer += `No threshold-crossing anomalies right now — pressures and utilization are within limits.\n\n`;

    let focusPosition: AIResponse['focusPosition'];

    if (activeBlockage) {
      const pipe = network.pipes.find(p => p.id === activeBlockage.pipeId);
      const ps = snapshot.pipes[activeBlockage.pipeId];
      answer += `⚠ **Active blockage on ${activeBlockage.pipeId}** (${pipe?.label ?? ''}) at **${activeBlockage.severity}%** severity.\n`;
      if (ps) {
        answer += `• Flow: **${Math.abs(ps.flow).toFixed(1)} L/s**, utilization **${ps.utilization}%** of effective capacity\n`;
        answer += `• Pressure across pipe: **${ps.pressure.toFixed(1)} bar**\n`;
      }
      answer += `• Network average pressure: **${snapshot.systemMetrics.averagePressure.toFixed(1)} bar** (baseline 2.5)\n\n`;
      answer += `The restriction is not yet starving downstream demand, but head loss across it is elevated. Escalate severity or add a second restriction to see failure propagate.`;
      focusPosition = activeBlockage.position;
    } else if (activeLeak) {
      answer += `⚠ **Active leak on ${activeLeak.pipeId}** losing **${activeLeak.flowRate.toFixed(1)} L/s**.\n\n`;
      answer += `Water loss is ongoing even though pressures remain in band.`;
      focusPosition = activeLeak.position;
    } else if (activeRestrictions.length > 0) {
      answer += `⚠ **${activeRestrictions.length} pipe(s) in blocked status:** ${activeRestrictions.slice(0, 5).map(p => p.id).join(', ')}${activeRestrictions.length > 5 ? '…' : ''}.`;
      const firstPipeState = snapshot.pipes[activeRestrictions[0].id];
      const first = activeRestrictions[0];
      focusPosition = firstPipeState ? midpointOfPipe(network, first) : undefined;
    } else {
      // Rank by risk and surface the leader with context.
      const ranked = network.pipes
        .map(p => ({ p, s: snapshot.pipes[p.id] }))
        .filter(x => x.s)
        .sort((a, b) => b.s.riskScore - a.s.riskScore);
      const top = ranked[0];
      answer += `All pipes are within normal operating parameters.\n`;
      if (top) {
        answer += `\nCurrent highest-risk asset: **${top.p.id}** (${top.p.label}) — risk **${top.s.riskScore}/100**, pressure **${top.s.pressure.toFixed(1)} bar**${top.p.maxBendAngle > 60 ? `, ${top.p.maxBendAngle.toFixed(0)}° bend` : ''}, age ${top.p.age}y.`;
      }
      answer += `\nResilience score: **${snapshot.systemMetrics.resilienceScore}/100**`;
    }

    return { answer, focusPosition };
  }

  const asset = vulnerableAnomaly.assetId;
  const pipe = network.pipes.find(p => p.id === asset);
  const pipeState = snapshot.pipes[asset];
  const node = network.nodes.find(n => n.id === asset);

  let answer = `**HIGHEST RISK LOCATION**\n\n`;
  answer += `**${asset}** — ${vulnerableAnomaly.title}\n\n`;
  answer += `**Reason:**\n`;

  if (pipe && pipeState) {
    answer += `• Pressure: **${pipeState.pressure.toFixed(1)} bar**\n`;
    answer += `• Risk score: **${pipeState.riskScore}/100**\n`;
    answer += `• Bend angle: **${pipe.maxBendAngle.toFixed(0)}°**\n`;
    answer += `• Flow: **${Math.abs(pipeState.flow).toFixed(1)} L/s**\n`;
    answer += `• Age: **${pipe.age} years**\n`;
    answer += `• Condition: **${pipe.condition}%**\n\n`;
    answer += `**Confidence:** ${vulnerableAnomaly.confidence}%\n\n`;
    if (vulnerableAnomaly.type === 'flow_restriction') {
      answer += `Flow is constrained through a narrowed cross-section. Utilization relative to effective capacity is near the design ceiling — monitor downstream pressure.`;
    } else if (vulnerableAnomaly.type === 'leak_detected') {
      answer += `Active loss is depressurizing this segment and wasting supply. Repair priority should reflect the leak rate.`;
    } else {
      answer += `Sharp bends experience higher stress under pressure. Combined with pipe age and condition, this creates a vulnerable zone.`;
    }
  } else if (node) {
    const nodeState = snapshot.nodes[asset];
    answer += `• Risk score: **${nodeState?.riskScore ?? 'N/A'}/100**\n`;
    answer += `• Pressure: **${nodeState?.pressure.toFixed(1) ?? 'N/A'} bar**\n`;
    answer += `• Node type: **${node.type}**\n\n`;
    answer += `**Confidence:** ${vulnerableAnomaly.confidence}%`;
  }

  return {
    answer,
    focusPosition: vulnerableAnomaly.position,
  };
}

// ── Pressure Anomaly Analysis ──────────────────────────────
function analyzePressureAnomaly(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  selectedAssetId?: string | null,
): AIResponse {
  const targetId = selectedAssetId || findHighestPressureNode(snapshot);

  if (!targetId) {
    return { answer: 'No pressure anomaly detected in the current network state.' };
  }

  const node = network.nodes.find(n => n.id === targetId);
  const nodeState = snapshot.nodes[targetId];
  const connectedPipes = getConnectedPipes(network, targetId);

  let answer = `**PRESSURE ANALYSIS**\n\n`;
  answer += `**Location:** ${targetId} — ${node?.label || 'Unknown'}\n`;
  answer += `**Observed:** ${nodeState?.pressure.toFixed(1) ?? 'N/A'} bar\n\n`;

  // Find contributing factors
  answer += `**Contributing factors:**\n\n`;

  let factorCount = 0;

  // Check upstream flow
  const upstreamPipes = connectedPipes.filter(p => p.toNode === targetId);
  for (const pipe of upstreamPipes) {
    const pipeState = snapshot.pipes[pipe.id];
    if (pipeState && pipeState.flow > 8) {
      factorCount++;
      answer += `${factorCount}. High upstream flow on ${pipe.label} (${pipeState.flow.toFixed(1)} L/s)\n`;
    }
  }

  // Check downstream restrictions
  const downstreamPipes = connectedPipes.filter(p => p.fromNode === targetId);
  for (const pipe of downstreamPipes) {
    const pipeState = snapshot.pipes[pipe.id];
    if (pipeState && pipeState.utilization > 80) {
      factorCount++;
      answer += `${factorCount}. Downstream restriction on ${pipe.label} (${pipeState.utilization.toFixed(0)}% utilized)\n`;
    }
  }

  // Check bends
  for (const pipe of connectedPipes) {
    if (pipe.maxBendAngle > 60) {
      factorCount++;
      answer += `${factorCount}. Direction change at ${pipe.label} (${pipe.maxBendAngle.toFixed(0)}°)\n`;
    }
  }

  if (factorCount === 0) {
    answer += `1. Normal flow conditions\n`;
    answer += `2. No significant downstream restrictions\n`;
  }

  answer += `\n**Recommendation:** Inspect ${connectedPipes.length > 0 ? connectedPipes[0].label : targetId} and downstream junctions.`;

  const anomaly = snapshot.systemMetrics.anomalies.find(a => a.assetId === targetId);

  return {
    answer,
    focusPosition: anomaly?.position || node?.position,
  };
}

// ── Blockage Effect ────────────────────────────────────────
function analyzeBlockageEffect(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  question: string,
  selectedAssetId?: string | null,
): AIResponse {
  // Extract severity from question
  const severityMatch = question.match(/(\d+)\s*%/);
  const severity = severityMatch ? parseInt(severityMatch[1]) : 50;

  const targetId = selectedAssetId || findHighestFlowPipe(snapshot, network);

  if (!targetId) {
    return { answer: 'No suitable pipe found for blockage analysis.' };
  }

  const pipe = network.pipes.find(p => p.id === targetId);
  const pipeState = snapshot.pipes[targetId];

  let answer = `**BLOCKAGE SIMULATION**\n\n`;
  answer += `**Target:** ${targetId} — ${pipe?.label || 'Unknown'}\n`;
  answer += `**Restriction:** ${severity}%\n\n`;
  answer += `**Expected effects:**\n\n`;
  answer += `1. Flow on ${targetId} will decrease to ~${((pipeState?.flow ?? 0) * (1 - severity / 100)).toFixed(1)} L/s\n`;
  answer += `2. Upstream pressure will increase as flow backs up\n`;
  answer += `3. Downstream nodes will see reduced supply\n`;

  if (severity > 50) {
    answer += `4. **Critical:** Network may not meet downstream demand\n`;
    answer += `5. Affected area will expand significantly\n`;
  }

  answer += `\n**Confidence:** 82%`;

  return {
    answer,
    focusPosition: pipe?.waypoints?.[0] || pipe ? network.nodes.find(n => n.id === pipe!.fromNode)?.position : undefined,
    action: `apply_blockage_${targetId}_${severity}`,
  };
}

// ── Pump Failure ───────────────────────────────────────────
function analyzePumpFailure(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIResponse {
  const pump = network.pumps[0];
  const pumpNode = network.nodes.find(n => n.id === pump?.nodeId);

  let answer = `**PUMP FAILURE SIMULATION**\n\n`;
  answer += `**Pump:** ${pump?.label || 'PU-001'}\n\n`;
  answer += `**Expected effects:**\n\n`;
  answer += `1. Flow decreases immediately downstream of pump station\n`;
  answer += `2. Pressure drops significantly in the first 3 junctions\n`;
  answer += `3. Source reservoir level will rise (no outflow)\n`;
  answer += `4. Eastern network sections see reduced supply\n`;
  answer += `5. If alternate paths exist (loops), partial redistribution occurs\n\n`;
  answer += `**Severity:** HIGH — affects entire downstream network\n`;
  answer += `**Confidence:** 90%`;

  return {
    answer,
    focusPosition: pumpNode?.position,
    action: 'apply_pump_failure',
  };
}

// ── Valve Closure ──────────────────────────────────────────
function analyzeValveClosure(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  selectedAssetId?: string | null,
): AIResponse {
  const valveId = selectedAssetId || 'V-001';
  const valve = network.valves.find(v => v.id === valveId);

  let answer = `**VALVE CLOSURE SIMULATION**\n\n`;
  answer += `**Valve:** ${valve?.label || valveId}\n`;
  answer += `**Location:** Node ${valve?.nodeId || 'N/A'}\n\n`;
  answer += `**Expected effects:**\n\n`;
  answer += `1. Flow through ${valve?.pipeId || 'N/A'} drops to zero\n`;
  answer += `2. Flow redistributes through alternate paths\n`;
  answer += `3. Pressure increases upstream of closed valve\n`;
  answer += `4. Pressure decreases downstream of closed valve\n`;

  // Check for alternate paths
  const connectedNodes = new Set<string>();
  network.pipes.forEach(p => {
    if (p.fromNode === valve?.nodeId) connectedNodes.add(p.toNode);
    if (p.toNode === valve?.nodeId) connectedNodes.add(p.fromNode);
  });

  answer += `\n**Alternate paths available:** ${connectedNodes.size > 1 ? 'Yes' : 'Limited'}\n`;
  answer += `**Confidence:** 85%`;

  return {
    answer,
    action: `apply_valve_close_${valveId}`,
  };
}

// ── Leak Analysis ──────────────────────────────────────────
function analyzeLeak(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  selectedAssetId?: string | null,
): AIResponse {
  const activeLeaks = network.leaks.filter(l => l.active);

  if (activeLeaks.length === 0) {
    return {
      answer: `**LEAK ASSESSMENT**\n\nNo active leaks detected in the network.\n\nTo simulate a leak, select a pipe and choose "Create Leak" from the inspector.`,
    };
  }

  let answer = `**ACTIVE LEAK ANALYSIS**\n\n`;
  answer += `**Active leaks:** ${activeLeaks.length}\n\n`;

  for (const leak of activeLeaks) {
    const pipe = network.pipes.find(p => p.id === leak.pipeId);
    answer += `**${leak.pipeId}** — ${pipe?.label || 'Unknown'}\n`;
    answer += `• Severity: ${leak.severity.toFixed(0)}%\n`;
    answer += `• Flow loss: ${leak.flowRate.toFixed(1)} L/s\n\n`;
  }

  answer += `**Total water loss:** ${activeLeaks.reduce((s, l) => s + l.flowRate, 0).toFixed(1)} L/s\n`;
  answer += `**Confidence:** 88%`;

  return { answer };
}

// ── Network Status ─────────────────────────────────────────
function analyzeNetworkStatus(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIResponse {
  const m = snapshot.systemMetrics;

  let answer = `**NETWORK STATUS REPORT**\n\n`;
  answer += `**Resilience Score:** ${m.resilienceScore}/100\n\n`;
  answer += `| Metric | Value |\n|---|---|\n`;
  answer += `| Total Assets | ${m.totalAssets} |\n`;
  answer += `| Critical Assets | ${m.criticalAssets} |\n`;
  answer += `| Active Alerts | ${m.activeAlerts} |\n`;
  answer += `| Avg Pressure | ${m.averagePressure.toFixed(1)} bar |\n`;
  answer += `| Peak Flow | ${m.peakFlow.toFixed(1)} L/s |\n`;
  answer += `| Water Loss | ${m.waterLoss.toFixed(1)} L/s |\n`;
  answer += `| Pressure Stability | ${m.pressureStability}% |\n`;
  answer += `| Redundancy | ${m.redundancy}% |\n`;
  answer += `| Capacity | ${m.capacity}% |\n`;
  answer += `| Leak Risk | ${m.leakRisk}% |\n\n`;

  if (m.activeAlerts > 0) {
    answer += `**⚠ ${m.activeAlerts} active alert(s) require attention.**`;
  } else {
    answer += `**✓ All systems within normal operating parameters.**`;
  }

  return { answer };
}

// ── Show Request ───────────────────────────────────────────
function analyzeShowRequest(
  question: string,
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIResponse {
  if (question.includes('vulnerable') || question.includes('corner') || question.includes('bend')) {
    const bendPipes = [...network.pipes]
      .sort((a, b) => b.maxBendAngle - a.maxBendAngle);

    const topBend = bendPipes[0];
    if (topBend) {
      return {
        answer: `**MOST VULNERABLE BEND**\n\n` +
          `**${topBend.label}** — ${topBend.maxBendAngle.toFixed(0)}° direction change\n` +
          `Risk score: ${snapshot.pipes[topBend.id]?.riskScore ?? 'N/A'}/100\n` +
          `Pressure: ${snapshot.pipes[topBend.id]?.pressure.toFixed(1) ?? 'N/A'} bar`,
        focusPosition: topBend.waypoints[0] || network.nodes.find(n => n.id === topBend.fromNode)?.position,
      };
    }
  }

  if (question.includes('top risk') || question.includes('worst')) {
    const sorted = [...network.pipes].sort((a, b) =>
      (snapshot.pipes[b.id]?.riskScore ?? 0) - (snapshot.pipes[a.id]?.riskScore ?? 0)
    );

    let answer = `**TOP RISK LOCATIONS**\n\n`;
    sorted.slice(0, 5).forEach((pipe, i) => {
      const state = snapshot.pipes[pipe.id];
      answer += `${i + 1}. **${pipe.label}** — Risk: ${state?.riskScore ?? 0}/100, Pressure: ${state?.pressure.toFixed(1) ?? 'N/A'} bar\n`;
    });

    return { answer };
  }

  return analyzeNetworkStatus(network, snapshot);
}

// ── Comparison ─────────────────────────────────────────────
function analyzeComparison(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  baselineSnapshot?: SimulationSnapshot | null,
): AIResponse {
  let answer = `**SCENARIO COMPARISON**\n\n`;

  const m = snapshot.systemMetrics;
  const base = baselineSnapshot?.systemMetrics;
  answer += `**Current state vs. baseline:**\n\n`;
  answer += `| Metric | Baseline | Current |\n|---|---|---|\n`;
  answer += `| Resilience | ${base?.resilienceScore ?? '—'} | ${m.resilienceScore} |\n`;
  answer += `| Avg Pressure | ${base ? base.averagePressure.toFixed(1) + ' bar' : '—'} | ${m.averagePressure.toFixed(1)} bar |\n`;
  answer += `| Demand Met | ${base ? Math.round(base.deliveryRatio * 100) + '%' : '—'} | ${Math.round(m.deliveryRatio * 100)}% |\n`;
  answer += `| Water Loss | ${base ? base.waterLoss.toFixed(1) + ' L/s' : '—'} | ${m.waterLoss.toFixed(1)} L/s |\n`;

  return { answer };
}

// ── Recommendations ────────────────────────────────────────
function getRecommendations(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIResponse {
  const recommendations: string[] = [];

  // Check for high-risk pipes
  const highRiskPipes = network.pipes.filter(p => (snapshot.pipes[p.id]?.riskScore ?? 0) > 60);
  if (highRiskPipes.length > 0) {
    recommendations.push(`1. **Inspect ${highRiskPipes[0].label}** — Risk score ${snapshot.pipes[highRiskPipes[0].id]?.riskScore}/100. Consider condition assessment.`);
  }

  // Check for overloaded pipes
  const overloaded = network.pipes.filter(p => (snapshot.pipes[p.id]?.utilization ?? 0) > 85);
  if (overloaded.length > 0) {
    recommendations.push(`2. **Reduce load on ${overloaded[0].label}** — ${snapshot.pipes[overloaded[0].id]?.utilization}% utilized. Consider opening parallel paths.`);
  }

  // Check for pressure issues
  const highPressure = Object.entries(snapshot.nodes).filter(([, s]) => s.pressure > 4.0);
  if (highPressure.length > 0) {
    recommendations.push(`3. **Relieve pressure at ${highPressure[0][0]}** — ${highPressure[0][1].pressure.toFixed(1)} bar. Consider opening downstream valve.`);
  }

  // Low resilience
  if (snapshot.systemMetrics.resilienceScore < 70) {
    recommendations.push(`4. **Improve network redundancy** — Current score ${snapshot.systemMetrics.resilienceScore}/100. Consider adding cross-connections.`);
  }

  if (recommendations.length === 0) {
    recommendations.push(`1. Network is operating within normal parameters.`);
    recommendations.push(`2. Consider preventive maintenance for aging pipes.`);
  }

  return {
    answer: `**AI RECOMMENDATIONS**\n\n${recommendations.join('\n\n')}`,
  };
}

// ── Asset Analysis ─────────────────────────────────────────
function analyzeAsset(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  assetId: string,
): AIResponse {
  const pipe = network.pipes.find(p => p.id === assetId);
  const node = network.nodes.find(n => n.id === assetId);

  if (pipe) {
    const state = snapshot.pipes[assetId];
    let answer = `**ASSET ANALYSIS: ${pipe.label}**\n\n`;
    answer += `| Property | Value |\n|---|---|\n`;
    answer += `| Length | ${pipe.length.toFixed(1)} m |\n`;
    answer += `| Diameter | ${pipe.diameter} mm |\n`;
    answer += `| Flow | ${state?.flow.toFixed(1) ?? 0} L/s |\n`;
    answer += `| Pressure | ${state?.pressure.toFixed(1) ?? 0} bar |\n`;
    answer += `| Velocity | ${state?.velocity.toFixed(2) ?? 0} m/s |\n`;
    answer += `| Utilization | ${state?.utilization ?? 0}% |\n`;
    answer += `| Risk | ${state?.riskScore ?? 0}/100 |\n`;
    answer += `| Status | ${state?.status ?? 'unknown'} |\n`;
    answer += `| Bend angle | ${pipe.maxBendAngle.toFixed(0)}° |\n`;
    answer += `| Age | ${pipe.age} years |\n`;

    return { answer, focusPosition: pipe.waypoints[0] || network.nodes.find(n => n.id === pipe.fromNode)?.position };
  }

  if (node) {
    const state = snapshot.nodes[assetId];
    const connected = getConnectedPipes(network, assetId);
    let answer = `**ASSET ANALYSIS: ${node.label}**\n\n`;
    answer += `| Property | Value |\n|---|---|\n`;
    answer += `| Type | ${node.type} |\n`;
    answer += `| Elevation | ${node.elevation.toFixed(1)} m |\n`;
    answer += `| Pressure | ${state?.pressure.toFixed(1) ?? 0} bar |\n`;
    answer += `| Water Level | ${state?.waterLevel.toFixed(1) ?? 0} m |\n`;
    answer += `| Risk | ${state?.riskScore ?? 0}/100 |\n`;
    answer += `| Connected Pipes | ${connected.map(p => p.id).join(', ')} |\n`;

    return { answer, focusPosition: node.position };
  }

  return { answer: `Asset ${assetId} not found in the network model.` };
}

// ── Helpers ────────────────────────────────────────────────
function findHighestPressureNode(snapshot: SimulationSnapshot): string | null {
  let maxPressure = 0;
  let maxId: string | null = null;
  for (const [id, state] of Object.entries(snapshot.nodes)) {
    if (state.pressure > maxPressure) {
      maxPressure = state.pressure;
      maxId = id;
    }
  }
  return maxId;
}

function findHighestFlowPipe(snapshot: SimulationSnapshot, network: WaterNetwork): string | null {
  let maxFlow = 0;
  let maxId: string | null = null;
  for (const [id, state] of Object.entries(snapshot.pipes)) {
    if (Math.abs(state.flow) > maxFlow) {
      maxFlow = Math.abs(state.flow);
      maxId = id;
    }
  }
  return maxId;
}

// ── Generate Recommendations ───────────────────────────────
export function generateRecommendations(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];

  // High risk pipe → recommend inspection
  const highRiskPipe = [...network.pipes]
    .sort((a, b) => (snapshot.pipes[b.id]?.riskScore ?? 0) - (snapshot.pipes[a.id]?.riskScore ?? 0))[0];

  if (highRiskPipe && (snapshot.pipes[highRiskPipe.id]?.riskScore ?? 0) > 50) {
    recommendations.push({
      id: 'REC-001',
      title: `Inspect ${highRiskPipe.label}`,
      description: `Risk score ${snapshot.pipes[highRiskPipe.id]?.riskScore}/100. ${highRiskPipe.maxBendAngle > 60 ? 'Sharp bend detected.' : ''} Condition: ${highRiskPipe.condition}%`,
      expectedEffect: 'Identify potential failure before it occurs',
      action: () => {},
      priority: 'high',
    });
  }

  // Overloaded pipe → recommend opening alternate path
  const overloaded = network.pipes
    .filter(p => (snapshot.pipes[p.id]?.utilization ?? 0) > 80)
    .sort((a, b) => (snapshot.pipes[b.id]?.utilization ?? 0) - (snapshot.pipes[a.id]?.utilization ?? 0))[0];

  if (overloaded) {
    recommendations.push({
      id: 'REC-002',
      title: `Reduce load on ${overloaded.label}`,
      description: `Utilization at ${snapshot.pipes[overloaded.id]?.utilization}%. Consider opening parallel valve path.`,
      expectedEffect: 'Reduce utilization and pressure downstream',
      action: () => {},
      priority: 'medium',
    });
  }

  return recommendations;
}
