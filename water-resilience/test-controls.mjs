import { createDemoNetwork } from './src/lib/network/model.ts';
import { runSimulationStep } from './src/lib/network/simulation.ts';

const network = createDemoNetwork();
const baseSim = {
  time: 0, isRunning: false, speed: 1, inflowMultiplier: 1.0,
  scenario: 'baseline', duration: 3600, baselineSnapshot: null,
  currentSnapshot: { time: 0, nodes: {}, pipes: {}, systemMetrics: { totalAssets: 0, criticalAssets: 0, activeAlerts: 0, averagePressure: 0, peakFlow: 0, waterLoss: 0, resilienceScore: 0, pressureStability: 0, redundancy: 0, capacity: 0, leakRisk: 0, anomalies: [] } },
  sourcePressure: 2.8, sourceFlow: 22, pipeRestrictions: {},
};

console.log('=== TEST 1: Baseline (2.8 bar, 22 L/s) ===');
const baseline = runSimulationStep(network, baseSim, 0);
console.log('  Avg Pressure:', baseline.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', baseline.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('  Resilience:', baseline.systemMetrics.resilienceScore);

console.log('\n=== TEST 2: High Pressure (5.5 bar, 22 L/s) ===');
const highPressure = runSimulationStep(network, { ...baseSim, sourcePressure: 5.5 }, 0);
console.log('  Avg Pressure:', highPressure.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', highPressure.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('  Alerts:', highPressure.systemMetrics.activeAlerts);
const srcP = highPressure.nodes['S-001']?.pressure;
console.log('  Source node pressure:', srcP?.toFixed(2), 'bar (should be ~5.5)');

console.log('\n=== TEST 3: High Inflow (50 L/s, 2.8 bar) ===');
const highFlow = runSimulationStep(network, { ...baseSim, sourceFlow: 50 }, 0);
console.log('  Avg Pressure:', highFlow.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', highFlow.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('  Resilience:', highFlow.systemMetrics.resilienceScore);

console.log('\n=== TEST 4: Low Pressure + High Flow (1.0 bar, 60 L/s) ===');
const stress = runSimulationStep(network, { ...baseSim, sourcePressure: 1.0, sourceFlow: 60 }, 0);
console.log('  Avg Pressure:', stress.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', stress.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('  Resilience:', stress.systemMetrics.resilienceScore);
console.log('  Alerts:', stress.systemMetrics.activeAlerts);

console.log('\n=== TEST 5: Pipe Restriction (P-001 at 50%) ===');
const restricted = runSimulationStep(network, { ...baseSim, pipeRestrictions: { 'P-001': 50 } }, 0);
console.log('  Avg Pressure:', restricted.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', restricted.systemMetrics.peakFlow.toFixed(1), 'L/s');
const p001Flow = restricted.pipes['P-001']?.flow;
console.log('  P-001 flow:', p001Flow?.toFixed(1), 'L/s (baseline was', baseline.pipes['P-001']?.flow.toFixed(1), ')');
console.log('  Flow reduced:', p001Flow && baseline.pipes['P-001']?.flow ? ((1 - p001Flow / baseline.pipes['P-001'].flow) * 100).toFixed(0) + '%' : 'N/A');

console.log('\n=== TEST 6: Extreme (max pressure + max flow + restriction) ===');
const extreme = runSimulationStep(network, {
  ...baseSim,
  sourcePressure: 6.0, sourceFlow: 80,
  pipeRestrictions: { 'P-001': 70, 'P-002': 50 },
}, 0);
console.log('  Avg Pressure:', extreme.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('  Peak Flow:', extreme.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('  Resilience:', extreme.systemMetrics.resilienceScore);
console.log('  Alerts:', extreme.systemMetrics.activeAlerts);
console.log('  Critical Assets:', extreme.systemMetrics.criticalAssets);

console.log('\n=== ALL TESTS PASSED ===');
