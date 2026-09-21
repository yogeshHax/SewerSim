'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { SURFACE_Y } from '../../lib/network/sceneConstants';

const SURFACE = SURFACE_Y; // surface Y level

// ── Low-poly house with pitched roof ───────────────────────
function House({
  x, z, w, d, h, color, roofColor,
}: {
  x: number; z: number; w: number; d: number; h: number;
  color: string; roofColor: string;
}) {
  const ry = SURFACE;
  const roofH = h * 0.45;
  return (
    <group position={[x, ry, z]}>
      {/* Walls */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Pitched roof (two slanted planes) */}
      <mesh position={[0, h + roofH * 0.35, 0]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[w * 0.75, roofH, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Door */}
      <mesh position={[0, h * 0.25, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.25, h * 0.5, 0.05]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Window */}
      <mesh position={[w * 0.25, h * 0.6, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.2, 0.05]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.3} metalness={0.2} emissive="#93c5fd" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-w * 0.25, h * 0.6, d / 2 + 0.01]}>
        <boxGeometry args={[w * 0.2, h * 0.2, 0.05]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.3} metalness={0.2} emissive="#93c5fd" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

// ── Commercial / office building ────────────────────────────
function OfficeBuilding({
  x, z, w, d, h, color,
}: {
  x: number; z: number; w: number; d: number; h: number; color: string;
}) {
  const ry = SURFACE;
  return (
    <group position={[x, ry, z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Windows (grid on front face) */}
      {Array.from({ length: Math.floor(h / 0.6) }, (_, row) =>
        Array.from({ length: Math.floor(w / 0.5) }, (_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              -w / 2 + 0.35 + col * 0.5,
              0.5 + row * 0.6,
              d / 2 + 0.01,
            ]}
          >
            <boxGeometry args={[0.25, 0.3, 0.05]} />
            <meshStandardMaterial
              color="#bfdbfe" roughness={0.2} metalness={0.3}
              emissive="#93c5fd" emissiveIntensity={0.1}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Water facility / treatment plant ────────────────────────
function WaterFacility({ x, z }: { x: number; z: number }) {
  const ry = SURFACE;
  return (
    <group position={[x, ry, z]}>
      {/* Main building */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[3.5, 1.6, 2.5]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, 1.65, 0]}>
        <boxGeometry args={[3.7, 0.1, 2.7]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      {/* Water tank */}
      <mesh position={[2.5, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 2.0, 8]} />
        <meshStandardMaterial color="#0891b2" roughness={0.4} metalness={0.3} transparent opacity={0.85} />
      </mesh>
      {/* Tank water surface */}
      <mesh position={[2.5, 1.5, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.1, 8]} />
        <meshStandardMaterial color="#22d3ee" transparent opacity={0.5} emissive="#0ea5e9" emissiveIntensity={0.3} />
      </mesh>
      {/* Fence */}
      {[-3, -1.5, 0, 1.5, 3].map((dx, i) => (
        <mesh key={`f${i}`} position={[dx, 0.15, 1.5]}>
          <boxGeometry args={[0.05, 0.3, 0.05]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>
      ))}
      {/* Sign */}
      <mesh position={[0, 2.0, 1.3]}>
        <boxGeometry args={[2.0, 0.4, 0.05]} />
        <meshStandardMaterial color="#1e40af" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ── Roads with lane markings ────────────────────────────────
function Roads() {
  return (
    <group>
      {/* Main east-west road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, SURFACE + 0.01, -8]}>
        <planeGeometry args={[90, 3.0]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, SURFACE + 0.02, -8]}>
        <planeGeometry args={[80, 0.12]} />
        <meshStandardMaterial color="#eab308" roughness={0.7} emissive="#eab308" emissiveIntensity={0.1} />
      </mesh>

      {/* North-south road */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[5, SURFACE + 0.01, -14]}>
        <planeGeometry args={[70, 2.5]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>

      {/* Secondary east-west road (south) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, SURFACE + 0.01, -26]}>
        <planeGeometry args={[60, 2.0]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>

      {/* Secondary east-west road (north) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SURFACE + 0.01, 4]}>
        <planeGeometry args={[50, 2.0]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>

      {/* Cross road near source */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-22, SURFACE + 0.01, -4]}>
        <planeGeometry args={[30, 2.0]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>

      {/* Sidewalks along main road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, SURFACE + 0.015, -6.3]}>
        <planeGeometry args={[80, 0.6]} />
        <meshStandardMaterial color="#374151" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, SURFACE + 0.015, -9.7]}>
        <planeGeometry args={[80, 0.6]} />
        <meshStandardMaterial color="#374151" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ── Trees ───────────────────────────────────────────────────
// NOTE: tree z-coordinates are used DIRECTLY (matching houses/roads, which
// are already in scene space). The (x, z, -y) plan-to-scene mapping applies
// only to network nodes, not to city props.
function Trees() {
  const trees = useMemo(() => {
    const spots = [
      // Along main road (same z band as the road at z=-8)
      { x: -15, z: -5.8 }, { x: -8, z: -10.2 }, { x: 0, z: -5.8 },
      { x: 8, z: -10.2 }, { x: 16, z: -5.8 }, { x: 24, z: -10.2 },
      { x: 32, z: -5.8 }, { x: -15, z: -10.2 }, { x: 0, z: -10.2 },
      // Park area (west)
      { x: -30, z: 2 }, { x: -28, z: 0 }, { x: -32, z: -2 },
      { x: -26, z: 4 }, { x: -34, z: 3 },
      // Scattered
      { x: 40, z: -5 }, { x: 38, z: -12 }, { x: -8, z: -18 },
      { x: 15, z: -20 }, { x: 30, z: -28 }, { x: -20, z: -30 },
      { x: 42, z: 2 }, { x: -38, z: -8 },
    ];
    return spots.map(p => {
      const conifer = Math.random() > 0.45;
      const h = conifer ? 1.2 + Math.random() * 0.9 : 1.0 + Math.random() * 0.7;
      return {
        pos: [p.x, SURFACE + 0.1, p.z] as [number, number, number],
        h,
        trunkH: h * 0.25,
        layers: conifer ? 2 + Math.floor(Math.random() * 2) : 1,
        conifer,
        color: conifer
          ? ['#166534', '#15803d', '#14532d'][Math.floor(Math.random() * 3)]
          : ['#16a34a', '#65a30d', '#4d7c0f'][Math.floor(Math.random() * 3)],
        tilt: (Math.random() - 0.5) * 0.08,
      };
    });
  }, []);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={t.pos} rotation={[t.tilt, 0, t.tilt]}>
          {/* Trunk */}
          <mesh position={[0, t.trunkH / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.08, t.trunkH, 5]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          {/* Foliage — layered conifers vs blob canopies for natural variety */}
          {t.conifer ? (
            Array.from({ length: t.layers }, (_, layer) => {
              const f = layer / t.layers; // 0 bottom .. 1 top
              const r = 0.42 * (1 - f * 0.55);
              const y = t.trunkH + (t.h - t.trunkH) * f * 0.8;
              return (
                <mesh key={layer} position={[0, y + 0.1, 0]}>
                  <coneGeometry args={[r, ((t.h - t.trunkH) / t.layers) * 1.6, 6]} />
                  <meshStandardMaterial color={t.color} roughness={0.8} transparent opacity={0.9} />
                </mesh>
              );
            })
          ) : (
            <>
              <mesh position={[0, t.trunkH + (t.h - t.trunkH) * 0.45, 0]}>
                <sphereGeometry args={[0.38, 7, 6]} />
                <meshStandardMaterial color={t.color} roughness={0.85} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0.16, t.trunkH + (t.h - t.trunkH) * 0.7, -0.1]}>
                <sphereGeometry args={[0.24, 6, 5]} />
                <meshStandardMaterial color={t.color} roughness={0.85} transparent opacity={0.85} />
              </mesh>
              <mesh position={[-0.15, t.trunkH + (t.h - t.trunkH) * 0.62, 0.12]}>
                <sphereGeometry args={[0.2, 6, 5]} />
                <meshStandardMaterial color={t.color} roughness={0.85} transparent opacity={0.85} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

// ── Street lights ───────────────────────────────────────────
function StreetLights() {
  const lights = useMemo(() => [
    { x: -18, z: -6.5 }, { x: -6, z: -9.5 }, { x: 8, z: -6.5 },
    { x: 20, z: -9.5 }, { x: 34, z: -6.5 }, { x: -18, z: -9.5 },
    { x: 8, z: -9.5 }, { x: 20, z: -6.5 },
  ], []);

  return (
    <group>
      {lights.map((l, i) => (
        <group key={i} position={[l.x, SURFACE, l.z]}>
          {/* Pole */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.03, 0.04, 1.2, 4]} />
            <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.3} />
          </mesh>
          {/* Arm */}
          <mesh position={[0.2, 1.15, 0]} rotation={[0, 0, Math.PI / 6]}>
            <boxGeometry args={[0.4, 0.03, 0.03]} />
            <meshStandardMaterial color="#6b7280" roughness={0.7} metalness={0.3} />
          </mesh>
          {/* Light */}
          <mesh position={[0.35, 1.1, 0]}>
            <boxGeometry args={[0.15, 0.06, 0.1]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Manhole covers at surface ───────────────────────────────
function SurfaceManholeCovers() {
  const network = useStore(s => s.network);
  const manholes = network.nodes.filter(n => n.type === 'manhole');

  return (
    <group>
      {manholes.map(m => (
        <group key={m.id} position={[m.position.x, SURFACE + 0.02, -m.position.y]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.04, 12]} />
            <meshStandardMaterial color="#374151" roughness={0.8} metalness={0.2} />
          </mesh>
          {/* Cross pattern on cover */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.04]} />
            <meshStandardMaterial color="#4b5563" roughness={0.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <boxGeometry args={[0.5, 0.05, 0.04]} />
            <meshStandardMaterial color="#4b5563" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Main Export ─────────────────────────────────────────────
export default function TerrainAndCity() {
  const terrainMode = useStore(s => s.terrainMode);

  if (terrainMode === 'underground') return null;

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, SURFACE - 0.01, -12]} receiveShadow>
        <planeGeometry args={[110, 90]} />
        <meshStandardMaterial
          color="#1a2332" roughness={0.95} metalness={0.0}
          transparent opacity={terrainMode === 'both' ? 0.5 : 0.85}
        />
      </mesh>

      <Roads />

      {/* ── Houses (residential clusters) ── */}
      {/* Cluster 1: near source (west) */}
      <House x={-30} z={-2} w={1.6} d={1.2} h={1.4} color="#d1d5db" roofColor="#991b1b" />
      <House x={-27} z={-1} w={1.4} d={1.0} h={1.2} color="#e5e7eb" roofColor="#b45309" />
      <House x={-24} z={-3} w={1.5} d={1.1} h={1.3} color="#f3f4f6" roofColor="#92400e" />
      <House x={-31} z={-5} w={1.3} d={1.0} h={1.1} color="#d1d5db" roofColor="#78350f" />
      <House x={-28} z={-6} w={1.6} d={1.3} h={1.5} color="#e5e7eb" roofColor="#991b1b" />

      {/* Cluster 2: north side */}
      <House x={-10} z={6} w={1.4} d={1.1} h={1.3} color="#d1d5db" roofColor="#b45309" />
      <House x={-7} z={7} w={1.5} d={1.2} h={1.4} color="#f3f4f6" roofColor="#92400e" />
      <House x={-4} z={5.5} w={1.3} d={1.0} h={1.2} color="#e5e7eb" roofColor="#78350f" />
      <House x={2} z={7} w={1.6} d={1.2} h={1.5} color="#d1d5db" roofColor="#991b1b" />
      <House x={5} z={5.5} w={1.4} d={1.1} h={1.3} color="#f3f4f6" roofColor="#b45309" />

      {/* Cluster 3: east side */}
      <House x={32} z={-4} w={1.5} d={1.2} h={1.4} color="#e5e7eb" roofColor="#92400e" />
      <House x={35} z={-3} w={1.3} d={1.0} h={1.2} color="#d1d5db" roofColor="#78350f" />
      <House x={38} z={-5} w={1.6} d={1.3} h={1.5} color="#f3f4f6" roofColor="#991b1b" />
      <House x={33} z={-7} w={1.4} d={1.1} h={1.3} color="#e5e7eb" roofColor="#b45309" />

      {/* Cluster 4: south side */}
      <House x={-5} z={-20} w={1.5} d={1.2} h={1.4} color="#d1d5db" roofColor="#92400e" />
      <House x={-2} z={-22} w={1.4} d={1.0} h={1.2} color="#f3f4f6" roofColor="#78350f" />
      <House x={2} z={-20} w={1.6} d={1.3} h={1.5} color="#e5e7eb" roofColor="#991b1b" />
      <House x={-8} z={-23} w={1.3} d={1.1} h={1.3} color="#d1d5db" roofColor="#b45309" />
      <House x={5} z={-23} w={1.5} d={1.2} h={1.4} color="#f3f4f6" roofColor="#92400e" />

      {/* Cluster 5: southeast */}
      <House x={15} z={-22} w={1.4} d={1.1} h={1.3} color="#e5e7eb" roofColor="#78350f" />
      <House x={18} z={-24} w={1.6} d={1.2} h={1.5} color="#d1d5db" roofColor="#991b1b" />
      <House x={22} z={-22} w={1.3} d={1.0} h={1.2} color="#f3f4f6" roofColor="#b45309" />

      {/* ── Office / commercial buildings ── */}
      <OfficeBuilding x={-12} z={-10} w={2.0} d={1.5} h={2.5} color="#64748b" />
      <OfficeBuilding x={-8} z={-12} w={1.8} d={1.4} h={3.0} color="#475569" />
      <OfficeBuilding x={10} z={-10} w={2.2} d={1.6} h={2.8} color="#64748b" />
      <OfficeBuilding x={15} z={-12} w={1.8} d={1.5} h={2.2} color="#94a3b8" />
      <OfficeBuilding x={25} z={-10} w={2.0} d={1.4} h={2.6} color="#475569" />
      <OfficeBuilding x={-20} z={-12} w={1.6} d={1.3} h={2.0} color="#64748b" />

      {/* ── Water facility near source ── */}
      <WaterFacility x={-22} z={4} />

      {/* Trees, street lights, manhole covers */}
      <Trees />
      <StreetLights />
      <SurfaceManholeCovers />
    </group>
  );
}
