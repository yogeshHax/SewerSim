// ============================================================
// Scene constants — shared between terrain and network rendering
// ============================================================
// Coordinate mapping used across the app:
//   network (x, y, z) -> three.js (x, z, -y)
// where network z is burial DEPTH (larger = deeper underground) and
// network y is the plan (map) coordinate.
//
// 1 plan unit = 15 real-world metres (see model.ts METERS_PER_UNIT).

// Three.js Y of the ground surface. All pipes sit below this.
export const SURFACE_Y = 5.5;

// Three.js Y of the pipe-batch ceiling — deepest network node z is ~4.6.
export const MAX_PIPE_DEPTH_Y = 0.5;

// World half-extents used for the ground plane and shadow frustum.
export const WORLD_CENTER: [number, number, number] = [5, SURFACE_Y, -12];
export const WORLD_HALF = 55;
