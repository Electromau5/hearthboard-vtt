import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The sewer under the derelict house, reached through its back door (see
 * `sewer` in src/lib/walkthrough.ts). Built here rather than in Summer: a
 * brick stairwell straight out of the doorway drops three metres into a
 * vaulted sewer main running across it — a channel of black water down the
 * middle that can be waded, a walkway either side, a plank footbridge — with
 * a collapse at its west end and the outfall grate at its east. A side
 * passage off the far walkway runs to a round cistern with a sump pool and a
 * ladder up to a manhole.
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
  update: (dt: number) => void;
  dispose: () => void;
};

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

  // ── The main ────────────────────────────────────────────────────
  box(brick, [X0 - WALL, BED - 0.3, STAIR_END], [-W, SPRING, T0]);
  box(brick, [W, BED - 0.3, STAIR_END], [X1 + WALL, SPRING, T0]);
  box(brick, [-W, LOW, STAIR_END], [W, SPRING, T0]);
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
  band(X0, -W, FLOOR, 0.75, T0, 1);
  band(W, X1, FLOOR, 0.75, T0, 1);
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
    const floor = new THREE.RingGeometry(0.95, CR + 0.05, 40, 2);
    scaleUv(floor, 2 * CR, 2 * CR);
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
    update(dt) {
      // The water creeps east toward the grate.
      waterTex.offset.x = (waterTex.offset.x - dt * 0.03) % 1;
    },
    dispose() {
      geos.forEach(x => x.dispose());
      mats.forEach(x => x.dispose());
      texs.forEach(x => x.dispose());
      group.removeFromParent();
    },
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
