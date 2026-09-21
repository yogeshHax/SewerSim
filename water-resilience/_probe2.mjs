import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { createDemoNetwork } = await jiti.import('./src/lib/network/model.ts');
const { runSimulationStep } = await jiti.import('./src/lib/network/simulation.ts');
const network = createDemoNetwork();
const mk = (over = {}) => ({
  time: 0, isRunning: false, speed: 1, inflowMultiplier: 1.0,
  scenario: 'baseline', duration: 3600, baselineSnapshot: null,
  currentSnapshot: { time: 0, nodes: {}, pipes: {}, systemMetrics: {} },
  sourcePressure: 2.8, sourceFlow: 32, pipeRestrictions: {}, ...over,
});
for (const mult of [1.0, 1.5, 2.0, 3.0]) {
  const s = runSimulationStep(network, mk({inflowMultiplier: mult}));
  const srcOut = network.pipes.filter(p => p.fromNode === 'S-001').reduce((a,p)=>a+Math.abs(s.pipes[p.id]?.flow||0),0);
  const m = s.systemMetrics;
  console.log(`MULT ${mult}: srcOut=${srcOut.toFixed(2)} supply=${m.supply} deliv=${m.totalDelivered.toFixed(1)}/${m.totalDemand.toFixed(1)} peakQ=${m.peakFlow.toFixed(1)} avgP=${m.averagePressure.toFixed(2)} resil=${m.resilienceScore}`);
}
const b = runSimulationStep(network, mk());
console.log('P-004 baseline flow:', b.pipes['P-004']?.flow.toFixed(2), 'util:', b.pipes['P-004']?.utilization);
console.log('P-003 baseline flow:', b.pipes['P-003']?.flow.toFixed(2));
console.log('P-001 flow:', b.pipes['P-001']?.flow.toFixed(2), 'P-002:', b.pipes['P-002']?.flow.toFixed(2), 'P-042:', b.pipes['P-042']?.flow.toFixed(2));
const n4 = JSON.parse(JSON.stringify(network)); n4.blockages=[{id:'b',pipeId:'P-004',severity:80,active:true,position:{x:0,y:0,z:0}}];
const s4 = runSimulationStep(n4, mk());
console.log('BLOCK P-004 80%: P-004 flow:', s4.pipes['P-004']?.flow.toFixed(2), 'deliv:', s4.systemMetrics.totalDelivered.toFixed(1), 'resil:', s4.systemMetrics.resilienceScore);
