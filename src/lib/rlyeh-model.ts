/**
 * The architect's model of R'lyeh, in the Black Archive's Drafting Room, as a
 * building game: the base (painted sea, a basalt shelf) is built into the
 * level, and the city goes back onto it piece by piece in the builder
 * (ModelBuilder.tsx). Ten pieces lie loose on the table; the other six are
 * `source: 'elsewhere'`, for the investigators to find in other levels and
 * bring back. Where each of those turns up is not decided yet.
 *
 * Shared by the client (drawing) and /api/models/[id] (which ids exist, and
 * which are on the table from the start).
 */

import type { ModelBox, ModelBuild, ModelPiece } from './walkthrough';

type V3 = [number, number, number];

/** A slab standing on its foot, leaning `deg` about the X or Z axis. */
function lean(size: V3, deg: number, axis: 'x' | 'z', at: [number, number] = [0, 0], mat: ModelBox['mat'] = 'basalt'): ModelBox {
  const t = (deg * Math.PI) / 180;
  const h = size[1] / 2;
  // Sunk a little, so the low corner of a leaning slab stays in the base.
  const sink = Math.abs(Math.sin(t)) * Math.min(size[0], size[2]) * 0.5;
  const c: V3 = axis === 'z'
    ? [at[0] - Math.sin(t) * h, Math.cos(t) * h - sink, at[1]]
    : [at[0], Math.cos(t) * h - sink, at[1] + Math.sin(t) * h];
  return { size, at: c, rot: axis === 'z' ? [0, 0, deg] : [deg, 0, 0], mat };
}

const DEG = 180 / Math.PI;

/** The Great Door: a slab leaning 18° out of true, its verdigris panel on the side facing east. */
function greatDoor(): ModelBox[] {
  const t = 18 / DEG;
  const slab = lean([0.06, 0.62, 0.46], 18, 'z');
  const n: V3 = [Math.cos(t), Math.sin(t), 0];
  const panel: V3 = [slab.at[0] + n[0] * 0.034, slab.at[1] + n[1] * 0.034 - 0.02, 0];
  return [slab, { size: [0.012, 0.42, 0.3], at: panel, rot: [0, 0, 18], mat: 'verdigris' }];
}

/** Eleven steps that climb, turn and tilt more than they should. */
function stair(): ModelBox[] {
  return Array.from({ length: 11 }, (_, k): ModelBox => ({
    size: [0.05, 0.03, 0.16],
    at: [k * 0.045, 0.015 + k * 0.025, -k * 0.012],
    rot: [k * 0.03 * DEG, k * 0.16 * DEG, 0],
    mat: 'basalt',
  }));
}

export const RLYEH_PIECES: ModelPiece[] = [
  // ── On the table ─────────────────────────────────────────────────────────
  {
    id: 'great-door', title: 'the Great Door', source: 'table',
    boxes: greatDoor(),
    slot: { x: -0.15, z: -0.1, yawDeg: 0 },
    loose: { x: -0.85, z: 0.75, yawDeg: 90 },
  },
  {
    id: 'jamb-north', title: 'the north jamb of the Great Door', source: 'table',
    boxes: [lean([0.07, 0.6, 0.07], -12, 'x')],
    slot: { x: -0.06, z: -0.4, yawDeg: 0 },
    loose: { x: -0.45, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'jamb-south', title: 'the south jamb of the Great Door', source: 'table',
    boxes: [lean([0.07, 0.62, 0.07], 14, 'x')],
    slot: { x: -0.06, z: 0.2, yawDeg: 0 },
    loose: { x: -0.28, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'stair', title: 'the twisting stair', source: 'table',
    boxes: stair(),
    slot: { x: 0.05, z: 0.24, yawDeg: 0 },
    loose: { x: 1.2, z: -0.15, yawDeg: 90 },
  },
  {
    id: 'monolith-tall', title: 'the tall leaning monolith', source: 'table',
    boxes: [lean([0.14, 0.55, 0.12], 16, 'z')],
    slot: { x: -0.62, z: -0.28, yawDeg: 30 },
    loose: { x: -0.05, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'monolith-broad', title: 'the broad monolith', source: 'table',
    boxes: [lean([0.18, 0.34, 0.08], 10, 'x')],
    slot: { x: 0.8, z: -0.42, yawDeg: 60 },
    loose: { x: 0.2, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'leaning-pair', title: 'the two slabs that lean together', source: 'table',
    boxes: [lean([0.05, 0.4, 0.14], 14, 'z', [0.09, 0]), lean([0.05, 0.4, 0.14], -14, 'z', [-0.09, 0])],
    slot: { x: 0.82, z: 0.22, yawDeg: 45 },
    symmetryDeg: 180,
    loose: { x: 0.5, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'needle', title: 'the needle', source: 'table',
    boxes: [lean([0.06, 0.46, 0.06], 22, 'x')],
    slot: { x: -0.42, z: 0.38, yawDeg: 15 },
    loose: { x: 0.72, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'lintel', title: 'the fallen lintel', source: 'table',
    boxes: [
      { size: [0.06, 0.14, 0.06], at: [-0.12, 0.07, 0], mat: 'basalt' },
      { size: [0.06, 0.12, 0.06], at: [0.12, 0.06, 0], mat: 'basalt' },
      { size: [0.34, 0.05, 0.09], at: [0, 0.155, 0], rot: [0, 0, -5], mat: 'basalt' },
    ],
    slot: { x: 0.44, z: -0.2, yawDeg: 105 },
    loose: { x: 0.98, z: 0.75, yawDeg: 0 },
  },
  {
    id: 'squat-block', title: 'the squat block', source: 'table',
    boxes: [lean([0.16, 0.2, 0.14], 6, 'z')],
    slot: { x: -0.88, z: 0.22, yawDeg: 0 },
    loose: { x: -1.2, z: 0.0, yawDeg: 90 },
  },

  // ── To be found elsewhere ────────────────────────────────────────────────
  {
    id: 'idol', title: 'the idol on its pedestal', source: 'elsewhere',
    boxes: [
      { size: [0.1, 0.08, 0.1], at: [0, 0.04, 0], mat: 'basalt' },
      { size: [0.05, 0.09, 0.045], at: [0, 0.125, 0], mat: 'verdigris' },
      { size: [0.055, 0.045, 0.05], at: [0.005, 0.19, 0], mat: 'verdigris' },
      { size: [0.008, 0.07, 0.05], at: [-0.03, 0.15, 0.03], rot: [25, 0, 0], mat: 'verdigris' },
      { size: [0.008, 0.07, 0.05], at: [-0.03, 0.15, -0.03], rot: [-25, 0, 0], mat: 'verdigris' },
    ],
    slot: { x: -0.4, z: -0.05, yawDeg: 0 },
  },
  {
    id: 'obelisk', title: 'the crooked obelisk', source: 'elsewhere',
    boxes: [
      lean([0.09, 0.62, 0.09], 9, 'x'),
      { size: [0.06, 0.06, 0.06], at: [0, 0.63, 0.1], rot: [9, 45, 0], mat: 'basalt' },
    ],
    slot: { x: -0.85, z: -0.4, yawDeg: 45 },
  },
  {
    id: 'citadel', title: 'the stepped citadel', source: 'elsewhere',
    boxes: [
      { size: [0.24, 0.12, 0.2], at: [0, 0.06, 0], mat: 'basalt' },
      { size: [0.17, 0.12, 0.14], at: [0.01, 0.18, 0], rot: [0, 12, 3], mat: 'basalt' },
      { size: [0.1, 0.14, 0.08], at: [0.025, 0.31, 0], rot: [0, 24, 6], mat: 'basalt' },
    ],
    slot: { x: 0.1, z: -0.45, yawDeg: 0 },
  },
  {
    id: 'split-monolith', title: 'the split monolith', source: 'elsewhere',
    boxes: [lean([0.06, 0.4, 0.12], 12, 'z', [0.045, 0]), lean([0.06, 0.38, 0.12], 12, 'z', [-0.045, 0])],
    slot: { x: 0.98, z: -0.05, yawDeg: 0 },
  },
  {
    id: 'column', title: 'the broken column', source: 'elsewhere',
    boxes: [
      { size: [0.08, 0.28, 0.08], at: [0, 0.14, 0], rot: [0, 0, 4], mat: 'basalt' },
      { size: [0.08, 0.16, 0.08], at: [0.09, 0.04, 0.05], rot: [90, 20, 0], mat: 'basalt' },
    ],
    slot: { x: -0.66, z: 0.05, yawDeg: 30 },
  },
  {
    id: 'sea-gate', title: 'the sea gate', source: 'elsewhere',
    boxes: [
      { size: [0.05, 0.3, 0.05], at: [0, 0.15, -0.1], mat: 'basalt' },
      { size: [0.05, 0.27, 0.05], at: [0, 0.135, 0.1], mat: 'basalt' },
      { size: [0.06, 0.05, 0.3], at: [0, 0.31, 0], rot: [8, 0, 0], mat: 'basalt' },
    ],
    slot: { x: 0.45, z: 0.48, yawDeg: 0 },
  },
];

/** A man, to scale, by the foot of the stair. */
const MAN: ModelBox[] = [
  { size: [0.01, 0.028, 0.01], at: [0, 0.014, 0.42], mat: 'paper' },
  { size: [0.012, 0.012, 0.012], at: [0, 0.034, 0.42], mat: 'paper' },
];

/**
 * Low broken stones over the shelf, kept clear of every slot so they never
 * get in a piece's way. Seeded, so every investigator sees the same field.
 */
function rubble(): ModelBox[] {
  let s = 1936;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: ModelBox[] = [];
  const clearOf = [...RLYEH_PIECES.map(p => [p.slot.x, p.slot.z]), [0.28, 0.18], [0.45, 0.14], [0, 0.42]];
  for (let tries = 0; out.length < 26 && tries < 400; tries++) {
    const x = (rnd() * 2 - 1) * 1.02;
    const z = (rnd() * 2 - 1) * 0.58;
    if (clearOf.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.2)) continue;
    const h = 0.03 + rnd() * 0.09;
    const w = 0.03 + rnd() * 0.07;
    out.push({
      size: [w, h, w * (0.6 + rnd())],
      at: [x, h * 0.4, z],
      rot: [(rnd() - 0.5) * 30, rnd() * 360, (rnd() - 0.5) * 30],
      mat: 'basalt',
    });
  }
  return [...out, ...MAN];
}

export const RLYEH_MODEL: ModelBuild = {
  id: 'rlyeh',
  // Matches build_drafting() in my-summer-game/tools/build_archive_cli.gd: the
  // table at (-14.3, 0.02, 6.4), 0.85 tall, the basalt shelf 0.05 on top.
  base: { at: [-14.3, 0.92, 6.4], size: [2.2, 1.3] },
  table: { size: [2.6, 1.7], drop: 0.055 },
  pieces: RLYEH_PIECES,
  rubble: rubble(),
  completeText: 'The city is whole. The Great Door leans out over the painted sea, and the little man at the foot of the stair looks up at it.',
};

/** Every model the API keeps progress for. */
export const MODELS: Record<string, ModelBuild> = { rlyeh: RLYEH_MODEL };
