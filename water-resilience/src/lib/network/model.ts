// ============================================================
// Smart Water Resilience Network — Dense City Underground
// ============================================================
// 52 nodes, 68 pipes — full city underground grid network.
// Every pipe path begins at its fromNode and ends at its toNode.
// ============================================================

import type {
  WaterNetwork, NetworkNode, PipeSegment, Valve, Pump, PressureZone, Vector3,
} from './types';

function v3(x: number, y: number, z: number): Vector3 { return { x, y, z }; }

function dist(a: Vector3, b: Vector3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

function calcBendAngle(prev: Vector3, curr: Vector3, next: Vector3): number {
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y, z: curr.z - prev.z };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y, z: next.z - curr.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
  if (m1 === 0 || m2 === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * (180 / Math.PI);
}

function pathLength(wps: Vector3[]): number {
  let l = 0;
  for (let i = 0; i < wps.length - 1; i++) l += dist(wps[i], wps[i + 1]);
  return l;
}

// Compute bend angles at intermediate waypoints (not endpoints)
function calcIntermediateBendAngles(wps: Vector3[]): number[] {
  const a: number[] = [];
  for (let i = 1; i < wps.length - 1; i++) a.push(calcBendAngle(wps[i - 1], wps[i], wps[i + 1]));
  return a;
}

// Scale factor: 1 XY coordinate unit = 15 real-world metres
// Converts pipe waypoint distances to realistic pipe lengths
const METERS_PER_UNIT = 15;

// ============================================================
// NODES — 48 total
// ============================================================
interface ND { id: string; label: string; type: NetworkNode['type']; x: number; y: number; z: number; elev: number; demand: number; cond: number }

const N: ND[] = [
  // ── Source complex ──
  { id:'R-001',   label:'Water Reservoir',       type:'reservoir',     x:-22, y: 0,  z:4.6, elev:46, demand:0,   cond:95 },
  { id:'P-UMP-001',label:'Pump Station',         type:'pump_station', x:-18, y: 0,  z:4.4, elev:44, demand:0,   cond:93 },
  { id:'S-001',   label:'Source Junction',        type:'source',       x:-14, y: 0,  z:4.2, elev:42, demand:0,   cond:92 },
  // ── Main trunk ──
  { id:'J-001',   label:'Junction J-001',         type:'junction',     x: -8, y: 0,  z:3.9, elev:39, demand:1.2, cond:88 },
  { id:'J-002',   label:'Junction J-002',         type:'junction',     x: -2, y: 0,  z:3.7, elev:37, demand:1.8, cond:85 },
  // ── Loop ──
  { id:'J-003',   label:'Junction J-003',         type:'junction',     x:  4, y: 0,  z:3.5, elev:35, demand:1.2, cond:82 },
  { id:'J-004',   label:'Junction J-004',         type:'junction',     x:  4, y: 8,  z:3.2, elev:32, demand:0.8, cond:80 },
  { id:'J-005',   label:'Junction J-005',         type:'junction',     x: 12, y: 8,  z:3.0, elev:30, demand:1.2, cond:78 },
  { id:'J-006',   label:'Junction J-006',         type:'junction',     x: 20, y: 8,  z:2.8, elev:28, demand:0.8, cond:77 },
  { id:'J-007',   label:'Junction J-007',         type:'junction',     x: 20, y: 0,  z:2.6, elev:26, demand:1.2, cond:76 },
  { id:'J-008',   label:'Junction J-008',         type:'junction',     x: 12, y: 0,  z:2.4, elev:24, demand:0.8, cond:75 },
  // ── Loop return manhole ──
  { id:'M-004',   label:'Manhole M-004',          type:'manhole',      x:  8, y: 0,  z:2.3, elev:23, demand:0,   cond:74 },
  // ── Upper alternate ──
  { id:'M-006',   label:'Manhole M-006',          type:'manhole',      x: 12, y:12,  z:3.1, elev:31, demand:0,   cond:85 },
  // ── Branch manholes ──
  { id:'M-007',   label:'Manhole M-007',          type:'manhole',      x: 20, y:-4,  z:2.5, elev:25, demand:0,   cond:82 },
  { id:'M-003',   label:'Manhole M-003',          type:'manhole',      x: -2, y:-6,  z:3.5, elev:35, demand:0,   cond:83 },
  // ── Confluence ──
  { id:'J-009',   label:'Junction J-009',         type:'junction',     x: 20, y:-8,  z:2.3, elev:23, demand:1.5, cond:80 },
  { id:'J-010',   label:'Junction J-010',         type:'junction',     x: 28, y:-8,  z:2.1, elev:21, demand:1.2, cond:82 },
  { id:'OUT-002', label:'Distribution Outlet 2',   type:'destination',  x: 36, y:-8,  z:1.9, elev:19, demand:1.8, cond:88 },
  // ── U-turn ──
  { id:'J-011',   label:'Junction J-011',         type:'junction',     x: 28, y:-16, z:1.8, elev:18, demand:1.2, cond:78 },
  // ── Lower branches ──
  { id:'M-008',   label:'Manhole M-008',          type:'manhole',      x: 22, y:-16, z:1.7, elev:17, demand:0,   cond:77 },
  { id:'M-009',   label:'Manhole M-009',          type:'manhole',      x: 34, y:-16, z:1.7, elev:17, demand:0,   cond:77 },
  { id:'J-012',   label:'Junction J-012',         type:'junction',     x: 22, y:-22, z:1.5, elev:15, demand:0.8, cond:75 },
  { id:'J-013',   label:'Junction J-013',         type:'junction',     x: 34, y:-22, z:1.5, elev:15, demand:0.8, cond:75 },
  // ── Final trunk ──
  { id:'J-014',   label:'Junction J-014',         type:'junction',     x: 28, y:-28, z:1.3, elev:13, demand:1.2, cond:73 },
  { id:'J-015',   label:'Junction J-015',         type:'junction',     x: 28, y:-34, z:1.1, elev:11, demand:0.8, cond:72 },
  { id:'OUT-001', label:'Distribution Outlet 1',   type:'destination',  x: 28, y:-40, z:0.9, elev: 9, demand:2.5, cond:85 },
  // ── Access stub manholes ──
  { id:'M-001',   label:'Manhole M-001',          type:'manhole',      x: -8, y:-3,  z:3.9, elev:39, demand:0,   cond:90 },
  { id:'M-002',   label:'Manhole M-002',          type:'manhole',      x: -2, y:-3,  z:3.7, elev:37, demand:0,   cond:90 },
  { id:'M-005',   label:'Manhole M-005',          type:'manhole',      x: 12, y:11,  z:3.0, elev:30, demand:0,   cond:88 },
  { id:'M-010',   label:'Manhole M-010',          type:'manhole',      x: 31, y:-8,  z:2.1, elev:21, demand:0,   cond:88 },
  { id:'M-011',   label:'Manhole M-011',          type:'manhole',      x: 28, y:-31, z:1.3, elev:13, demand:0,   cond:85 },
  { id:'M-012',   label:'Manhole M-012',          type:'manhole',      x: 19, y:-22, z:1.5, elev:15, demand:0,   cond:85 },

  // ════════════════════════════════════════════════════════════
  // NEW — expanded grid junctions + manholes for dense network
  // ════════════════════════════════════════════════════════════

  // ── West grid (between trunk and loop) ──
  { id:'J-016',   label:'Junction J-016',         type:'junction',     x: -8, y: 8,  z:3.8, elev:38, demand:0.6, cond:84 },
  { id:'J-017',   label:'Junction J-017',         type:'junction',     x: -8, y:-6,  z:3.8, elev:38, demand:0.6, cond:84 },
  { id:'M-013',   label:'Manhole M-013',          type:'manhole',      x: -8, y: 4,  z:3.85,elev:38, demand:0,   cond:86 },
  // ── Central grid fill ──
  { id:'J-018',   label:'Junction J-018',         type:'junction',     x:  4, y: 4,  z:3.35,elev:34, demand:0.5, cond:81 },
  { id:'J-019',   label:'Junction J-019',         type:'junction',     x: 12, y: 4,  z:2.85,elev:29, demand:0.5, cond:79 },
  { id:'J-020',   label:'Junction J-020',         type:'junction',     x: 20, y: 4,  z:2.7, elev:27, demand:0.5, cond:78 },
  { id:'J-021',   label:'Junction J-021',         type:'junction',     x:  4, y:-4,  z:3.3, elev:33, demand:0.5, cond:80 },
  { id:'J-022',   label:'Junction J-022',         type:'junction',     x: 12, y:-4,  z:2.65,elev:27, demand:0.5, cond:78 },
  // ── Upper grid ──
  { id:'J-023',   label:'Junction J-023',         type:'junction',     x:  4, y:14,  z:3.1, elev:31, demand:0.4, cond:82 },
  { id:'J-024',   label:'Junction J-024',         type:'junction',     x: 20, y:14,  z:2.75,elev:28, demand:0.4, cond:80 },
  { id:'M-014',   label:'Manhole M-014',          type:'manhole',      x: 12, y:14,  z:2.95,elev:30, demand:0,   cond:83 },
  // ── East grid ──
  { id:'J-025',   label:'Junction J-025',         type:'junction',     x: 28, y:-4,  z:2.2, elev:22, demand:0.6, cond:81 },
  { id:'J-026',   label:'Junction J-026',         type:'junction',     x: 28, y:-12, z:2.0, elev:20, demand:0.5, cond:79 },
  { id:'J-027',   label:'Junction J-027',         type:'junction',     x: 34, y:-12, z:1.85,elev:19, demand:0.5, cond:78 },
  { id:'M-015',   label:'Manhole M-015',          type:'manhole',      x: 28, y:-20, z:1.65,elev:17, demand:0,   cond:76 },
  // ── Lower grid ──
  { id:'J-028',   label:'Junction J-028',         type:'junction',     x: 18, y:-28, z:1.35,elev:14, demand:0.5, cond:74 },
  { id:'J-029',   label:'Junction J-029',         type:'junction',     x: 38, y:-28, z:1.3, elev:13, demand:0.5, cond:73 },
  { id:'J-030',   label:'Junction J-030',         type:'junction',     x: 22, y:-34, z:1.1, elev:11, demand:0.4, cond:72 },
  { id:'M-016',   label:'Manhole M-016',          type:'manhole',      x: 34, y:-34, z:1.1, elev:11, demand:0,   cond:73 },
  // ── Dead-end service lines ──
  { id:'J-031',   label:'Junction J-031',         type:'junction',     x: -14, y:-6, z:4.1, elev:41, demand:0.3, cond:87 },
];

// ============================================================
// PIPES — 58 total, with exact engineered waypoints
// ============================================================
interface PD { id:string; type:PipeSegment['type']; from:string; to:string; wps:Vector3[]; dia:number; rough:number; age:number; cond:number }

const P: PD[] = [
  // ═══ ORIGINAL 36 PIPES ═══
  // ── Source complex ──
  { id:'P-001', type:'main', from:'R-001', to:'P-UMP-001',
    wps:[v3(-22,0,4.6), v3(-18,0,4.4)], dia:300, rough:140, age:5, cond:95 },
  { id:'P-002', type:'main', from:'P-UMP-001', to:'S-001',
    wps:[v3(-18,0,4.4), v3(-14,0,4.2)], dia:300, rough:140, age:5, cond:95 },
  { id:'P-003', type:'main', from:'S-001', to:'J-001',
    wps:[v3(-14,0,4.2), v3(-8,0,3.9)], dia:250, rough:130, age:8, cond:90 },
  // ── Main trunk ──
  { id:'P-004', type:'main', from:'J-001', to:'J-002',
    wps:[v3(-8,0,3.9), v3(-2,0,3.7)], dia:250, rough:130, age:12, cond:85 },
  { id:'P-005', type:'main', from:'J-002', to:'J-003',
    wps:[v3(-2,0,3.7), v3(4,0,3.5)], dia:250, rough:130, age:12, cond:85 },
  // ── Loop top ──
  { id:'P-006', type:'main', from:'J-003', to:'J-004',
    wps:[v3(4,0,3.5), v3(4,8,3.2)], dia:200, rough:120, age:15, cond:80 },
  { id:'P-007', type:'main', from:'J-004', to:'J-005',
    wps:[v3(4,8,3.2), v3(12,8,3.0)], dia:200, rough:120, age:15, cond:80 },
  { id:'P-008', type:'main', from:'J-005', to:'J-006',
    wps:[v3(12,8,3.0), v3(20,8,2.8)], dia:200, rough:120, age:15, cond:80 },
  // ── Loop right ──
  { id:'P-009', type:'main', from:'J-006', to:'J-007',
    wps:[v3(20,8,2.8), v3(20,0,2.6)], dia:200, rough:120, age:15, cond:78 },
  // ── Loop bottom ──
  { id:'P-010', type:'main', from:'J-007', to:'J-008',
    wps:[v3(20,0,2.6), v3(12,0,2.4)], dia:200, rough:120, age:15, cond:78 },
  // ── Loop return through M-004 ──
  { id:'P-011', type:'main', from:'J-008', to:'M-004',
    wps:[v3(12,0,2.4), v3(8,0,2.3)], dia:200, rough:120, age:15, cond:75 },
  { id:'P-012', type:'main', from:'M-004', to:'J-003',
    wps:[v3(8,0,2.3), v3(6,0,2.9), v3(4,0,3.5)], dia:200, rough:120, age:15, cond:75 },
  // ── Upper alternate through M-006 ──
  { id:'P-013', type:'secondary', from:'J-004', to:'M-006',
    wps:[v3(4,8,3.2), v3(8,10,3.15), v3(12,12,3.1)], dia:150, rough:130, age:10, cond:85 },
  { id:'P-014', type:'secondary', from:'M-006', to:'J-006',
    wps:[v3(12,12,3.1), v3(16,10,2.95), v3(20,8,2.8)], dia:150, rough:130, age:10, cond:85 },
  // ── J-007 → M-007 → J-009 ──
  { id:'P-015', type:'secondary', from:'J-007', to:'M-007',
    wps:[v3(20,0,2.6), v3(20,-4,2.5)], dia:150, rough:130, age:10, cond:82 },
  { id:'P-016', type:'secondary', from:'M-007', to:'J-009',
    wps:[v3(20,-4,2.5), v3(20,-8,2.3)], dia:150, rough:130, age:10, cond:82 },
  // ── J-008 → J-009 ──
  { id:'P-017', type:'secondary', from:'J-008', to:'J-009',
    wps:[v3(12,0,2.4), v3(12,-4,2.35), v3(20,-8,2.3)], dia:150, rough:130, age:12, cond:80 },
  // ── Secondary branch J-002 → M-003 → J-009 ──
  { id:'P-018', type:'secondary', from:'J-002', to:'M-003',
    wps:[v3(-2,0,3.7), v3(-2,-6,3.5)], dia:150, rough:130, age:10, cond:83 },
  { id:'P-019', type:'secondary', from:'M-003', to:'J-009',
    wps:[v3(-2,-6,3.5), v3(6,-7,3.0), v3(14,-8,2.6), v3(20,-8,2.3)], dia:150, rough:120, age:12, cond:78 },
  // ── Main continuation ──
  { id:'P-020', type:'main', from:'J-009', to:'J-010',
    wps:[v3(20,-8,2.3), v3(28,-8,2.1)], dia:200, rough:120, age:12, cond:80 },
  // ── Secondary destination ──
  { id:'P-021', type:'distribution', from:'J-010', to:'OUT-002',
    wps:[v3(28,-8,2.1), v3(36,-8,1.9)], dia:150, rough:130, age:8, cond:88 },
  // ── U-TURN (4×90° bends) ──
  { id:'P-022', type:'main', from:'J-010', to:'J-011',
    wps:[v3(28,-8,2.1), v3(28,-10,2.05), v3(32,-10,2.0), v3(32,-14,1.9), v3(28,-14,1.85), v3(28,-16,1.8)],
    dia:200, rough:110, age:18, cond:72 },
  // ── Lower branches ──
  { id:'P-023', type:'tertiary', from:'J-011', to:'M-008',
    wps:[v3(28,-16,1.8), v3(22,-16,1.7)], dia:150, rough:120, age:14, cond:78 },
  { id:'P-024', type:'tertiary', from:'J-011', to:'M-009',
    wps:[v3(28,-16,1.8), v3(34,-16,1.7)], dia:150, rough:120, age:14, cond:78 },
  { id:'P-025', type:'tertiary', from:'M-008', to:'J-012',
    wps:[v3(22,-16,1.7), v3(22,-22,1.5)], dia:150, rough:120, age:14, cond:76 },
  { id:'P-026', type:'tertiary', from:'M-009', to:'J-013',
    wps:[v3(34,-16,1.7), v3(34,-22,1.5)], dia:150, rough:120, age:14, cond:76 },
  // ── Cross connection ──
  { id:'P-027', type:'secondary', from:'J-012', to:'J-013',
    wps:[v3(22,-22,1.5), v3(34,-22,1.5)], dia:150, rough:120, age:14, cond:75 },
  // ── Final trunk ──
  { id:'P-028', type:'main', from:'J-013', to:'J-014',
    wps:[v3(34,-22,1.5), v3(31,-25,1.4), v3(28,-28,1.3)], dia:200, rough:120, age:14, cond:75 },
  { id:'P-029', type:'main', from:'J-014', to:'J-015',
    wps:[v3(28,-28,1.3), v3(28,-34,1.1)], dia:200, rough:120, age:14, cond:73 },
  { id:'P-030', type:'main', from:'J-015', to:'OUT-001',
    wps:[v3(28,-34,1.1), v3(28,-40,0.9)], dia:200, rough:120, age:14, cond:73 },
  // ── Manhole access stubs ──
  { id:'P-031', type:'distribution', from:'J-001', to:'M-001',
    wps:[v3(-8,0,3.9), v3(-8,-3,3.9)], dia:100, rough:140, age:8, cond:90 },
  { id:'P-032', type:'distribution', from:'J-002', to:'M-002',
    wps:[v3(-2,0,3.7), v3(-2,-3,3.7)], dia:100, rough:140, age:8, cond:90 },
  { id:'P-033', type:'distribution', from:'J-005', to:'M-005',
    wps:[v3(12,8,3.0), v3(12,11,3.0)], dia:100, rough:140, age:10, cond:88 },
  { id:'P-034', type:'distribution', from:'J-010', to:'M-010',
    wps:[v3(28,-8,2.1), v3(31,-8,2.1)], dia:100, rough:140, age:8, cond:88 },
  { id:'P-035', type:'distribution', from:'J-014', to:'M-011',
    wps:[v3(28,-28,1.3), v3(28,-31,1.3)], dia:100, rough:140, age:12, cond:85 },
  { id:'P-036', type:'distribution', from:'J-012', to:'M-012',
    wps:[v3(22,-22,1.5), v3(19,-22,1.5)], dia:100, rough:140, age:12, cond:85 },

  // ════════════════════════════════════════════════════════════
  // NEW — 22 additional pipes for dense city underground grid
  // ════════════════════════════════════════════════════════════

  // ── West grid: J-001 ↔ J-016 ↔ J-004 (north lateral) ──
  { id:'P-037', type:'secondary', from:'J-001', to:'M-013',
    wps:[v3(-8,0,3.9), v3(-8,4,3.85)], dia:150, rough:130, age:10, cond:86 },
  { id:'P-038', type:'secondary', from:'M-013', to:'J-016',
    wps:[v3(-8,4,3.85), v3(-8,8,3.8)], dia:150, rough:130, age:10, cond:84 },
  { id:'P-039', type:'secondary', from:'J-016', to:'J-004',
    wps:[v3(-8,8,3.8), v3(4,8,3.2)], dia:150, rough:130, age:12, cond:82 },
  // ── West grid south: J-001 ↔ J-017 ──
  { id:'P-040', type:'secondary', from:'J-001', to:'J-017',
    wps:[v3(-8,0,3.9), v3(-8,-6,3.8)], dia:150, rough:130, age:10, cond:84 },
  // ── West to source: J-017 ↔ J-031 ↔ S-001 ──
  { id:'P-041', type:'secondary', from:'J-017', to:'J-031',
    wps:[v3(-8,-6,3.8), v3(-14,-6,4.1)], dia:150, rough:130, age:10, cond:87 },
  { id:'P-042', type:'secondary', from:'J-031', to:'S-001',
    wps:[v3(-14,-6,4.1), v3(-14,0,4.2)], dia:150, rough:130, age:10, cond:90 },

  // ── Central grid: horizontal laterals ──
  { id:'P-043', type:'tertiary', from:'J-003', to:'J-018',
    wps:[v3(4,0,3.5), v3(4,4,3.35)], dia:150, rough:120, age:12, cond:80 },
  { id:'P-044', type:'tertiary', from:'J-018', to:'J-004',
    wps:[v3(4,4,3.35), v3(4,8,3.2)], dia:150, rough:120, age:12, cond:80 },
  { id:'P-045', type:'tertiary', from:'J-008', to:'J-019',
    wps:[v3(12,0,2.4), v3(12,4,2.85)], dia:150, rough:120, age:12, cond:78 },
  { id:'P-046', type:'tertiary', from:'J-019', to:'J-005',
    wps:[v3(12,4,2.85), v3(12,8,3.0)], dia:150, rough:120, age:12, cond:78 },
  { id:'P-047', type:'tertiary', from:'J-007', to:'J-020',
    wps:[v3(20,0,2.6), v3(20,4,2.7)], dia:150, rough:120, age:12, cond:77 },
  { id:'P-048', type:'tertiary', from:'J-020', to:'J-006',
    wps:[v3(20,4,2.7), v3(20,8,2.8)], dia:150, rough:120, age:12, cond:77 },

  // ── Central grid: south laterals ──
  { id:'P-049', type:'tertiary', from:'J-003', to:'J-021',
    wps:[v3(4,0,3.5), v3(4,-4,3.3)], dia:150, rough:120, age:12, cond:80 },
  { id:'P-050', type:'tertiary', from:'J-008', to:'J-022',
    wps:[v3(12,0,2.4), v3(12,-4,2.65)], dia:150, rough:120, age:12, cond:78 },
  { id:'P-051', type:'tertiary', from:'J-021', to:'J-022',
    wps:[v3(4,-4,3.3), v3(12,-4,2.65)], dia:150, rough:120, age:12, cond:78 },
  { id:'P-052', type:'tertiary', from:'J-022', to:'M-007',
    wps:[v3(12,-4,2.65), v3(20,-4,2.5)], dia:150, rough:120, age:12, cond:79 },

  // ── Upper grid: M-006 ↔ J-023, J-024 ──
  { id:'P-053', type:'secondary', from:'M-006', to:'M-014',
    wps:[v3(12,12,3.1), v3(12,14,2.95)], dia:150, rough:130, age:10, cond:83 },
  { id:'P-054', type:'secondary', from:'J-004', to:'J-023',
    wps:[v3(4,8,3.2), v3(4,14,3.1)], dia:150, rough:130, age:10, cond:82 },
  { id:'P-055', type:'secondary', from:'J-023', to:'M-014',
    wps:[v3(4,14,3.1), v3(12,14,2.95)], dia:150, rough:130, age:10, cond:82 },
  { id:'P-056', type:'secondary', from:'M-014', to:'J-024',
    wps:[v3(12,14,2.95), v3(20,14,2.75)], dia:150, rough:130, age:10, cond:80 },
  { id:'P-057', type:'secondary', from:'J-006', to:'J-024',
    wps:[v3(20,8,2.8), v3(20,14,2.75)], dia:150, rough:130, age:10, cond:80 },

  // ── East grid: J-010 ↔ J-025 ↔ J-026 ↔ J-027 ──
  { id:'P-058', type:'secondary', from:'J-010', to:'J-025',
    wps:[v3(28,-8,2.1), v3(28,-4,2.2)], dia:150, rough:120, age:10, cond:81 },
  { id:'P-059', type:'secondary', from:'J-025', to:'J-026',
    wps:[v3(28,-4,2.2), v3(28,-12,2.0)], dia:150, rough:120, age:10, cond:80 },
  { id:'P-060', type:'secondary', from:'J-026', to:'J-027',
    wps:[v3(28,-12,2.0), v3(34,-12,1.85)], dia:150, rough:120, age:10, cond:79 },
  { id:'P-061', type:'tertiary', from:'J-026', to:'M-015',
    wps:[v3(28,-12,2.0), v3(28,-20,1.65)], dia:150, rough:120, age:12, cond:77 },
  { id:'P-062', type:'tertiary', from:'M-015', to:'J-012',
    wps:[v3(28,-20,1.65), v3(22,-22,1.5)], dia:150, rough:120, age:12, cond:76 },

  // ── Lower grid: cross-connections ──
  { id:'P-063', type:'tertiary', from:'J-014', to:'J-028',
    wps:[v3(28,-28,1.3), v3(18,-28,1.35)], dia:150, rough:120, age:14, cond:74 },
  { id:'P-064', type:'tertiary', from:'J-014', to:'J-029',
    wps:[v3(28,-28,1.3), v3(38,-28,1.3)], dia:150, rough:120, age:14, cond:73 },
  { id:'P-065', type:'tertiary', from:'J-015', to:'J-030',
    wps:[v3(28,-34,1.1), v3(22,-34,1.1)], dia:150, rough:120, age:14, cond:72 },
  { id:'P-066', type:'tertiary', from:'J-015', to:'M-016',
    wps:[v3(28,-34,1.1), v3(34,-34,1.1)], dia:150, rough:120, age:14, cond:73 },
  { id:'P-067', type:'tertiary', from:'J-029', to:'M-016',
    wps:[v3(38,-28,1.3), v3(34,-34,1.1)], dia:150, rough:120, age:14, cond:73 },
  { id:'P-068', type:'tertiary', from:'J-030', to:'OUT-001',
    wps:[v3(22,-34,1.1), v3(28,-40,0.9)], dia:150, rough:120, age:14, cond:72 },
];

// ============================================================
// CREATE NETWORK
// ============================================================
export function createDemoNetwork(): WaterNetwork {
  const nodes: NetworkNode[] = N.map(n => ({
    id: n.id, label: n.label, type: n.type,
    position: v3(n.x, n.y, n.z), elevation: n.elev,
    pressure: 0, waterLevel: 1.5, demand: n.demand,
    riskScore: 0, status: 'normal' as const, condition: n.cond,
  }));

  const pipes: PipeSegment[] = P.map(p => {
    const len = pathLength(p.wps) * METERS_PER_UNIT;
    const ba = calcIntermediateBendAngles(p.wps);
    return {
      id: p.id, label: `Pipe ${p.id}`, type: p.type,
      fromNode: p.from, toNode: p.to, waypoints: p.wps,
      length: Math.round(len), diameter: p.dia, roughness: p.rough,
      flow: 0, pressure: 0, velocity: 0, utilization: 0, headLoss: 0,
      riskScore: 0, condition: p.cond, age: p.age,
      status: 'normal' as const,
      bendAngles: ba, maxBendAngle: ba.length ? Math.max(...ba) : 0,
    };
  });

  const valves: Valve[] = [
    { id:'V-001', label:'Loop Control Valve',    nodeId:'J-003', pipeId:'P-006', state:'open', openness:100, type:'gate' },
    { id:'V-002', label:'Secondary Outlet Valve', nodeId:'J-010', pipeId:'P-021', state:'open', openness:100, type:'butterfly' },
    { id:'V-003', label:'U-Turn Isolation Valve', nodeId:'J-011', pipeId:'P-022', state:'open', openness:100, type:'gate' },
    { id:'V-004', label:'Final Section Valve',    nodeId:'J-013', pipeId:'P-028', state:'open', openness:100, type:'check' },
    { id:'V-005', label:'West Grid Valve',        nodeId:'J-016', pipeId:'P-039', state:'open', openness:100, type:'gate' },
    { id:'V-006', label:'East Grid Valve',        nodeId:'J-025', pipeId:'P-058', state:'open', openness:100, type:'butterfly' },
  ];

  const pumps: Pump[] = [
    { id:'PU-001', label:'Main Pump Station', nodeId:'P-UMP-001',
      state:'running', capacity:35, head:35, power:25, utilization:78 },
  ];

  const pressureZones: PressureZone[] = [
    { id:'PZ-01', name:'High Zone (Source)', targetPressure:3.0, minPressure:1.5, maxPressure:4.5,
      nodeIds:['R-001','P-UMP-001','S-001','J-001','J-002','J-016','J-017','J-031','M-013'] },
    { id:'PZ-02', name:'Medium Zone (Loop)', targetPressure:2.5, minPressure:1.0, maxPressure:4.0,
      nodeIds:['J-003','J-004','J-005','J-006','J-007','J-008','M-004','M-006',
        'J-018','J-019','J-020','J-021','J-022','J-023','J-024','M-014'] },
    { id:'PZ-03', name:'Lower Zone (Distribution)', targetPressure:2.0, minPressure:0.5, maxPressure:3.5,
      nodeIds:['J-009','J-010','J-011','J-012','J-013','J-014','J-015','OUT-001','OUT-002',
        'M-007','M-003','M-008','M-009','M-010','J-025','J-026','J-027','M-015',
        'J-028','J-029','J-030','M-016'] },
  ];

  return { nodes, pipes, valves, pumps, leaks: [], blockages: [], pressureZones };
}

// ============================================================
// VALIDATION
// ============================================================
export function validateNetwork(network: WaterNetwork): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nIds = new Set(network.nodes.map(n => n.id));
  const pIds = new Set(network.pipes.map(p => p.id));

  if (nIds.size !== network.nodes.length) errors.push('Duplicate node IDs');
  if (pIds.size !== network.pipes.length) errors.push('Duplicate pipe IDs');

  const src = network.nodes.find(n => n.type === 'source');
  if (!src) errors.push('No source node');
  const dsts = network.nodes.filter(n => n.type === 'destination');
  if (!dsts.length) errors.push('No destination nodes');

  for (const pipe of network.pipes) {
    if (!nIds.has(pipe.fromNode)) errors.push(`${pipe.id}: fromNode ${pipe.fromNode} missing`);
    if (!nIds.has(pipe.toNode)) errors.push(`${pipe.id}: toNode ${pipe.toNode} missing`);
    if (pipe.fromNode === pipe.toNode) errors.push(`${pipe.id}: self-connection`);
    const fn = network.nodes.find(n => n.id === pipe.fromNode);
    const tn = network.nodes.find(n => n.id === pipe.toNode);
    if (fn && tn && pipe.waypoints.length >= 2) {
      const sd = dist(pipe.waypoints[0], fn.position);
      const ed = dist(pipe.waypoints[pipe.waypoints.length - 1], tn.position);
      if (sd > 0.01) errors.push(`${pipe.id}: path start ${sd.toFixed(3)} from fromNode`);
      if (ed > 0.01) errors.push(`${pipe.id}: path end ${ed.toFixed(3)} to toNode`);
    }
  }

  if (src) {
    const adj = new Map<string, Set<string>>();
    for (const n of network.nodes) adj.set(n.id, new Set());
    for (const p of network.pipes) { adj.get(p.fromNode)?.add(p.toNode); adj.get(p.toNode)?.add(p.fromNode); }
    const vis = new Set<string>([src.id]);
    const q = [src.id];
    while (q.length) { const c = q.shift()!; for (const nb of adj.get(c) || []) { if (!vis.has(nb)) { vis.add(nb); q.push(nb); } } }
    for (const n of network.nodes) if (!vis.has(n.id)) errors.push(`${n.id} unreachable from source`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// UTILITIES
// ============================================================
export function getNodeById(network: WaterNetwork, id: string): NetworkNode | undefined {
  return network.nodes.find(n => n.id === id);
}
export function getPipeById(network: WaterNetwork, id: string): PipeSegment | undefined {
  return network.pipes.find(p => p.id === id);
}
export function getConnectedPipes(network: WaterNetwork, nodeId: string): PipeSegment[] {
  return network.pipes.filter(p => p.fromNode === nodeId || p.toNode === nodeId);
}
export function getConnectedNodes(network: WaterNetwork, nodeId: string): string[] {
  const s = new Set<string>();
  for (const p of network.pipes) { if (p.fromNode === nodeId) s.add(p.toNode); if (p.toNode === nodeId) s.add(p.fromNode); }
  return Array.from(s);
}
