import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Pool } from './sewer';

/**
 * The inner sanctums off the shrine of Dagon (see sewer.ts). Two passages
 * leave the god's side of the shrine's brick wall, one through its near wall
 * and one through its far, each climbing three steps up out of the brine to a
 * dry chamber hewn deeper into the rock:
 *
 * - to the north, the Black Goat: Shub-Niggurath on a plinth, roots hanging
 *   from the roof as if the woods had come underground, sigils and smeared
 *   hands in dried blood on every wall, a ring of skulls, black candles;
 * - to the south, Bokrug, the great water-lizard of Ib, whose idols were sea-
 *   green stone: verdigris glyphs of the doom of Sarnath on the walls, a pale
 *   phosphorescent circle on the floor, a basin of glowing brine, and candles
 *   burning green. Its head turns, stone on stone, to follow whoever comes in;
 *   the rest of it never moves.
 *
 * No lights of their own (see sewer.ts): the candle flames glow but light
 * nothing, and the torch does the rest. Everything solid goes through `box`,
 * so it joins the sewer's merged solids.
 */

type V3 = [number, number, number];

/** What the sewer hands over: its coordinates, builders, materials and the shrine's measures. */
export type SanctumKit = {
  at: THREE.Vector3;
  P: (x: number, y: number, d: number) => THREE.Vector3;
  box: (mat: THREE.Material, a: V3, b: V3, tile?: number) => void;
  group: THREE.Group;
  g: <T extends THREE.BufferGeometry>(x: T) => T;
  m: <T extends THREE.Material>(x: T) => T;
  tx: <T extends THREE.Texture>(x: T) => T;
  rock: THREE.Material;
  water: THREE.Material;
  glowWater: THREE.Material;
  /** The shrine's floor and its flood's surface. */
  deep: number;
  brine: number;
  /** Its near and far walls' inner faces, where the two passages leave it. */
  near: number;
  far: number;
  /** Both passages' sides (x) and the roof over them. */
  ox0: number;
  ox1: number;
  passTop: number;
};

export type Sanctums = {
  pools: Pool[];
  /** Places the skulls once the bone kit (public/props/bones.glb) is in. */
  withBones: (kit: Map<string, THREE.BufferGeometry>) => void;
  /** Loads the statues; `keep` collects what must be disposed of. */
  load: (loader: GLTFLoader, keep: (o: THREE.Object3D) => void, gone: () => boolean) => void;
  /** Candles flicker; Bokrug watches `eye` (world). */
  update: (dt: number, eye: THREE.Vector3 | null) => void;
};

/** Where Bokrug's head was cut from it, in the model's own metres (measured in the Blender build). */
const BOKRUG_NECK: V3 = [0.1024, 1.8259, 0.2809];
/** Which way its snout points at rest, from the neck: turned a little to its left, raised. */
const BOKRUG_GAZE = { yaw: -0.58, pitch: 0.53 };

export function buildSanctums(k: SanctumKit): Sanctums {
  const { P, box, group, g, m, tx, rock, deep, brine, near, far, ox0, ox1, passTop } = k;
  const RISE = 0.2, TREAD = 0.3;
  const SF = deep + 3 * RISE;              // the sanctums' floor, dry above the brine
  const H = 3.4;                           // their height
  const RX0 = -5.5, RX1 = 1.5;             // both rooms' west and east walls
  const MX = (ox0 + ox1) / 2;              // the passages' centre line, and the rooms' aisle
  const W = 0.4;                           // rock wall thickness
  const pools: Pool[] = [];

  // ── Materials ───────────────────────────────────────────────────
  const decal = (c: HTMLCanvasElement, emissive?: number, glow = 0) => {
    const map = tx(new THREE.CanvasTexture(c));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return m(new THREE.MeshStandardMaterial({
      map, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2,
      ...(emissive !== undefined ? { emissive, emissiveMap: map, emissiveIntensity: glow } : {}),
    }));
  };
  const blackStone = m(new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.85 }));
  const greenStone = m(new THREE.MeshStandardMaterial({ color: 0x41594f, roughness: 0.8 }));

  /** A plane flat against a wall (`facing` the way into the room along x or d), or on the floor. */
  const panel = (mat: THREE.Material, w: number, h: number, pos: THREE.Vector3, rotY: number, flat = false) => {
    const mesh = new THREE.Mesh(g(new THREE.PlaneGeometry(w, h)), mat);
    mesh.position.copy(pos);
    if (flat) mesh.rotation.set(-Math.PI / 2, 0, rotY);
    else mesh.rotation.y = rotY;
    group.add(mesh);
    return mesh;
  };

  // ── Passages ────────────────────────────────────────────────────
  // From the shrine's wall face (`from`) out to the room's (`to`); `dir` is +1 going out along d.
  const passage = (from: number, to: number) => {
    const dir = Math.sign(to - from);
    // Its sides and roof between the two walls (their own ends line the way through them):
    // no face may lie in another's plane, or they flicker.
    const a0 = from + dir * W, a1 = to - dir * W;
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    box(rock, [ox0 - W, deep - 0.3, lo], [ox0, passTop + 0.2, hi], 1.2);
    box(rock, [ox1, deep - 0.3, lo], [ox1 + W, passTop + 0.2, hi], 1.2);
    box(rock, [ox0, passTop, lo], [ox1, passTop + 0.2, hi], 1.2);
    // Three steps up out of the flood, then level to where the room's floor takes over.
    for (let i = 0; i < 3; i++) {
      const a = from + dir * i * TREAD, b = i === 2 ? a1 : from + dir * (i + 1) * TREAD;
      box(rock, [ox0, deep - 0.3, Math.min(a, b)], [ox1, deep + (i + 1) * RISE, Math.max(a, b)], 0.5);
    }
    // The brine laps over the first two.
    const wet = 2 * TREAD;
    const flood = new THREE.Mesh(g(new THREE.PlaneGeometry(ox1 - ox0, wet).rotateX(-Math.PI / 2)), k.water);
    flood.position.copy(P(MX, brine, from + dir * wet / 2));
    group.add(flood);
    const p0 = P(ox0, 0, from), p1 = P(ox1, 0, from + dir * wet);
    pools.push({ min: [Math.min(p0.x, p1.x), Math.min(p0.z, p1.z)], max: [Math.max(p0.x, p1.x), Math.max(p0.z, p1.z)], surface: k.at.y + brine });
  };

  /** A hewn room from d0 to d1 with its way in on the `door` side (a d), the gap ox0..ox1 wide. */
  const room = (d0: number, d1: number, door: number) => {
    box(rock, [RX0 - W, SF - 0.3, d0 - W], [RX1 + W, SF, d1 + W], 1.2);
    box(rock, [RX0 - W, SF + H, d0 - W], [RX1 + W, SF + H + 0.25, d1 + W], 1.2);
    box(rock, [RX0 - W, SF - 0.3, d0], [RX0, SF + H, d1], 1.2);
    box(rock, [RX1, SF - 0.3, d0], [RX1 + W, SF + H, d1], 1.2);
    for (const [d, out] of [[d0, d0 - W], [d1, d1 + W]] as const) {
      const [lo, hi] = [Math.min(d, out), Math.max(d, out)];
      if (d !== door) { box(rock, [RX0, SF - 0.3, lo], [RX1, SF + H, hi], 1.2); continue; }
      box(rock, [RX0, SF - 0.3, lo], [ox0, SF + H, hi], 1.2);
      box(rock, [ox1, SF - 0.3, lo], [RX1, SF + H, hi], 1.2);
      box(rock, [ox0, passTop, lo], [ox1, SF + H, hi], 1.2);
    }
  };

  /** Painted walls: one panel a wall, the way in left bare round its gap. */
  const paintWalls = (d0: number, d1: number, door: number, paint: (seed: number, w: number) => HTMLCanvasElement) => {
    const h = 2.6, y = SF + 0.25 + h / 2;
    const wd = d1 - d0, wx = RX1 - RX0;
    // West and east walls, facing in.
    panel(decal(paint(1, wd)), wd - 0.2, h, P(RX0 + 0.012, y, (d0 + d1) / 2), Math.PI / 2);
    panel(decal(paint(2, wd)), wd - 0.2, h, P(RX1 - 0.012, y, (d0 + d1) / 2), -Math.PI / 2);
    // The end walls; the one with the way in, either side of it.
    for (const [d, rot, seed] of [[d0, Math.PI, 3], [d1, 0, 4]] as const) {
      const inward = d === d0 ? 0.012 : -0.012;
      if (d !== door) { panel(decal(paint(seed, wx)), wx - 0.2, h, P((RX0 + RX1) / 2, y, d + inward), rot); continue; }
      const left = ox0 - RX0 - 0.15, right = RX1 - ox1 - 0.15;
      panel(decal(paint(seed, left)), left, h, P(RX0 + 0.05 + left / 2, y, d + inward), rot);
      panel(decal(paint(seed + 10, right)), right, h, P(ox1 + 0.1 + right / 2, y, d + inward), rot);
    }
  };

  // ── Candles ─────────────────────────────────────────────────────
  // Wax as one instanced mesh a room; the flames as one set of points, each
  // with its own size and flicker, drawn over everything dim around them.
  const flames: { mat: THREE.ShaderMaterial }[] = [];
  const candles = (spots: [number, number, number][], wax: number, flame: THREE.Color, seed: number) => {
    const rnd = rng(seed);
    const geo = g(new THREE.CylinderGeometry(0.022, 0.026, 1, 8).translate(0, 0.5, 0));
    const mesh = new THREE.InstancedMesh(geo, m(new THREE.MeshStandardMaterial({ color: wax, roughness: 0.6 })), spots.length);
    const pos: number[] = [], size: number[] = [], phase: number[] = [];
    const dummy = new THREE.Object3D();
    spots.forEach(([x, y, d], i) => {
      const tall = 0.06 + rnd() * 0.26;
      dummy.position.copy(P(x, y, d));
      dummy.scale.set(1 + rnd() * 0.5, tall, 1 + rnd() * 0.5);
      dummy.rotation.set((rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const top = P(x, y + tall + 0.035, d);
      pos.push(top.x, top.y, top.z);
      size.push(0.07 + rnd() * 0.04);
      phase.push(rnd() * 100);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    const pts = g(new THREE.BufferGeometry());
    pts.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pts.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    pts.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const mat = m(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: flame }, uScale: { value: 600 } },
      vertexShader: `
        attribute float size; attribute float phase;
        uniform float uTime; uniform float uScale;
        varying float vFlick;
        void main() {
          float f = 0.8 + 0.12 * sin(uTime * 9.0 + phase) + 0.08 * sin(uTime * 23.0 + phase * 1.7);
          vFlick = f;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * f * uScale / -mv.z;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vFlick;
        void main() {
          // A teardrop: narrow and bright at the wick, a soft halo round it.
          vec2 c = gl_PointCoord - vec2(0.5, 0.62);
          c.x *= 1.0 + max(0.0, -c.y) * 2.4;
          float core = smoothstep(0.16, 0.0, length(c * vec2(1.7, 1.0)));
          float halo = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * 0.35;
          vec3 col = mix(uColor, vec3(1.0, 0.95, 0.8), core * 0.7);
          gl_FragColor = vec4(col * (core + halo) * vFlick, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const points = new THREE.Points(pts, mat);
    points.frustumCulled = false;
    group.add(points);
    flames.push({ mat });
  };

  /** Candle spots: a cluster round (x, d) on the floor (or a top at `y`), `n` of them within `r`. */
  const cluster = (out: [number, number, number][], x: number, d: number, n: number, r: number, y: number, rnd: () => number) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r;
      out.push([x + Math.cos(a) * rr, y, d + Math.sin(a) * rr]);
    }
  };

  // ── The Black Goat, north ───────────────────────────────────────
  const N0 = near - 7.4, N1 = near - 3.0;  // the room, d (8.65 … 13.05)
  passage(near, N1);
  room(N0, N1, N1);
  paintWalls(N0, N1, N1, (seed, w) => paintGoatWall(seed, w));
  const goat = { x: MX, d: N0 + 1.0 };
  box(blackStone, [goat.x - 0.85, SF, goat.d - 0.7], [goat.x + 0.85, SF + 0.35, goat.d + 0.7], 0.6);
  box(blackStone, [goat.x - 0.95, SF + 0.35, goat.d - 0.8], [goat.x + 0.95, SF + 0.42, goat.d + 0.8], 0.6);
  // The altar before her, a slab on two blocks, black with old blood.
  const goatAltar = goat.d + 1.75;
  box(blackStone, [goat.x - 0.75, SF, goatAltar - 0.3], [goat.x - 0.45, SF + 0.8, goatAltar + 0.3], 0.6);
  box(blackStone, [goat.x + 0.45, SF, goatAltar - 0.3], [goat.x + 0.75, SF + 0.8, goatAltar + 0.3], 0.6);
  box(blackStone, [goat.x - 0.85, SF + 0.8, goatAltar - 0.38], [goat.x + 0.85, SF + 0.92, goatAltar + 0.38], 0.6);
  panel(decal(paintStain(31)), 1.5, 0.66, P(goat.x, SF + 0.925, goatAltar), 0, true);
  // Her circle, in blood, round the plinth and the altar.
  panel(decal(paintCircle('goat')), 3.6, 3.6, P(goat.x, SF + 0.006, goat.d + 1.2), 0, true);
  {
    const rnd = rng(41), spots: [number, number, number][] = [];
    cluster(spots, goat.x - 1.1, goat.d + 0.1, 7, 0.3, SF, rnd);
    cluster(spots, goat.x + 1.1, goat.d + 0.1, 7, 0.3, SF, rnd);
    cluster(spots, goat.x, goatAltar, 6, 0.32, SF + 0.92, rnd);
    for (const x of [RX0 + 0.3, RX1 - 0.3]) for (const d of [N0 + 0.4, N1 - 0.5]) cluster(spots, x, d, 5, 0.22, SF, rnd);
    candles(spots, 0x141210, new THREE.Color(1.0, 0.55, 0.2), 42);
  }
  // Roots hanging through the roof, as if her woods had grown down into the rock.
  {
    const rnd = rng(43);
    const bark = m(new THREE.MeshStandardMaterial({ color: 0x2b2117, roughness: 0.95 }));
    const tubes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 34; i++) {
      const x = RX0 + 0.3 + rnd() * (RX1 - RX0 - 0.6), d = N0 + 0.3 + rnd() * (N1 - N0 - 0.6);
      if (Math.abs(x - goat.x) < 1.1 && Math.abs(d - goat.d) < 1.0) continue;   // clear of her antlers
      const len = 0.5 + rnd() * 1.6;
      const pts: THREE.Vector3[] = [];
      let px = x, pd = d;
      for (let j = 0; j <= 5; j++) {
        pts.push(P(px, SF + H - (len * j) / 5, pd));
        px += (rnd() - 0.5) * 0.18; pd += (rnd() - 0.5) * 0.18;
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.015 + rnd() * 0.03, 5, false);
      // Tapering to a point.
      const p = tube.attributes.position as THREE.BufferAttribute;
      const c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const centre = tube.parameters.path.getPointAt(t, c);
        for (let r = 0; r <= 5; r++) {
          const i = s * 6 + r;
          v.fromBufferAttribute(p, i).sub(centre).multiplyScalar(1 - t * 0.85).add(centre);
          p.setXYZ(i, v.x, v.y, v.z);
        }
      }
      tube.deleteAttribute('uv');
      tubes.push(tube);
    }
    const merged = g(mergeAll(tubes));
    group.add(new THREE.Mesh(merged, bark));
  }

  // ── Bokrug, south ───────────────────────────────────────────────
  const S0 = far + 3.0, S1 = far + 8.5;    // the room, d (24 … 29.5)
  passage(far, S0);
  room(S0, S1, S0);
  paintWalls(S0, S1, S0, (seed, w) => paintLizardWall(seed, w));
  const lizard = { x: MX, d: S1 - 1.0 };
  box(greenStone, [lizard.x - 0.8, SF, lizard.d - 0.75], [lizard.x + 0.8, SF + 0.4, lizard.d + 0.75], 0.6);
  box(greenStone, [lizard.x - 0.9, SF + 0.4, lizard.d - 0.85], [lizard.x + 0.9, SF + 0.48, lizard.d + 0.85], 0.6);
  // A basin of brine before him, glowing like the cistern's sump, in a low stone kerb.
  const basinD = lizard.d - 1.9;
  box(greenStone, [lizard.x - 0.75, SF, basinD - 0.55], [lizard.x + 0.75, SF + 0.22, basinD - 0.45], 0.5);
  box(greenStone, [lizard.x - 0.75, SF, basinD + 0.45], [lizard.x + 0.75, SF + 0.22, basinD + 0.55], 0.5);
  box(greenStone, [lizard.x - 0.75, SF, basinD - 0.45], [lizard.x - 0.65, SF + 0.22, basinD + 0.45], 0.5);
  box(greenStone, [lizard.x + 0.65, SF, basinD - 0.45], [lizard.x + 0.75, SF + 0.22, basinD + 0.45], 0.5);
  const pool = new THREE.Mesh(g(new THREE.PlaneGeometry(1.3, 0.9).rotateX(-Math.PI / 2)), k.glowWater);
  pool.position.copy(P(lizard.x, SF + 0.16, basinD));
  group.add(pool);
  // His circle, laid in something pale that glows faintly green in the dark.
  panel(decal(paintCircle('lizard'), 0x3fae84, 0.5), 4.2, 4.2, P(lizard.x, SF + 0.006, lizard.d - 1.4), Math.PI, true);
  {
    const rnd = rng(51), spots: [number, number, number][] = [];
    for (const dx of [-1.15, 1.15]) cluster(spots, lizard.x + dx, lizard.d, 6, 0.3, SF, rnd);
    for (const dx of [-0.95, 0.95]) cluster(spots, lizard.x + dx, basinD, 4, 0.22, SF, rnd);
    for (const x of [RX0 + 0.3, RX1 - 0.3]) for (const d of [S0 + 0.5, S1 - 0.4]) cluster(spots, x, d, 5, 0.22, SF, rnd);
    candles(spots, 0xb8b29a, new THREE.Color(0.25, 0.95, 0.6), 52);
  }
  // Stone tablets of Ib leaning against the walls, their glyphs worn.
  {
    const rnd = rng(53);
    for (let i = 0; i < 6; i++) {
      const west = i % 2 === 0;
      const d = S0 + 1.2 + (i >> 1) * 1.4 + rnd() * 0.3;
      const x = west ? RX0 + 0.12 : RX1 - 0.12;
      const geo = new THREE.BoxGeometry(0.08, 0.55 + rnd() * 0.35, 0.4 + rnd() * 0.2);
      const mesh = new THREE.Mesh(g(geo), greenStone);
      mesh.position.copy(P(x, SF + geo.parameters.height / 2 - 0.02, d));
      mesh.rotation.z = (west ? -1 : 1) * (0.12 + rnd() * 0.1);
      group.add(mesh);
    }
  }

  // ── Statues ─────────────────────────────────────────────────────
  let head: THREE.Object3D | null = null;
  let statue: THREE.Object3D | null = null;
  const rest = BOKRUG_GAZE;
  const look = { yaw: 0, pitch: 0 };
  const load: Sanctums['load'] = (loader, keep, gone) => {
    loader.load('/props/shub-niggurath-statue.glb', (gltf) => {
      if (gone()) return;
      const idol = gltf.scene;
      stone(idol, 0x47423d);
      idol.scale.setScalar(1.35);
      // The model faces +X; turned to face +d, out of her room toward the way in.
      idol.rotation.y = Math.PI / 2;
      idol.position.copy(P(goat.x, SF + 0.42, goat.d));
      group.add(idol);
      keep(idol);
    });
    loader.load('/props/bokrug-statue.glb', (gltf) => {
      if (gone()) return;
      const idol = gltf.scene;
      stone(idol, 0x5f8576);
      // The model faces +Z: -d, back down his room to the way in.
      idol.position.copy(P(lizard.x, SF + 0.48, lizard.d));
      group.add(idol);
      keep(idol);
      const h = idol.getObjectByName('Head');
      if (!h) return;
      // Hung from a pivot at the neck, wherever the file's own transforms put the mesh.
      const pivot = new THREE.Group();
      pivot.position.set(...BOKRUG_NECK);
      idol.add(pivot);
      idol.updateMatrixWorld(true);
      pivot.attach(h);
      head = pivot;
      statue = idol;
    });
  };

  const withBones = (kit: Map<string, THREE.BufferGeometry>) => {
    const skull = kit.get('skull');
    if (!skull) return;
    skull.computeBoundingBox();
    const lift = skull.boundingBox!.getSize(new THREE.Vector3()).y / 2;
    const ring = (cx: number, cd: number, r: number, n: number, seed: number, faceIn: boolean, gap?: number) => {
      const rnd = rng(seed);
      const mesh = new THREE.InstancedMesh(skull, m(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })), n);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color(), ivory = new THREE.Color(0xc9bc98), brown = new THREE.Color(0x4b3b27);
      let c = 0;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = cx + Math.sin(a) * r, d = cd + Math.cos(a) * r;
        if (gap !== undefined && Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < 0.45) continue;
        dummy.position.copy(P(x, SF + lift, d));
        // Each turned to stare at the god in the middle (or out, at whoever comes).
        const toward = Math.atan2(-(cx - x), cd - d);
        dummy.rotation.set(0, (faceIn ? toward : toward + Math.PI) + (rnd() - 0.5) * 0.3, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(c, dummy.matrix);
        mesh.setColorAt(c, col.copy(ivory).lerp(brown, rnd() * 0.7));
        c++;
      }
      mesh.count = c;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    // Her ring, broken where the altar stands; his, round the basin.
    ring(goat.x, goat.d + 0.4, 1.55, 26, 61, true, 0);
    ring(lizard.x, basinD, 1.05, 16, 62, false);
  };

  const eyeLocal = new THREE.Vector3();
  const qYaw = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), axis = new THREE.Vector3();
  const update: Sanctums['update'] = (dt, eye) => {
    for (const f of flames) f.mat.uniforms.uTime.value += dt;
    if (!head || !statue) return;
    // Bokrug watches whoever is in his room, or on the steps up to it; otherwise looks ahead.
    let ty = 0, tp = 0;
    if (eye) {
      eyeLocal.copy(eye);
      statue.worldToLocal(eyeLocal).sub(head.position);
      // Up the passage or in the room: never through the rock from the shrine.
      const d = k.at.z - eye.z, x = eye.x - k.at.x;
      const inRoom = eye.y > k.at.y + deep && eye.y < k.at.y + SF + H && d > far && x > RX0 && x < RX1;
      if (inRoom) {
        // As far round as a neck would go either side of the statue's front, and down to meet your eye.
        ty = THREE.MathUtils.clamp(Math.atan2(eyeLocal.x, eyeLocal.z), -1.25, 1.25) - rest.yaw;
        tp = THREE.MathUtils.clamp(Math.atan2(eyeLocal.y, Math.hypot(eyeLocal.x, eyeLocal.z)) - rest.pitch, -0.7, 0.2);
      }
    }
    // Slow, as stone would turn.
    const ease = 1 - Math.exp(-dt * 1.8);
    look.yaw += (ty - look.yaw) * ease;
    look.pitch += (tp - look.pitch) * ease;
    // Raise or lower it about the axis across its rest gaze, then turn it about the vertical.
    axis.set(Math.cos(rest.yaw), 0, -Math.sin(rest.yaw));
    qPitch.setFromAxisAngle(axis, -look.pitch);
    qYaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, look.yaw);
    head.quaternion.copy(qYaw).multiply(qPitch);
  };

  return { pools, withBones, load, update };
}

// ── Helpers ───────────────────────────────────────────────────────

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A statue's material, tinted to stone; its scanned faces lit from both sides. */
function stone(o: THREE.Object3D, tint: number) {
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of ([] as THREE.Material[]).concat(mesh.material)) {
      const s = mat as THREE.MeshStandardMaterial;
      s.color.setHex(tint);
      s.roughness = 0.85;
      s.metalness = 0.05;
      s.side = THREE.DoubleSide;
    }
    mesh.castShadow = mesh.receiveShadow = true;
  });
}

function mergeAll(list: THREE.BufferGeometry[]) {
  // Tubes share one layout, so their buffers can simply be joined.
  let verts = 0;
  for (const g of list) verts += g.attributes.position.count;
  const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3);
  const idx: number[] = [];
  let off = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array as Float32Array, off * 3);
    nor.set(g.attributes.normal.array as Float32Array, off * 3);
    for (const i of g.index!.array) idx.push(i + off);
    off += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

function sheet(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

/** Runs of paint down from a stroke. */
function drips(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, rnd: () => number, color: string, len = 60) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const dx = x + (rnd() - 0.5) * 30, l = len * (0.3 + rnd());
    const w = 1.5 + rnd() * 2.5;
    ctx.fillRect(dx, y, w, l);
    ctx.beginPath();
    ctx.arc(dx + w / 2, y + l, w * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A row of glyphs in an unknown hand: hooks, bars and eyes, each a little different. */
function glyphs(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, size: number, rnd: () => number, vertical = false) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const gx = vertical ? x : x + i * size * 1.25, gy = vertical ? y + i * size * 1.3 : y;
    ctx.beginPath();
    const strokes = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < strokes; s++) {
      const kind = rnd();
      const ax = gx + rnd() * size, ay = gy + rnd() * size;
      if (kind < 0.35) { ctx.moveTo(ax, ay); ctx.lineTo(gx + rnd() * size, gy + rnd() * size); }
      else if (kind < 0.65) { ctx.moveTo(ax + size * 0.18, ay); ctx.arc(ax, ay, size * 0.18, 0, Math.PI * (1 + rnd())); }
      else if (kind < 0.85) { ctx.moveTo(ax, ay); ctx.quadraticCurveTo(gx + rnd() * size, gy - size * 0.2, gx + rnd() * size, gy + size); }
      else { ctx.moveTo(ax + 3, ay); ctx.arc(ax, ay, 3, 0, Math.PI * 2); }
    }
    ctx.stroke();
  }
}

/** A hand, pressed flat in paint and dragged a little. */
function hand(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, rnd: () => number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.5, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const fingers: [number, number, number][] = [[-0.42, -0.55, -0.5], [-0.2, -0.8, -0.12], [0.05, -0.88, 0], [0.28, -0.8, 0.12], [0.55, -0.15, 0.9]];
  for (const [fx, fy, fr] of fingers) {
    ctx.save();
    ctx.translate(fx * s, fy * s);
    ctx.rotate(fr);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.22, s * 0.11, s * (0.3 + rnd() * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Her walls: goat-headed sigils in dried blood, smeared hands — her thousand young — and runs of script. */
function paintGoatWall(seed: number, w: number) {
  const PX = 180;                          // pixels a metre
  const [c, ctx] = sheet(Math.min(2048, Math.round(w * PX)), Math.round(2.6 * PX));
  const rnd = rng(100 + seed);
  const blood = 'rgba(62,7,5,0.88)', dark = 'rgba(16,5,4,0.8)';
  const W = c.width, Hh = c.height;
  // Soot from candles, rising up the wall.
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W;
    const gr = ctx.createLinearGradient(0, Hh, 0, 0);
    gr.addColorStop(0, 'rgba(10,8,7,0.0)'); gr.addColorStop(0.5, 'rgba(10,8,7,0.35)'); gr.addColorStop(1, 'rgba(10,8,7,0.0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - 40, 0, 80 + rnd() * 60, Hh);
  }
  // The sigils: a circle, a five-pointed star in it, a goat's head over the star.
  const n = Math.max(1, Math.round(W / 420));
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * (W / n) + (rnd() - 0.5) * 40, cy = Hh * 0.42 + (rnd() - 0.5) * 30, r = 95 + rnd() * 25;
    ctx.strokeStyle = blood; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r + 16, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let p = 0; p <= 5; p++) {
      const a = Math.PI / 2 + (p * 4 * Math.PI) / 5;   // point down: inverted
      const px = cx + Math.cos(a) * r * 0.95, py = cy + Math.sin(a) * r * 0.95;
      if (p) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    // The head: a long face, two horns curling out, two slots of eyes.
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 30); ctx.lineTo(cx + 22, cy - 30); ctx.lineTo(cx + 8, cy + 40); ctx.lineTo(cx - 8, cy + 40); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 9;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 18, cy - 30);
      ctx.bezierCurveTo(cx + s * 60, cy - 90, cx + s * 110, cy - 40, cx + s * 70, cy - 10);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(120,20,12,0.9)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * 10, cy - 12, 6, 2.5, s * 0.3, 0, Math.PI * 2); ctx.fill(); }
    // Script round it.
    ctx.strokeStyle = blood; ctx.lineWidth = 2.5;
    for (let a = 0; a < Math.PI * 2; a += 0.28) {
      const gx = cx + Math.cos(a) * (r + 32), gy = cy + Math.sin(a) * (r + 32);
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(a + Math.PI / 2);
      glyphs(ctx, -6, -6, 1, 12, rnd);
      ctx.restore();
    }
    drips(ctx, cx, cy + r + 10, 4, rnd, blood, 70);
  }
  // Hands, dozens of them, low on the wall where the faithful knelt.
  ctx.fillStyle = 'rgba(58,6,4,0.7)';
  for (let i = 0; i < Math.round(W / 60); i++) hand(ctx, rnd() * W, Hh * (0.72 + rnd() * 0.22), 18 + rnd() * 8, (rnd() - 0.5) * 0.9, rnd);
  // A line of her litany along the top.
  ctx.strokeStyle = blood; ctx.lineWidth = 3;
  glyphs(ctx, 20, 24, Math.floor((W - 40) / 25), 20, rnd);
  ctx.fillStyle = 'rgba(70,10,6,0.9)';
  ctx.font = 'italic 26px Georgia, serif';
  if (seed % 2) ctx.fillText('IÄ! SHUB-NIGGURATH! THE BLACK GOAT OF THE WOODS WITH A THOUSAND YOUNG!'.slice(0, Math.floor(W / 15)), 24, Hh * 0.9);
  return c;
}

/** His walls: verdigris glyphs of Ib, the great lizard drawn again and again, and the doom of Sarnath. */
function paintLizardWall(seed: number, w: number) {
  const PX = 180;
  const [c, ctx] = sheet(Math.min(2048, Math.round(w * PX)), Math.round(2.6 * PX));
  const rnd = rng(200 + seed);
  const verd = 'rgba(28,78,60,0.9)', pale = 'rgba(120,170,140,0.75)', blood = 'rgba(60,8,6,0.8)';
  const W = c.width, Hh = c.height;
  // Water-stain tide lines along the wall.
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(20,40,32,${0.25 + rnd() * 0.2})`;
    ctx.lineWidth = 3 + rnd() * 6;
    ctx.beginPath();
    const y = Hh * (0.55 + i * 0.1);
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 6);
    ctx.stroke();
  }
  // The lizard: a long S of a body in a ring of waves, four splayed legs, the tail curling.
  const n = Math.max(1, Math.round(W / 460));
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * (W / n), cy = Hh * 0.4, r = 110;
    ctx.strokeStyle = verd; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const rr = r + Math.sin(a * 14) * 7;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 80);
    ctx.bezierCurveTo(cx + 60, cy - 30, cx - 60, cy + 20, cx + 10, cy + 70);
    ctx.quadraticCurveTo(cx + 50, cy + 95, cx + 30, cy + 60);
    ctx.stroke();
    ctx.lineWidth = 7;
    for (const [lx, ly, s] of [[18, -50, 1], [-14, -40, -1], [-6, 30, -1], [26, 40, 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + lx * 0.5, cy + ly);
      ctx.lineTo(cx + lx + s * 30, cy + ly - 14);
      ctx.lineTo(cx + lx + s * 44, cy + ly - 4);
      ctx.stroke();
    }
    ctx.fillStyle = verd;
    ctx.beginPath(); ctx.ellipse(cx, cy - 90, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pale;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * 6, cy - 94, 3, 0, Math.PI * 2); ctx.fill(); }
    drips(ctx, cx, cy + r + 8, 3, rnd, verd, 50);
  }
  // Columns of the script of Ib between them.
  ctx.strokeStyle = verd; ctx.lineWidth = 3;
  for (let i = 0; i <= n; i++) glyphs(ctx, i * (W / n) - 12, 30, 9, 22, rnd, true);
  // The doom of Sarnath below: towers, the moon, and figures that are not men coming up out of the lake.
  ctx.strokeStyle = pale; ctx.lineWidth = 2.5;
  const base = Hh * 0.86;
  ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(W, base); ctx.stroke();
  for (let x = 20; x < W - 20; x += 70 + rnd() * 60) {
    const kind = rnd();
    if (kind < 0.4) { const h = 30 + rnd() * 40; ctx.strokeRect(x, base - h, 16, h); ctx.beginPath(); ctx.moveTo(x - 3, base - h); ctx.lineTo(x + 8, base - h - 14); ctx.lineTo(x + 19, base - h); ctx.stroke(); }
    else if (kind < 0.8) {
      // A figure: a hunched body, a wide head, webbed hands raised.
      ctx.beginPath(); ctx.arc(x + 8, base - 40, 7, 0, Math.PI * 2); ctx.moveTo(x + 8, base - 33); ctx.lineTo(x + 8, base - 12);
      ctx.moveTo(x + 8, base - 28); ctx.lineTo(x - 4, base - 44); ctx.moveTo(x + 8, base - 28); ctx.lineTo(x + 20, base - 44);
      ctx.moveTo(x + 8, base - 12); ctx.lineTo(x, base); ctx.moveTo(x + 8, base - 12); ctx.lineTo(x + 16, base); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(x + 10, base - 70, 10, 0.3, Math.PI * 2 - 0.3); ctx.stroke(); }
  }
  // Here and there, older, in blood.
  ctx.fillStyle = blood;
  for (let i = 0; i < Math.round(W / 220); i++) hand(ctx, rnd() * W, Hh * (0.62 + rnd() * 0.15), 17, (rnd() - 0.5) * 0.8, rnd);
  ctx.fillStyle = 'rgba(40,96,74,0.9)';
  ctx.font = 'italic 24px Georgia, serif';
  if (seed % 2 === 0) ctx.fillText('BOKRUG · THE GREAT WATER-LIZARD · WHO CAME UP OUT OF THE LAKE UPON SARNATH'.slice(0, Math.floor(W / 14)), 24, Hh * 0.97);
  return c;
}

/** The ritual circle on the floor before the god: rings, a star, the name written round. */
function paintCircle(kind: 'goat' | 'lizard') {
  const S = 1024;
  const [c, ctx] = sheet(S, S);
  const rnd = rng(kind === 'goat' ? 300 : 400);
  const ink = kind === 'goat' ? 'rgba(58,6,4,0.9)' : 'rgba(150,210,180,0.85)';
  const C = S / 2;
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round';
  for (const [r, w] of [[480, 10], [440, 4], [330, 6]] as const) { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke(); }
  // The name, round between the outer rings.
  const words = kind === 'goat'
    ? ' IÄ! IÄ! SHUB-NIGGURATH! THE GOAT WITH A THOUSAND YOUNG! IÄ! SHUB-NIGGURATH! '
    : ' BOKRUG · BOKRUG · THE WATER-LIZARD OF IB · THE DOOM THAT CAME TO SARNATH · ';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center';
  const step = (Math.PI * 2) / words.length;
  for (let i = 0; i < words.length; i++) {
    const a = i * step - Math.PI / 2;
    ctx.save(); ctx.translate(C + Math.cos(a) * 458, C + Math.sin(a) * 458); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(words[i], 0, 12);
    ctx.restore();
  }
  // A star of seven points for the lizard, five for the goat, and a glyph at each.
  const pts = kind === 'goat' ? 5 : 7, skip = kind === 'goat' ? 2 : 3;
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let p = 0; p <= pts; p++) {
    const a = -Math.PI / 2 + (p * skip * 2 * Math.PI) / pts;
    const x = C + Math.cos(a) * 330, y = C + Math.sin(a) * 330;
    if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let p = 0; p < pts; p++) {
    const a = -Math.PI / 2 + (p * 2 * Math.PI) / pts;
    ctx.save(); ctx.translate(C + Math.cos(a) * 385, C + Math.sin(a) * 385);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    glyphs(ctx, -16, -16, 1, 32, rnd);
    ctx.restore();
  }
  // Spatters across it.
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 500;
    ctx.beginPath(); ctx.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Old blood pooled and dried on the altar top. */
function paintStain(seed: number) {
  const [c, ctx] = sheet(512, 256);
  const rnd = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x = 256 + (rnd() - 0.5) * 300, y = 128 + (rnd() - 0.5) * 120, r = 10 + rnd() * 60;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,4,3,0.85)'); gr.addColorStop(1, 'rgba(40,4,3,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Runnels down the long edges.
  ctx.fillStyle = 'rgba(45,5,3,0.8)';
  for (let i = 0; i < 8; i++) ctx.fillRect(40 + rnd() * 430, rnd() < 0.5 ? 0 : 236, 4 + rnd() * 6, 20);
  return c;
}
