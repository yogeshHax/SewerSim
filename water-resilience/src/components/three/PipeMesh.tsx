'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { PipeSegment, ViewMode } from '../../lib/network/types';
import { useStore } from '../../store/useStore';
import { getRiskColor, getPressureColor, getFlowColor, getVelocityColor } from '../../lib/network/simulation';

interface PipeMeshProps {
  pipe: PipeSegment;
}

function getPipePoints(pipe: PipeSegment): THREE.Vector3[] {
  return pipe.waypoints.map(wp => new THREE.Vector3(wp.x, wp.z, -wp.y));
}

function getPipeRadius(diameter: number): number {
  return diameter / 1000 * 1.2;
}

function getPipeColor(pipe: PipeSegment, viewMode: ViewMode): string {
  switch (viewMode) {
    case 'pressure': return getPressureColor(pipe.pressure);
    case 'flow': return getFlowColor(pipe.utilization);
    case 'velocity': return getVelocityColor(pipe.velocity);
    case 'risk': return getRiskColor(pipe.riskScore);
    case 'waterLevel': return pipe.velocity > 0 ? '#22d3ee' : '#64748b';
    default: {
      switch (pipe.status) {
        case 'normal': return '#64748b';
        case 'warning': return '#eab308';
        case 'critical': return '#ef4444';
        case 'leak': return '#f97316';
        case 'blocked': return '#a855f7';
        case 'failed': return '#991b1b';
        default: return '#64748b';
      }
    }
  }
}

// Build merged tube geometry from straight LineCurve3 segments
function buildMergedTube(points: THREE.Vector3[], radius: number): THREE.BufferGeometry | null {
  if (points.length < 2) return null;

  const segGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const line = new THREE.LineCurve3(points[i], points[i + 1]);
    segGeos.push(new THREE.TubeGeometry(line, 1, radius, 8, false));
  }

  if (segGeos.length === 0) return null;

  // Count total vertices and indices
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of segGeos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);

  let vertOff = 0;
  let idxOff = 0;
  const idxArr = new Uint32Array(totalIdx);

  for (const g of segGeos) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const norm = g.attributes.normal as THREE.BufferAttribute;
    const idx = g.index;
    const count = pos.count;

    for (let j = 0; j < count; j++) {
      posArr[(vertOff + j) * 3] = pos.getX(j);
      posArr[(vertOff + j) * 3 + 1] = pos.getY(j);
      posArr[(vertOff + j) * 3 + 2] = pos.getZ(j);
      normArr[(vertOff + j) * 3] = norm.getX(j);
      normArr[(vertOff + j) * 3 + 1] = norm.getY(j);
      normArr[(vertOff + j) * 3 + 2] = norm.getZ(j);
    }
    if (idx) {
      for (let j = 0; j < idx.count; j++) {
        idxArr[idxOff + j] = idx.getX(j) + vertOff;
      }
      idxOff += idx.count;
    }
    vertOff += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return merged;
}

// Build a CurvePath from straight LineCurve3 segments (used to move water
// globules along the pipe)
function buildFlowCurve(points: THREE.Vector3[]): THREE.CurvePath<THREE.Vector3> | null {
  if (points.length < 2) return null;
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  }
  return path;
}

// ═══ WATER VISUALIZATION LAYER ═══
// Three stacked layers, all carrying an `along` attribute (0..1 per straight
// segment) that the shaders use as the flow axis:
//   body   (1.03R) — translucent fluid surface just above the pipe wall;
//                    Fresnel rim + axis-scrolling noise = volume & depth.
//   streaks(1.12R) — additive bright filaments riding the pipe; these are
//                    what make the flow readable in every view mode.
//   glow   (1.22R) — Fresnel-only halo, FrontSide so it hugs the silhouette.
// In Normal view the pipe wall turns translucent while water is shown so the
// fluid reads inside the bore; wall COLORS are never changed.

const waterVertexShader = /* glsl */ `
  attribute float along;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vAlong;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vAlong = along;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFlowDir;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vAlong;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndv = abs(dot(normalize(vNormalW), viewDir));
    float fresnel = pow(1.0 - ndv, 2.2);

    // Streaks scroll along the pipe axis; uTime is advanced by the component
    // proportionally to the pipe's real velocity.
    float u = vAlong * 9.0;
    float n1 = noise(vec3(u * 0.55 + uTime * 1.35 * uFlowDir, vWorldPos.z * 1.4, vWorldPos.y * 1.4));
    float n2 = noise(vec3(u * 1.35 + uTime * 2.30 * uFlowDir + 31.7, vWorldPos.z * 2.6, vWorldPos.y * 2.6 + n1 * 1.4));
    float streaks = 0.62 + 0.38 * n2;

    float band = abs(fract(vAlong * 1.0 - uTime * 0.22 * uFlowDir) - 0.5);
    float sheen = smoothstep(0.18, 0.0, band) * 0.35;

    vec3 col = mix(uDeep, uColor, clamp(streaks + fresnel * 0.55, 0.0, 1.0));
    col += sheen * uColor * uIntensity;

    float alpha = uOpacity * (0.52 + 0.48 * streaks) + fresnel * 0.30;
    alpha = clamp(alpha * mix(0.85, 1.0, uIntensity), 0.0, 0.96);

    gl_FragColor = vec4(col, alpha);
  }
`;

// Additive flow dashes — always rendered OUTSIDE the wall (1.12R) so the
// moving flow is visible in every view mode. Long soft-edged bands sliding
// along the pipe axis stay resolvable at city zoom, where in-tube noise
// would average to a uniform wash.
const streakFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFlowDir;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vAlong;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    // 3 dashes per segment-length, sliding with time; each dash gets a
    // stable per-instance brightness so trains of pulses feel organic.
    float phase = vAlong * 3.0 - uTime * 0.55 * uFlowDir;
    float cell = floor(phase);
    float f = fract(phase);

    // Soft-edged dash occupying ~45% of the cycle
    float dash = smoothstep(0.0, 0.18, f) * smoothstep(0.55, 0.40, f);

    // Subtle per-dash brightness variation + gentle shimmer
    float vary = 0.75 + 0.25 * hash(cell + 7.0);
    float shimmer = 0.9 + 0.1 * sin(uTime * 5.0 + cell * 21.0);

    float alpha = uOpacity * uIntensity * (0.15 + 0.85 * dash * vary * shimmer);
    alpha = clamp(alpha, 0.0, 0.9);

    gl_FragColor = vec4(uColor, alpha);
  }
`;

const glowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFlowDir;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  varying float vAlong;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndv = abs(dot(normalize(vNormalW), viewDir));
    float rim = pow(1.0 - ndv, 2.6);
    float flicker = 0.9 + 0.1 * sin(uTime * 2.0 + vAlong * 12.0 * uFlowDir);
    gl_FragColor = vec4(uColor, rim * uOpacity * flicker * uIntensity);
  }
`;

// Build the water-layer geometries from the pipe waypoints: merged tube per
// straight segment (plus an `along` attribute for the flow axis) and joint
// spheres at interior waypoints so bends and junctions stay continuous.
function buildWaterGeometries(points: THREE.Vector3[], radius: number) {
  const makeMerged = (radialScale: number): THREE.BufferGeometry | null => {
    if (points.length < 2) return null;
    const segGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const line = new THREE.LineCurve3(points[i], points[i + 1]);
      segGeos.push(new THREE.TubeGeometry(line, 1, radius * radialScale, 12, false));
    }
    if (segGeos.length === 0) return null;

    let totalVerts = 0;
    let totalIdx = 0;
    for (const g of segGeos) {
      totalVerts += g.attributes.position.count;
      totalIdx += g.index ? g.index.count : 0;
    }

    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const alongArr = new Float32Array(totalVerts);
    const idxArr = new Uint32Array(totalIdx);

    let vertOff = 0;
    let idxOff = 0;
    for (let s = 0; s < segGeos.length; s++) {
      const g = segGeos[s];
      const pos = g.attributes.position as THREE.BufferAttribute;
      const norm = g.attributes.normal as THREE.BufferAttribute;
      const idx = g.index;

      const a = points[s];
      const b = points[s + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length() || 1;
      dir.divideScalar(len);

      const tmp = new THREE.Vector3();
      for (let j = 0; j < pos.count; j++) {
        tmp.set(pos.getX(j), pos.getY(j), pos.getZ(j));
        alongArr[vertOff + j] = tmp.clone().sub(a).dot(dir) / len;
        posArr[(vertOff + j) * 3] = pos.getX(j);
        posArr[(vertOff + j) * 3 + 1] = pos.getY(j);
        posArr[(vertOff + j) * 3 + 2] = pos.getZ(j);
        normArr[(vertOff + j) * 3] = norm.getX(j);
        normArr[(vertOff + j) * 3 + 1] = norm.getY(j);
        normArr[(vertOff + j) * 3 + 2] = norm.getZ(j);
      }
      if (idx) {
        for (let j = 0; j < idx.count; j++) {
          idxArr[idxOff + j] = idx.getX(j) + vertOff;
        }
        idxOff += idx.count;
      }
      vertOff += pos.count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    merged.setAttribute('along', new THREE.BufferAttribute(alongArr, 1));
    merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
    return merged;
  };

  const body = makeMerged(1.03);
  const streaks = makeMerged(1.12);
  const glow = makeMerged(1.16);

  // Joint spheres for interior waypoints (bends / junctions).
  const makeJoint = (radialScale: number): THREE.BufferGeometry | null => {
    if (points.length < 3) return null;
    const sphere = new THREE.SphereGeometry(radius * radialScale, 12, 10);
    const pos = sphere.attributes.position as THREE.BufferAttribute;
    const alongArr = new Float32Array(pos.count);
    for (let j = 0; j < pos.count; j++) {
      alongArr[j] = pos.getX(j) / (radius * 2.5) + 0.5;
    }
    sphere.setAttribute('along', new THREE.BufferAttribute(alongArr, 1));
    return sphere;
  };

  return {
    body,
    streaks,
    glow,
    joints: makeJoint(1.05),
    streakJoints: makeJoint(1.14),
  };
}

interface WaterLayerGeometries {
  body: THREE.BufferGeometry | null;
  streaks: THREE.BufferGeometry | null;
  glow: THREE.BufferGeometry | null;
  joints: THREE.BufferGeometry | null;
  streakJoints: THREE.BufferGeometry | null;
}

function WaterFlowParticles({
  geometries, jointPoints, flow, velocity, utilization, speed, status, showBody,
}: {
  geometries: WaterLayerGeometries;
  jointPoints: THREE.Vector3[];
  flow: number;
  velocity: number;
  utilization: number;
  speed: number;
  status: string;
  showBody: boolean;
}) {
  const timeRef = useRef(0);

  const absVel = Math.abs(velocity);
  const util = Math.min(1, Math.max(0, utilization));
  const stagnant = status === 'blocked' || status === 'failed' || Math.abs(flow) < 0.1;
  const hasFlow = !stagnant;

  // Hydraulic readout → color. Same cyan family as the theme; stagnant water
  // desaturates toward slate so no-flow sections are clearly distinct.

  // Softer water: gentle cyan that supports rather than overpowers the scene.
  const color = useMemo(() =>
    hasFlow
      ? new THREE.Color('#38a8c9').lerp(new THREE.Color('#67c9e8'), Math.min(1, util * 0.85))
      : new THREE.Color('#55707f'),
  [hasFlow, util]);
  const deep = useMemo(() =>
    hasFlow
      ? new THREE.Color('#155e75').lerp(new THREE.Color('#0c4a6e'), Math.min(1, util))
      : new THREE.Color('#24303d'),
  [hasFlow, util]);
  const intensity = hasFlow ? 0.7 + util * 0.7 : 0.3;
  const bodyOpacity = hasFlow ? 0.4 + util * 0.22 : 0.3;
  const streakOpacity = hasFlow ? 0.75 : 0.25;
  const glowOpacity = hasFlow ? 0.12 + util * 0.14 : 0.05;

  const bodyUniforms = useMemo(() => ({
    uColor: { value: color.clone() },
    uDeep: { value: deep.clone() },
    uOpacity: { value: bodyOpacity },
    uTime: { value: 0 },
    uFlowDir: { value: flow >= 0 ? 1 : -1 },
    uIntensity: { value: intensity },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const streakUniforms = useMemo(() => ({
    uColor: { value: color.clone() },
    uOpacity: { value: streakOpacity },
    uTime: { value: 0 },
    uFlowDir: { value: flow >= 0 ? 1 : -1 },
    uIntensity: { value: intensity },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const glowUniforms = useMemo(() => ({
    uColor: { value: color.clone() },
    uOpacity: { value: glowOpacity },
    uTime: { value: 0 },
    uFlowDir: { value: flow >= 0 ? 1 : -1 },
    uIntensity: { value: intensity },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const u of [bodyUniforms, streakUniforms, glowUniforms]) {
      u.uColor.value.copy(color);
      u.uTime.value = 0;
      u.uFlowDir.value = flow >= 0 ? 1 : -1;
      u.uIntensity.value = intensity;
    }
    bodyUniforms.uOpacity.value = bodyOpacity;
    streakUniforms.uOpacity.value = streakOpacity;
    glowUniforms.uOpacity.value = glowOpacity;
  }, [color, bodyOpacity, streakOpacity, glowOpacity, intensity, flow, hasFlow, bodyUniforms, streakUniforms, glowUniforms]);

  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta);
    timeRef.current += dt * Math.min(2.4, 0.25 + absVel * 0.55) * Math.max(0.2, speed);
    bodyUniforms.uTime.value = timeRef.current;
    streakUniforms.uTime.value = timeRef.current;
    glowUniforms.uTime.value = timeRef.current;
  });

  const common = {
    vertexShader: waterVertexShader,
    transparent: true,
    depthWrite: false,
  } as const;

  return (
    <group>
      {/* Fluid surface — only in Normal view, where the wall is translucent */}
      {showBody && geometries.body && (
        <mesh geometry={geometries.body} renderOrder={1} frustumCulled={false}>
          <shaderMaterial
            {...common}
            fragmentShader={waterFragmentShader}
            uniforms={bodyUniforms}
            side={THREE.FrontSide}
          />
        </mesh>
      )}
      {showBody && geometries.joints && jointPoints.map((p, i) => (
        <mesh key={`b${i}`} geometry={geometries.joints!} position={p} renderOrder={1} frustumCulled={false}>
          <shaderMaterial
            {...common}
            fragmentShader={waterFragmentShader}
            uniforms={bodyUniforms}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}

      {/* Flow filaments — visible in every view mode, riding above the wall */}
      {geometries.streaks && (
        <mesh geometry={geometries.streaks} renderOrder={2} frustumCulled={false}>
          <shaderMaterial
            {...common}
            fragmentShader={streakFragmentShader}
            uniforms={streakUniforms}
            side={THREE.FrontSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {geometries.streakJoints && jointPoints.map((p, i) => (
        <mesh key={`s${i}`} geometry={geometries.streakJoints!} position={p} renderOrder={2} frustumCulled={false}>
          <shaderMaterial
            {...common}
            fragmentShader={streakFragmentShader}
            uniforms={streakUniforms}
            side={THREE.FrontSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Silhouette halo */}
      {geometries.glow && (
        <mesh geometry={geometries.glow} renderOrder={3} frustumCulled={false}>
          <shaderMaterial
            {...common}
            fragmentShader={glowFragmentShader}
            uniforms={glowUniforms}
            side={THREE.FrontSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

// ═══ WATER GLOBULES — continuously moving droplets along the pipe ═══
// Instanced spheres traveling the full pipe path; spacing, size and speed
// follow the live hydraulics. Additive + translucent so they read as liquid
// rather than solid balls.
function WaterGlobules({
  curve, radius, flow, velocity, utilization, speed, status,
}: {
  curve: THREE.CurvePath<THREE.Vector3>;
  radius: number;
  flow: number;
  velocity: number;
  utilization: number;
  speed: number;
  status: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const absVel = Math.abs(velocity);
  const util = Math.min(1, Math.max(0, utilization));
  const stagnant = status === 'blocked' || status === 'failed' || Math.abs(flow) < 0.1;

  const count = Math.max(5, Math.min(14, Math.round(4 + absVel * 2.2)));
  const size = radius * (stagnant ? 0.42 : 0.5 + util * 0.22);
  const moveSpeed = stagnant ? 0 : Math.min(2.2, 0.3 + absVel * 0.5) * Math.max(0.2, speed);
  const dir = flow >= 0 ? 1 : -1;

  // Softer cyan matching the reduced water palette.
  const globColor = useMemo(
    () => (stagnant ? new THREE.Color('#55707f') : new THREE.Color('#67c9e8')),
  [stagnant]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    timeRef.current += Math.min(0.1, delta) * moveSpeed;

    for (let i = 0; i < count; i++) {
      // Even spacing + per-globule offset → a continuous, overlapping train
      let t = (i / count + timeRef.current * 0.12 * dir) % 1;
      if (t < 0) t += 1;
      const pos = curve.getPointAt(t);
      dummy.position.copy(pos);
      const pulse = 1 + 0.12 * Math.sin(timeRef.current * 6 + i * 2.1);
      dummy.scale.setScalar(size * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={4}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial
        color={globColor}
        transparent
        opacity={stagnant ? 0.35 : 0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ═══ MAIN PIPE COMPONENT ═══
export default function PipeMesh({ pipe }: PipeMeshProps) {
  const viewMode = useStore(s => s.viewMode);
  const showWaterFlow = useStore(s => s.showWaterFlow);
  const selectedAssetId = useStore(s => s.selectedAssetId);
  const hoveredAssetId = useStore(s => s.hoveredAssetId);
  const simulation = useStore(s => s.simulation);
  const selectAsset = useStore(s => s.selectAsset);
  const hoverAsset = useStore(s => s.hoverAsset);

  const pipeState = simulation.currentSnapshot.pipes[pipe.id];
  const effectivePipe = pipeState ? { ...pipe, ...pipeState } : pipe;

  const points = useMemo(() => getPipePoints(pipe), [pipe]);
  const radius = useMemo(() => getPipeRadius(pipe.diameter), [pipe.diameter]);
  const color = useMemo(() => getPipeColor(effectivePipe, viewMode), [effectivePipe, viewMode]);

  const isSelected = selectedAssetId === pipe.id;
  const isHovered = hoveredAssetId === pipe.id;
  const hasFlow = Math.abs(effectivePipe.flow) > 0.1;

  const geometry = useMemo(() => buildMergedTube(points, radius), [points, radius]);
  const waterGeos = useMemo(() => buildWaterGeometries(points, radius), [points, radius]);
  const flowCurve = useMemo(() => buildFlowCurve(points), [points]);
  const jointPoints = useMemo(() => (points.length > 2 ? points.slice(1, -1) : []), [points]);

  if (!geometry) return null;

  // In Normal view with water shown, the wall becomes translucent so the
  // fluid inside reads — same color, same emissive behavior, opacity only.
  const wallTransparent = showWaterFlow && hasFlow && viewMode === 'normal';

  return (
    <group>
      <mesh
        geometry={geometry}
        renderOrder={wallTransparent ? 0 : 0}
        onClick={(e) => { e.stopPropagation(); selectAsset(pipe.id); }}
        onPointerOver={(e) => { e.stopPropagation(); hoverAsset(pipe.id); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { hoverAsset(null); document.body.style.cursor = 'auto'; }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.2}
          transparent={wallTransparent}
          opacity={wallTransparent ? 0.3 : 1}
          depthWrite={!wallTransparent}
          emissive={isHovered ? color : isSelected ? color : '#000000'}
          emissiveIntensity={isHovered ? 0.4 : isSelected ? 0.2 : 0}
        />
      </mesh>
      {showWaterFlow && hasFlow && (
        <>
          <WaterFlowParticles
            geometries={waterGeos}
            jointPoints={jointPoints}
            flow={effectivePipe.flow}
            velocity={effectivePipe.velocity}
            utilization={effectivePipe.utilization}
            speed={simulation.speed}
            status={effectivePipe.status}
            showBody={viewMode === 'normal'}
          />
          <WaterGlobules
            curve={flowCurve!}
            radius={radius}
            flow={effectivePipe.flow}
            velocity={effectivePipe.velocity}
            utilization={effectivePipe.utilization}
            speed={simulation.speed}
            status={effectivePipe.status}
          />
        </>
      )}
    </group>
  );
}
