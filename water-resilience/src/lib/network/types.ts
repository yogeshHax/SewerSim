// ============================================================
// Water Resilience Network — Type Definitions
// ============================================================

import * as THREE from 'three';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type NodeType = 'source' | 'junction' | 'manhole' | 'destination' | 'reservoir' | 'pump_station';

export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  position: Vector3;
  elevation: number; // meters above datum
  // Computed simulation state
  pressure: number; // bar
  waterLevel: number; // meters
  demand: number; // L/s
  riskScore: number; // 0-100
  status: 'normal' | 'warning' | 'critical';
  condition: number; // 0-100 (100 = perfect)
}

export type PipeType = 'main' | 'secondary' | 'tertiary' | 'distribution';

export interface PipeSegment {
  id: string;
  label: string;
  type: PipeType;
  fromNode: string;
  toNode: string;
  // Geometry: intermediate points for bends/curves
  waypoints: Vector3[];
  // Physical properties
  length: number; // meters
  diameter: number; // mm
  roughness: number; // Hazen-Williams C value (higher = smoother)
  // Operational state
  flow: number; // L/s (positive = from→to)
  pressure: number; // bar (average)
  velocity: number; // m/s
  utilization: number; // 0-100%
  headLoss: number; // m per 100m
  // Condition
  riskScore: number; // 0-100
  condition: number; // 0-100
  age: number; // years
  status: 'normal' | 'warning' | 'critical' | 'leak' | 'blocked' | 'failed';
  // Bends
  bendAngles: number[]; // angle at each waypoint (degrees)
  maxBendAngle: number;
}

export type ValveState = 'open' | 'partial' | 'closed';
export type PumpState = 'running' | 'reduced' | 'failed' | 'off';

export interface Valve {
  id: string;
  label: string;
  nodeId: string;
  pipeId: string;
  state: ValveState;
  openness: number; // 0-100%
  type: 'gate' | 'check' | 'butterfly';
}

export interface Pump {
  id: string;
  label: string;
  nodeId: string;
  state: PumpState;
  capacity: number; // L/s
  head: number; // meters
  power: number; // kW
  utilization: number; // 0-100%
}

export interface Leak {
  id: string;
  pipeId: string;
  position: Vector3;
  severity: number; // 0-100%
  flowRate: number; // L/s
  active: boolean;
}

export interface Blockage {
  id: string;
  pipeId: string;
  position: Vector3;
  severity: number; // 0-100%
  active: boolean;
}

export interface PressureZone {
  id: string;
  name: string;
  targetPressure: number;
  minPressure: number;
  maxPressure: number;
  nodeIds: string[];
}

export type ViewMode = 'normal' | 'pressure' | 'flow' | 'velocity' | 'risk' | 'waterLevel';
export type TerrainMode = 'surface' | 'underground' | 'both';

export interface SimulationState {
  time: number; // seconds elapsed
  isRunning: boolean;
  speed: number; // 1x, 2x, 4x
  inflowMultiplier: number;
  scenario: ScenarioType;
  duration: number; // total seconds
  baselineSnapshot: SimulationSnapshot | null;
  currentSnapshot: SimulationSnapshot;
  // Manual control overrides (null = use defaults)
  sourcePressure: number; // bar (0.5 - 6.0)
  sourceFlow: number; // L/s (5 - 80)
  // Per-pipe restriction overrides (pipeId -> 0-100%)
  pipeRestrictions: Record<string, number>;
}

export type ScenarioType =
  | 'baseline'
  | 'heavy_water_event'
  | 'pump_failure'
  | 'pipe_leak'
  | 'blockage'
  | 'valve_closed'
  | 'custom';

export interface SimulationSnapshot {
  time: number;
  nodes: Record<string, {
    pressure: number;
    waterLevel: number;
    demand: number;
    riskScore: number;
    status: 'normal' | 'warning' | 'critical';
  }>;
  pipes: Record<string, {
    flow: number;
    pressure: number;
    velocity: number;
    utilization: number;
    headLoss: number;
    riskScore: number;
    status: 'normal' | 'warning' | 'critical' | 'leak' | 'blocked' | 'failed';
  }>;
  systemMetrics: SystemMetrics;
}

export interface SystemMetrics {
  totalAssets: number;
  criticalAssets: number;
  activeAlerts: number;
  averagePressure: number;
  peakFlow: number;
  waterLoss: number; // L/s
  resilienceScore: number; // 0-100
  pressureStability: number; // 0-100
  redundancy: number; // 0-100
  capacity: number; // 0-100
  leakRisk: number; // 0-100
  anomalies: AIAnomaly[];
  // Supply/demand balance (demand-driven model)
  totalDemand: number; // L/s requested by the network
  totalDelivered: number; // L/s actually supplied
  supply: number; // L/s available at source
  deliveryRatio: number; // 0-1, 1 = all demand met
}

export interface AIAnomaly {
  id: string;
  type: 'pressure_anomaly' | 'flow_restriction' | 'leak_detected' | 'vulnerable_location' | 'capacity_warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assetId: string;
  assetType: 'pipe' | 'junction' | 'manhole' | 'pump' | 'valve';
  title: string;
  description: string;
  confidence: number; // 0-100%
  position: Vector3;
}

export interface ScenarioComparison {
  label: string;
  baseline: SimulationSnapshot;
  modified: SimulationSnapshot;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  expectedEffect: string;
  action: () => void;
  priority: 'low' | 'medium' | 'high';
}

export interface WaterNetwork {
  nodes: NetworkNode[];
  pipes: PipeSegment[];
  valves: Valve[];
  pumps: Pump[];
  leaks: Leak[];
  blockages: Blockage[];
  pressureZones: PressureZone[];
}
