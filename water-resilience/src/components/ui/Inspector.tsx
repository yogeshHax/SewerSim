'use client';

import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, ChevronDown, ChevronUp, AlertTriangle, Droplets, Zap, Shield } from 'lucide-react';

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '8px 14px', background: 'none', border: 'none',
          color: '#94a3b8', fontSize: 9, letterSpacing: 1.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit',
        }}
      >
        {title}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div style={{ padding: '0 14px 10px' }}>{children}</div>}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 11, color: color || '#e2e8f0', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    normal: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
    warning: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
    critical: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    leak: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
    blocked: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    open: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
    closed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    running: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  };
  const c = colors[status] || colors.normal;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3, fontSize: 9,
      background: c.bg, color: c.text, letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    }}>
      {status}
    </span>
  );
}

function RiskBar({ value }: { value: number }) {
  const color = value < 25 ? '#22c55e' : value < 50 ? '#eab308' : value < 75 ? '#f97316' : '#ef4444';
  return (
    <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}

function LeakControls({ pipeId }: { pipeId: string }) {
  const { applyLeak, removeLeak, network } = useStore();
  const existingLeak = network.leaks.find(l => l.pipeId === pipeId && l.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {existingLeak ? (
        <>
          <Row label="Leak Active" value={`${existingLeak.severity.toFixed(0)}%`} color="#f97316" />
          <Row label="Flow Loss" value={`${existingLeak.flowRate.toFixed(1)} L/s`} color="#f97316" />
          <button
            onClick={() => removeLeak(pipeId)}
            style={{
              padding: '5px 8px', background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 3,
              color: '#22c55e', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
            }}
          >
            Repair Leak
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {[10, 25, 50].map(sev => (
            <button
              key={sev}
              onClick={() => applyLeak(pipeId, sev)}
              style={{
                flex: 1, padding: '5px', background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: 3,
                color: '#f97316', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
              }}
            >
              {sev}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockageControls({ pipeId }: { pipeId: string }) {
  const { applyBlockage, removeBlockage, network } = useStore();
  const existingBlockage = network.blockages.find(b => b.pipeId === pipeId && b.active);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {existingBlockage ? (
        <>
          <Row label="Blockage" value={`${existingBlockage.severity.toFixed(0)}%`} color="#a855f7" />
          <button
            onClick={() => removeBlockage(pipeId)}
            style={{
              padding: '5px 8px', background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 3,
              color: '#22c55e', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
            }}
          >
            Clear Blockage
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {[25, 50, 75, 100].map(sev => (
            <button
              key={sev}
              onClick={() => applyBlockage(pipeId, sev)}
              style={{
                flex: 1, padding: '5px', background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 3,
                color: '#a855f7', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
              }}
            >
              {sev}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Inspector() {
  const { selectedAssetId, inspectorOpen, toggleInspector, network, simulation, focusCamera } = useStore();

  if (!inspectorOpen || !selectedAssetId) return null;

  const pipe = network.pipes.find(p => p.id === selectedAssetId);
  const node = network.nodes.find(n => n.id === selectedAssetId);
  const valve = network.valves.find(v => v.id === selectedAssetId);
  const pump = network.pumps.find(p => p.id === selectedAssetId);

  const pipeState = pipe ? simulation.currentSnapshot.pipes[pipe.id] : null;
  const nodeState = node ? simulation.currentSnapshot.nodes[node.id] : null;

  const handleFocus = () => {
    if (pipe) {
      const fromNode = network.nodes.find(n => n.id === pipe.fromNode);
      if (fromNode) focusCamera(fromNode.position);
    } else if (node) {
      focusCamera(node.position);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      right: 0, top: 40, bottom: 40,
      width: 280,
      background: 'rgba(15, 23, 42, 0.92)',
      borderLeft: '1px solid rgba(51, 65, 85, 0.5)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
            {pipe?.label || node?.label || valve?.label || pump?.label || selectedAssetId}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginTop: 2 }}>
            {pipe ? 'PIPE' : node ? node.type.toUpperCase().replace('_', ' ') : valve ? 'VALVE' : 'PUMP'}
          </div>
        </div>
        <button
          onClick={toggleInspector}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Pipe Details */}
      {pipe && pipeState && (
        <>
          <Section title="PROPERTIES">
            <Row label="Length" value={`${pipe.length.toFixed(1)} m`} />
            <Row label="Diameter" value={`${pipe.diameter} mm`} />
            <Row label="Roughness" value={`C=${pipe.roughness}`} />
            <Row label="Type" value={pipe.type} />
            <Row label="Age" value={`${pipe.age} years`} />
            <Row label="Condition" value={`${pipe.condition}%`} />
            {pipe.maxBendAngle > 0 && (
              <Row label="Max Bend" value={`${pipe.maxBendAngle.toFixed(0)}°`} color={pipe.maxBendAngle > 60 ? '#f97316' : undefined} />
            )}
          </Section>
          <Section title="SIMULATION">
            <Row label="Flow" value={`${pipeState.flow.toFixed(1)} L/s`} color="#38bdf8" />
            <Row label="Pressure" value={`${pipeState.pressure.toFixed(1)} bar`} color="#22c55e" />
            <Row label="Velocity" value={`${pipeState.velocity.toFixed(2)} m/s`} />
            <Row label="Utilization" value={`${pipeState.utilization}%`} color={pipeState.utilization > 80 ? '#f97316' : undefined} />
            <Row label="Head Loss" value={`${pipeState.headLoss.toFixed(3)} m/m`} />
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Risk Score</div>
              <RiskBar value={pipeState.riskScore} />
              <div style={{ fontSize: 10, color: pipeState.riskScore > 50 ? '#f97316' : '#94a3b8', marginTop: 2 }}>
                {pipeState.riskScore}/100
              </div>
            </div>
          </Section>
          <Section title="STATUS">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Status:</span>
              <StatusBadge status={pipeState.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Connected:</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{pipe.fromNode} → {pipe.toNode}</span>
            </div>
          </Section>
          <Section title="ACTIONS">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <LeakControls pipeId={pipe.id} />
              <BlockageControls pipeId={pipe.id} />
              <button
                onClick={handleFocus}
                style={{
                  padding: '6px 8px', background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 3,
                  color: '#60a5fa', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Focus in 3D
              </button>
            </div>
          </Section>
        </>
      )}

      {/* Node Details */}
      {node && nodeState && (
        <>
          <Section title="PROPERTIES">
            <Row label="Type" value={node.type.replace('_', ' ')} />
            <Row label="Elevation" value={`${node.elevation.toFixed(1)} m`} />
            <Row label="Condition" value={`${node.condition}%`} />
          </Section>
          <Section title="SIMULATION">
            <Row label="Pressure" value={`${nodeState.pressure.toFixed(1)} bar`} color="#22c55e" />
            <Row label="Water Level" value={`${nodeState.waterLevel.toFixed(1)} m`} color="#38bdf8" />
            <Row label="Demand" value={`${node.demand.toFixed(1)} L/s`} />
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Risk Score</div>
              <RiskBar value={nodeState.riskScore} />
              <div style={{ fontSize: 10, color: nodeState.riskScore > 50 ? '#f97316' : '#94a3b8', marginTop: 2 }}>
                {nodeState.riskScore}/100
              </div>
            </div>
          </Section>
          <Section title="CONNECTED PIPES">
            {network.pipes
              .filter(p => p.fromNode === node.id || p.toNode === node.id)
              .map(p => (
                <div
                  key={p.id}
                  onClick={() => useStore.getState().selectAsset(p.id)}
                  style={{
                    padding: '4px 8px', marginBottom: 2, background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#94a3b8',
                    display: 'flex', justifyContent: 'space-between',
                  }}
                >
                  <span>{p.label}</span>
                  <StatusBadge status={simulation.currentSnapshot.pipes[p.id]?.status || 'normal'} />
                </div>
              ))}
          </Section>
          <Section title="STATUS">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Status:</span>
              <StatusBadge status={nodeState.status} />
            </div>
          </Section>
          <Section title="ACTIONS">
            <button
              onClick={handleFocus}
              style={{
                padding: '6px 8px', background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 3,
                color: '#60a5fa', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
              }}
            >
              Focus in 3D
            </button>
          </Section>
        </>
      )}

      {/* Valve Details */}
      {valve && (
        <>
          <Section title="PROPERTIES">
            <Row label="Type" value={valve.type} />
            <Row label="Openness" value={`${valve.openness}%`} />
            <Row label="State" value={valve.state} color={valve.state === 'open' ? '#22c55e' : '#ef4444'} />
          </Section>
          <Section title="ACTIONS">
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => useStore.getState().openValve(valve.id)}
                style={{
                  flex: 1, padding: '6px', background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 3,
                  color: '#22c55e', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Open
              </button>
              <button
                onClick={() => useStore.getState().closeValve(valve.id)}
                style={{
                  flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 3,
                  color: '#ef4444', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          </Section>
        </>
      )}

      {/* Pump Details */}
      {pump && (
        <>
          <Section title="PROPERTIES">
            <Row label="Capacity" value={`${pump.capacity.toFixed(1)} L/s`} />
            <Row label="Head" value={`${pump.head.toFixed(1)} m`} />
            <Row label="Power" value={`${pump.power} kW`} />
            <Row label="Utilization" value={`${pump.utilization}%`} />
            <Row label="State" value={pump.state} color={pump.state === 'running' ? '#22c55e' : '#ef4444'} />
          </Section>
          <Section title="ACTIONS">
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => useStore.getState().fixPump(pump.id)}
                style={{
                  flex: 1, padding: '6px', background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 3,
                  color: '#22c55e', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Start
              </button>
              <button
                onClick={() => useStore.getState().failPump(pump.id)}
                style={{
                  flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 3,
                  color: '#ef4444', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
                }}
              >
                Fail
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
