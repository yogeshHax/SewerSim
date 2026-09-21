// ============================================================
// Simulation Engine — Water Resilience Network
// ============================================================
// Deterministic simulation that calculates flow, pressure,
// velocity, risk, and water levels from network state.
// Not a full hydraulic solver, but internally consistent.
// ============================================================

import type {
  WaterNetwork,
  NetworkNode,
  PipeSegment,
  SimulationSnapshot,
  SimulationState,
  SystemMetrics,
  AIAnomaly,
  Leak,
  Blockage,
  ViewMode,
  Vector3,
} from './types';

// ── Constants ──────────────────────────────────────────────
const GRAVITY = 9.81;
const WATER_DENSITY = 998; // kg/m³
const DEFAULT_SOURCE_PRESSURE = 2.8; // bar at source
const DEFAULT_SOURCE_FLOW = 32; // L/s available supply (network demand ≈ 27 L/s)
const PUMP_FAILED_PRESSURE = 0.6; // bar — pump failure collapses source pressure
const RISK_WEIGHT_PRESSURE = 0.3;
const RISK_WEIGHT_BEND = 0.25;
const RISK_WEIGHT_AGE = 0.15;
const RISK_WEIGHT_FLOW = 0.15;
const RISK_WEIGHT_CONDITION = 0.15;

// ── MODEL CALIBRATION (disclosed simplification) ───────────
// Hazen-Williams head loss is computed with its physically correct form, then
// multiplied by this factor. A real 25 L/s flow in a 250 mm pipe loses only
// ~0.01 bar per 100 m, which would make the pressure view visually flat. This
// amplification exaggerates the gradient so pressure variation is legible in
// the visualization. It is a VISUALIZATION CALIBRATION, not a physical
// coefficient — the network is NOT a calibrated hydraulic model.
const HEAD_LOSS_AMPLIFICATION = 70;

// ── Pressure Calculation ───────────────────────────────────
function calcPressureLoss(
  flow: number, // L/s
  diameter: number, // mm
  length: number, // m
  roughness: number,
  bendAngles: number[],
): { headLoss: number; pressureDrop: number } {
  // Hazen-Williams approximation
  const Q = Math.abs(flow) / 1000; // m³/s
  const D = diameter / 1000; // m
  const C = roughness;

  if (Q === 0 || D === 0) return { headLoss: 0, pressureDrop: 0 };

  // HW head loss: h_f = (10.67 * L * Q^1.852) / (C^1.852 * D^4.87)
  const headLossPerM = (10.67 * Math.pow(Q, 1.852)) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
  // Visualization calibration — see HEAD_LOSS_AMPLIFICATION comment above.
  const headLoss = headLossPerM * length * HEAD_LOSS_AMPLIFICATION;

  // Add bend losses (each bend adds equivalent length)
  let bendLoss = 0;
  for (const angle of bendAngles) {
    // K factor for bends: increases with angle
    const K = 0.2 * Math.pow(angle / 90, 1.5);
    bendLoss += K * (Q * Q) / (2 * GRAVITY * Math.PI * Math.PI * Math.pow(D / 2, 4));
  }

  const totalHeadLoss = headLoss + bendLoss;
  const pressureDrop = totalHeadLoss * WATER_DENSITY * GRAVITY / 100000; // bar

  return { headLoss: totalHeadLoss, pressureDrop };
}

// ── Flow Distribution ──────────────────────────────────────
// DEMAND-DRIVEN, MASS-CONSERVING ALLOCATION (simplified model).
//
// Water is pulled by downstream demand, not pushed by an arbitrary source
// share. Each junction extracts its own demand; the remainder is split among
// outgoing pipes in proportion to what each downstream branch actually needs,
// weighted by pipe conductance (size, blockage, leak, valve). Flows are solved
// by fixed-point iteration, which converges because every loop in this network
// has gain < 1 (each loop junction has ≥2 in-pipes, so conductance shares are
// fractional).
//
// Conservation: flow out of the source == delivered demand + leak losses.
// This is NOT a full hydraulic solver (no simultaneous energy/continuity
// matrix solve). It is a demand-driven approximation in the style of a
// simplified EPANET demand analysis.
export interface FlowResult {
  flow: Map<string, number>;
  deliveredDemand: Map<string, number>; // L/s actually extracted at each node
  restrictions: Map<string, number>; // 0-100 effective restriction per pipe
  totalDemand: number; // L/s requested by the network (incl. storm load)
  totalDelivered: number; // L/s actually supplied
  supply: number; // L/s available at source
  deliveryRatio: number; // 0-1, 1 = all demand met
}

// Per-pipe conductance 0..1 — how freely this pipe passes its share.
function computeConductance(
  network: WaterNetwork,
  pipeRestrictions?: Record<string, number>,
): Map<string, number> {
  const cond = new Map<string, number>();
  for (const pipe of network.pipes) {
    // Larger pipes carry disproportionately more (~D²).
    const sizeFactor = Math.pow(pipe.diameter / 200, 2);

    // Blockage: explicit blockage or manual restriction override.
    const manualRestriction = pipeRestrictions?.[pipe.id];
    const blockage = network.blockages.find(b => b.pipeId === pipe.id && b.active);
    const blockageSeverity = manualRestriction != null ? manualRestriction : (blockage ? blockage.severity : 0);
    const blockageFactor = Math.max(0.01, 1 - blockageSeverity / 100);

    // Leak: severity s removes up to half the passing flow (s/200).
    const leak = network.leaks.find(l => l.pipeId === pipe.id && l.active);
    const leakFactor = leak ? Math.max(0.5, 1 - leak.severity / 200) : 1;

    // Valve: throttles in proportion to openness.
    const valve = network.valves.find(v => v.pipeId === pipe.id);
    const valveFactor = valve ? Math.max(0.01, valve.openness / 100) : 1;

    cond.set(pipe.id, Math.max(0.005, sizeFactor * blockageFactor * leakFactor * valveFactor));
  }
  return cond;
}

// Absolute capacity per pipe in L/s — the most a pipe may carry before it is
// considered saturated (≈ V_MAX m/s). Caps let blockages STARVE downstream
// demand rather than merely re-routing it, which is the observable effect of
// a real restriction in a network with limited alternate paths.
const V_MAX = 2.0; // m/s design velocity ceiling for distribution mains
function computeCapacity(
  network: WaterNetwork,
  pipeRestrictions?: Record<string, number>,
): Map<string, number> {
  const cap = new Map<string, number>();
  for (const pipe of network.pipes) {
    const D = pipe.diameter / 1000; // m
    const area = Math.PI * Math.pow(D / 2, 2); // m²
    const manualRestriction = pipeRestrictions?.[pipe.id];
    const blockage = network.blockages.find(b => b.pipeId === pipe.id && b.active);
    const blockageSeverity = manualRestriction != null ? manualRestriction : (blockage ? blockage.severity : 0);
    const blockageFactor = Math.max(0.01, 1 - blockageSeverity / 100);
    const valve = network.valves.find(v => v.pipeId === pipe.id);
    const valveFactor = valve ? Math.max(0.01, valve.openness / 100) : 1;
    cap.set(pipe.id, area * V_MAX * 1000 * blockageFactor * valveFactor);
  }
  return cap;
}

// Storm/demand time profile — makes the simulation timeline meaningful.
// A "heavy water event" (inflowMultiplier > 1) ramps in like a rainfall
// hydrograph (starting partway so the effect is visible immediately), peaks,
// then recedes. A gentle diurnal wiggle always applies.
function computeLoadFactor(state: SimulationState): number {
  const base = state.inflowMultiplier;
  const t = state.duration > 0 ? Math.min(Math.max(state.time / state.duration, 0), 1) : 0;
  // Diurnal demand variation across the scenario window.
  const diurnal = 1 + 0.06 * Math.sin(t * Math.PI * 4);

  if (base <= 1.0001) return base * diurnal;

  // Hydrograph shape: 0.5 at t=0, 1.0 over the peak window, receding to 0.4.
  let shape: number;
  if (t < 0.3) shape = 0.5 + 0.5 * (t / 0.3);
  else if (t < 0.7) shape = 1;
  else shape = Math.max(0.4, 1 - ((t - 0.7) / 0.3) * 0.6);

  return (1 + (base - 1) * shape) * diurnal;
}

// Minimum service pressure. Below this, delivered demand falls off
// proportionally (pressure-dependent demand, as in PDA solvers) — a network
// that cannot sustain pressure cannot actually deliver its demand.
const MIN_SERVICE_PRESSURE = 1.5; // bar

function distributeFlow(
  network: WaterNetwork,
  state: SimulationState,
  pressureDemandScale?: Map<string, number>,
): FlowResult {
  const source = network.nodes.find(n => n.type === 'source');
  const supply = state.sourceFlow ?? DEFAULT_SOURCE_FLOW;
  const loadFactor = computeLoadFactor(state);

  // Requested demand at every node, scaled by the storm load factor and by the
  // pressure-dependent demand factor from a previous solve pass.
  const pressureFactor = (id: string) => pressureDemandScale?.get(id) ?? 1;
  const totalDemand = network.nodes.reduce((s, n) => s + n.demand, 0) * loadFactor;
  const deliveryRatio = totalDemand > 0 ? Math.min(1, supply / totalDemand) : 1;

  // Leaks act as additional demand extracted at the leak's downstream node.
  const demandOf = new Map<string, number>();
  for (const node of network.nodes) {
    demandOf.set(node.id, node.demand * loadFactor * deliveryRatio * pressureFactor(node.id));
  }
  for (const leak of network.leaks.filter(l => l.active)) {
    const pipe = network.pipes.find(p => p.id === leak.pipeId);
    if (!pipe) continue;
    const downId = pipe.toNode;
    demandOf.set(downId, (demandOf.get(downId) ?? 0) + leak.flowRate * deliveryRatio);
  }

  const conductance = computeConductance(network, state.pipeRestrictions);
  const capacity = computeCapacity(network, state.pipeRestrictions);

  // Effective restriction per pipe (blockage or manual override) — used by the
  // pressure solver for local head loss.
  const restrictions = new Map<string, number>();
  for (const pipe of network.pipes) {
    const manualRestriction = state.pipeRestrictions?.[pipe.id];
    const blockage = network.blockages.find(b => b.pipeId === pipe.id && b.active);
    const sev = manualRestriction != null ? manualRestriction : (blockage ? blockage.severity : 0);
    restrictions.set(pipe.id, Math.max(0, Math.min(100, sev)));
  }

  // In-pipe lookup: nodeId -> pipes feeding into it.
  const inPipes = new Map<string, PipeSegment[]>();
  const outPipes = new Map<string, PipeSegment[]>();
  for (const node of network.nodes) {
    inPipes.set(node.id, []);
    outPipes.set(node.id, []);
  }
  for (const pipe of network.pipes) {
    inPipes.get(pipe.toNode)?.push(pipe);
    outPipes.get(pipe.fromNode)?.push(pipe);
  }

  // Fixed-point iteration.
  // need[v]  = demandOf[v] + Σ flow on out-pipes of v
  // flow[p]  = min( need[to(p)] · conductance[p] / Σ conductance of in-pipes of to(p),
  //                 capacity[p] )
  const need = new Map<string, number>();
  for (const [id, d] of demandOf) need.set(id, d);
  const flow = new Map<string, number>();
  for (const pipe of network.pipes) flow.set(pipe.id, 0);

  const MAX_ITER = 200;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let maxChange = 0;

    // Recompute flows from needs.
    for (const [vId, pipes] of inPipes) {
      // The source generates flow; it must not also receive circulating flow.
      // Only genuine upstream SUPPLY nodes (reservoir / pump station) may feed
      // the source. This breaks the source-side cycle
      // (J-001 → J-017 → J-031 → S-001) while keeping the reservoir feed
      // (R-001 → P-UMP-001 → S-001) and legitimate loop returns elsewhere
      // (e.g. P-012 M-004 → J-003).
      if (vId === source?.id) {
        for (const p of pipes) {
          const feeder = network.nodes.find(n => n.id === p.fromNode);
          const isSupply = feeder && (feeder.type === 'reservoir' || feeder.type === 'pump_station');
          const f = isSupply ? (need.get(vId) ?? 0) : 0;
          maxChange = Math.max(maxChange, Math.abs(f - (flow.get(p.id) ?? 0)));
          flow.set(p.id, f);
        }
        continue;
      }
      const needV = need.get(vId) ?? 0;
      if (needV <= 0 || pipes.length === 0) {
        for (const p of pipes) flow.set(p.id, 0);
        continue;
      }
      let tc = 0;
      for (const p of pipes) tc += conductance.get(p.id) ?? 0;
      if (tc <= 0) continue;
      for (const p of pipes) {
        const share = needV * ((conductance.get(p.id) ?? 0) / tc);
        const f = Math.min(share, capacity.get(p.id) ?? Infinity); // capacity cap
        maxChange = Math.max(maxChange, Math.abs(f - (flow.get(p.id) ?? 0)));
        flow.set(p.id, f);
      }
    }

    // Recompute needs from flows.
    for (const [uId, pipes] of outPipes) {
      let out = 0;
      for (const p of pipes) out += flow.get(p.id) ?? 0;
      need.set(uId, (demandOf.get(uId) ?? 0) + out);
    }

    if (maxChange < 1e-4) break;
  }

  // Delivered demand: a node's request is met only if enough flow actually
  // reaches it (honest accounting under capacity constraints).
  const deliveredDemand = new Map<string, number>();
  for (const node of network.nodes) {
    const inflow = (inPipes.get(node.id) ?? []).reduce((s, p) => s + (flow.get(p.id) ?? 0), 0);
    deliveredDemand.set(node.id, Math.min(demandOf.get(node.id) ?? 0, inflow));
  }
  const totalDelivered = network.nodes.reduce((s, n) => s + (deliveredDemand.get(n.id) ?? 0), 0);

  return { flow, deliveredDemand, restrictions, totalDemand, totalDelivered, supply, deliveryRatio };
}

// ── Node Pressure Calculation ──────────────────────────────
// Pressure propagates from the source along every path; each node keeps the
// HIGHEST pressure reaching it (water arrives via the path of least
// resistance). This mirrors "max-pressure-wins" in a looped network and is a
// disclosed simplification — a real solver would close the energy equation
// simultaneously for all loops.
function calculateNodePressures(
  network: WaterNetwork,
  flowMap: Map<string, number>,
  flowResult: FlowResult,
  manualPressure?: number,
): Map<string, number> {
  const pressureMap = new Map<string, number>();

  const source = network.nodes.find(n => n.type === 'source');
  if (!source) return pressureMap;

  // Pump failure collapses source pressure; otherwise the operator-set
  // source pressure stands (the pump station's output).
  const pump = network.pumps[0];
  const pumpFailed = pump?.state === 'failed';
  const sourcePressure = pumpFailed ? PUMP_FAILED_PRESSURE : (manualPressure ?? DEFAULT_SOURCE_PRESSURE);

  for (const node of network.nodes) pressureMap.set(node.id, 0);
  pressureMap.set(source.id, sourcePressure);

  const nodeById = new Map(network.nodes.map(n => [n.id, n]));

  // Relax every edge (both directions) repeatedly, keeping the max pressure.
  // Converges because pressures are bounded above by the source value.
  const RELAX_PASSES = 24;
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let changed = false;

    for (const pipe of network.pipes) {
      const a = pipe.fromNode;
      const b = pipe.toNode;
      const pa = pressureMap.get(a) ?? 0;
      const pb = pressureMap.get(b) ?? 0;
      const na = nodeById.get(a);
      const nb = nodeById.get(b);
      if (!na || !nb) continue;

      const flow = flowMap.get(pipe.id) ?? 0;
      const { pressureDrop } = calcPressureLoss(
        Math.abs(flow), pipe.diameter, pipe.length, pipe.roughness, pipe.bendAngles,
      );
      // Velocity through the full bore (m/s) — drives local restriction losses.
      const D = pipe.diameter / 1000;
      const area = Math.PI * Math.pow(D / 2, 2);
      const velocity = area > 0 ? Math.abs(flow) / 1000 / area : 0;
      const vSquared = Math.pow(velocity, 2);

      // A blockage is a local constriction: water accelerates through the
      // reduced opening and loses head as ~K·v². The loss grows quadratically
      // with severity and with the velocity through the pipe. This is
      // deliberately graduated — a 50% restriction should be a warning, not a
      // network-wide collapse.
      const restriction = flowResult.restrictions.get(pipe.id) ?? 0;
      const restrictionDrop = Math.min(3.0, 0.55 * Math.pow(restriction / 100, 2) * (1 + vSquared));

      // A throttled valve adds a loss proportional to its closure.
      const valve = network.valves.find(v => v.pipeId === pipe.id);
      const valveDrop = valve
        ? Math.min(2.5, (1 - valve.openness / 100) * (0.3 + vSquared * 0.5))
        : 0;

      // Pressure candidate at b, arriving from a.
      const elevAB = (nb.elevation - na.elevation) * 0.0981; // bar
      const candB = pa - pressureDrop - elevAB - valveDrop - restrictionDrop;
      if (candB > pb) { pressureMap.set(b, candB); changed = true; }

      // Pressure candidate at a, arriving from b (reverse traversal keeps
      // upstream nodes like the reservoir consistent).
      const candA = pb - pressureDrop + elevAB - valveDrop - restrictionDrop;
      if (candA > pa) { pressureMap.set(a, candA); changed = true; }
    }

    if (!changed) break;
  }

  // Clamp to a physically sensible envelope.
  for (const [id] of pressureMap) {
    pressureMap.set(id, Math.max(0.3, Math.min(6.0, pressureMap.get(id)!)));
  }
  // Source stays fixed regardless of relaxation order.
  pressureMap.set(source.id, sourcePressure);

  return pressureMap;
}

// ── Risk Assessment ────────────────────────────────────────
function calculatePipeRisk(
  pipe: PipeSegment,
  pressure: number,
): number {
  let risk = 0;

  // Pressure risk: deviation from optimal (2.5 bar)
  const pressureDeviation = Math.abs(pressure - 2.5) / 2.5;
  risk += pressureDeviation * 100 * RISK_WEIGHT_PRESSURE;

  // Bend risk: sharper bends = more vulnerable
  const bendRisk = pipe.maxBendAngle / 180;
  risk += bendRisk * 100 * RISK_WEIGHT_BEND;

  // Age risk
  const ageRisk = Math.min(pipe.age / 25, 1);
  risk += ageRisk * 100 * RISK_WEIGHT_AGE;

  // Flow/utilization risk
  const flowRisk = pipe.utilization / 100;
  risk += flowRisk * 100 * RISK_WEIGHT_FLOW;

  // Condition risk (inverted: lower condition = higher risk)
  const conditionRisk = 1 - pipe.condition / 100;
  risk += conditionRisk * 100 * RISK_WEIGHT_CONDITION;

  // Add vulnerability at bends > 60 degrees
  if (pipe.maxBendAngle > 60) {
    risk += (pipe.maxBendAngle - 60) / 120 * 20;
  }

  // Leaks increase risk
  if (pipe.status === 'leak') risk = Math.max(risk, 75);

  return Math.min(100, Math.max(0, Math.round(risk)));
}

function calculateNodeRisk(
  node: NetworkNode,
  pressure: number,
  connectedPipes: PipeSegment[],
): number {
  let risk = 0;

  // Pressure deviation
  const pressureDev = Math.abs(pressure - 2.5) / 2.5;
  risk += pressureDev * 40;

  // Connected pipe risk (max)
  const maxPipeRisk = connectedPipes.reduce((max, p) => Math.max(max, p.riskScore), 0);
  risk += maxPipeRisk * 0.3;

  // Condition
  risk += (1 - node.condition / 100) * 30;

  // Junctions with many connections are more complex = more risk
  if (node.type === 'junction' && connectedPipes.length >= 4) {
    risk += 5;
  }

  return Math.min(100, Math.max(0, Math.round(risk)));
}

// ── Anomaly Detection ──────────────────────────────────────

// Midpoint of a pipe's path — the natural place to mark a leak/blockage.
export function midpointOfPipe(network: WaterNetwork, pipe: PipeSegment): Vector3 {
  const wps = pipe.waypoints;
  if (wps.length === 0) {
    return network.nodes.find(n => n.id === pipe.fromNode)?.position ?? { x: 0, y: 0, z: 0 };
  }
  if (wps.length === 1) return wps[0];
  // Walk to the halfway point by arc length.
  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < wps.length - 1; i++) {
    const d = Math.sqrt(
      (wps[i + 1].x - wps[i].x) ** 2 +
      (wps[i + 1].y - wps[i].y) ** 2 +
      (wps[i + 1].z - wps[i].z) ** 2,
    );
    segs.push(d);
    total += d;
  }
  let remaining = total / 2;
  for (let i = 0; i < segs.length; i++) {
    if (remaining <= segs[i]) {
      const t = segs[i] > 0 ? remaining / segs[i] : 0;
      const a = wps[i], b = wps[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= segs[i];
  }
  return wps[wps.length - 1];
}

function detectAnomalies(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  flowResult: FlowResult,
): AIAnomaly[] {
  const anomalies: AIAnomaly[] = [];
  let anomalyId = 0;

  // Check each pipe
  for (const pipe of network.pipes) {
    const pipeState = snapshot.pipes[pipe.id];
    if (!pipeState) continue;

    // High pressure anomaly — only flag significantly above normal
    if (pipeState.pressure > 4.5) {
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'pressure_anomaly',
        severity: pipeState.pressure > 5.5 ? 'critical' : 'high',
        assetId: pipe.id,
        assetType: 'pipe',
        title: `High pressure on ${pipe.label}`,
        description: `Pressure at ${pipeState.pressure.toFixed(1)} bar exceeds threshold of 4.0 bar. ${pipe.maxBendAngle > 60 ? 'Elevated risk at sharp bend.' : ''}`,
        confidence: Math.min(95, 70 + Math.round((pipeState.pressure - 4.5) * 15)),
        position: midpointOfPipe(network, pipe),
      });
    }

    // Low pressure anomaly — demand-starved regions
    if (pipeState.pressure > 0 && pipeState.pressure < 0.8) {
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'pressure_anomaly',
        severity: pipeState.pressure < 0.5 ? 'critical' : 'high',
        assetId: pipe.id,
        assetType: 'pipe',
        title: `Low pressure on ${pipe.label}`,
        description: `Pressure at ${pipeState.pressure.toFixed(1)} bar is below the 0.8 bar minimum. Demand is exceeding supply in this region.`,
        confidence: Math.min(92, 70 + Math.round((0.8 - pipeState.pressure) * 30)),
        position: midpointOfPipe(network, pipe),
      });
    }

    // Flow restriction — only flag near capacity
    if (pipeState.utilization > 92) {
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'flow_restriction',
        severity: pipeState.utilization > 97 ? 'critical' : 'high',
        assetId: pipe.id,
        assetType: 'pipe',
        title: `Flow restriction on ${pipe.label}`,
        description: `Utilization at ${pipeState.utilization.toFixed(0)}% indicates near-capacity flow. Possible restriction or undersized pipe.`,
        confidence: Math.min(90, 65 + Math.round((pipeState.utilization - 90) * 3)),
        position: midpointOfPipe(network, pipe),
      });
    }

    // Leak detection
    if (pipeState.status === 'leak' || network.leaks.some(l => l.pipeId === pipe.id && l.active)) {
      const leak = network.leaks.find(l => l.pipeId === pipe.id && l.active);
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'leak_detected',
        severity: (leak?.severity ?? 0) > 40 ? 'critical' : 'high',
        assetId: pipe.id,
        assetType: 'pipe',
        title: `Leak on ${pipe.label}`,
        description: `Estimated leak rate: ${leak?.flowRate.toFixed(1)} L/s at ${(leak?.severity ?? 0).toFixed(0)}% severity. Pressure anomaly detected.`,
        confidence: Math.min(95, 75 + Math.round((leak?.severity ?? 0) / 5)),
        position: leak?.position ?? network.nodes.find(n => n.id === pipe.fromNode)!.position,
      });
    }

    // Vulnerable bend — only flag really sharp bends under pressure
    if (pipe.maxBendAngle > 70 && pipeState.riskScore > 55) {
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'vulnerable_location',
        severity: pipe.maxBendAngle > 110 || pipeState.riskScore > 75 ? 'high' : 'medium',
        assetId: pipe.id,
        assetType: 'pipe',
        title: `Vulnerable bend at ${pipe.label}`,
        description: `${pipe.maxBendAngle.toFixed(0)}° direction change with risk score ${pipeState.riskScore}/100. Sharp bends experience higher stress under pressure.`,
        confidence: Math.min(92, 70 + Math.round(pipe.maxBendAngle / 15)),
        position: midpointOfPipe(network, pipe),
      });
    }
  }

  // Check nodes
  for (const node of network.nodes) {
    const nodeState = snapshot.nodes[node.id];
    if (!nodeState) continue;

    if (nodeState.riskScore > 70) {
      anomalies.push({
        id: `ANM-${++anomalyId}`,
        type: 'vulnerable_location',
        severity: nodeState.riskScore > 85 ? 'critical' : 'high',
        assetId: node.id,
        assetType: 'junction',
        title: `High-risk node: ${node.label}`,
        description: `Risk score ${nodeState.riskScore}/100. Pressure: ${nodeState.pressure.toFixed(1)} bar.`,
        confidence: Math.min(90, 65 + Math.round(nodeState.riskScore / 5)),
        position: node.position,
      });
    }
  }

  // Network-wide supply shortfall
  if (flowResult.deliveryRatio < 0.95) {
    const source = network.nodes.find(n => n.type === 'source');
    anomalies.push({
      id: `ANM-${++anomalyId}`,
      type: 'capacity_warning',
      severity: flowResult.deliveryRatio < 0.7 ? 'critical' : 'high',
      assetId: source?.id ?? 'SOURCE',
      assetType: source ? 'junction' : 'pipe',
      title: 'Demand exceeds supply',
      description: `Network requests ${flowResult.totalDemand.toFixed(1)} L/s but only ${flowResult.supply.toFixed(1)} L/s is available — ${Math.round((1 - flowResult.deliveryRatio) * 100)}% of demand is unmet. Pressures will sag network-wide.`,
      confidence: 95,
      position: source?.position ?? { x: 0, y: 0, z: 0 },
    });
  }

  // Sort by severity and confidence
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  anomalies.sort((a, b) =>
    (severityOrder[b.severity] - severityOrder[a.severity]) ||
    (b.confidence - a.confidence)
  );

  // Cap the list so the UI stays readable under network-wide stress.
  const MAX_ANOMALIES = 14;
  return anomalies.slice(0, MAX_ANOMALIES);
}

// ── System Metrics ─────────────────────────────────────────
function calculateSystemMetrics(
  network: WaterNetwork,
  snapshot: SimulationSnapshot,
  anomalies: AIAnomaly[],
  flowResult: FlowResult,
): SystemMetrics {
  const nodeStates = Object.values(snapshot.nodes);
  const pipeStates = Object.values(snapshot.pipes);

  const criticalAssets = nodeStates.filter(s => s.status === 'critical').length +
    pipeStates.filter(s => s.status === 'critical').length;

  const avgPressure = nodeStates.length > 0
    ? nodeStates.reduce((sum, s) => sum + s.pressure, 0) / nodeStates.length
    : 0;

  const peakFlow = pipeStates.reduce((max, s) => Math.max(max, Math.abs(s.flow)), 0);

  const waterLoss = network.leaks
    .filter(l => l.active)
    .reduce((sum, l) => sum + l.flowRate, 0);

  // Resilience sub-scores
  const pressureStability = Math.max(0, 100 - Math.abs(avgPressure - 2.5) * 30);
  const redundancy = calculateRedundancy(network);
  const capacity = pipeStates.length > 0
    ? pipeStates.reduce((sum, s) => sum + s.utilization, 0) / pipeStates.length
    : 0;
  const leakRisk = pipeStates.length > 0
    ? pipeStates.reduce((sum, s) => sum + s.riskScore, 0) / pipeStates.length
    : 0;
  // Supply shortfall: share of customer demand that is NOT actually delivered
  // (captures both source rationing and pressure-dependent demand collapse).
  const shortfall = flowResult.totalDemand > 0
    ? Math.max(0, 1 - flowResult.totalDelivered / flowResult.totalDemand)
    : 0;
  const supplyShortfall = shortfall * 100;

  const resilienceScore = Math.round(
    pressureStability * 0.25 +
    redundancy * 0.2 +
    (100 - capacity) * 0.15 +
    (100 - leakRisk) * 0.2 +
    (100 - supplyShortfall) * 0.2
  );

  return {
    totalAssets: network.nodes.length + network.pipes.length + network.valves.length + network.pumps.length,
    criticalAssets,
    activeAlerts: anomalies.filter(a => a.severity === 'high' || a.severity === 'critical').length,
    averagePressure: Math.round(avgPressure * 100) / 100,
    peakFlow: Math.round(peakFlow * 100) / 100,
    waterLoss: Math.round(waterLoss * 100) / 100,
    resilienceScore: Math.max(0, Math.min(100, resilienceScore)),
    pressureStability: Math.round(pressureStability),
    redundancy: Math.round(redundancy),
    capacity: Math.round(100 - capacity),
    leakRisk: Math.round(leakRisk),
    totalDemand: Math.round(flowResult.totalDemand * 100) / 100,
    totalDelivered: Math.round(flowResult.totalDelivered * 100) / 100,
    supply: Math.round(flowResult.supply * 100) / 100,
    deliveryRatio: Math.round(flowResult.deliveryRatio * 1000) / 1000,
    anomalies,
  };
}

function calculateRedundancy(network: WaterNetwork): number {
  // Count loops by finding cycles
  const adj = new Map<string, string[]>();
  for (const pipe of network.pipes) {
    if (!adj.has(pipe.fromNode)) adj.set(pipe.fromNode, []);
    if (!adj.has(pipe.toNode)) adj.set(pipe.toNode, []);
    adj.get(pipe.fromNode)!.push(pipe.toNode);
    adj.get(pipe.toNode)!.push(pipe.fromNode);
  }

  // BFS from source to find alternate paths
  const source = network.nodes.find(n => n.type === 'source');
  if (!source) return 0;

  // Simple: count nodes with 3+ connections
  let multiConnectNodes = 0;
  for (const [nodeId, neighbors] of adj) {
    const uniqueNeighbors = new Set(neighbors);
    if (uniqueNeighbors.size >= 3) multiConnectNodes++;
  }

  return Math.min(100, Math.round((multiConnectNodes / network.nodes.length) * 100 * 3));
}

// ── Main Simulation Step ───────────────────────────────────
export function runSimulationStep(
  network: WaterNetwork,
  state: SimulationState,
  deltaTime: number,
): SimulationSnapshot {
  // 1. First pass: demand-driven flow allocation.
  let flowResult = distributeFlow(network, state);

  // 2. Pressure solve.
  let pressureMap = calculateNodePressures(network, flowResult.flow, flowResult, state.sourcePressure);

  // 2b. Pressure-dependent demand feedback: nodes below minimum service
  // pressure cannot deliver their full demand. One extra pass couples
  // pressure back into delivery so a pressure collapse also collapses supply
  // (as in a PDA solver), instead of showing "all demand met" at 0.5 bar.
  const pdScale = new Map<string, number>();
  let needsFeedback = false;
  for (const node of network.nodes) {
    const p = pressureMap.get(node.id) ?? 0;
    const f = p >= MIN_SERVICE_PRESSURE ? 1 : Math.max(0.1, p / MIN_SERVICE_PRESSURE);
    pdScale.set(node.id, f);
    if (f < 0.999) needsFeedback = true;
  }
  if (needsFeedback) {
    flowResult = distributeFlow(network, state, pdScale);
    pressureMap = calculateNodePressures(network, flowResult.flow, flowResult, state.sourcePressure);
  }

  const flowMap = flowResult.flow;

  // 3. Update pipe states
  const pipeStates: SimulationSnapshot['pipes'] = {};
  for (const pipe of network.pipes) {
    const flow = flowMap.get(pipe.id) || 0;
    const D = pipe.diameter / 1000;
    const Q = Math.abs(flow) / 1000;
    const area = Math.PI * Math.pow(D / 2, 2);
    const velocity = area > 0 ? Q / area : 0;

    const fromPressure = pressureMap.get(pipe.fromNode) || 0;
    const toPressure = pressureMap.get(pipe.toNode) || 0;
    const avgPressure = (fromPressure + toPressure) / 2;

    // Utilization: flow relative to the pipe's EFFECTIVE capacity — design
    // capacity (V_MAX) reduced by any active restriction/blockage and valve
    // throttling. A blocked pipe therefore reads as more utilized even at
    // constant flow, which is the operationally honest signal.
    const restriction = flowResult.restrictions.get(pipe.id) ?? 0;
    const valve = network.valves.find(v => v.pipeId === pipe.id);
    const valveFactor = valve ? Math.max(0.01, valve.openness / 100) : 1;
    const effFactor = Math.max(0.01, (1 - restriction / 100)) * valveFactor;
    const maxFlow = area * V_MAX * 1000 * effFactor; // L/s
    const utilization = maxFlow > 0 ? (Math.abs(flow) / maxFlow) * 100 : 0;

    const { headLoss } = calcPressureLoss(
      flow, pipe.diameter, pipe.length, pipe.roughness, pipe.bendAngles,
    );

    const updatedPipe = { ...pipe, flow, pressure: avgPressure, velocity, utilization, headLoss };
    const risk = calculatePipeRisk(updatedPipe, avgPressure);

    // Determine status
    let status: PipeSegment['status'] = 'normal';
    // Manual operator restrictions (Control Room) are blockages too — keep
    // status consistent with the 3D blockage markers and Control Room list.
    const manualRestricted = (state.pipeRestrictions?.[pipe.id] ?? 0) > 0;
    if (network.leaks.some(l => l.pipeId === pipe.id && l.active)) status = 'leak';
    else if (network.blockages.some(b => b.pipeId === pipe.id && b.active) || manualRestricted) status = 'blocked';
    else if (risk > 75) status = 'critical';
    else if (risk > 50) status = 'warning';

    pipeStates[pipe.id] = {
      flow: Math.round(flow * 100) / 100,
      pressure: Math.round(avgPressure * 100) / 100,
      velocity: Math.round(velocity * 1000) / 1000,
      utilization: Math.round(Math.min(100, utilization)),
      headLoss: Math.round(headLoss * 1000) / 1000,
      riskScore: risk,
      status,
    };
  }

  // 4. Update node states
  const nodeStates: SimulationSnapshot['nodes'] = {};
  for (const node of network.nodes) {
    const pressure = pressureMap.get(node.id) || 0;
    const connectedPipes = network.pipes
      .filter(p => p.fromNode === node.id || p.toNode === node.id)
      .map(p => ({ ...p, ...pipeStates[p.id] }));

    const risk = calculateNodeRisk(node, pressure, connectedPipes);

    // Water level tracks delivered supply at source/destination, pressure elsewhere.
    const delivered = flowResult.deliveredDemand.get(node.id) ?? 0;
    let waterLevel = node.waterLevel;
    if (node.type === 'source') waterLevel = Math.max(0.5, 4.5 - (1 - flowResult.deliveryRatio) * 3.0);
    else if (node.type === 'destination') waterLevel = Math.max(0.3, 2.0 * flowResult.deliveryRatio + 0.4);
    else waterLevel = Math.max(0.2, Math.min(3.5, pressure * 0.5));

    let status: NetworkNode['status'] = 'normal';
    if (risk > 75) status = 'critical';
    else if (risk > 50) status = 'warning';

    nodeStates[node.id] = {
      pressure: Math.round(pressure * 100) / 100,
      waterLevel: Math.round(waterLevel * 100) / 100,
      demand: Math.round(delivered * 100) / 100,
      riskScore: risk,
      status,
    };
  }

  // 5. Create snapshot
  const snapshot: SimulationSnapshot = {
    time: state.time,
    nodes: nodeStates,
    pipes: pipeStates,
    systemMetrics: {} as SystemMetrics, // filled below
  };

  // 6. Detect anomalies and compute metrics
  const anomalies = detectAnomalies(network, snapshot, flowResult);
  snapshot.systemMetrics = calculateSystemMetrics(network, snapshot, anomalies, flowResult);

  return snapshot;
}

// ── Color Helpers ──────────────────────────────────────────
export function getPressureColor(pressure: number): string {
  // Low (blue) → Normal (green) → High (red)
  if (pressure < 1.5) return '#3b82f6'; // blue
  if (pressure < 2.0) return '#22d3ee'; // cyan
  if (pressure < 3.0) return '#22c55e'; // green
  if (pressure < 4.0) return '#eab308'; // yellow
  if (pressure < 5.0) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function getFlowColor(utilization: number): string {
  if (utilization < 20) return '#94a3b8'; // slate
  if (utilization < 50) return '#22c55e'; // green
  if (utilization < 75) return '#eab308'; // yellow
  if (utilization < 90) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function getVelocityColor(velocity: number): string {
  if (velocity < 0.5) return '#3b82f6';
  if (velocity < 1.0) return '#22c55e';
  if (velocity < 1.5) return '#eab308';
  if (velocity < 2.0) return '#f97316';
  return '#ef4444';
}

export function getRiskColor(risk: number): string {
  if (risk < 25) return '#22c55e';
  if (risk < 50) return '#eab308';
  if (risk < 75) return '#f97316';
  return '#ef4444';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#22c55e';
    case 'warning': return '#eab308';
    case 'critical': return '#ef4444';
    case 'leak': return '#f97316';
    case 'blocked': return '#a855f7';
    case 'failed': return '#ef4444';
    default: return '#94a3b8';
  }
}

export function getViewModeColor(
  viewMode: ViewMode,
  pipe: PipeSegment,
  nodePressure?: number,
): string {
  switch (viewMode) {
    case 'pressure': return getPressureColor(pipe.pressure || nodePressure || 2.5);
    case 'flow': return getFlowColor(pipe.utilization);
    case 'velocity': return getVelocityColor(pipe.velocity);
    case 'risk': return getRiskColor(pipe.riskScore);
    case 'waterLevel': return pipe.velocity > 0 ? '#22d3ee' : '#3b82f6';
    default: return '#64748b'; // slate default pipe color
  }
}
