'use client';

import React from 'react';
import { useStore } from '../../store/useStore';
import type { ViewMode, TerrainMode } from '../../lib/network/types';
import {
  Eye, Layers, Target, AlertTriangle, Droplets, Gauge,
  Mountain, ArrowDownToLine, SplitSquareVertical,
  RotateCcw, Play, Pause, ChevronLeft, ChevronRight,
} from 'lucide-react';

const viewModes: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'normal', label: 'Normal', icon: <Eye size={16} /> },
  { mode: 'pressure', label: 'Pressure', icon: <Gauge size={16} /> },
  { mode: 'flow', label: 'Flow', icon: <Droplets size={16} /> },
  { mode: 'velocity', label: 'Velocity', icon: <Target size={16} /> },
  { mode: 'risk', label: 'Risk', icon: <AlertTriangle size={16} /> },
  { mode: 'waterLevel', label: 'Water Level', icon: <Layers size={16} /> },
];

const terrainModes: { mode: TerrainMode; label: string }[] = [
  { mode: 'surface', label: 'Surface' },
  { mode: 'underground', label: 'Underground' },
  { mode: 'both', label: 'Both' },
];

const cameraPresets = [
  { preset: 'top' as const, label: 'TOP' },
  { preset: 'side' as const, label: 'SIDE' },
  { preset: '3d' as const, label: '3D' },
  { preset: 'default' as const, label: 'FIT' },
];

export default function Sidebar() {
  const {
    sidebarOpen, toggleSidebar,
    viewMode, setViewMode,
    terrainMode, setTerrainMode,
    showWaterFlow, toggleWaterFlow,
    showLabels, toggleLabels,
    showManholes, toggleManholes,
    setCameraPreset,
    simulation, toggleSimulation, resetToBaseline,
    setInflowMultiplier,
    resetSimulation,
  } = useStore();

  const sim = simulation;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: sidebarOpen ? 220 : 44,
        background: 'rgba(15, 23, 42, 0.92)',
        borderRight: '1px solid rgba(51, 65, 85, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        zIndex: 20,
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono", "SF Mono", monospace',
      }}
    >
      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        }}
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        {sidebarOpen && <span style={{ letterSpacing: 1 }}>WATER RESILIENCE</span>}
      </button>

      {sidebarOpen && (
        <>
          {/* View Modes */}
          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>VIEW</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {viewModes.map(vm => (
                <button
                  key={vm.mode}
                  onClick={() => setViewMode(vm.mode)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: viewMode === vm.mode ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: viewMode === vm.mode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                    borderRadius: 4,
                    color: viewMode === vm.mode ? '#60a5fa' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {vm.icon}
                  {vm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Terrain */}
          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>TERRAIN</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {terrainModes.map(tm => (
                <button
                  key={tm.mode}
                  onClick={() => setTerrainMode(tm.mode)}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    background: terrainMode === tm.mode ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: terrainMode === tm.mode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3,
                    color: terrainMode === tm.mode ? '#60a5fa' : '#64748b',
                    cursor: 'pointer',
                    fontSize: 9,
                    fontFamily: 'inherit',
                  }}
                >
                  {tm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera */}
          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>CAMERA</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {cameraPresets.map(cp => (
                <button
                  key={cp.preset}
                  onClick={() => setCameraPreset(cp.preset)}
                  style={{
                    flex: 1,
                    padding: '5px 4px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 9,
                    fontFamily: 'inherit',
                  }}
                >
                  {cp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>DISPLAY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Water Flow', active: showWaterFlow, toggle: toggleWaterFlow },
                { label: 'Labels', active: showLabels, toggle: toggleLabels },
                { label: 'Manholes', active: showManholes, toggle: toggleManholes },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.toggle}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 10px',
                    background: 'transparent',
                    border: '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{
                    width: 28, height: 14, borderRadius: 7,
                    background: item.active ? '#3b82f6' : '#334155',
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 5,
                      background: '#fff',
                      position: 'absolute',
                      top: 2,
                      left: item.active ? 16 : 2,
                      transition: 'left 0.2s',
                    }} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Demand event multiplier */}
          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 4 }}>DEMAND EVENT</div>
            <div style={{ fontSize: 8, color: '#475569', marginBottom: 6 }}>Storm surge load on the network</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { label: '1.0×', value: 1.0 },
                { label: '1.5×', value: 1.5 },
                { label: '2.0×', value: 2.0 },
                { label: '3.0×', value: 3.0 },
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => setInflowMultiplier(item.value)}
                  style={{
                    flex: 1,
                    padding: '5px 2px',
                    background: sim.inflowMultiplier === item.value ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                    border: sim.inflowMultiplier === item.value ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3,
                    color: sim.inflowMultiplier === item.value ? '#eab308' : '#64748b',
                    cursor: 'pointer',
                    fontSize: 9,
                    fontFamily: 'inherit',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Reset */}
          <div style={{ padding: '12px', borderTop: '1px solid rgba(51, 65, 85, 0.3)' }}>
            <button
              onClick={resetSimulation}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 4,
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'inherit',
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <RotateCcw size={12} />
              RESET SIMULATION
            </button>
          </div>
        </>
      )}
    </div>
  );
}
