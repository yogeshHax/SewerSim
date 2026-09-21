'use client';

import React from 'react';
import { useStore } from '../../store/useStore';
import { BarChart3, X, Shield, Droplets, Gauge, AlertTriangle } from 'lucide-react';

function MetricCard({ label, value, unit, color, icon }: {
  label: string; value: string | number; unit?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(30, 41, 59, 0.6)',
      border: '1px solid rgba(51, 65, 85, 0.3)',
      borderRadius: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 9, color: '#64748b', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, color: color || '#e2e8f0', fontWeight: 700 }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4, fontWeight: 400 }}>{unit}</span>}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? '#22c55e' : pct > 50 ? '#eab308' : pct > 30 ? '#f97316' : '#ef4444';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 10, color }}>{value}%</span>
      </div>
      <div style={{ width: '100%', height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dashboardOpen, toggleDashboard, currentSnapshot, network, sidebarOpen } = useStore();

  if (!dashboardOpen) return null;

  const m = currentSnapshot.systemMetrics;

  // Count by status
  const pipeStatusCounts = network.pipes.reduce((acc, p) => {
    const status = currentSnapshot.pipes[p.id]?.status || 'normal';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nodeStatusCounts = network.nodes.reduce((acc, n) => {
    const status = currentSnapshot.nodes[n.id]?.status || 'normal';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
          <BarChart3 size={16} color="#60a5fa" />
          <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, letterSpacing: 0.5 }}>NETWORK STATUS</span>
        </div>
        <button onClick={toggleDashboard} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>

      {/* Resilience Score */}
      <div style={{
        padding: '16px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>WATER RESILIENCE SCORE</div>
        <div style={{
          fontSize: 48, fontWeight: 800,
          color: m.resilienceScore > 70 ? '#22c55e' : m.resilienceScore > 50 ? '#eab308' : '#ef4444',
          lineHeight: 1,
        }}>
          {m.resilienceScore}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>/ 100</div>

        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <ProgressBar label="Pressure Stability" value={m.pressureStability} />
          <ProgressBar label="Redundancy" value={m.redundancy} />
          <ProgressBar label="Capacity Reserve" value={m.capacity} />
          <ProgressBar label="Low Leak Risk" value={100 - m.leakRisk} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
      }}>
        <MetricCard
          label="TOTAL ASSETS"
          value={m.totalAssets}
          icon={<Shield size={10} color="#64748b" />}
        />
        <MetricCard
          label="CRITICAL"
          value={m.criticalAssets}
          color={m.criticalAssets > 0 ? '#ef4444' : '#22c55e'}
          icon={<AlertTriangle size={10} color={m.criticalAssets > 0 ? '#ef4444' : '#64748b'} />}
        />
        <MetricCard
          label="AVG PRESSURE"
          value={m.averagePressure.toFixed(1)}
          unit="bar"
          color={m.averagePressure > 4 ? '#f97316' : '#e2e8f0'}
          icon={<Gauge size={10} color="#64748b" />}
        />
        <MetricCard
          label="WATER LOSS"
          value={m.waterLoss.toFixed(1)}
          unit="L/s"
          color={m.waterLoss > 0 ? '#f97316' : '#22c55e'}
          icon={<Droplets size={10} color="#64748b" />}
        />
      </div>

      {/* Asset Status Breakdown */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1.5, marginBottom: 8 }}>ASSET STATUS</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Pipes ({network.pipes.length})</div>
          <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden' }}>
            {Object.entries(pipeStatusCounts).map(([status, count]) => (
              <div
                key={status}
                style={{
                  flex: count,
                  background: status === 'normal' ? '#22c55e' :
                    status === 'warning' ? '#eab308' :
                    status === 'critical' ? '#ef4444' :
                    status === 'leak' ? '#f97316' :
                    status === 'blocked' ? '#a855f7' : '#94a3b8',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {Object.entries(pipeStatusCounts).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: status === 'normal' ? '#22c55e' :
                    status === 'warning' ? '#eab308' :
                    status === 'critical' ? '#ef4444' :
                    status === 'leak' ? '#f97316' :
                    status === 'blocked' ? '#a855f7' : '#94a3b8',
                }} />
                <span style={{ color: '#64748b' }}>{status}: {count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Nodes ({network.nodes.length})</div>
          <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden' }}>
            {Object.entries(nodeStatusCounts).map(([status, count]) => (
              <div
                key={status}
                style={{
                  flex: count,
                  background: status === 'normal' ? '#22c55e' :
                    status === 'warning' ? '#eab308' :
                    status === 'critical' ? '#ef4444' : '#94a3b8',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
