'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '../../components/ui/Sidebar';
import Inspector from '../../components/ui/Inspector';
import AIPanel from '../../components/ui/AIPanel';
import Dashboard from '../../components/ui/Dashboard';
import ScenarioPanel from '../../components/ui/ScenarioPanel';
import AlertBar from '../../components/ui/AlertBar';
import Timeline from '../../components/ui/Timeline';
import ControlRoom from '../../components/ui/ControlRoom';

// Dynamic import for Three.js (must be client-only)
const WaterWorld = dynamic(() => import('../../components/three/WaterWorld'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0c1222',
      fontFamily: '"JetBrains Mono", monospace',
      color: '#64748b',
      fontSize: 14,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12, color: '#3b82f6' }}>◇</div>
        <div>Loading Water Network...</div>
        <div style={{ fontSize: 10, marginTop: 4, color: '#334155' }}>Initializing 3D environment</div>
      </div>
    </div>
  ),
});

export default function Home() {
  const [controlRoomOpen, setControlRoomOpen] = React.useState(false);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#0c1222',
    }}>
      {/* 3D Scene (fills entire viewport) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}>
        <WaterWorld />
      </div>

      {/* UI Overlays */}
      <Sidebar />
      <AlertBar />
      <Inspector />
      <AIPanel />
      <Dashboard />
      <ScenarioPanel />
      <Timeline />

      {/* Control Room Button */}
      <button
        onClick={() => setControlRoomOpen(!controlRoomOpen)}
        style={{
          position: 'absolute',
          bottom: 60,
          right: 16,
          padding: '10px 18px',
          background: controlRoomOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(10, 15, 30, 0.9)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 6,
          color: '#38bdf8',
          cursor: 'pointer',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1,
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s',
          boxShadow: controlRoomOpen ? '0 0 20px rgba(56, 189, 248, 0.15)' : 'none',
        }}
      >
        <span style={{ fontSize: 14 }}>&#9881;</span>
        CONTROL ROOM
      </button>

      {/* Control Room Panel */}
      <ControlRoom open={controlRoomOpen} onClose={() => setControlRoomOpen(false)} />
    </div>
  );
}
