'use client';

import React from 'react';
import { useStore } from '../../store/useStore';
import type { ScenarioType } from '../../lib/network/types';
import { Network, X, Play, RotateCcw, ChevronRight } from 'lucide-react';

interface ScenarioDef {
  id: ScenarioType;
  label: string;
  description: string;
  action?: () => void;
}

export default function ScenarioPanel() {
  const {
    scenarioOpen, toggleScenario, network, currentSnapshot,
    baselineSnapshot, activeScenario, setScenario,
    setInflowMultiplier, applyBlockage, applyLeak, closeValve, failPump,
    runSimulation, resetSimulation, simulation, sidebarOpen,
  } = useStore();

  if (!scenarioOpen) return null;

  const scenarios: ScenarioDef[] = [
    {
      id: 'baseline',
      label: 'BASELINE',
      description: 'Normal operating conditions. All systems nominal.',
      action: resetSimulation,
    },
    {
      id: 'heavy_water_event',
      label: 'STORM SURGE 2×',
      description: 'Rainfall event doubles network demand.',
      action: () => setInflowMultiplier(2.0),
    },
    {
      id: 'blockage',
      label: 'TRUNK BLOCKAGE',
      description: '80% restriction on the main trunk pipe P-004.',
      action: () => { applyBlockage('P-004', 80); },
    },
    {
      id: 'pump_failure',
      label: 'PUMP FAILURE',
      description: 'Main pump station goes offline.',
      action: () => failPump('PU-001'),
    },
    {
      id: 'valve_closed',
      label: 'VALVE CLOSED',
      description: 'Loop control valve V-001 closed, redirecting flow.',
      action: () => closeValve('V-001'),
    },
    {
      id: 'pipe_leak',
      label: 'PIPE LEAK',
      description: 'Major leak on the U-turn trunk pipe P-022.',
      action: () => { applyLeak('P-022', 30); },
    },
  ];

  const handleRunScenario = (scenario: ScenarioDef) => {
    setScenario(scenario.id);
    if (scenario.id === 'baseline') {
      // Reset restores the pristine baseline snapshot — do not let the follow-up
      // runSimulation() overwrite it with a fresh state.
      scenario.action?.();
      return;
    }
    if (scenario.action) scenario.action();
    setTimeout(() => runSimulation(), 100);
  };

  const m = currentSnapshot.systemMetrics;

  return (
    <div style={{
      position: 'absolute',
      left: sidebarOpen ? 230 : 54, top: 50, bottom: 90,
      width: 340,
      background: 'rgba(15, 23, 42, 0.92)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 18,
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Network size={16} color="#60a5fa" />
          <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>SCENARIOS</span>
        </div>
        <button onClick={toggleScenario} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>

      {/* Active Scenario */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
      }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 4 }}>ACTIVE SCENARIO</div>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
          {scenarios.find(s => s.id === activeScenario)?.label || 'BASELINE'}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          Inflow: {simulation.inflowMultiplier}× | Time: {Math.floor(simulation.time)}s
        </div>
      </div>

      {/* Scenario List */}
      <div style={{ padding: '10px 14px', flex: 1 }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>PRESET SCENARIOS</div>
        {scenarios.map(scenario => (
          <div
            key={scenario.id}
            onClick={() => handleRunScenario(scenario)}
            style={{
              padding: '10px 12px',
              marginBottom: 6,
              background: activeScenario === scenario.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 41, 59, 0.6)',
              border: `1px solid ${activeScenario === scenario.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(51, 65, 85, 0.3)'}`,
              borderRadius: 4, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: activeScenario === scenario.id ? '#60a5fa' : '#e2e8f0', fontWeight: 500 }}>
                {scenario.label}
              </div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{scenario.description}</div>
            </div>
            <ChevronRight size={14} color="#64748b" />
          </div>
        ))}
      </div>

      {/* Comparison against the captured baseline snapshot */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(51, 65, 85, 0.3)',
      }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>VS BASELINE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
          <div style={{ color: '#64748b' }}>Metric</div>
          <div style={{ color: '#64748b' }}>Baseline</div>
          <div style={{ color: '#64748b' }}>Current</div>

          <div style={{ color: '#94a3b8' }}>Resilience</div>
          <div style={{ color: '#94a3b8' }}>{baselineSnapshot?.systemMetrics.resilienceScore ?? '—'}</div>
          <div style={{ color: m.resilienceScore > 70 ? '#22c55e' : m.resilienceScore > 50 ? '#eab308' : '#ef4444' }}>
            {m.resilienceScore}
          </div>

          <div style={{ color: '#94a3b8' }}>Avg pressure</div>
          <div style={{ color: '#94a3b8' }}>{baselineSnapshot?.systemMetrics.averagePressure.toFixed(1) ?? '—'} bar</div>
          <div style={{ color: m.averagePressure > 4 ? '#f97316' : m.averagePressure < 1.2 ? '#3b82f6' : '#e2e8f0' }}>
            {m.averagePressure.toFixed(1)} bar
          </div>

          <div style={{ color: '#94a3b8' }}>Demand met</div>
          <div style={{ color: '#94a3b8' }}>{baselineSnapshot ? Math.round(baselineSnapshot.systemMetrics.deliveryRatio * 100) : '—'}%</div>
          <div style={{ color: m.deliveryRatio > 0.9 ? '#22c55e' : m.deliveryRatio > 0.6 ? '#eab308' : '#ef4444' }}>
            {Math.round(m.deliveryRatio * 100)}%
          </div>

          <div style={{ color: '#94a3b8' }}>Water loss</div>
          <div style={{ color: '#94a3b8' }}>{baselineSnapshot?.systemMetrics.waterLoss.toFixed(1) ?? '—'} L/s</div>
          <div style={{ color: m.waterLoss > 0 ? '#f97316' : '#22c55e' }}>
            {m.waterLoss.toFixed(1)} L/s
          </div>
        </div>
      </div>
    </div>
  );
}
