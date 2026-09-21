'use client';

import React, { useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { Play, Pause, SkipBack } from 'lucide-react';

export default function Timeline() {
  const { simulation, toggleSimulation, setSimulationTime, resetToBaseline, sidebarOpen } = useStore();
  const { time, isRunning, speed, duration } = simulation;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setSimulationTime(pct * duration);
  }, [duration, setSimulationTime]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: sidebarOpen ? 220 : 44, right: 0, height: 52,
      background: 'rgba(15, 23, 42, 0.95)',
      borderTop: '1px solid rgba(51, 65, 85, 0.5)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      zIndex: 20,
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    }}>
      {/* Play/Pause */}
      <button
        onClick={toggleSimulation}
        style={{
          width: 32, height: 32, borderRadius: 4,
          background: isRunning ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
          border: `1px solid ${isRunning ? 'rgba(234, 179, 8, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          color: isRunning ? '#eab308' : '#22c55e',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isRunning ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {/* Reset */}
      <button
        onClick={() => { resetToBaseline(); }}
        style={{
          width: 32, height: 32, borderRadius: 4,
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid rgba(51, 65, 85, 0.3)',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <SkipBack size={14} />
      </button>

      {/* Time display */}
      <div style={{ fontSize: 11, color: '#e2e8f0', minWidth: 90, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(time)}
      </div>

      {/* Timeline track */}
      <div
        onClick={handleTimelineClick}
        style={{
          flex: 1, height: 24, position: 'relative', cursor: 'pointer',
        }}
      >
        {/* Track background */}
        <div style={{
          position: 'absolute', top: 10, left: 0, right: 0, height: 4,
          background: '#1e293b', borderRadius: 2,
        }} />
        {/* Progress */}
        <div style={{
          position: 'absolute', top: 10, left: 0, height: 4,
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          borderRadius: 2,
          transition: 'width 0.1s linear',
        }} />
        {/* Playhead */}
        <div style={{
          position: 'absolute', top: 6,
          left: `calc(${progress}% - 6px)`,
          width: 12, height: 12, borderRadius: 6,
          background: '#60a5fa',
          border: '2px solid #1e293b',
          boxShadow: '0 0 6px rgba(96, 165, 250, 0.4)',
          transition: 'left 0.1s linear',
        }} />
      </div>

      {/* Duration */}
      <div style={{ fontSize: 10, color: '#64748b', minWidth: 50, textAlign: 'right' }}>
        {formatTime(duration)}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: 'rgba(51, 65, 85, 0.5)' }} />

      {/* Speed */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 4].map(s => (
          <button
            key={s}
            onClick={() => useStore.getState().setSimulationSpeed(s)}
            style={{
              padding: '3px 6px',
              background: speed === s ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: speed === s ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(51, 65, 85, 0.3)',
              borderRadius: 2, cursor: 'pointer',
              color: speed === s ? '#60a5fa' : '#64748b',
              fontSize: 9, fontFamily: 'inherit',
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
