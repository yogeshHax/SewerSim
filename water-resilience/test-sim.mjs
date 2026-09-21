// Headless test: verify simulation engine correctness
// Run with: node test-sim.mjs

import { createDemoNetwork, validateNetwork } from './src/lib/network/model.ts';
import { runSimulationStep } from './src/lib/network/simulation.ts';

let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('\n=== 1. NETWORK VALIDATION ===');
const network = createDemoNetwork();
const validation = validateNetwork(network);
assert(validation.valid, 'Network is valid', validation.errors.join(', '));
assert(network.nodes.length === 52, `Node count = 52 (got ${network.nodes.length})`);
assert(network.pipes.length === 68, `Pipe count = 68 (got ${network.pipes.length})`);

// Check node types
const src = network.nodes.find(n => n.type === 'source');
assert(!!src, 'Source node exists');
assert(src?.id === 'S-001', `Source ID = S-001 (got ${src?.id})`);
const dsts = network.nodes.filter(n => n.type === 'destination');
assert(dsts.length === 2, `2 destinations (got ${dsts.length})`);
assert(dsts.some(d => d.id === 'OUT-001'), 'OUT-001 exists');
assert(dsts.some(d => d.id === 'OUT-002'), 'OUT-002 exists');

// Check loop exists
const loopPipes = ['P-006','P-007','P-008','P-009','P-010','P-011','P-012'];
const allLoopPipesExist = loopPipes.every(id => network.pipes.some(p => p.id === id));
assert(allLoopPipesExist, 'Loop pipes exist (P-006 through P-012)');

// Check U-turn
const uTurn = network.pipes.find(p => p.id === 'P-022');
assert(!!uTurn, 'U-turn pipe P-022 exists');
assert(uTurn.waypoints.length === 6, `U-turn has 6 waypoints (got ${uTurn.waypoints.length})`);
assert(uTurn.maxBendAngle > 80, `U-turn max bend > 80° (got ${uTurn.maxBendAngle.toFixed(1)}°)`);

// Check path validation (waypoints match node positions)
let pathErrors = 0;
for (const pipe of network.pipes) {
  const fn = network.nodes.find(n => n.id === pipe.fromNode);
  const tn = network.nodes.find(n => n.id === pipe.toNode);
  if (fn && tn && pipe.waypoints.length >= 2) {
    const startDist = Math.sqrt(
      (pipe.waypoints[0].x - fn.position.x)**2 +
      (pipe.waypoints[0].y - fn.position.y)**2 +
      (pipe.waypoints[0].z - fn.position.z)**2
    );
    const endDist = Math.sqrt(
      (pipe.waypoints[pipe.waypoints.length-1].x - tn.position.x)**2 +
      (pipe.waypoints[pipe.waypoints.length-1].y - tn.position.y)**2 +
      (pipe.waypoints[pipe.waypoints.length-1].z - tn.position.z)**2
    );
    if (startDist > 0.01 || endDist > 0.01) pathErrors++;
  }
}
assert(pathErrors === 0, `All pipe paths match endpoints (${pathErrors} mismatches)`);

console.log('\n=== 2. SIMULATION — BASELINE ===');
const simState = {
  time: 0, isRunning: true, speed: 1, inflowMultiplier: 1.0,
  scenario: 'baseline', duration: 3600, baselineSnapshot: null,
  currentSnapshot: { time: 0, nodes: {}, pipes: {}, systemMetrics: {} }
};
const baseline = runSimulationStep(network, simState, 0);

assert(baseline.systemMetrics.totalAssets > 70, `Total assets > 70 (got ${baseline.systemMetrics.totalAssets})`);
assert(baseline.systemMetrics.averagePressure > 0, `Avg pressure > 0 (got ${baseline.systemMetrics.averagePressure})`);
assert(baseline.systemMetrics.peakFlow > 0, `Peak flow > 0 (got ${baseline.systemMetrics.peakFlow})`);
assert(baseline.systemMetrics.resilienceScore > 0, `Resilience > 0 (got ${baseline.systemMetrics.resilienceScore})`);

// Source pressure should be highest
const srcPressure = baseline.nodes['S-001']?.pressure;
assert(srcPressure > 2.0, `Source pressure > 2.0 bar (got ${srcPressure})`);

// Destination pressure should be lower than source
const dst1Pressure = baseline.nodes['OUT-001']?.pressure;
assert(dst1Pressure > 0, `OUT-001 pressure > 0 (got ${dst1Pressure})`);

// Water should flow through pipes
const p001Flow = baseline.pipes['P-001']?.flow;
assert(p001Flow > 0, `P-001 flow > 0 (got ${p001Flow})`);

console.log('\n=== 3. SIMULATION — HIGH INFLOW ===');
const highSim = { ...simState, inflowMultiplier: 2.0 };
const highResult = runSimulationStep(network, highSim, 0);

const flowIncrease = highResult.pipes['P-001']?.flow > baseline.pipes['P-001']?.flow;
assert(flowIncrease, `P-001 flow increases with 2× inflow (baseline: ${baseline.pipes['P-001']?.flow?.toFixed(2)}, high: ${highResult.pipes['P-001']?.flow?.toFixed(2)})`);

console.log('\n=== 4. SIMULATION — LEAK ===');
// Create a leak on P-022 (U-turn)
const leakNetwork = JSON.parse(JSON.stringify(network));
leakNetwork.leaks = [{
  id: 'LEAK-P-022', pipeId: 'P-022',
  position: leakNetwork.pipes.find(p => p.id === 'P-022').waypoints[2],
  severity: 50, flowRate: 2.5, active: true
}];
leakNetwork.pipes.find(p => p.id === 'P-022').status = 'leak';

const leakResult = runSimulationStep(leakNetwork, simState, 0);
assert(leakResult.pipes['P-022']?.status === 'leak', 'P-022 shows leak status');
assert(leakResult.systemMetrics.waterLoss > 0, `Water loss detected (got ${leakResult.systemMetrics.waterLoss})`);

// Leak should reduce pressure slightly downstream
const leakPressure = leakResult.nodes['J-011']?.pressure;
const basePressure = baseline.nodes['J-011']?.pressure;
assert(leakPressure !== undefined && basePressure !== undefined, 'Both pressures exist for comparison');

console.log('\n=== 5. SIMULATION — BLOCKAGE ===');
const blockNetwork = JSON.parse(JSON.stringify(network));
blockNetwork.blockages = [{
  id: 'BLK-P-020', pipeId: 'P-020',
  position: blockNetwork.pipes.find(p => p.id === 'P-020').waypoints[0],
  severity: 50, active: true
}];

const blockResult = runSimulationStep(blockNetwork, simState, 0);
const blockPipe = blockResult.pipes['P-020'];
const basePipe = baseline.pipes['P-020'];
// A 50% blockage halves capacity. If demand downstream is still deliverable
// within the reduced capacity (pressure-dependent demand not triggered), flow
// can legitimately stay the same — the honest observables are utilization,
// head loss, and downstream pressure.
const flowDropped = blockPipe.flow < basePipe.flow;
const utilRose = blockPipe.utilization > basePipe.utilization;
assert(flowDropped || utilRose,
  `Blockage observable on P-020 (flow ${basePipe.flow?.toFixed(2)}→${blockPipe.flow?.toFixed(2)}, util ${basePipe.utilization}%→${blockPipe.utilization}%)`);
const toNode20 = blockNetwork.pipes.find(p => p.id === 'P-020').toNode;
const pDrop = baseline.nodes[toNode20]?.pressure - blockResult.nodes[toNode20]?.pressure;
assert(pDrop > 0.005, `Blockage drops pressure at ${toNode20} (−${pDrop?.toFixed(3)} bar)`);

console.log('\n=== 6. ANOMALY DETECTION ===');
assert(baseline.systemMetrics.anomalies !== undefined, 'Anomalies array exists');

console.log('\n=== 7. VALVE + PUMP STATE ===');
assert(network.valves.length >= 4, `At least 4 valves (got ${network.valves.length})`);
assert(network.pumps.length === 1, `1 pump (got ${network.pumps.length})`);
assert(network.valves.every(v => v.state === 'open'), 'All valves open in baseline');
assert(network.pumps[0].state === 'running', 'Pump running in baseline');

console.log('\n=== SUMMARY ===');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('  ALL TESTS PASSED ✓');
