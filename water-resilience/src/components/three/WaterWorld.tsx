'use client';

import React, { useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import {
  midpointOfPipe,
  getPressureColor,
  getFlowColor,
  getRiskColor,
} from '../../lib/network/simulation';
import type { ViewMode } from '../../lib/network/types';
import PipeMesh from './PipeMesh';
import NodeMesh from './NodeMesh';
import TerrainAndCity from './TerrainAndCity';
import { WORLD_CENTER, WORLD_HALF } from '../../lib/network/sceneConstants';

// Shared pipe color helper (kept in sync with PipeMesh's getPipeColor)
function getPipeColor(pipe: any, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'pressure': return getPressureColor(pipe.pressure);
    case 'flow': return getFlowColor(pipe.utilization);
    case 'risk': return getRiskColor(pipe.riskScore);
    default: {
      switch (pipe.status) {
        case 'leak': return '#f97316';
        case 'blocked': return '#a855f7';
        case 'critical': return '#ef4444';
        case 'warning': return '#eab308';
        default: return '#64748b';
      }
    }
  }
}

// ── Labels Component ───────────────────────────────────────
function NetworkLabels() {
  const network = useStore(s => s.network);
  const showLabels = useStore(s => s.showLabels);
  const simulation = useStore(s => s.simulation);

  if (!showLabels) return null;

  const labels: { pos: THREE.Vector3; text: string; color: string; subText?: string }[] = [];

  // Source label
  const src = network.nodes.find(n => n.type === 'source');
  if (src) {
    labels.push({
      pos: new THREE.Vector3(src.position.x, src.position.z + 2.2, -src.position.y),
      text: 'WATER SOURCE',
      color: '#38bdf8',
      subText: 'Reservoir',
    });
  }

  // Destination labels
  for (const dst of network.nodes.filter(n => n.type === 'destination')) {
    labels.push({
      pos: new THREE.Vector3(dst.position.x, dst.position.z + 1.8, -dst.position.y),
      text: dst.label.includes('1') ? 'OUTLET 1' : 'OUTLET 2',
      color: '#22d3ee',
      subText: 'Distribution',
    });
  }

  // Manhole labels (at surface level)
  for (const node of network.nodes) {
    if (node.type === 'manhole') {
      const nodeState = simulation.currentSnapshot.nodes[node.id];
      const riskColor = nodeState && nodeState.riskScore > 60 ? '#f97316' : '#94a3b8';
      labels.push({
        pos: new THREE.Vector3(node.position.x, 6.5, -node.position.y),
        text: node.id,
        color: riskColor,
      });
    }
  }

  return (
    <group>
      {labels.map((label, i) => (
        <group key={i} position={label.pos}>
          <Text
            fontSize={0.4}
            color={label.color}
            anchorX="center"
            anchorY="middle"
            font={undefined}
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {label.text}
          </Text>
          {label.subText && (
            <Text
              position={[0, -0.4, 0]}
              fontSize={0.3}
              color="#64748b"
              anchorX="center"
              anchorY="middle"
            >
              {label.subText}
            </Text>
          )}
        </group>
      ))}
    </group>
  );
}

// ── Leak Markers ───────────────────────────────────────────
function LeakMarkers() {
  const network = useStore(s => s.network);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  return (
    <group>
      {network.leaks.filter(l => l.active).map(leak => {
        const pos = new THREE.Vector3(leak.position.x, leak.position.z, -leak.position.y);
        const pulse = Math.sin(timeRef.current * 3) * 0.15 + 0.85;
        return (
          <group key={leak.id} position={pos}>
            {/* Leak warning ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.4 * pulse, 0.6 * pulse, 16]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            {/* Leak point */}
            <mesh>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial
                color="#f97316"
                emissive="#f97316"
                emissiveIntensity={0.8}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Water spray particles */}
            {[...Array(5)].map((_, j) => {
              const angle = (j / 5) * Math.PI * 2 + timeRef.current * 2;
              const r = 0.3 + Math.sin(timeRef.current * 4 + j) * 0.1;
              return (
                <mesh key={j} position={[Math.cos(angle) * r, 0.3, Math.sin(angle) * r]}>
                  <sphereGeometry args={[0.05, 4, 4]} />
                  <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// ── Blockage Markers ───────────────────────────────────────
function BlockageMarkers() {
  const network = useStore(s => s.network);
  const simulation = useStore(s => s.simulation);
  const timeRef = useRef(0);

  useFrame((_, delta) => { timeRef.current += delta; });

  const blocked = new Set<string>([
    ...network.blockages.filter(b => b.active).map(b => b.pipeId),
    ...Object.entries(simulation.pipeRestrictions)
      .filter(([, sev]) => sev > 0)
      .map(([id]) => id),
  ]);

  return (
    <group>
      {network.pipes.filter(p => blocked.has(p.id)).map(pipe => {
        const pos = midpointOfPipe(network, pipe);
        const scenePos = new THREE.Vector3(pos.x, pos.z, -pos.y);
        const pulse = 1 + Math.sin(timeRef.current * 3.5) * 0.18;
        return (
          <group key={pipe.id} position={scenePos}>
            <mesh>
              <sphereGeometry args={[0.22 * pulse, 8, 8]} />
              <meshStandardMaterial
                color="#a855f7" emissive="#a855f7" emissiveIntensity={0.9}
                transparent opacity={0.95}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.45 * pulse, 0.58 * pulse, 16]} />
              <meshBasicMaterial color="#a855f7" transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Valve Markers ──────────────────────────────────────────
function ValveMarkers() {
  const network = useStore(s => s.network);
  const selectAsset = useStore(s => s.selectAsset);
  const selectedAssetId = useStore(s => s.selectedAssetId);

  return (
    <group>
      {network.valves.map(valve => {
        const pipe = network.pipes.find(p => p.id === valve.pipeId);
        if (!pipe) return null;
        const node = network.nodes.find(n => n.id === valve.nodeId);
        if (!node) return null;

        const pos = new THREE.Vector3(node.position.x, node.position.z + 0.5, -node.position.y);
        const isOpen = valve.state === 'open';
        const isSelected = selectedAssetId === valve.id;

        return (
          <group key={valve.id} position={pos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); selectAsset(valve.id); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <boxGeometry args={[0.4, 0.3, 0.25]} />
              <meshStandardMaterial
                color={isOpen ? '#22c55e' : '#ef4444'}
                roughness={0.6}
                metalness={0.3}
                emissive={isSelected ? (isOpen ? '#22c55e' : '#ef4444') : '#000000'}
                emissiveIntensity={isSelected ? 0.4 : 0}
              />
            </mesh>
            {/* Valve handle */}
            <mesh position={[0, 0.25, 0]} rotation={[0, 0, isOpen ? 0 : Math.PI / 4]}>
              <boxGeometry args={[0.35, 0.06, 0.06]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Pump Markers ───────────────────────────────────────────
function PumpMarkers() {
  const network = useStore(s => s.network);
  const selectAsset = useStore(s => s.selectAsset);
  const selectedAssetId = useStore(s => s.selectedAssetId);

  return (
    <group>
      {network.pumps.map(pump => {
        const node = network.nodes.find(n => n.id === pump.nodeId);
        if (!node) return null;
        const pos = new THREE.Vector3(node.position.x, node.position.z + 1.5, -node.position.y);
        const isRunning = pump.state === 'running';
        const isSelected = selectedAssetId === pump.id;

        return (
          <group key={pump.id} position={pos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); selectAsset(pump.id); }}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <cylinderGeometry args={[0.25, 0.3, 0.5, 8]} />
              <meshStandardMaterial
                color={isRunning ? '#3b82f6' : '#ef4444'}
                roughness={0.5}
                metalness={0.3}
                emissive={isSelected ? (isRunning ? '#3b82f6' : '#ef4444') : '#000000'}
                emissiveIntensity={isSelected ? 0.4 : 0}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Hover Tooltip ──────────────────────────────────────────
function HoverTooltip() {
  const hoveredAssetId = useStore(s => s.hoveredAssetId);
  const network = useStore(s => s.network);
  const simulation = useStore(s => s.simulation);
  const viewMode = useStore(s => s.viewMode);

  const pipe = network.pipes.find(p => p.id === hoveredAssetId);
  const node = network.nodes.find(n => n.id === hoveredAssetId);
  if (!pipe && !node) return null;

  const state = pipe
    ? simulation.currentSnapshot.pipes[pipe.id]
    : node ? simulation.currentSnapshot.nodes[node.id] : undefined;
  if (!state) return null;

  const primary = 'flow' in state
    ? `${Math.abs(state.flow).toFixed(1)} L/s · ${state.pressure.toFixed(1)} bar · ${state.utilization}% cap`
    : `${state.pressure.toFixed(1)} bar · ${(node?.demand ?? 0).toFixed(1)} L/s demand`;

  const accent = pipe
    ? getPipeColor({ ...pipe, ...state }, viewMode)
    : getPressureColor(state.pressure);

  return (
    <div style={{
      position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(8, 13, 24, 0.92)', border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 4, padding: '6px 12px', zIndex: 15,
      fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>{(pipe ?? node)!.id}</span>
      <span style={{ fontSize: 9, color: '#64748b' }}>
        {pipe ? 'PIPE' : (node!.type.replace('_', ' ').toUpperCase())}
      </span>
      <span style={{ fontSize: 10, color: accent }}>{primary}</span>
      <span style={{ fontSize: 8, color: '#475569' }}>click for details</span>
    </div>
  );
}

// ── View Legend ────────────────────────────────────────────
function ViewLegend() {
  const viewMode = useStore(s => s.viewMode);

  const scales: Record<ViewMode, { title: string; stops: { color: string; label: string }[] }> = {
    normal: {
      title: 'ASSET STATUS',
      stops: [
        { color: '#64748b', label: 'normal' }, { color: '#eab308', label: 'warning' },
        { color: '#ef4444', label: 'critical' }, { color: '#f97316', label: 'leak' },
        { color: '#a855f7', label: 'blocked' },
      ],
    },
    pressure: {
      title: 'PRESSURE (bar)',
      stops: [
        { color: '#3b82f6', label: '<1.5' }, { color: '#22d3ee', label: '1.5–2' },
        { color: '#22c55e', label: '2–3' }, { color: '#eab308', label: '3–4' },
        { color: '#f97316', label: '4–5' }, { color: '#ef4444', label: '>5' },
      ],
    },
    flow: {
      title: 'CAPACITY UTILIZATION',
      stops: [
        { color: '#94a3b8', label: '<20%' }, { color: '#22c55e', label: '20–50%' },
        { color: '#eab308', label: '50–75%' }, { color: '#f97316', label: '75–90%' },
        { color: '#ef4444', label: '>90%' },
      ],
    },
    velocity: {
      title: 'VELOCITY (m/s)',
      stops: [
        { color: '#3b82f6', label: '<0.5' }, { color: '#22c55e', label: '0.5–1' },
        { color: '#eab308', label: '1–1.5' }, { color: '#f97316', label: '1.5–2' },
        { color: '#ef4444', label: '>2' },
      ],
    },
    risk: {
      title: 'RISK SCORE',
      stops: [
        { color: '#22c55e', label: '<25' }, { color: '#eab308', label: '25–50' },
        { color: '#f97316', label: '50–75' }, { color: '#ef4444', label: '>75' },
      ],
    },
    waterLevel: {
      title: 'WATER PRESENCE',
      stops: [
        { color: '#22d3ee', label: 'flowing' }, { color: '#64748b', label: 'static' },
      ],
    },
  };

  const scale = scales[viewMode];
  return (
    <div style={{
      position: 'absolute', bottom: 64, right: 16, zIndex: 15,
      background: 'rgba(8, 13, 24, 0.88)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 4, padding: '8px 12px', pointerEvents: 'none',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{ fontSize: 8, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>{scale.title}</div>
      <div style={{ display: 'flex' }}>
        {scale.stops.map((stop, i) => (
          <div key={i} style={{
            width: 26, height: 8,
            background: stop.color,
            borderLeft: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.3)',
            borderTopLeftRadius: i === 0 ? 2 : 0,
            borderBottomLeftRadius: i === 0 ? 2 : 0,
            borderTopRightRadius: i === scale.stops.length - 1 ? 2 : 0,
            borderBottomRightRadius: i === scale.stops.length - 1 ? 2 : 0,
          }} title={stop.label} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 7, color: '#475569' }}>{scale.stops[0].label}</span>
        <span style={{ fontSize: 7, color: '#475569' }}>{scale.stops[scale.stops.length - 1].label}</span>
      </div>
    </div>
  );
}

// ── Camera Controller ──────────────────────────────────────
function CameraController() {
  const controlsRef = useRef<any>(null);
  const cameraTarget = useStore(s => s.cameraTarget);
  const cameraPreset = useStore(s => s.cameraPreset);
  const { camera } = useThree();

  useEffect(() => {
    if (!controlsRef.current) return;

    if (cameraPreset) {
      const controls = controlsRef.current;
      switch (cameraPreset) {
        case 'top':
          camera.position.set(5, 65, 12);
          controls.target.set(5, 2, 12);
          break;
        case 'side':
          camera.position.set(55, 8, 12);
          controls.target.set(5, 2, 12);
          break;
        case '3d':
          camera.position.set(35, 28, 30);
          controls.target.set(5, 2, 12);
          break;
        default:
          camera.position.set(35, 28, 30);
          controls.target.set(5, 2, 12);
      }
      controls.update();
    }
  }, [cameraPreset, camera]);

  useEffect(() => {
    if (cameraTarget && controlsRef.current) {
      const t = new THREE.Vector3(cameraTarget.x, cameraTarget.z, -cameraTarget.y);
      controlsRef.current.target.copy(t);
      // Move camera closer
      const offset = new THREE.Vector3(8, 8, 8);
      camera.position.copy(t).add(offset);
      controlsRef.current.update();
    }
  }, [cameraTarget, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={5}
      maxDistance={120}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
}

// ── Simulation Loop ────────────────────────────────────────
function SimulationLoop() {
  const stepSimulation = useStore(s => s.stepSimulation);
  const simulation = useStore(s => s.simulation);

  useFrame((_, delta) => {
    if (simulation.isRunning) {
      stepSimulation(delta);
    }
  });

  return null;
}

// ── Main Scene Content ─────────────────────────────────────
function SceneContent() {
  const network = useStore(s => s.network);
  const terrainMode = useStore(s => s.terrainMode);
  const showManholes = useStore(s => s.showManholes);

  const pipeElements = useMemo(() => {
    return network.pipes.map(pipe => {
      return <PipeMesh key={pipe.id} pipe={pipe} />;
    });
  }, [network.pipes]);

  const nodeElements = useMemo(() => {
    return network.nodes.map(node => {
      // Hide manholes if toggle is off
      if (!showManholes && node.type === 'manhole') return null;
      return <NodeMesh key={node.id} node={node} />;
    });
  }, [network.nodes, showManholes]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <directionalLight position={[-15, 20, -10]} intensity={0.3} color="#93c5fd" />
      <pointLight position={[0, -3, 0]} intensity={0.2} color="#38bdf8" distance={30} />

      {/* Fog */}
      <fog attach="fog" args={['#080d18', 80, 180]} />

      {/* Background color */}
      <color attach="background" args={['#080d18']} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[35, 28, 30]} fov={45} near={0.1} far={250} />
      <CameraController />

      {/* Network */}
      <group>{pipeElements}</group>
      <group>{nodeElements}</group>
      <ValveMarkers />
      <PumpMarkers />
      <LeakMarkers />
      <BlockageMarkers />
      <NetworkLabels />

      {/* City Context */}
      <TerrainAndCity />

      {/* Excavated soil floor below the network — gives the underground a
          readable ground reference instead of open void. */}
      {terrainMode !== 'surface' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WORLD_CENTER[0], -3.6, WORLD_CENTER[2]]} receiveShadow>
          <planeGeometry args={[WORLD_HALF * 2, 80]} />
          <meshStandardMaterial
            color="#1c140d"
            transparent
            opacity={terrainMode === 'underground' ? 0.85 : 0.4}
            roughness={1}
          />
        </mesh>
      )}

      {/* Underground ground plane (transparent in surface mode) */}
      {terrainMode !== 'surface' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, 5.5, -12]}>
          <planeGeometry args={[100, 80]} />
          <meshStandardMaterial
            color="#0f172a"
            transparent
            opacity={terrainMode === 'underground' ? 0.2 : 0.5}
            roughness={1}
          />
        </mesh>
      )}

      {/* Simulation loop */}
      <SimulationLoop />
    </>
  );
}

// ── HUD Overlays (tooltip + legend) ─────────────────────────
function SceneOverlays() {
  return (
    <>
      <HoverTooltip />
      <ViewLegend />
    </>
  );
}

// ── Loading ────────────────────────────────────────────────
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#64748b" />
    </mesh>
  );
}

// ── Main Export ─────────────────────────────────────────────
export default function WaterWorld() {
  const initializeNetwork = useStore(s => s.initializeNetwork);

  useEffect(() => {
    initializeNetwork();
  }, [initializeNetwork]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows={'basic' as any}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ background: '#0c1222' }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <SceneOverlays />
    </div>
  );
}
