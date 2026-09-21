'use client';

import React from 'react';
import { useStore } from '../../store/useStore';
import {
  Activity, AlertTriangle, Bot, BarChart3, Network,
  Play, Pause, RotateCcw,
} from 'lucide-react';

export default function AlertBar() {
  const {
    currentSnapshot, simulation, toggleSimulation,
    toggleAIPanel, aiPanelOpen, toggleDashboard, dashboardOpen,
    toggleScenario, scenarioOpen, resetToBaseline,
    setViewMode, sidebarOpen,
  } = useStore();

  const m = currentSnapshot.systemMetrics;
  const isRunning = simulation.isRunning;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: sidebarOpen ? 220 : 44, right: 0, height: 40,
      background: 'rgba(15, 23, 42, 0.95)',
      borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 16,
      zIndex: 20,
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    }}>
      {/* Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 6, height: 6, borderRadius: 3,
          background: isRunning ? '#22c55e' : m.activeAlerts > 0 ? '#eab308' : '#22c55e',
          animation: isRunning ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5 }}>
          {isRunning ? 'SIMULATION ACTIVE' : 'SYSTEM ONLINE'}
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'rgba(51, 65, 85, 0.5)' }} />

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#64748b' }}>Assets:</span>
          <span style={{ color: '#e2e8f0' }}>{m.totalAssets}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#64748b' }}>Avg P:</span>
          <span style={{ color: m.averagePressure > 4 ? '#f97316' : m.averagePressure < 1.5 ? '#3b82f6' : '#e2e8f0' }}>
            {m.averagePressure.toFixed(1)} bar
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#64748b' }}>Peak Flow:</span>
          <span style={{ color: '#e2e8f0' }}>{m.peakFlow.toFixed(1)} L/s</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#64748b' }}>Resilience:</span>
          <span style={{
            color: m.resilienceScore > 70 ? '#22c55e' : m.resilienceScore > 50 ? '#eab308' : '#ef4444',
            fontWeight: 600,
          }}>
            {m.resilienceScore}/100
          </span>
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'rgba(51, 65, 85, 0.5)' }} />

      {/* Alerts */}
      {m.activeAlerts > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} color="#eab308" />
          <span style={{ fontSize: 10, color: '#eab308' }}>
            {m.activeAlerts} alert{m.activeAlerts > 1 ? 's' : ''}
          </span>
          {m.criticalAssets > 0 && (
            <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>
              {m.criticalAssets} critical
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sim Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={toggleSimulation}
          style={{
            padding: '4px 8px', background: isRunning ? 'rgba(234, 179, 8, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            border: `1px solid ${isRunning ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
            borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            color: isRunning ? '#eab308' : '#22c55e', fontSize: 9, fontFamily: 'inherit',
          }}
        >
          {isRunning ? <Pause size={10} /> : <Play size={10} />}
          {isRunning ? 'PAUSE' : 'PLAY'}
        </button>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 4].map(speed => (
            <button
              key={speed}
              onClick={() => useStore.getState().setSimulationSpeed(speed)}
              style={{
                padding: '3px 6px',
                background: simulation.speed === speed ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                border: simulation.speed === speed ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                borderRadius: 2, cursor: 'pointer',
                color: simulation.speed === speed ? '#60a5fa' : '#64748b',
                fontSize: 9, fontFamily: 'inherit',
              }}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'rgba(51, 65, 85, 0.5)' }} />

      {/* View Mode Buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'pressure', label: 'P', color: '#22c55e' },
          { key: 'flow', label: 'F', color: '#38bdf8' },
          { key: 'risk', label: 'R', color: '#f97316' },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key as any)}
            style={{
              width: 22, height: 22, borderRadius: 3,
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.3)',
              color: v.color, cursor: 'pointer', fontSize: 9,
              fontFamily: 'inherit', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {v.key.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'rgba(51, 65, 85, 0.5)' }} />

      {/* Panel Toggles */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={toggleDashboard}
          style={{
            padding: '4px 8px',
            background: dashboardOpen ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: dashboardOpen ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(51, 65, 85, 0.3)',
            borderRadius: 3, cursor: 'pointer',
            color: dashboardOpen ? '#60a5fa' : '#64748b',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontFamily: 'inherit',
          }}
        >
          <BarChart3 size={12} />
          Dashboard
        </button>
        <button
          onClick={toggleAIPanel}
          style={{
            padding: '4px 8px',
            background: aiPanelOpen ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: aiPanelOpen ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(51, 65, 85, 0.3)',
            borderRadius: 3, cursor: 'pointer',
            color: aiPanelOpen ? '#60a5fa' : '#64748b',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontFamily: 'inherit',
          }}
        >
          <Bot size={12} />
          AI Engineer
        </button>
        <button
          onClick={toggleScenario}
          style={{
            padding: '4px 8px',
            background: scenarioOpen ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: scenarioOpen ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(51, 65, 85, 0.3)',
            borderRadius: 3, cursor: 'pointer',
            color: scenarioOpen ? '#60a5fa' : '#64748b',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontFamily: 'inherit',
          }}
        >
          <Network size={12} />
          Scenarios
        </button>
      </div>
    </div>
  );
}
