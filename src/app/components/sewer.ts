import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * The sewer under the derelict house, reached through its back door (see
 * `sewer` in src/lib/walkthrough.ts). Built here rather than in Summer: a
 * brick stairwell straight out of the doorway drops three metres into a
 * vaulted sewer main running across it — a channel of black water down the
 * middle that can be waded, a walkway either side, a plank footbridge — with
 * a collapse at its west end and the outfall grate at its east. A side
 * passage off the far walkway runs to a round cistern with a sump pool and a
 * ladder up to a manhole, and a shaft in its floor with a second ladder down
 * to a shrine of Dagon: a hewn chamber, the god on a plinth at its far end,
 * the chamber flooded to the knee with black brine and bone floating in it.
 * The foot of that ladder is walled off from the god by later brickwork, with
 * an iron-bound door through it, padlocked on the ladder's side.
 *
 * Back under the house, the main's near wall opens on older, lower tunnels:
 * a west and an east branch joined by a cross tunnel beneath the house's
 * front, through a pillared junction chamber; a crawl pipe too low to walk,
 * straight from the main to that chamber; and a spur off the west branch to a
 * dead end where something has made its lair. Together they make a loop to
 * run round, and a pipe only a crouching man fits through.
 *
 * No lights of its own (every light costs every pixel in the level): the
 * investigators' torches light it, helped by a little moonlight from a
 * storm drain and a faint phosphorescence on the cistern pool.
 *
 * `at` is the doorway's outer face, at floor level, with the house behind it
 * along +Z. Positions below are in metres, x across, y up, and d out from the
 * doorway (world z = at.z - d).
 */

export type Sewer = {
  group: THREE.Group;
  /** What blocks and carries the investigators: add to the level's walls. */
  solids: THREE.Object3D[];
  /** Where the investigators can climb: the walkthrough's controller holds them on these. */
  ladders: Ladder[];
  /** Standing water deep enough to wade: the controller slows anyone whose feet are under it. */
  pools: Pool[];
  /** The padlocked door into the shrine. */
  door: ShrineDoor;
  update: (dt: number) => void;
  dispose: () => void;
};

/**
 * A ladder up a shaft, in world coordinates: anyone whose feet stand over
 * its opening (`min`..`max` in x and z) between `bottom` and `top` is on it.
 */
export type Ladder = { min: [number, number]; max: [number, number]; bottom: number; top: number };

/**
 * The door walling the shrine off from the foot of its ladder. `blocking` is
 * its leaf, to stand among the walls while it is shut; `lock` is the padlock
 * and hasp, to examine. `set` swings it, 0 shut … 1 open, and the padlock
 * hangs open on its staple from the moment it starts to move.
 */
export type ShrineDoor = { blocking: THREE.Mesh[]; lock: THREE.Box3; set: (k: number) => void; dispose: () => void };

/** Water over an xz box, in world coordinates, up to `surface`. */
export type Pool = { min: [number, number]; max: [number, number]; surface: number };

// The stairwell.
const W = 0.6;                       // half its inner width
const WALL = 0.3;
const LANDING = 0.95;
const RISE = 0.19, TREAD = 0.25, STEPS = 16;
const FLOOR = -RISE * STEPS;         // the sewer's walkways, -3.04
const STAIR_END = LANDING + TREAD * STEPS;
// The main, across the foot of the stairs.
const T0 = STAIR_END + WALL;         // its near wall's face
const WALK = 0.9, CHANNEL = 1.2;
const T1 = T0 + WALK * 2 + CHANNEL;  // its far wall's face
const TC = (T0 + T1) / 2;
const R = (T1 - T0) / 2;             // the vault
const SPRING = FLOOR + 2.2;          // where the vault springs from the walls
const BED = FLOOR - 0.36;            // the channel's bed: shallow enough to step out of
const WATER = FLOOR - 0.12;
const X0 = -12, X1 = 18;             // west and east ends
const GRATE = 14;                    // the outfall grate
const RUBBLE = 1.5;                  // how far the collapse reaches in from X0
const BRIDGE = [3.0, 3.9];
const SHAFT_X = -5;                  // the storm drain
// The side passage and its cistern.
const B0 = 5.3, B1 = 6.7, BX = (B0 + B1) / 2;
const CR = 2.5;                      // the cistern's radius
const CD = T1 + WALL + 5.45 + CR;    // its centre, out from the doorway
const CNEAR = CD - CR;
const LOW = FLOOR + 2.1;             // a flat ceiling's underside
// The shrine under the cistern, down a shaft in its floor.
const SHAFT = 0.45;                  // half the shaft's opening
const SX = BX - 1.75, SD = CD;       // its centre, west of the sump
const CEIL = FLOOR - 0.45;           // the shrine's ceiling
const DEEP = CEIL - 3.4;             // and its floor, -6.89
const RX0 = -4.6, RX1 = B0 - WALL;   // its west and east walls
const RD0 = SD - SHAFT, RD1 = SD + 4.5; // its near wall (the ladder's) and far wall
const BRINE = DEEP + 0.5;            // the flood in it, knee-deep
const IDOL = [-3.5, SD + 2.0] as const; // where Dagon stands, facing east to the ladder
// The brick wall across the shrine, between the ladder's foot and the god, and its door.
const PW0 = 2.9, PW1 = 3.2;          // its west and east faces
const DD0 = IDOL[1] - 0.5, DD1 = IDOL[1] + 0.5; // the doorway, on the aisle to the altar
const DOOR_H = 2.1;
// The tunnels under the house (see the header): flat-roofed, LOW high, 2·TH wide.
const TH = 0.8;
const U1X = -7, U2X = 10;            // the west and east branches' centre lines
const U3D = -8;                      // the cross tunnel's
const JX0 = -1.5, JX1 = 5.5, JD0 = -11, JD1 = -5; // the junction chamber
const JTOP = FLOOR + 2.8;
const CX = 2, CH = 0.4;              // the crawl pipe's centre line and half-width
const CTOP = FLOOR + 1.15;           // too low to walk upright
const SPUR_D = -2;                   // the spur to the lair, west off the west branch
const LX0 = -17.5, LX1 = -14, LD0 = -4.2, LD1 = 0.2; // the lair

type V3 = [number, number, number];

export function createSewer(at: THREE.Vector3): Sewer {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const tx = <T extends THREE.Texture>(x: T) => { texs.push(x); return x; };

  const group = new THREE.Group();
  group.name = 'Sewer';
  /** Sewer coordinates to world. */
  const P = (x: number, y: number, d: number) => new THREE.Vector3(at.x + x, at.y + y, at.z - d);

  const brickTex = tx(repeatTexture(paintBrick()));
  const stoneTex = tx(repeatTexture(paintStone()));
  const waterTex = tx(repeatTexture(paintWater()));
  const grimeTex = tx(repeatTexture(paintGrime()));
  grimeTex.wrapT = THREE.ClampToEdgeWrapping;

  const brick = m(new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.72, side: THREE.DoubleSide }));
  const stone = m(new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 }));
  const wood = m(new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 }));
  const iron = m(new THREE.MeshStandardMaterial({ color: 0x2b2420, metalness: 0.55, roughness: 0.75 }));
  const water = m(new THREE.MeshStandardMaterial({
    color: 0x16261e, map: waterTex, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  // The cistern's pool glows, faintly, from something living in it.
  const glowWater = m(new THREE.MeshStandardMaterial({
    color: 0x0e2418, map: waterTex, emissive: 0x16573a, emissiveIntensity: 0.65, emissiveMap: waterTex, roughness: 0.1, metalness: 0.2,
    transparent: true, opacity: 0.92, depthWrite: false,
  }));
  const grime = m(new THREE.MeshStandardMaterial({
    map: grimeTex, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  const moonPool = m(new THREE.MeshBasicMaterial({
    color: 0x9fb4d8, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const black = m(new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
  const blocker = m(new THREE.MeshBasicMaterial());

  // Geometry gathered by material, merged into one mesh each at the end.
  const bins = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (mat: THREE.Material, geo: THREE.BufferGeometry) => {
    if (!bins.has(mat)) bins.set(mat, []);
    bins.get(mat)!.push(geo);
  };
  /** A box from corner to corner in sewer coordinates, its texture laid at `tile` metres. */
  const box = (mat: THREE.Material, [x0, y0, d0]: V3, [x1, y1, d1]: V3, tile = 1) => {
    const w = x1 - x0, h = y1 - y0, d = d1 - d0;
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUv(geo, w, h, d, tile);
    geo.translate(at.x + (x0 + x1) / 2, at.y + (y0 + y1) / 2, at.z - (d0 + d1) / 2);
    add(mat, geo);
  };
  const solids: THREE.Object3D[] = [];
  /** An invisible wall: the collapse and the grate are too ragged to walk against. */
  const block = ([x0, y0, d0]: V3, [x1, y1, d1]: V3) => {
    const mesh = new THREE.Mesh(g(new THREE.BoxGeometry(x1 - x0, y1 - y0, d1 - d0)), blocker);
    mesh.position.copy(P((x0 + x1) / 2, (y0 + y1) / 2, (d0 + d1) / 2));
    mesh.visible = false;
    mesh.updateMatrixWorld(true);
    group.add(mesh);
    solids.push(mesh);
  };

  // ── The stairwell ───────────────────────────────────────────────
  box(stone, [-W - WALL, -0.3, 0], [W + WALL, 0, LANDING]);
  box(brick, [-W - WALL, 2.3, 0], [W + WALL, 2.5, LANDING]);
  box(brick, [-W - WALL, FLOOR - 0.3, 0], [-W, 2.6, STAIR_END]);
  box(brick, [W, FLOOR - 0.3, 0], [W + WALL, 2.6, STAIR_END]);
  for (let i = 0; i < STEPS; i++) {
    const top = -(i + 1) * RISE;
    box(stone, [-W, top - 0.25, LANDING + i * TREAD], [W, top, LANDING + (i + 1) * TREAD], 0.5);
  }
  {
    // The ceiling follows the stairs down, 2.4 m over the top step and 2.1 m over the last.
    const from = new THREE.Vector2(LANDING, 2.3), to = new THREE.Vector2(STAIR_END, LOW);
    const len = from.distanceTo(to);
    const tilt = Math.atan2(from.y - to.y, to.x - from.x);
    const geo = new THREE.BoxGeometry(2 * (W + WALL), 0.2, len);
    scaleBoxUv(geo, 2 * (W + WALL), 0.2, len, 1);
    geo.rotateX(-tilt);
    const up = new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
    const mid = P(0, (from.y + to.y) / 2, (from.x + to.x) / 2).addScaledVector(up, 0.1);
    geo.translate(mid.x, mid.y, mid.z);
    add(brick, geo);
  }
  // Through the main's near wall at the foot of the stairs.
  box(stone, [-W, BED - 0.3, STAIR_END - 0.01], [W, FLOOR, T0]);

  /**
   * An opening in a wall, from `a` to `b` along it, `top` high (the wall's
   * full height if left out); the floor runs on through it unless `floor` is false.
   */
  type Gap = { a: number; b: number; top?: number; floor?: boolean };
  /** A brick wall running along x, d0..d1 thick, y0..y1 high, with openings. */
  const wallX = (x0: number, x1: number, d0: number, d1: number, y0: number, y1: number, gaps: Gap[] = []) => {
    let from = x0;
    for (const gap of [...gaps].sort((p, q) => p.a - q.a)) {
      if (gap.a > from) box(brick, [from, y0, d0], [gap.a, y1, d1]);
      if (gap.top !== undefined && gap.top < y1) box(brick, [gap.a, gap.top, d0], [gap.b, y1, d1]);
      if (gap.floor !== false) box(stone, [gap.a, FLOOR - 0.3, d0], [gap.b, FLOOR, d1], 0.5);
      from = gap.b;
    }
    if (x1 > from) box(brick, [from, y0, d0], [x1, y1, d1]);
  };
  /** The same, running along d, x0..x1 thick. */
  const wallD = (d0: number, d1: number, x0: number, x1: number, y0: number, y1: number, gaps: Gap[] = []) => {
    let from = d0;
    for (const gap of [...gaps].sort((p, q) => p.a - q.a)) {
      if (gap.a > from) box(brick, [x0, y0, from], [x1, y1, gap.a]);
      if (gap.top !== undefined && gap.top < y1) box(brick, [x0, gap.top, gap.a], [x1, y1, gap.b]);
      if (gap.floor !== false) box(stone, [x0, FLOOR - 0.3, gap.a], [x1, FLOOR, gap.b], 0.5);
      from = gap.b;
    }
    if (d1 > from) box(brick, [x0, y0, from], [x1, y1, d1]);
  };

  // ── The main ────────────────────────────────────────────────────
  // Its near wall, broken through for the stairs, the two branches and the crawl pipe.
  wallX(X0 - WALL, X1 + WALL, STAIR_END, T0, BED - 0.3, SPRING, [
    { a: -W, b: W, top: LOW, floor: false },
    { a: U1X - TH, b: U1X + TH, top: LOW },
    { a: CX - CH, b: CX + CH, top: CTOP },
    { a: U2X - TH, b: U2X + TH, top: LOW },
  ]);
  box(brick, [X0 - WALL, BED - 0.3, T1], [B0, SPRING, T1 + WALL]);
  box(brick, [B1, BED - 0.3, T1], [X1 + WALL, SPRING, T1 + WALL]);
  box(brick, [B0, LOW, T1], [B1, SPRING, T1 + WALL]);
  box(brick, [X0 - WALL, BED - 0.3, T0], [X0, SPRING, T1]);
  box(brick, [X1, BED - 0.3, T0], [X1 + WALL, SPRING, T1]);
  box(stone, [X0, BED - 0.3, T0], [X1, FLOOR, T0 + WALK], 0.5);
  box(stone, [X0, BED - 0.3, T1 - WALK], [X1, FLOOR, T1], 0.5);
  box(stone, [X0, BED - 0.3, T0 + WALK], [X1, BED, T1 - WALK], 0.5);
  {
    const len = X1 - X0;
    const vault = new THREE.CylinderGeometry(R, R, len, 32, 1, true, 0, Math.PI);
    scaleUv(vault, Math.PI * R, len);
    vault.rotateZ(Math.PI / 2);
    const c = P((X0 + X1) / 2, SPRING, TC);
    vault.translate(c.x, c.y, c.z);
    add(brick, vault);
    for (const x of [X0, X1]) {
      const cap = new THREE.CircleGeometry(R, 24, 0, Math.PI);
      scaleUv(cap, 2 * R, 2 * R);
      cap.rotateY(Math.PI / 2);
      const p = P(x, SPRING, TC);
      cap.translate(p.x, p.y, p.z);
      add(brick, cap);
    }
  }
  // Black water down the channel, flowing east to the outfall.
  {
    const geo = g(new THREE.PlaneGeometry(X1 - X0, T1 - T0 - 2 * WALK).rotateX(-Math.PI / 2));
    scaleUv(geo, (X1 - X0) / 2, (T1 - T0 - 2 * WALK) / 2);
    const mesh = new THREE.Mesh(geo, water);
    mesh.position.copy(P((X0 + X1) / 2, WATER, TC));
    group.add(mesh);
  }
  // Slime up the walls to the old waterline, and down the channel's sides.
  const band = (x0: number, x1: number, y0: number, h: number, d: number, facing: 1 | -1) => {
    const geo = g(new THREE.PlaneGeometry(x1 - x0, h));
    scaleUv(geo, (x1 - x0) / 2, 1);
    const mesh = new THREE.Mesh(geo, grime);
    mesh.position.copy(P((x0 + x1) / 2, y0 + h / 2, d + facing * 0.006));
    if (facing === 1) mesh.rotation.y = Math.PI;
    group.add(mesh);
  };
  for (const [x0, x1] of [[X0, U1X - TH], [U1X + TH, -W], [W, CX - CH], [CX + CH, U2X - TH], [U2X + TH, X1]]) {
    band(x0, x1, FLOOR, 0.75, T0, 1);
  }
  band(X0, B0, FLOOR, 0.75, T1, -1);
  band(B1, X1, FLOOR, 0.75, T1, -1);
  band(X0, X1, BED, FLOOR - BED, T0 + WALK, 1);
  band(X0, X1, BED, FLOOR - BED, T1 - WALK, -1);

  // A plank footbridge over the channel.
  for (let i = 0; i < 5; i++) {
    const x0 = BRIDGE[0] + i * (BRIDGE[1] - BRIDGE[0]) / 5;
    const lift = i % 2 ? 0.006 : -0.004;
    box(wood, [x0, FLOOR + lift, T0 + WALK - 0.18], [x0 + (BRIDGE[1] - BRIDGE[0]) / 5, FLOOR + 0.05 + lift, T1 - WALK + 0.18]);
  }

  // The west end: the vault has come down in a slope of brick and earth.
  {
    const rnd = seeded(7);
    const rubble: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 90; i++) {
      const along = Math.pow(rnd(), 1.6) * (RUBBLE + 0.6);
      const height = (1 - along / (RUBBLE + 0.6)) * 2.4;
      const size = 0.12 + rnd() * 0.3;
      const geo = new THREE.DodecahedronGeometry(size, 0);
      geo.scale(1 + rnd() * 0.6, 0.6 + rnd() * 0.5, 1 + rnd() * 0.4);
      geo.rotateY(rnd() * Math.PI);
      const p = P(X0 + along, BED + rnd() * height, T0 + rnd() * (T1 - T0));
      geo.translate(p.x, p.y, p.z);
      rubble.push(geo);
    }
    const merged = g(mergeGeometries(rubble, false)!);
    rubble.forEach(r => r.dispose());
    group.add(new THREE.Mesh(merged, brick));
    block([X0, BED, T0], [X0 + RUBBLE, SPRING + R, T1]);
  }

  // The east end: the outfall grate, rusted fast, and the dark beyond it.
  {
    const bars: THREE.BufferGeometry[] = [];
    for (let u = -R + 0.08; u <= R - 0.08; u += 0.12) {
      const d = TC + u;
      const bottom = d > T0 + WALK && d < T1 - WALK ? BED : FLOOR;
      const top = SPRING + Math.sqrt(R * R - u * u) - 0.02;
      const geo = new THREE.CylinderGeometry(0.014, 0.014, top - bottom, 6);
      const p = P(GRATE, (top + bottom) / 2, d);
      geo.translate(p.x, p.y, p.z);
      bars.push(geo);
    }
    for (const y of [FLOOR + 0.45, FLOOR + 1.2, FLOOR + 1.95, SPRING + 0.9]) {
      const half = y <= SPRING ? R : Math.sqrt(Math.max(0, R * R - (y - SPRING) ** 2));
      const geo = new THREE.BoxGeometry(0.03, 0.05, 2 * half - 0.04);
      const p = P(GRATE, y, TC);
      geo.translate(p.x, p.y, p.z);
      bars.push(geo);
    }
    const merged = g(mergeGeometries(bars.map(b => b.index ? b.toNonIndexed() : b).map(b => { b.deleteAttribute('uv'); return b; }), false)!);
    bars.forEach(b => b.dispose());
    group.add(new THREE.Mesh(merged, iron));
    block([GRATE - 0.05, BED, T0], [GRATE + 0.05, SPRING + R, T1]);
  }

  // A storm drain in the crown of the vault, letting a little moonlight down onto the water.
  {
    const crown = SPRING + R;
    const slots = new THREE.Mesh(g(new THREE.CircleGeometry(0.28, 20).rotateX(Math.PI / 2)), moonPool);
    slots.position.copy(P(SHAFT_X, crown - 0.03, TC));
    const pool = new THREE.Mesh(g(new THREE.CircleGeometry(0.6, 24).rotateX(-Math.PI / 2)), moonPool);
    pool.position.copy(P(SHAFT_X, WATER + 0.004, TC));
    group.add(slots, pool);
  }

  // ── The tunnels under the house ─────────────────────────────────
  // Each wall, floor and roof is laid once: where two tunnels meet, one of them
  // owns the corner, so no two brick faces ever lie in the same plane.
  const YB = FLOOR - 0.3;
  const floorBox = (x0: number, x1: number, d0: number, d1: number) => box(stone, [x0, YB, d0], [x1, FLOOR, d1], 0.5);
  const roof = (x0: number, x1: number, d0: number, d1: number, y = LOW) => box(brick, [x0, y, d0], [x1, y + 0.25, d1]);
  const [u1w, u1e, u2w, u2e] = [U1X - TH, U1X + TH, U2X - TH, U2X + TH];
  const [u3n, u3s] = [U3D - TH, U3D + TH];   // the cross tunnel's far and near sides (d)
  // The west branch, from the main back under the house to the cross tunnel.
  floorBox(u1w, u1e, u3n, STAIR_END);
  wallD(u3n - WALL, STAIR_END, u1w - WALL, u1w, YB, LOW, [{ a: SPUR_D - TH, b: SPUR_D + TH }]);
  wallD(u3s, STAIR_END, u1e, u1e + WALL, YB, LOW);
  roof(u1w - WALL, u1e + WALL, u3s + WALL, STAIR_END);
  // The east branch, the same.
  floorBox(u2w, u2e, u3n, STAIR_END);
  wallD(u3s, STAIR_END, u2w - WALL, u2w, YB, LOW);
  wallD(u3n, STAIR_END, u2e, u2e + WALL, YB, LOW);
  roof(u2w - WALL, u2e + WALL, u3s + WALL, STAIR_END);
  // The cross tunnel, west of the chamber and east of it; it owns the branches' far corners.
  floorBox(u1e, JX0 - WALL, u3n, u3s);
  wallX(u1w, JX0 - WALL, u3n - WALL, u3n, YB, LOW);
  wallX(u1e + WALL, JX0 - WALL, u3s, u3s + WALL, YB, LOW);
  roof(u1w - WALL, JX0 - WALL, u3n - WALL, u3s + WALL);
  floorBox(JX1 + WALL, u2w, u3n, u3s);
  wallX(JX1 + WALL, u2e + WALL, u3n - WALL, u3n, YB, LOW);
  wallX(JX1 + WALL, u2w - WALL, u3s, u3s + WALL, YB, LOW);
  roof(JX1 + WALL, u2e + WALL, u3n - WALL, u3s + WALL);
  // The junction chamber, higher, four piers holding up its roof.
  floorBox(JX0, JX1, JD0, JD1);
  wallD(JD0 - WALL, JD1 + WALL, JX0 - WALL, JX0, YB, JTOP, [{ a: u3n, b: u3s, top: LOW }]);
  wallD(JD0 - WALL, JD1 + WALL, JX1, JX1 + WALL, YB, JTOP, [{ a: u3n, b: u3s, top: LOW }]);
  wallX(JX0, JX1, JD0 - WALL, JD0, YB, JTOP);
  wallX(JX0, JX1, JD1, JD1 + WALL, YB, JTOP, [{ a: CX - CH, b: CX + CH, top: CTOP }]);
  roof(JX0 - WALL, JX1 + WALL, JD0 - WALL, JD1 + WALL, JTOP);
  for (const px of [JX0 + 1.8, JX1 - 1.8]) {
    for (const pd of [JD0 + 1.2, JD1 - 1.2]) box(brick, [px - 0.25, FLOOR, pd - 0.25], [px + 0.25, JTOP, pd + 0.25]);
  }
  // The crawl pipe, from the chamber's near wall to the main's.
  floorBox(CX - CH, CX + CH, JD1 + WALL, STAIR_END);
  wallD(JD1 + WALL, STAIR_END, CX - CH - WALL, CX - CH, YB, CTOP);
  wallD(JD1 + WALL, STAIR_END, CX + CH, CX + CH + WALL, YB, CTOP);
  roof(CX - CH - WALL, CX + CH + WALL, JD1 + WALL, STAIR_END, CTOP);
  // The spur, and the lair at its end.
  floorBox(LX1 + WALL, u1w - WALL, SPUR_D - TH, SPUR_D + TH);
  wallX(LX1 + WALL, u1w - WALL, SPUR_D - TH - WALL, SPUR_D - TH, YB, LOW);
  wallX(LX1 + WALL, u1w - WALL, SPUR_D + TH, SPUR_D + TH + WALL, YB, LOW);
  roof(LX1 + WALL, u1w - WALL, SPUR_D - TH - WALL, SPUR_D + TH + WALL);
  floorBox(LX0, LX1, LD0, LD1);
  wallD(LD0 - WALL, LD1 + WALL, LX1, LX1 + WALL, YB, LOW + 0.3, [{ a: SPUR_D - TH, b: SPUR_D + TH, top: LOW }]);
  wallD(LD0 - WALL, LD1 + WALL, LX0 - WALL, LX0, YB, LOW + 0.3);
  wallX(LX0, LX1, LD0 - WALL, LD0, YB, LOW + 0.3);
  wallX(LX0, LX1, LD1, LD1 + WALL, YB, LOW + 0.3);
  roof(LX0 - WALL, LX1 + WALL, LD0 - WALL, LD1 + WALL, LOW + 0.3);
  // A runnel of black water down the middle of each tunnel.
  const runnel = (x0: number, x1: number, d0: number, d1: number) => {
    const w = x1 - x0, l = d1 - d0;
    const geo = g(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2));
    scaleUv(geo, w / 2, l / 2);
    const mesh = new THREE.Mesh(geo, water);
    mesh.position.copy(P((x0 + x1) / 2, FLOOR + 0.006, (d0 + d1) / 2));
    group.add(mesh);
  };
  runnel(U1X - 0.18, U1X + 0.18, U3D, STAIR_END);
  runnel(U2X - 0.18, U2X + 0.18, U3D, STAIR_END);
  runnel(U1X + 0.18, U2X - 0.18, U3D - 0.18, U3D + 0.18);
  runnel(LX1, U1X - 0.18, SPUR_D - 0.18, SPUR_D + 0.18);
  // In the lair, a pool of the same glowing brine as the cistern's sump.
  {
    const pool = new THREE.Mesh(g(new THREE.CircleGeometry(0.9, 28).rotateX(-Math.PI / 2)), glowWater);
    pool.position.copy(P(LX0 + 1.2, FLOOR + 0.008, LD0 + 1.2));
    group.add(pool);
  }

  // ── The side passage ────────────────────────────────────────────
  box(stone, [B0, BED - 0.3, T1], [B1, FLOOR, T1 + WALL]);
  box(stone, [B0 - WALL, BED - 0.3, T1 + WALL], [B1 + WALL, FLOOR, CNEAR + 0.12], 0.5);
  box(brick, [B0 - WALL, FLOOR - 0.3, T1 + WALL], [B0, LOW + 0.2, CNEAR + 0.25]);
  box(brick, [B1, FLOOR - 0.3, T1 + WALL], [B1 + WALL, LOW + 0.2, CNEAR + 0.25]);
  box(brick, [B0 - WALL, LOW, T1 + WALL], [B1 + WALL, LOW + 0.2, CNEAR + 0.1]);

  // ── The cistern ─────────────────────────────────────────────────
  {
    const c = P(BX, 0, CD);
    const ringH = 2.6;
    // Open toward the passage (+Z, back toward the house).
    const gap = Math.asin((B1 - B0) / 2 / CR) + 0.01;
    const ring = new THREE.CylinderGeometry(CR, CR, ringH, 40, 1, true, gap, Math.PI * 2 - 2 * gap);
    scaleUv(ring, (Math.PI * 2 - 2 * gap) * CR, ringH);
    ring.translate(c.x, at.y + FLOOR + ringH / 2, c.z);
    add(brick, ring);
    box(brick, [B0, LOW, CNEAR - 0.1], [B1, FLOOR + ringH, CNEAR + 0.2]);
    const dome = new THREE.SphereGeometry(CR, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    scaleUv(dome, Math.PI * 2 * CR, CR * 1.5);
    dome.scale(1, 0.55, 1);
    dome.translate(c.x, at.y + FLOOR + ringH, c.z);
    add(brick, dome);
    // Flagged round the sump, with the shrine's shaft let into it to the west.
    const outline = new THREE.Shape().absarc(0, 0, CR + 0.05, 0, Math.PI * 2, false);
    outline.holes.push(new THREE.Path().absarc(0, 0, 0.95, 0, Math.PI * 2, true));
    const [hu, hv] = [SX - BX, SD - CD];
    outline.holes.push(new THREE.Path().setFromPoints([
      new THREE.Vector2(hu - SHAFT, hv - SHAFT), new THREE.Vector2(hu - SHAFT, hv + SHAFT),
      new THREE.Vector2(hu + SHAFT, hv + SHAFT), new THREE.Vector2(hu + SHAFT, hv - SHAFT),
    ]));
    const floor = new THREE.ShapeGeometry(outline, 40);
    floor.rotateX(-Math.PI / 2);
    floor.translate(c.x, at.y + FLOOR + 0.002, c.z);
    add(stone, floor);
    // The sump: a shallow round pool in the middle.
    const bed = new THREE.CircleGeometry(0.97, 32);
    scaleUv(bed, 2, 2);
    bed.rotateX(-Math.PI / 2);
    bed.translate(c.x, at.y + FLOOR - 0.28, c.z);
    add(stone, bed);
    const rim = new THREE.CylinderGeometry(0.95, 0.95, 0.28, 32, 1, true);
    scaleUv(rim, Math.PI * 1.9, 0.28);
    rim.translate(c.x, at.y + FLOOR - 0.14, c.z);
    add(stone, rim);
    const pool = new THREE.Mesh(g(new THREE.CircleGeometry(0.95, 32).rotateX(-Math.PI / 2)), glowWater);
    pool.position.set(c.x, at.y + FLOOR - 0.1, c.z);
    group.add(pool);
    // An iron ladder up the far wall to a manhole, its cover long gone.
    const ladder: THREE.BufferGeometry[] = [];
    const wallD = CD + CR - 0.1;
    const top = FLOOR + ringH + 0.35;
    for (const dx of [-0.22, 0.22]) {
      const rail = new THREE.BoxGeometry(0.035, top - FLOOR, 0.035);
      const p = P(BX + dx, (FLOOR + top) / 2, wallD);
      rail.translate(p.x, p.y, p.z);
      ladder.push(rail);
    }
    for (let y = FLOOR + 0.3; y < top - 0.1; y += 0.3) {
      const rung = new THREE.CylinderGeometry(0.012, 0.012, 0.44, 6).rotateZ(Math.PI / 2);
      const p = P(BX, y, wallD);
      rung.translate(p.x, p.y, p.z);
      ladder.push(rung);
    }
    const merged = g(mergeGeometries(ladder.map(l => l.index ? l.toNonIndexed() : l).map(l => { l.deleteAttribute('uv'); return l; }), false)!);
    ladder.forEach(l => l.dispose());
    group.add(new THREE.Mesh(merged, iron));
    const hole = new THREE.Mesh(g(new THREE.CircleGeometry(0.34, 20).rotateX(Math.PI / 2)), black);
    hole.position.copy(P(BX, top - 0.02, wallD - 0.25));
    group.add(hole);
  }

  // ── The shrine ──────────────────────────────────────────────────
  // A square shaft down through the cistern's floor, an iron ladder fixed to
  // its near side, into a chamber hewn out under the cistern. No light down
  // here at all but a faint glow off the brine in the offering basin.
  // The bones bob and drift on the flood, each on its own swell: moved in the
  // vertex shader, after its instance matrix, so they all go up and down alike.
  const bones = m(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }));
  const swell = { value: 0 };
  bones.onBeforeCompile = (shader) => {
    shader.uniforms.uSwell = swell;
    shader.vertexShader = 'uniform float uSwell;\n' + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        float ph = dot( instanceMatrix[3].xz, vec2( 1.7, 2.3 ) );
        mvPosition.xyz += vec3( sin( uSwell * 0.23 + ph ) * 0.04, sin( uSwell * 0.9 + ph * 1.3 ) * 0.014, cos( uSwell * 0.19 + ph ) * 0.04 );
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  const rock = m(new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x77716a, roughness: 0.9 }));
  {
    // The shaft's lining, from the shrine's ceiling to just under the flags.
    const top = FLOOR - 0.01, low = CEIL;
    box(brick, [SX - SHAFT - 0.2, low, SD - SHAFT - 0.2], [SX + SHAFT + 0.2, top, SD - SHAFT]);
    box(brick, [SX - SHAFT - 0.2, low, SD + SHAFT], [SX + SHAFT + 0.2, top, SD + SHAFT + 0.2]);
    box(brick, [SX - SHAFT - 0.2, low, SD - SHAFT], [SX - SHAFT, top, SD + SHAFT]);
    box(brick, [SX + SHAFT, low, SD - SHAFT], [SX + SHAFT + 0.2, top, SD + SHAFT]);
    // The chamber: floor, walls, and a ceiling with the shaft let through it.
    box(rock, [RX0 - 0.4, DEEP - 0.3, RD0 - 0.4], [RX1 + 0.4, DEEP, RD1 + 0.4], 1.2);
    box(rock, [RX0 - 0.4, DEEP - 0.3, RD0 - 0.4], [RX1 + 0.4, CEIL + 0.2, RD0], 1.2);
    box(rock, [RX0 - 0.4, DEEP - 0.3, RD1], [RX1 + 0.4, CEIL + 0.2, RD1 + 0.4], 1.2);
    box(rock, [RX0 - 0.4, DEEP - 0.3, RD0], [RX0, CEIL + 0.2, RD1], 1.2);
    box(rock, [RX1, DEEP - 0.3, RD0], [RX1 + 0.4, CEIL + 0.2, RD1], 1.2);
    box(rock, [RX0, CEIL, RD0], [SX - SHAFT, CEIL + 0.2, RD1], 1.2);
    box(rock, [SX + SHAFT, CEIL, RD0], [RX1, CEIL + 0.2, RD1], 1.2);
    box(rock, [SX - SHAFT, CEIL, SD + SHAFT], [SX + SHAFT, CEIL + 0.2, RD1], 1.2);
    // The plinth Dagon stands on, an altar before it, and two squat pillars flanking the way to it.
    const [ix, id] = IDOL;
    box(rock, [ix - 0.9, DEEP, id - 0.9], [ix + 0.9, DEEP + 0.6, id + 0.9], 0.6);
    box(rock, [ix - 1.0, DEEP + 0.6, id - 1.0], [ix + 1.0, DEEP + 0.7, id + 1.0], 0.6);
    box(rock, [ix + 1.4, DEEP, id - 0.55], [ix + 2.1, DEEP + 0.85, id + 0.55], 0.6);
    for (const dd of [-1.6, 1.6]) {
      const pillar = new THREE.CylinderGeometry(0.28, 0.34, CEIL - DEEP, 10);
      scaleUv(pillar, 2, 3);
      const p = P(ix + 2.6, (DEEP + CEIL) / 2, id + dd);
      pillar.translate(p.x, p.y, p.z);
      add(rock, pillar);
    }
    // The flood: black brine to the knee from wall to wall.
    const flood = new THREE.Mesh(g(new THREE.PlaneGeometry(RX1 - RX0, RD1 - RD0).rotateX(-Math.PI / 2)), water);
    scaleUv(flood.geometry, (RX1 - RX0) / 2, (RD1 - RD0) / 2);
    flood.position.copy(P((RX0 + RX1) / 2, BRINE, (RD0 + RD1) / 2));
    group.add(flood);
    // Brine in a basin cut into the altar, glowing like the cistern's sump.
    const basin = new THREE.Mesh(g(new THREE.CircleGeometry(0.24, 24).rotateX(-Math.PI / 2)), glowWater);
    basin.position.copy(P(ix + 1.75, DEEP + 0.855, id));
    group.add(basin);
    // Slime round the foot of the walls, where the sea has come up through the floor.
    const foot = (x0: number, x1: number, d: number, facing: 1 | -1) => {
      const geo = g(new THREE.PlaneGeometry(x1 - x0, 1.1));
      scaleUv(geo, (x1 - x0) / 2, 1);
      const mesh = new THREE.Mesh(geo, grime);
      mesh.position.copy(P((x0 + x1) / 2, DEEP + 0.55, d + facing * 0.006));
      if (facing === 1) mesh.rotation.y = Math.PI;
      group.add(mesh);
    };
    foot(RX0, RX1, RD0, 1);
    foot(RX0, RX1, RD1, -1);

    // The ladder, from the shrine's floor to a handhold above the cistern's flags.
    const ladder: THREE.BufferGeometry[] = [];
    const wallD = RD0 + 0.07;
    const head = FLOOR + 0.75;
    for (const dx of [-0.22, 0.22]) {
      const rail = new THREE.BoxGeometry(0.035, head - DEEP, 0.035);
      const p = P(SX + dx, (DEEP + head) / 2, wallD);
      rail.translate(p.x, p.y, p.z);
      ladder.push(rail);
    }
    for (let y = DEEP + 0.3; y < FLOOR; y += 0.3) {
      const rung = new THREE.CylinderGeometry(0.012, 0.012, 0.44, 6).rotateZ(Math.PI / 2);
      const p = P(SX, y, wallD);
      rung.translate(p.x, p.y, p.z);
      ladder.push(rung);
    }
    const merged = g(mergeGeometries(ladder.map(l => l.index ? l.toNonIndexed() : l).map(l => { l.deleteAttribute('uv'); return l; }), false)!);
    ladder.forEach(l => l.dispose());
    group.add(new THREE.Mesh(merged, iron));

    // The wall: sewer brick, newer than the rock, either side of the doorway and over it.
    box(brick, [PW0, DEEP - 0.3, RD0], [PW1, CEIL + 0.2, DD0]);
    box(brick, [PW0, DEEP - 0.3, DD1], [PW1, CEIL + 0.2, RD1]);
    box(brick, [PW0, DEEP + DOOR_H, DD0], [PW1, CEIL + 0.2, DD1]);
  }
  const door = buildShrineDoor(P, { iron, g, m });
  group.add(door.group);

  const a = P(SX - SHAFT, 0, SD + SHAFT), b = P(SX + SHAFT, 0, SD - SHAFT);
  const ladders: Ladder[] = [{ min: [a.x, a.z], max: [b.x, b.z], bottom: at.y + DEEP, top: at.y + FLOOR }];
  const r0 = P(RX0, 0, RD1), r1 = P(RX1, 0, RD0);
  const pools: Pool[] = [{ min: [r0.x, r0.z], max: [r1.x, r1.z], surface: at.y + BRINE }];

  // The god and the bones come from models of their own, loaded behind the rest.
  let gone = false;
  const loaded: THREE.Object3D[] = [];
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('/props/dagon-statue.glb', (gltf) => {
    if (gone) return;
    const idol = gltf.scene;
    idol.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Green-black stone, sea-worn.
      mat.color.setHex(0x6d7a68);
      mat.roughness = 0.88;
      mat.metalness = 0.05;
      mesh.castShadow = mesh.receiveShadow = true;
    });
    idol.scale.setScalar(1.3);
    // The model faces +X: east, down the chamber to the foot of the ladder.
    idol.position.copy(P(IDOL[0], DEEP + 0.7, IDOL[1]));
    group.add(idol);
    loaded.push(idol);
  });
  loader.load('/props/bones.glb', (gltf) => {
    if (gone) return;
    const kit = new Map<string, THREE.BufferGeometry>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) kit.set(mesh.name, mesh.geometry);
    });
    const field = scatterBones(kit, bones, at);
    group.add(field);
    loaded.push(field);
    // Dry ones, gnawed, heaped in the lair: they lie still.
    const heap = heapBones(kit, m(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })), at);
    group.add(heap);
    loaded.push(heap);
  });

  // Merge each material's pieces into one mesh: one draw call, and one object
  // for every collision ray to test.
  for (const [mat, list] of bins) {
    const merged = g(mergeGeometries(list, false)!);
    list.forEach(x => x.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    mesh.updateMatrixWorld(true);
    group.add(mesh);
    solids.push(mesh);
  }

  return {
    group,
    solids,
    ladders,
    pools,
    door: door.door,
    update(dt) {
      swell.value += dt;
      // The water creeps east toward the grate.
      waterTex.offset.x = (waterTex.offset.x - dt * 0.03) % 1;
    },
    dispose() {
      gone = true;
      for (const o of loaded) {
        o.traverse((x) => {
          const mesh = x as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          for (const mat of ([] as THREE.Material[]).concat(mesh.material)) {
            (mat as THREE.MeshStandardMaterial).map?.dispose();
            mat.dispose();
          }
        });
      }
      geos.forEach(x => x.dispose());
      mats.forEach(x => x.dispose());
      texs.forEach(x => x.dispose());
      group.removeFromParent();
    },
  };
}

// ── The bones ─────────────────────────────────────────────────────

/** How many of each piece of the kit (public/props/bones.glb) lie on the shrine's floor. */
const BONE_MIX: Record<string, number> = {
  skull: 70, jaw: 45, femur: 110, tibia: 95, fibula: 80, humerus: 95, radius: 80, ulna: 80,
  hip: 50, sacrum: 34, rib_a: 230, rib_b: 230, rib_c: 230, clavicle: 60, scapula: 45, sternum: 20,
};

/**
 * Human bone afloat over the whole of the shrine's flood, packed against the
 * walls and round the foot of the plinth, thinner down the middle where the
 * faithful waded to the altar. One instanced mesh per piece of the kit. The kit's
 * pieces lie long along X with their thinnest side up; the skull sits upright,
 * face to +Z.
 */
function scatterBones(kit: Map<string, THREE.BufferGeometry>, mat: THREE.Material, at: THREE.Vector3) {
  const field = new THREE.Group();
  field.name = 'ShrineBones';
  const rnd = seeded(1931);
  // How high the heap already stands, on a 10 cm grid.
  const cell = 0.1;
  const cols = Math.ceil((RX1 - RX0) / cell), rows = Math.ceil((RD1 - RD0) / cell);
  const heap = new Float32Array(cols * rows);
  const [ix, id] = IDOL;
  const keepOut = (x: number, d: number) =>
    (x > ix - 0.95 && x < ix + 0.95 && d > id - 0.95 && d < id + 0.95) ||       // the plinth
    (x > ix + 1.35 && x < ix + 2.15 && d > id - 0.6 && d < id + 0.6) ||         // the altar
    [-1.6, 1.6].some(dd => Math.hypot(x - ix - 2.6, d - id - dd) < 0.4) ||      // the pillars
    (x > PW0 - 0.12 && x < PW1 + 0.12) ||                                       // the wall
    (x > PW0 - 1.1 && x < PW0 && d > DD0 && d < DD1 + 0.1);                     // the door's swing
  // Deeper by the walls and the plinth than down the aisle.
  const depth = (x: number, d: number) => {
    const wall = Math.min(x - RX0, RX1 - x, d - RD0, RD1 - d);
    const plinth = Math.hypot(Math.max(0, Math.abs(x - ix) - 0.9), Math.max(0, Math.abs(d - id) - 0.9));
    const aisle = Math.abs(d - id) < 0.7 && x > ix + 2 ? 0.7 : 1;
    return aisle * (0.6 + 0.4 * Math.max(0, 1 - Math.min(wall, plinth * 1.4) / 1.2));
  };
  const color = new THREE.Color();
  const ivory = new THREE.Color(0xcbbf9f), brown = new THREE.Color(0x5e4c33), green = new THREE.Color(0x4f5a43);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';

  for (const [name, count] of Object.entries(BONE_MIX)) {
    const geo = kit.get(name);
    if (!geo) continue;
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new THREE.Vector3());
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    // Too many to cast shadows cheaply: they only take them.
    mesh.receiveShadow = true;
    let n = 0;
    for (let tries = 0; n < count && tries < count * 30; tries++) {
      const x = RX0 + 0.12 + rnd() * (RX1 - RX0 - 0.24);
      const d = RD0 + 0.12 + rnd() * (RD1 - RD0 - 0.24);
      if (keepOut(x, d) || rnd() > depth(x, d)) continue;
      const c = Math.min(cols - 1, Math.floor((x - RX0) / cell)) + cols * Math.min(rows - 1, Math.floor((d - RD0) / cell));
      const yaw = rnd() * Math.PI * 2;
      let lift: number;
      if (name === 'skull') {
        // Most sit on their jaws; some have rolled onto a side or face down.
        const roll = rnd() < 0.55 ? (rnd() - 0.5) * 0.4 : (rnd() < 0.5 ? 1 : -1) * (0.9 + rnd() * 0.7);
        dummy.rotation.set((rnd() - 0.5) * 0.5, yaw, roll);
        lift = Math.abs(roll) > 0.6 ? size.x / 2 : size.y / 2;
      } else {
        dummy.rotation.set((rnd() - 0.5) * 0.7, yaw, (rnd() - 0.5) * 0.25);
        lift = size.y / 2 + Math.sin(Math.abs(dummy.rotation.z)) * size.x * 0.15;
      }
      // Afloat, mostly under, rafted a little higher where they have drifted together.
      dummy.position.set(at.x + x, at.y + BRINE + heap[c] * 0.35 + lift * (0.3 - rnd() * 0.5), at.z - d);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      // Old bone, browned, and green with weed where it rides lowest.
      const t = rnd();
      color.copy(ivory).lerp(brown, t * 0.7).lerp(green, heap[c] < 0.05 ? 0.25 : 0);
      mesh.setColorAt(n, color);
      heap[c] = Math.min(0.12, heap[c] + size.y * 0.5);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    field.add(mesh);
  }
  return field;
}

/**
 * A lair's leavings: a few dozen bones dragged in and dropped against the
 * walls of the dead end, the skulls among them, thickest in the far corners.
 */
function heapBones(kit: Map<string, THREE.BufferGeometry>, mat: THREE.Material, at: THREE.Vector3) {
  const heap = new THREE.Group();
  heap.name = 'LairBones';
  const rnd = seeded(66);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const color = new THREE.Color();
  const ivory = new THREE.Color(0xbdb08e), brown = new THREE.Color(0x4a3a26);
  const MIX: Record<string, number> = { skull: 9, jaw: 6, femur: 14, tibia: 12, humerus: 12, hip: 6, rib_a: 20, rib_b: 20, scapula: 6 };
  for (const [name, count] of Object.entries(MIX)) {
    const geo = kit.get(name);
    if (!geo) continue;
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new THREE.Vector3());
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.receiveShadow = true;
    for (let n = 0; n < count; n++) {
      // Toward the walls: pick a spot, then push it out to the nearer side.
      let x = LX0 + 0.25 + rnd() * (LX1 - LX0 - 0.5);
      let d = LD0 + 0.25 + rnd() * (LD1 - LD0 - 0.5);
      const pull = Math.pow(rnd(), 0.5);
      if (rnd() < 0.5) x = x < (LX0 + LX1) / 2 ? LX0 + 0.2 + (x - LX0) * (1 - pull) : x;
      else d = d < (LD0 + LD1) / 2 ? LD0 + 0.2 + (d - LD0) * (1 - pull) : LD1 - 0.2 - (LD1 - d) * (1 - pull);
      dummy.rotation.set(name === 'skull' ? (rnd() - 0.5) * 0.6 : Math.PI / 2 * (rnd() < 0.5 ? 0 : 1) * 0.15, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.4);
      dummy.position.set(at.x + x, at.y + FLOOR + size.y / 2 * 0.8 + rnd() * 0.05, at.z - d);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, color.copy(ivory).lerp(brown, rnd() * 0.8));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    heap.add(mesh);
  }
  return heap;
}

// ── The shrine door ───────────────────────────────────────────────

/**
 * An iron-bound plank door in the brick wall, hung on its near jamb (DD0) and
 * opening west, into the shrine. A hasp on its free edge folds over a staple
 * in the brickwork, on the ladder's side, and a combination padlock — iron,
 * a brass dial on its face — hangs through the staple.
 */
function buildShrineDoor(
  P: (x: number, y: number, d: number) => THREE.Vector3,
  { iron, g, m }: {
    iron: THREE.Material;
    g: <T extends THREE.BufferGeometry>(x: T) => T; m: <T extends THREE.Material>(x: T) => T;
  },
) {
  const group = new THREE.Group();
  group.name = 'ShrineDoor';
  const brass = m(new THREE.MeshStandardMaterial({ color: 0x8a6a32, metalness: 0.7, roughness: 0.45 }));
  // Its planks soaked black with brine.
  const planks = m(new THREE.MeshStandardMaterial({ color: 0x1e150d, roughness: 0.7 }));
  // The door's own frame: the hinge's line, at the doorway's near side, mid-wall.
  const hinge = new THREE.Group();
  hinge.position.copy(P((PW0 + PW1) / 2, DEEP, DD0 + 0.02));
  group.add(hinge);
  // Its parts in the hinge's frame: across the doorway is -Z (sewer d grows away from the house).
  const W = DD1 - DD0 - 0.04, T = 0.08, H = DOOR_H - 0.02;
  const part = (mat: THREE.Material, [sx, sy, sz]: V3, [x, y, z]: V3) => {
    const mesh = new THREE.Mesh(g(new THREE.BoxGeometry(sx, sy, sz)), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    hinge.add(mesh);
    return mesh;
  };
  const leaf = part(planks, [T, H, W], [0, H / 2, -W / 2]);
  // Three iron straps across both faces, with a strap hinge at the jamb end.
  const straps: THREE.Mesh[] = [];
  for (const y of [0.25, H / 2, H - 0.25]) {
    for (const side of [-1, 1]) straps.push(part(iron, [0.012, 0.07, W - 0.04], [side * (T / 2 + 0.006), y, -W / 2]));
  }
  // The hasp, on the ladder (east) face at the free edge, folded over the staple.
  const LOCK_Y = 1.05;
  part(iron, [0.012, 0.05, 0.22], [T / 2 + 0.008, LOCK_Y, -W + 0.06]);

  // The staple, set in the brick past the door's edge, and the padlock through it.
  const face = PW1 + 0.004;
  const staple = new THREE.Mesh(g(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI)), iron);
  staple.rotation.set(0, Math.PI / 2, Math.PI / 2);
  staple.position.copy(P(face + 0.01, DEEP + LOCK_Y, DD1 + 0.05));
  group.add(staple);
  const padlock = new THREE.Group();
  padlock.position.copy(P(face + 0.03, DEEP + LOCK_Y - 0.06, DD1 + 0.05));
  const body = new THREE.Mesh(g(new THREE.BoxGeometry(0.032, 0.075, 0.068)), iron);
  const dial = new THREE.Mesh(g(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 20).rotateZ(Math.PI / 2)), brass);
  dial.position.x = 0.02;
  const shackle = new THREE.Mesh(g(new THREE.TorusGeometry(0.022, 0.0045, 6, 14, Math.PI)), brass);
  shackle.rotation.y = Math.PI / 2;
  shackle.position.y = 0.0375;
  padlock.add(body, dial, shackle);
  padlock.traverse(o => { o.castShadow = true; });
  group.add(padlock);

  group.updateMatrixWorld(true);
  const lock = new THREE.Box3().setFromObject(padlock).union(new THREE.Box3().setFromObject(staple)).expandByScalar(0.12);
  return {
    group,
    door: {
      blocking: [leaf, ...straps],
      lock,
      set(k: number) {
        // Eased, like the house's doors: slow away, settling.
        hinge.rotation.y = (Math.PI / 2) * (k * k * (3 - 2 * k));
        hinge.updateMatrixWorld(true);
        // Open, the shackle stands up out of the body and turns aside.
        shackle.position.y = k > 0 ? 0.06 : 0.0375;
        shackle.rotation.x = k > 0 ? 0.9 : 0;
        padlock.rotation.y = k > 0 ? 0.35 : 0;
      },
      dispose() { group.removeFromParent(); },
    } satisfies ShrineDoor,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

/** BoxGeometry's faces each run 0..1; lay its texture at `tile` metres instead. */
function scaleBoxUv(geo: THREE.BoxGeometry, w: number, h: number, d: number, tile: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Faces in order +x, -x, +y, -y, +z, -z, four vertices each.
  const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  uv.needsUpdate = true;
}

function scaleUv(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function repeatTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

/** A metre of old sewer brick: soot-dark, uneven, streaked where water has run down it. */
function paintBrick() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const rnd = seeded(31);
  ctx.fillStyle = '#1b1915';
  ctx.fillRect(0, 0, S, S);
  const rows = 12, perRow = 4;
  const rh = S / rows, bw = S / perRow, mortar = 3;
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? bw / 2 : 0;
    for (let b = -1; b < perRow; b++) {
      const x = b * bw + shift;
      const l = 14 + rnd() * 12, s = 22 + rnd() * 16, h = 10 + rnd() * 16;
      ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`;
      ctx.fillRect(x + mortar, r * rh + mortar, bw - mortar * 2, rh - mortar * 2);
      // Pitting and soot.
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.18})`;
        ctx.fillRect(x + mortar + rnd() * (bw - 8), r * rh + mortar + rnd() * (rh - 8), 2 + rnd() * 5, 1 + rnd() * 3);
      }
    }
  }
  // Wet streaks running down.
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, w = 6 + rnd() * 22;
    const grad = ctx.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3 + rnd() * 0.4, `rgba(5,10,6,${0.25 + rnd() * 0.25})`);
    grad.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, S);
  }
  return c;
}

/** Worn stone flags, dark with damp. */
function paintStone() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const rnd = seeded(53);
  ctx.fillStyle = '#121110';
  ctx.fillRect(0, 0, S, S);
  const n = 4, cell = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const l = 13 + rnd() * 9;
      ctx.fillStyle = `hsl(${30 + rnd() * 20}, ${6 + rnd() * 8}%, ${l}%)`;
      ctx.fillRect(i * cell + 3, j * cell + 3, cell - 6, cell - 6);
      for (let k = 0; k < 40; k++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '60,70,55'},${0.06 + rnd() * 0.12})`;
        ctx.beginPath();
        ctx.arc(i * cell + rnd() * cell, j * cell + rnd() * cell, 2 + rnd() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return c;
}

/** Slow ripples and scum on black water. */
function paintWater() {
  const S = 256;
  const [c, ctx] = canvas(S);
  const rnd = seeded(97);
  ctx.fillStyle = '#5a6a60';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 26;
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '20,30,24' : '140,160,130'},${0.05 + rnd() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Green-black slime, thick at the foot and fraying upward. */
function paintGrime() {
  const S = 256;
  const [c, ctx] = canvas(S);
  const rnd = seeded(13);
  for (let x = 0; x < S; x += 2) {
    const reach = S * (0.35 + rnd() * 0.5);
    const grad = ctx.createLinearGradient(0, S, 0, S - reach);
    grad.addColorStop(0, 'rgba(14,26,12,0.92)');
    grad.addColorStop(0.6, 'rgba(18,32,14,0.55)');
    grad.addColorStop(1, 'rgba(18,32,14,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, S - reach, 2, reach);
  }
  return c;
}
