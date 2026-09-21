// Quick verification: does the simulation produce flow for every pipe?
import { createDemoNetwork, validateNetwork } from './src/lib/network/model.ts';
import { runSimulationStep } from './src/lib/network/simulation.ts';

const network = createDemoNetwork();
const validation = validateNetwork(network);

console.log('=== NETWORK VALIDATION ===');
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errors.length === 0 ? 'NONE' : validation.errors.join(', '));
console.log('Nodes:', network.nodes.length);
console.log('Pipes:', network.pipes.length);

// Run simulation
const simState = {
  time: 0, isRunning: false, speed: 1, inflowMultiplier: 1.0,
  scenario: 'baseline', duration: 3600, baselineSnapshot: null,
  currentSnapshot: { time: 0, nodes: {}, pipes: {}, systemMetrics: { totalAssets: 0, criticalAssets: 0, activeAlerts: 0, averagePressure: 0, peakFlow: 0, waterLoss: 0, resilienceScore: 0, pressureStability: 0, redundancy: 0, capacity: 0, leakRisk: 0, anomalies: [] } }
};
const snapshot = runSimulationStep(network, simState, 0);

console.log('\n=== SIMULATION RESULTS ===');
console.log('Avg Pressure:', snapshot.systemMetrics.averagePressure.toFixed(2), 'bar');
console.log('Peak Flow:', snapshot.systemMetrics.peakFlow.toFixed(1), 'L/s');
console.log('Resilience:', snapshot.systemMetrics.resilienceScore);
console.log('Alerts:', snapshot.systemMetrics.activeAlerts);

// Check flow in every pipe
let pipesWithFlow = 0;
let pipesWithZeroFlow = 0;
let totalFlow = 0;
let maxFlow = 0;

for (const pipe of network.pipes) {
  const state = snapshot.pipes[pipe.id];
  if (state) {
    const flow = Math.abs(state.flow);
    totalFlow += flow;
    if (flow > 0.1) {
      pipesWithFlow++;
    } else {
      pipesWithZeroFlow++;
    }
    maxFlow = Math.max(maxFlow, flow);
  }
}

console.log('\n=== WATER FLOW PER PIPE ===');
console.log('Pipes with flow > 0.1 L/s:', pipesWithFlow);
console.log('Pipes with zero/near-zero flow:', pipesWithZeroFlow);
console.log('Total flow (sum):', totalFlow.toFixed(1), 'L/s');
console.log('Max single pipe flow:', maxFlow.toFixed(1), 'L/s');

// Show top 5 pipes by flow
const sortedPipes = network.pipes
  .map(p => ({ id: p.id, flow: Math.abs(snapshot.pipes[p.id]?.flow || 0), pressure: snapshot.pipes[p.id]?.pressure || 0 }))
  .sort((a, b) => b.flow - a.flow);

console.log('\n=== TOP 5 PIPES BY FLOW ===');
for (const p of sortedPipes.slice(0, 5)) {
  console.log(`  ${p.id}: ${p.flow.toFixed(2)} L/s, ${p.pressure.toFixed(2)} bar`);
}

// Show bottom 5 pipes by flow  
console.log('\n=== BOTTOM 5 PIPES BY FLOW ===');
for (const p of sortedPipes.slice(-5)) {
  console.log(`  ${p.id}: ${p.flow.toFixed(2)} L/s, ${p.pressure.toFixed(2)} bar`);
}

// Verify flow data has everything needed for visualization
console.log('\n=== FLOW VISUALIZATION CHECK ===');
console.log('All pipes have flow data:', network.pipes.every(p => snapshot.pipes[p.id]?.flow !== undefined));
console.log('Flow will show particles:', pipesWithFlow, 'pipes');
console.log('Total objects for scene:', network.nodes.length + network.pipes.length + network.valves.length + network.pumps.length);
