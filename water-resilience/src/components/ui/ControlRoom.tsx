'use client';

import React, { useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { getPressureColor, getFlowColor, getStatusColor } from '../../lib/network/simulation';

// ── Slider Component ──────────────────────────────────────────
function Slider({
  label, value, min, max, step, unit, onChange, color, sublabel,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (v: number) => void; color: string; sublabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 13, color, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      {sublabel && <div style={{ fontSize: 8, color: '#475569', marginBottom: 4 }}>{sublabel}</div>}
      <div style={{ position: 'relative', height: 20 }}>
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%', height: 4, WebkitAppearance: 'none', appearance: 'none',
            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
            borderRadius: 2, outline: 'none', cursor: 'pointer',
          }}
        />
        <style>{`
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 14px; height: 14px; border-radius: 50%;
            background: ${color}; border: 2px solid #0f172a;
            cursor: pointer; box-shadow: 0 0 6px ${color}66;
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────
function MetricCard({
  label, value, unit, color, subvalue,
}: {
  label: string; value: string; unit: string; color: string; subvalue?: string;
}) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(51, 65, 85, 0.3)',
      borderRadius: 6, padding: '8px 10px', flex: 1, minWidth: 80,
    }}>
      <div style={{ fontSize: 8, color: '#64748b', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: '"JetBrains Mono", monospace' }}>
        {value} <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>{unit}</span>
      </div>
      {subvalue && <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{subvalue}</div>}
    </div>
  );
}

// ── Pipe Pressure Bar ─────────────────────────────────────────
function PipeBar({ id, flow, pressure, risk, restriction, onRestrict, onClear }: {
  id: string; flow: number; pressure: number; risk: number;
  restriction: number; onRestrict: (v: number) => void; onClear: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
      background: restriction > 0 ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
      borderRadius: 3, borderLeft: restriction > 0 ? '2px solid #ef4444' : '2px solid transparent',
    }}>
      <span style={{ fontSize: 9, color: '#94a3b8', width: 40, fontFamily: '"JetBrains Mono", monospace' }}>{id}</span>
      <div style={{
        width: 6, height: 6, borderRadius: 3,
        background: getPressureColor(pressure),
      }} />
      <span style={{ fontSize: 9, color: '#94a3b8', width: 35 }}>{pressure.toFixed(1)} bar</span>
      <span style={{ fontSize: 9, color: '#64748b', width: 30 }}>{flow.toFixed(0)} L/s</span>
      <div style={{
        width: 4, height: 12, borderRadius: 2,
        background: risk < 25 ? '#22c55e' : risk < 50 ? '#eab308' : risk < 75 ? '#f97316' : '#ef4444',
      }} />
      {restriction > 0 ? (
        <button
          onClick={onClear}
          style={{
            fontSize: 8, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 3,
            padding: '1px 6px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {restriction}% ✕
        </button>
      ) : (
        <span style={{ fontSize: 8, color: '#334155' }}>—</span>
      )}
    </div>
  );
}

// ── Main ControlRoom Panel ────────────────────────────────────
export default function ControlRoom({ open, onClose }: { open: boolean; onClose: () => void }) {
  const simulation = useStore(s => s.simulation);
  const network = useStore(s => s.network);
  const setSourcePressure = useStore(s => s.setSourcePressure);
  const setSourceFlow = useStore(s => s.setSourceFlow);
  const setPipeRestriction = useStore(s => s.setPipeRestriction);
  const clearPipeRestriction = useStore(s => s.clearPipeRestriction);
  const resetManualControls = useStore(s => s.resetManualControls);
  const focusCamera = useStore(s => s.focusCamera);
  const selectAsset = useStore(s => s.selectAsset);

  const [tab, setTab] = useState<'controls' | 'pipes' | 'nodes'>('controls');
  const [restrictionTarget, setRestrictionTarget] = useState<string | null>(null);
  const [restrictionValue, setRestrictionValue] = useState(50);

  const metrics = simulation.currentSnapshot.systemMetrics;
  const snap = simulation.currentSnapshot;
  const srcPressure = simulation.sourcePressure;
  const srcFlow = simulation.sourceFlow;

  // Color for pressure slider
  const pressureColor = srcPressure < 1.0 ? '#3b82f6' : srcPressure < 2.0 ? '#22d3ee' : srcPressure < 3.5 ? '#22c55e' : srcPressure < 5.0 ? '#eab308' : '#ef4444';
  const flowColor = srcFlow < 15 ? '#3b82f6' : srcFlow < 30 ? '#22d3ee' : srcFlow < 50 ? '#22c55e' : srcFlow < 65 ? '#eab308' : '#ef4444';

  // Top pipes by flow for the pipe list
  const topPipes = network.pipes
    .map(p => ({
      id: p.id,
      flow: Math.abs(snap.pipes[p.id]?.flow || 0),
      pressure: snap.pipes[p.id]?.pressure || 0,
      risk: snap.pipes[p.id]?.riskScore || 0,
      restriction: simulation.pipeRestrictions[p.id] || 0,
    }))
    .sort((a, b) => b.flow - a.flow);

  // Node pressure summary
  const nodeSummary = network.nodes
    .map(n => ({
      id: n.id,
      type: n.type,
      pressure: snap.nodes[n.id]?.pressure || 0,
      risk: snap.nodes[n.id]?.riskScore || 0,
      status: snap.nodes[n.id]?.status || 'normal',
    }))
    .sort((a, b) => b.pressure - a.pressure);

  const handleRestrict = useCallback((pipeId: string) => {
    setPipeRestriction(pipeId, restrictionValue);
    setRestrictionTarget(null);
  }, [restrictionValue, setPipeRestriction]);

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 340,
      background: 'rgba(10, 15, 30, 0.95)', borderLeft: '1px solid rgba(51, 65, 85, 0.4)',
      zIndex: 30, display: 'flex', flexDirection: 'column',
      fontFamily: '"JetBrains Mono", "SF Mono", monospace', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', letterSpacing: 1 }}>
            CONTROL ROOM
          </div>
          <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
            Interactive Pressure & Flow Management
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: 16, padding: 4,
        }}>✕</button>
      </div>

      {/* Live Analytics Bar */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.2)',
        background: 'rgba(15, 23, 42, 0.4)',
      }}>
        <MetricCard label="AVG PRESSURE" value={metrics.averagePressure.toFixed(1)} unit="bar"
          color={getPressureColor(metrics.averagePressure)} />
        <MetricCard label="PEAK FLOW" value={metrics.peakFlow.toFixed(0)} unit="L/s"
          color={getFlowColor(metrics.peakFlow / 40 * 100)} />
        <MetricCard label="RESILIENCE" value={String(metrics.resilienceScore)} unit="/100"
          color={metrics.resilienceScore > 70 ? '#22c55e' : metrics.resilienceScore > 40 ? '#eab308' : '#ef4444'} />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
      }}>
        {[
          { key: 'controls' as const, label: 'CONTROLS' },
          { key: 'pipes' as const, label: `PIPES (${network.pipes.length})` },
          { key: 'nodes' as const, label: `NODES (${network.nodes.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px 4px', background: tab === t.key ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            border: 'none', borderBottom: tab === t.key ? '2px solid #38bdf8' : '2px solid transparent',
            color: tab === t.key ? '#38bdf8' : '#64748b', cursor: 'pointer',
            fontSize: 9, fontFamily: 'inherit', letterSpacing: 0.5, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        {tab === 'controls' && (
          <>
            {/* SOURCE PRESSURE */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(51, 65, 85, 0.3)',
              borderRadius: 8, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: '#38bdf8', letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>
                SOURCE PRESSURE
              </div>
              <Slider
                label="Pump Station Output"
                value={srcPressure}
                min={0.5} max={6.0} step={0.1}
                unit="bar"
                onChange={setSourcePressure}
                color={pressureColor}
                sublabel={`Default: 2.8 bar — Current node pressure: ${snap.nodes['S-001']?.pressure.toFixed(1) || '—'} bar`}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[1.0, 1.5, 2.0, 2.8, 3.5, 4.5, 5.5].map(v => (
                  <button key={v} onClick={() => setSourcePressure(v)} style={{
                    flex: 1, padding: '3px 2px', fontSize: 8,
                    background: Math.abs(srcPressure - v) < 0.05 ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    border: Math.abs(srcPressure - v) < 0.05 ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3, color: Math.abs(srcPressure - v) < 0.05 ? '#38bdf8' : '#64748b',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* SOURCE FLOW */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(51, 65, 85, 0.3)',
              borderRadius: 8, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: '#22d3ee', letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>
                SOURCE SUPPLY
              </div>
              <Slider
                label="Available Supply at Source"
                value={srcFlow}
                min={5} max={80} step={1}
                unit="L/s"
                onChange={setSourceFlow}
                color={flowColor}
                sublabel={`Default: 32 L/s — Network demand: ${metrics.totalDemand.toFixed(1)} L/s (live)`}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[5, 10, 20, 32, 45, 60, 80].map(v => (
                  <button key={v} onClick={() => setSourceFlow(v)} style={{
                    flex: 1, padding: '3px 2px', fontSize: 8,
                    background: Math.abs(srcFlow - v) < 0.5 ? 'rgba(34, 211, 238, 0.2)' : 'transparent',
                    border: Math.abs(srcFlow - v) < 0.5 ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3, color: Math.abs(srcFlow - v) < 0.5 ? '#22d3ee' : '#64748b',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* PIPE RESTRICTIONS */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(51, 65, 85, 0.3)',
              borderRadius: 8, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 10, color: '#f97316', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
                APPLY PIPE RESTRICTION
              </div>
              <div style={{ fontSize: 8, color: '#475569', marginBottom: 10 }}>
                Select a pipe and set restriction level to simulate blockage
              </div>
              {/* Quick restriction */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {network.pipes.filter(p => p.type === 'main').slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => {
                    setPipeRestriction(p.id, 50);
                  }} style={{
                    padding: '3px 6px', fontSize: 8,
                    background: simulation.pipeRestrictions[p.id] ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    border: simulation.pipeRestrictions[p.id] ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
                    borderRadius: 3, color: simulation.pipeRestrictions[p.id] ? '#ef4444' : '#94a3b8',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {p.id}
                  </button>
                ))}
              </div>
              {/* Custom restriction */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <select
                  value={restrictionTarget || ''}
                  onChange={e => setRestrictionTarget(e.target.value || null)}
                  style={{
                    flex: 1, padding: '4px 6px', fontSize: 9, background: '#0f172a',
                    border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: 3,
                    color: '#94a3b8', fontFamily: 'inherit',
                  }}
                >
                  <option value="">Select pipe...</option>
                  {network.pipes.map(p => (
                    <option key={p.id} value={p.id}>{p.id} — {p.label}</option>
                  ))}
                </select>
                <select
                  value={restrictionValue}
                  onChange={e => setRestrictionValue(parseInt(e.target.value))}
                  style={{
                    width: 70, padding: '4px 6px', fontSize: 9, background: '#0f172a',
                    border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: 3,
                    color: '#94a3b8', fontFamily: 'inherit',
                  }}
                >
                  {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
                <button
                  onClick={() => restrictionTarget && handleRestrict(restrictionTarget)}
                  disabled={!restrictionTarget}
                  style={{
                    padding: '4px 10px', fontSize: 9,
                    background: restrictionTarget ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 3, color: restrictionTarget ? '#ef4444' : '#334155',
                    cursor: restrictionTarget ? 'pointer' : 'default', fontFamily: 'inherit',
                  }}
                >
                  APPLY
                </button>
              </div>
              {/* Active restrictions */}
              {Object.keys(simulation.pipeRestrictions).length > 0 && (
                <div style={{
                  marginTop: 8, padding: 8, background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 4,
                }}>
                  <div style={{ fontSize: 8, color: '#ef4444', marginBottom: 6 }}>Active Restrictions:</div>
                  {Object.entries(simulation.pipeRestrictions).map(([id, sev]) => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 9, color: '#94a3b8' }}>{id}: {sev}% restricted</span>
                      <button onClick={() => clearPipeRestriction(id)} style={{
                        fontSize: 8, color: '#ef4444', background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RESET */}
            <button onClick={resetManualControls} style={{
              width: '100%', padding: '8px', fontSize: 10,
              background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: 4, color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: 0.5,
            }}>
              RESET ALL CONTROLS TO DEFAULT
            </button>
          </>
        )}

        {tab === 'pipes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {topPipes.map(p => (
              <PipeBar
                key={p.id} id={p.id} flow={p.flow} pressure={p.pressure}
                risk={p.risk} restriction={p.restriction}
                onRestrict={(v) => setPipeRestriction(p.id, v)}
                onClear={() => clearPipeRestriction(p.id)}
              />
            ))}
          </div>
        )}

        {tab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {nodeSummary.map(n => (
              <div
                key={n.id}
                onClick={() => { selectAsset(n.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                  borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: getPressureColor(n.pressure),
                }} />
                <span style={{ fontSize: 9, color: '#94a3b8', width: 50, fontFamily: '"JetBrains Mono", monospace' }}>{n.id}</span>
                <span style={{ fontSize: 8, color: '#475569', width: 60 }}>{n.type}</span>
                <span style={{ fontSize: 9, color: getPressureColor(n.pressure), fontFamily: '"JetBrains Mono", monospace', width: 40 }}>
                  {n.pressure.toFixed(1)} bar
                </span>
                <div style={{
                  width: 4, height: 12, borderRadius: 2, marginLeft: 'auto',
                  background: n.risk < 25 ? '#22c55e' : n.risk < 50 ? '#eab308' : n.risk < 75 ? '#f97316' : '#ef4444',
                }} />
                <span style={{ fontSize: 8, color: '#64748b', width: 20 }}>{n.risk}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
