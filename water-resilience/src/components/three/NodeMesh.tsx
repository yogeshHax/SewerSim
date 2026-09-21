'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { NetworkNode, ViewMode } from '../../lib/network/types';
import { useStore } from '../../store/useStore';
import { getRiskColor, getPressureColor } from '../../lib/network/simulation';
import { SURFACE_Y } from '../../lib/network/sceneConstants';

interface NodeMeshProps {
  node: NetworkNode;
}

export default function NodeMesh({ node }: NodeMeshProps) {
  const viewMode = useStore(s => s.viewMode);
  const selectedAssetId = useStore(s => s.selectedAssetId);
  const hoveredAssetId = useStore(s => s.hoveredAssetId);
  const simulation = useStore(s => s.simulation);
  const selectAsset = useStore(s => s.selectAsset);
  const hoverAsset = useStore(s => s.hoverAsset);

  const nodeState = simulation.currentSnapshot.nodes[node.id];
  const isSelected = selectedAssetId === node.id;
  const isHovered = hoveredAssetId === node.id;

  const position = useMemo(() => {
    return new THREE.Vector3(node.position.x, node.position.z, -node.position.y);
  }, [node.position]);

  const color = useMemo(() => {
    if (!nodeState) return '#94a3b8';
    switch (viewMode) {
      case 'pressure': return getPressureColor(nodeState.pressure);
      case 'risk': return getRiskColor(nodeState.riskScore);
      case 'normal':
      default: {
        switch (nodeState.status) {
          case 'normal': return '#94a3b8';
          case 'warning': return '#eab308';
          case 'critical': return '#ef4444';
          default: return '#94a3b8';
        }
      }
    }
  }, [nodeState, viewMode]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    selectAsset(node.id);
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    hoverAsset(node.id);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    hoverAsset(null);
    document.body.style.cursor = 'auto';
  };

  // Source: larger distinctive marker
  if (node.type === 'source') {
    return (
      <group position={position}>
        {/* Reservoir tank */}
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[1.8, 2.0, 1.5, 8]} />
          <meshStandardMaterial
            color="#0ea5e9"
            roughness={0.3}
            metalness={0.4}
            emissive={isHovered ? '#0ea5e9' : '#000000'}
            emissiveIntensity={isHovered ? 0.3 : 0}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Water surface */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1.6, 1.6, 0.1, 8]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.6}
            emissive="#0ea5e9"
            emissiveIntensity={0.4}
          />
        </mesh>
        {/* Inlet pipe */}
        <mesh position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 1.0, 8]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
        {isSelected && (
          <mesh>
            <ringGeometry args={[2.2, 2.5, 16]} />
            <meshBasicMaterial color="#0ea5e9" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Destination: distribution reservoir
  if (node.type === 'destination') {
    return (
      <group position={position}>
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={[3.0, 1.2, 2.0]} />
          <meshStandardMaterial
            color="#06b6d4"
            roughness={0.3}
            metalness={0.3}
            emissive={isHovered ? '#06b6d4' : '#000000'}
            emissiveIntensity={isHovered ? 0.3 : 0}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Water inside */}
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[2.6, 0.8, 1.6]} />
          <meshStandardMaterial
            color="#22d3ee"
            transparent
            opacity={0.5}
            emissive="#06b6d4"
            emissiveIntensity={0.3}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <ringGeometry args={[2.5, 2.8, 16]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Pump station
  if (node.type === 'pump_station') {
    return (
      <group position={position}>
        {/* Building */}
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          position={[0, 0.3, 0]}
        >
          <boxGeometry args={[1.4, 0.8, 1.0]} />
          <meshStandardMaterial
            color="#475569"
            roughness={0.8}
            metalness={0.1}
            emissive={isHovered ? '#475569' : '#000000'}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
        {/* Pump cylinder */}
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.6, 8]} />
          <meshStandardMaterial
            color="#64748b"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        {isSelected && (
          <mesh>
            <ringGeometry args={[1.5, 1.8, 16]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Reservoir
  if (node.type === 'reservoir') {
    return (
      <group position={position}>
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[1.2, 1.4, 1.0, 8]} />
          <meshStandardMaterial
            color="#0891b2"
            roughness={0.4}
            metalness={0.3}
            transparent
            opacity={0.8}
            emissive={isHovered ? '#0891b2' : '#000000'}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 0.15, 8]} />
          <meshStandardMaterial color="#22d3ee" transparent opacity={0.5} />
        </mesh>
        {isSelected && (
          <mesh>
            <ringGeometry args={[1.6, 1.9, 16]} />
            <meshBasicMaterial color="#0891b2" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Manhole — with vertical shaft to surface
  if (node.type === 'manhole') {
    const shaftHeight = SURFACE_Y - position.y;
    return (
      <group position={position}>
        {/* Vertical shaft from pipe level to surface */}
        <mesh position={[0, shaftHeight / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.2, shaftHeight, 8]} />
          <meshStandardMaterial color="#4b5563" roughness={0.9} transparent opacity={0.35} />
        </mesh>
        {/* Chamber at pipe level */}
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[0.45, 0.55, 0.5, 8]} />
          <meshStandardMaterial
            color="#6b7280" roughness={0.9} metalness={0.05}
            emissive={isHovered ? '#6b7280' : '#000000'}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
        {/* Cover at surface */}
        <mesh position={[0, shaftHeight, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 8]} />
          <meshStandardMaterial color="#374151" roughness={0.8} metalness={0.2} />
        </mesh>
        {isSelected && (
          <mesh position={[0, shaftHeight, 0]}>
            <ringGeometry args={[0.8, 1.1, 16]} />
            <meshBasicMaterial color="#6b7280" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    );
  }

  // Junction (default)
  return (
    <group position={position}>
      {/* Junction sphere */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <dodecahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={color}
          roughness={0.5}
          metalness={0.2}
          emissive={isHovered ? color : isSelected ? color : '#000000'}
          emissiveIntensity={isHovered ? 0.5 : isSelected ? 0.3 : 0}
        />
      </mesh>
      {isSelected && (
        <mesh>
          <ringGeometry args={[0.7, 0.95, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
