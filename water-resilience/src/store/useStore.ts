// ============================================================
// Global State Store — Water Resilience System
// ============================================================

import { create } from 'zustand';
import type {
  WaterNetwork,
  SimulationState,
  SimulationSnapshot,
  ViewMode,
  TerrainMode,
  ScenarioType,
  AIAnomaly,
  Leak,
  Blockage,
} from '../lib/network/types';
import { createDemoNetwork, validateNetwork } from '../lib/network/model';
import { runSimulationStep, midpointOfPipe } from '../lib/network/simulation';

interface AppState {
  // Network
  network: WaterNetwork;

  // Simulation
  simulation: SimulationState;
  baselineSnapshot: SimulationSnapshot | null;
  currentSnapshot: SimulationSnapshot;

  // UI State
  selectedAssetId: string | null;
  hoveredAssetId: string | null;
  viewMode: ViewMode;
  terrainMode: TerrainMode;
  showWaterFlow: boolean;
  showLabels: boolean;
  showManholes: boolean;

  // Panels
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  aiPanelOpen: boolean;
  dashboardOpen: boolean;
  scenarioOpen: boolean;

  // Camera
  cameraTarget: { x: number; y: number; z: number } | null;
  cameraPreset: 'default' | 'top' | 'side' | '3d' | null;

  // Scenario
  activeScenario: ScenarioType;
  baselineCompare: SimulationSnapshot | null;

  // Manual Controls
  setSourcePressure: (pressure: number) => void;
  setSourceFlow: (flow: number) => void;
  setPipeRestriction: (pipeId: string, severity: number) => void;
  clearPipeRestriction: (pipeId: string) => void;
  resetManualControls: () => void;

  // Actions
  initializeNetwork: () => void;
  runSimulation: () => void;
  stepSimulation: (deltaTime: number) => void;
  resetSimulation: () => void;
  resetToBaseline: () => void;

  setInflowMultiplier: (multiplier: number) => void;
  setSimulationSpeed: (speed: number) => void;
  toggleSimulation: () => void;
  setSimulationTime: (time: number) => void;

  selectAsset: (id: string | null) => void;
  hoverAsset: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setTerrainMode: (mode: TerrainMode) => void;
  toggleWaterFlow: () => void;
  toggleLabels: () => void;
  toggleManholes: () => void;

  setCameraTarget: (target: { x: number; y: number; z: number } | null) => void;
  setCameraPreset: (preset: 'default' | 'top' | 'side' | '3d') => void;

  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleAIPanel: () => void;
  toggleDashboard: () => void;
  toggleScenario: () => void;

  applyLeak: (pipeId: string, severity: number) => void;
  removeLeak: (pipeId: string) => void;
  applyBlockage: (pipeId: string, severity: number) => void;
  removeBlockage: (pipeId: string) => void;
  closeValve: (valveId: string) => void;
  openValve: (valveId: string) => void;
  failPump: (pumpId: string) => void;
  fixPump: (pumpId: string) => void;
  setScenario: (scenario: ScenarioType) => void;

  focusCamera: (position: { x: number; y: number; z: number }) => void;
}

const defaultSnapshot: SimulationSnapshot = {
  time: 0,
  nodes: {},
  pipes: {},
  systemMetrics: {
    totalAssets: 0, criticalAssets: 0, activeAlerts: 0,
    averagePressure: 0, peakFlow: 0, waterLoss: 0,
    resilienceScore: 0, pressureStability: 0, redundancy: 0,
    capacity: 0, leakRisk: 0, anomalies: [],
    totalDemand: 0, totalDelivered: 0, supply: 0, deliveryRatio: 1,
  },
};

export const useStore = create<AppState>((set, get) => ({
  // ── Initial State ────────────────────────────────────────
  network: createDemoNetwork(),
  simulation: {
    time: 0,
    isRunning: false,
    speed: 1,
    inflowMultiplier: 1.0,
    scenario: 'baseline',
    duration: 3600,
    baselineSnapshot: null,
    currentSnapshot: defaultSnapshot,
    sourcePressure: 2.8,
    sourceFlow: 32,
    pipeRestrictions: {},
  },
  baselineSnapshot: null,
  currentSnapshot: defaultSnapshot,

  selectedAssetId: null,
  hoveredAssetId: null,
  viewMode: 'normal',
  terrainMode: 'both',
  showWaterFlow: true,
  showLabels: true,
  showManholes: true,

  sidebarOpen: true,
  inspectorOpen: false,
  aiPanelOpen: false,
  dashboardOpen: false,
  scenarioOpen: false,

  cameraTarget: null,
  cameraPreset: null,

  activeScenario: 'baseline',
  baselineCompare: null,

  // ── Actions ──────────────────────────────────────────────
  initializeNetwork: () => {
    const network = createDemoNetwork();
    const validation = validateNetwork(network);
    if (!validation.valid) {
      console.error('Network validation failed:', validation.errors);
    }
    const snapshot = runSimulationStep(network, get().simulation, 0);
    set({
      network,
      currentSnapshot: snapshot,
      simulation: { ...get().simulation, currentSnapshot: snapshot },
      baselineSnapshot: snapshot,
    });
  },

  runSimulation: () => {
    const state = get();
    const snapshot = runSimulationStep(state.network, state.simulation, 0);
    set({
      currentSnapshot: snapshot,
      // NOTE: intentionally does NOT force isRunning — operator control changes
      // update the network state without hijacking the playback state.
      simulation: { ...state.simulation, currentSnapshot: snapshot },
      baselineCompare: state.baselineCompare ?? state.baselineSnapshot,
    });
  },

  stepSimulation: (deltaTime: number) => {
    const state = get();
    if (!state.simulation.isRunning) return;

    const newTime = Math.min(state.simulation.time + deltaTime * state.simulation.speed, state.simulation.duration);
    const simState = { ...state.simulation, time: newTime };
    const snapshot = runSimulationStep(state.network, simState, deltaTime);

    set({
      simulation: { ...simState, currentSnapshot: snapshot },
      currentSnapshot: snapshot,
    });
  },

  resetSimulation: () => {
    const state = get();
    // Clear all modifications
    const freshNetwork = createDemoNetwork();
    const snapshot = runSimulationStep(freshNetwork, { ...state.simulation, time: 0, inflowMultiplier: 1.0, isRunning: false, scenario: 'baseline', sourcePressure: 2.8, sourceFlow: 32, pipeRestrictions: {} }, 0);
    set({
      network: freshNetwork,
      simulation: {
        ...state.simulation,
        time: 0,
        isRunning: false,
        inflowMultiplier: 1.0,
        scenario: 'baseline',
        sourcePressure: 2.8,
        sourceFlow: 32,
        pipeRestrictions: {},
        currentSnapshot: snapshot,
      },
      currentSnapshot: snapshot,
      baselineCompare: null,
      baselineSnapshot: snapshot,
      activeScenario: 'baseline',
    });
  },

  resetToBaseline: () => {
    const state = get();
    const freshNetwork = createDemoNetwork();
    const simState: SimulationState = {
      time: 0, isRunning: false, speed: 1, inflowMultiplier: 1.0,
      scenario: 'baseline', duration: 3600, baselineSnapshot: null,
      currentSnapshot: defaultSnapshot,
      sourcePressure: 2.8, sourceFlow: 32, pipeRestrictions: {},
    };
    const snapshot = runSimulationStep(freshNetwork, simState, 0);
    set({
      network: freshNetwork,
      simulation: { ...simState, currentSnapshot: snapshot },
      currentSnapshot: snapshot,
      baselineSnapshot: snapshot,
      baselineCompare: null,
      activeScenario: 'baseline',
    });
  },

  setInflowMultiplier: (multiplier: number) => {
    set(state => ({
      simulation: { ...state.simulation, inflowMultiplier: multiplier },
    }));
    get().runSimulation();
  },

  setSimulationSpeed: (speed: number) => {
    set(state => ({
      simulation: { ...state.simulation, speed },
    }));
  },

  toggleSimulation: () => {
    set(state => {
      const isRunning = !state.simulation.isRunning;
      return {
        simulation: { ...state.simulation, isRunning },
      };
    });
  },

  setSimulationTime: (time: number) => {
    set(state => {
      const simState = { ...state.simulation, time };
      const snapshot = runSimulationStep(state.network, simState, 0);
      return {
        simulation: { ...simState, currentSnapshot: snapshot },
        currentSnapshot: snapshot,
      };
    });
  },

  selectAsset: (id) => set({ selectedAssetId: id, inspectorOpen: id !== null }),
  hoverAsset: (id) => set({ hoveredAssetId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTerrainMode: (mode) => set({ terrainMode: mode }),
  toggleWaterFlow: () => set(s => ({ showWaterFlow: !s.showWaterFlow })),
  toggleLabels: () => set(s => ({ showLabels: !s.showLabels })),
  toggleManholes: () => set(s => ({ showManholes: !s.showManholes })),

  setCameraTarget: (target) => set({ cameraTarget: target }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleInspector: () => set(s => ({ inspectorOpen: !s.inspectorOpen })),
  // Analysis panels are mutually exclusive — opening one closes the others so
  // panels never stack on the same screen edge.
  toggleAIPanel: () => set(s => ({
    aiPanelOpen: !s.aiPanelOpen,
    dashboardOpen: false,
    scenarioOpen: false,
  })),
  toggleDashboard: () => set(s => ({
    dashboardOpen: !s.dashboardOpen,
    aiPanelOpen: false,
    scenarioOpen: false,
  })),
  toggleScenario: () => set(s => ({
    scenarioOpen: !s.scenarioOpen,
    aiPanelOpen: false,
    dashboardOpen: false,
  })),

  // ── Scenario Actions ─────────────────────────────────────
  applyLeak: (pipeId: string, severity: number) => {
    const state = get();
    const pipe = state.network.pipes.find(p => p.id === pipeId);
    if (!pipe) return;

    const leak: Leak = {
      id: `LEAK-${pipeId}`,
      pipeId,
      position: midpointOfPipe(state.network, pipe),
      severity,
      flowRate: (severity / 100) * 5.0, // up to 5 L/s at 100%
      active: true,
    };

    const newLeaks = [...state.network.leaks.filter(l => l.pipeId !== pipeId), leak];
    const updatedPipe = state.network.pipes.map(p =>
      p.id === pipeId ? { ...p, status: 'leak' as const } : p
    );

    set({
      network: { ...state.network, leaks: newLeaks, pipes: updatedPipe },
    });
    get().runSimulation();
  },

  removeLeak: (pipeId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        leaks: state.network.leaks.filter(l => l.pipeId !== pipeId),
        pipes: state.network.pipes.map(p =>
          p.id === pipeId ? { ...p, status: 'normal' as const } : p
        ),
      },
    });
    get().runSimulation();
  },

  applyBlockage: (pipeId: string, severity: number) => {
    const state = get();
    const pipe = state.network.pipes.find(p => p.id === pipeId);
    if (!pipe) return;

    const blockage: Blockage = {
      id: `BLK-${pipeId}`,
      pipeId,
      position: midpointOfPipe(state.network, pipe),
      severity,
      active: true,
    };

    const newBlockages = [...state.network.blockages.filter(b => b.pipeId !== pipeId), blockage];

    set({
      network: { ...state.network, blockages: newBlockages },
    });
    get().runSimulation();
  },

  removeBlockage: (pipeId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        blockages: state.network.blockages.filter(b => b.pipeId !== pipeId),
      },
    });
    get().runSimulation();
  },

  closeValve: (valveId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        valves: state.network.valves.map(v =>
          v.id === valveId ? { ...v, state: 'closed' as const, openness: 0 } : v
        ),
      },
    });
    get().runSimulation();
  },

  openValve: (valveId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        valves: state.network.valves.map(v =>
          v.id === valveId ? { ...v, state: 'open' as const, openness: 100 } : v
        ),
      },
    });
    get().runSimulation();
  },

  failPump: (pumpId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        pumps: state.network.pumps.map(p =>
          p.id === pumpId ? { ...p, state: 'failed' as const, utilization: 0 } : p
        ),
      },
    });
    get().runSimulation();
  },

  fixPump: (pumpId: string) => {
    const state = get();
    set({
      network: {
        ...state.network,
        pumps: state.network.pumps.map(p =>
          p.id === pumpId ? { ...p, state: 'running' as const, utilization: 75 } : p
        ),
      },
    });
    get().runSimulation();
  },

  setScenario: (scenario: ScenarioType) => {
    set({ activeScenario: scenario });
  },

  focusCamera: (position) => {
    set({ cameraTarget: position, cameraPreset: null });
  },

  // ── Manual Controls ──────────────────────────────────────
  setSourcePressure: (pressure: number) => {
    set(state => ({
      simulation: { ...state.simulation, sourcePressure: pressure },
    }));
    get().runSimulation();
  },

  setSourceFlow: (flow: number) => {
    set(state => ({
      simulation: { ...state.simulation, sourceFlow: flow },
    }));
    get().runSimulation();
  },

  setPipeRestriction: (pipeId: string, severity: number) => {
    set(state => ({
      simulation: {
        ...state.simulation,
        pipeRestrictions: { ...state.simulation.pipeRestrictions, [pipeId]: severity },
      },
    }));
    get().runSimulation();
  },

  clearPipeRestriction: (pipeId: string) => {
    set(state => {
      const { [pipeId]: _, ...rest } = state.simulation.pipeRestrictions;
      return {
        simulation: { ...state.simulation, pipeRestrictions: rest },
      };
    });
    get().runSimulation();
  },

  resetManualControls: () => {
    set(state => ({
      simulation: {
        ...state.simulation,
        sourcePressure: 2.8,
        sourceFlow: 32,
        pipeRestrictions: {},
        inflowMultiplier: 1.0,
      },
    }));
    get().runSimulation();
  },
}));
