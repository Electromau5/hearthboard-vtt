import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvas, paintBrick, paintStone, paintWater, repeatTexture, scaleBoxUv, scaleUv, seeded } from './sewer';

/**
 * The beach behind the Innsmouth breakwater, where the wrecked trawler lies
 * (see `shore` in src/lib/walkthrough.ts). Built here, around the Summer-built
 * vessel, in its own metres: the ship's bow points to -Z and her port side is
 * -X, her deck about level with y = 0 and the sea at y = -1.3.
 *
 * Ahead of her bow a strip of sand climbs out of the water to a stone sea
 * wall, and in the wall the sewer under the derelict house lets out through a
 * brick culvert, a trickle of black water running from it down the sand. A
 * timber jetty runs from the sand out along her port side, and a gangplank
 * from it goes up over her rail and down onto her deck.
 *
 * The culvert is the way back into the sewer (`culvert`); the sand ends at the
 * water and at its two ends, where no one can walk on.
 */

export type Shore = {
  group: THREE.Group;
  /** What blocks and carries the investigators: add to the level's walls. */
  solids: THREE.Object3D[];
  /**
   * The back of the culvert: `box` to go in by, and `arrive`, where whoever
   * comes out of the sewer stands, looking down the beach to the wreck.
   */
  culvert: { box: THREE.Box3; arrive: { at: THREE.Vector3; yaw: number } };
  dispose: () => void;
};

// The beach: from the waterline (Z_WATER) up to the foot of the sea wall (Z_WALL).
const X_END = 22;
const Z_WATER = -20.5, Z_CREST = -27, Z_WALL = -35;
const WALL_T = 1.6, WALL_TOP = 4.2;
// The culvert, in the wall: its mouth, how far back it goes, how high.
const CW = 0.95, C_DEEP = 4.5;
const C_FLOOR = 0.62, C_TOP = 2.5;
// The jetty along her port side, and the gangplank over her rail.
const JX0 = -4.3, JX1 = -3.0, JZ0 = -27.6, JZ1 = -1.4;
const JTOP = 0.45;
const PLANK_Z = -2.0, PLANK_W = 0.7;
const RAIL_X = -2.45, PEAK = 1.3;    // her port rail stands about 1.14 here
const DECK_X = -1.0, DECK_Y = 0.03;  // and her deck, a step in from it

/** How high the sand lies at z, before its ripples. */
function sandAt(z: number) {
  const ease = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };
  if (z > Z_CREST) return -1.45 + 1.75 * ease((Z_WATER - z) / (Z_WATER - Z_CREST));
  return 0.3 + 0.32 * ease((Z_CREST - z) / (Z_CREST - Z_WALL));
}
/** The sand's ripples: shallow, so the ground underfoot stays easy. */
function ripple(x: number, z: number) {
  return 0.035 * Math.sin(x * 0.9 + z * 0.35) + 0.02 * Math.sin(x * 2.3 - z * 1.7);
}
const sandY = (x: number, z: number) => sandAt(z) + ripple(x, z);

export function createShore(): Shore {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const tx = <T extends THREE.Texture>(x: T) => { texs.push(x); return x; };

  const group = new THREE.Group();
  group.name = 'Shore';
  const solids: THREE.Object3D[] = [];

  const sandTex = tx(repeatTexture(paintSand()));
  const brick = m(new THREE.MeshStandardMaterial({ map: tx(repeatTexture(paintBrick())), roughness: 0.75 }));
  // The sea wall's granite, paler than the sewer's flags where the weather has bleached it.
  const granite = m(new THREE.MeshStandardMaterial({ map: tx(repeatTexture(paintStone())), color: 0xffffff, roughness: 0.9 }));
  const wood = m(new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.92 }));
  const darkWood = m(new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.95 }));
  const iron = m(new THREE.MeshStandardMaterial({ color: 0x2b2420, metalness: 0.55, roughness: 0.75 }));
  const rock = m(new THREE.MeshStandardMaterial({ color: 0x272a26, roughness: 0.95, flatShading: true }));
  const sand = m(new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.95 }));
  const runoff = m(new THREE.MeshStandardMaterial({
    color: 0x101a14, map: tx(repeatTexture(paintWater())), roughness: 0.05, metalness: 0.3,
    transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  const black = m(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const blocker = m(new THREE.MeshBasicMaterial());

  // Pieces gathered by material and merged into one mesh each at the end.
  // Solid pieces are walked on and bumped into; the rest (piles, battens, rocks) only render.
  const bins = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; solid: boolean }>();
  const add = (mat: THREE.Material, geo: THREE.BufferGeometry, solid = true) => {
    const key = `${mat.uuid}:${solid}`;
    if (!bins.has(key)) bins.set(key, { mat, geos: [], solid });
    bins.get(key)!.geos.push(geo);
  };
  /** A box from corner to corner, its texture laid at `tile` metres. */
  const box = (mat: THREE.Material, [x0, y0, z0]: number[], [x1, y1, z1]: number[], tile = 1, solid = true) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUv(geo, w, h, d, tile);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    add(mat, geo, solid);
  };
  /** An invisible wall. */
  const block = ([x0, y0, z0]: number[], [x1, y1, z1]: number[]) => {
    const mesh = new THREE.Mesh(g(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)), blocker);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.visible = false;
    mesh.updateMatrixWorld(true);
    group.add(mesh);
    solids.push(mesh);
  };

  // ── The sand ────────────────────────────────────────────────────
  {
    const w = 2 * X_END, d = Z_WATER - Z_WALL;
    const geo = new THREE.PlaneGeometry(w, d, 88, 58).rotateX(-Math.PI / 2);
    geo.translate(0, 0, (Z_WATER + Z_WALL) / 2);
    scaleUv(geo, w / 3, d / 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const dry = new THREE.Color(0xc9c0aa), wet = new THREE.Color(0x58554b), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = sandY(x, z);
      pos.setY(i, y);
      // Dark and wet up to where the tide last reached, pale above it.
      c.copy(wet).lerp(dry, Math.min(1, Math.max(0, (y + 0.9) / 1.1)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    add(sand, geo);
    // Black water from the culvert, spreading down the sand into the sea.
    const strip = new THREE.PlaneGeometry(1, 1, 1, 40).rotateX(-Math.PI / 2);
    const sp = strip.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const u = sp.getZ(i) + 0.5;                       // 0 at the culvert … 1 at the sea
      const z = Z_WALL + u * (Z_WATER - Z_WALL + 0.2);
      const x = 0.35 * Math.sin(u * 7) * u + sp.getX(i) * (0.3 + 0.9 * u * u);
      sp.setXYZ(i, x, sandY(x, z) + 0.02, z);
    }
    scaleUv(g(strip), 1, 6);
    const trickle = new THREE.Mesh(strip, runoff);
    group.add(trickle);
  }

  // ── The sea wall, and the culvert through it ────────────────────
  const zw0 = Z_WALL - WALL_T;
  box(granite, [-X_END - 2, -1.6, zw0], [-CW - 0.3, WALL_TOP, Z_WALL], 2);
  box(granite, [CW + 0.3, -1.6, zw0], [X_END + 2, WALL_TOP, Z_WALL], 2);
  box(granite, [-CW - 0.3, C_TOP + 0.3, zw0], [CW + 0.3, WALL_TOP, Z_WALL], 2);
  box(granite, [-CW - 0.3, -1.6, zw0], [CW + 0.3, C_FLOOR - 0.1, Z_WALL], 2);
  // A coping along its top, a little proud of the face.
  box(granite, [-X_END - 2, WALL_TOP, zw0], [X_END + 2, WALL_TOP + 0.25, Z_WALL + 0.12], 2);
  // The culvert: a brick barrel back into the dark, its floor a step up from the sand.
  const zc1 = Z_WALL - C_DEEP;
  box(brick, [-CW, C_FLOOR - 0.1, zc1], [CW, C_FLOOR, Z_WALL], 1);
  box(brick, [-CW - 0.3, C_FLOOR - 0.1, zc1], [-CW, C_TOP + 0.3, zw0], 1);
  box(brick, [CW, C_FLOOR - 0.1, zc1], [CW + 0.3, C_TOP + 0.3, zw0], 1);
  box(brick, [-CW - 0.3, C_TOP, zc1], [CW + 0.3, C_TOP + 0.3, zw0], 1);
  // Brick dressing the mouth, where it comes through the granite.
  box(brick, [-CW - 0.3, C_FLOOR - 0.1, zw0], [-CW, C_TOP + 0.3, Z_WALL + 0.05], 1);
  box(brick, [CW, C_FLOOR - 0.1, zw0], [CW + 0.3, C_TOP + 0.3, Z_WALL + 0.05], 1);
  box(brick, [-CW - 0.3, C_TOP, zw0], [CW + 0.3, C_TOP + 0.3, Z_WALL + 0.05], 1);
  {
    // The dark it goes back into, and a wall to stop at.
    const dark = new THREE.Mesh(g(new THREE.PlaneGeometry(2 * CW, C_TOP - C_FLOOR)), black);
    dark.position.set(0, (C_FLOOR + C_TOP) / 2, zc1 + 0.6);
    group.add(dark);
    block([-CW, C_FLOOR, zc1], [CW, C_TOP, zc1 + 0.6]);
  }
  // Its grating, rusted off its top hinge and hanging open against the wall.
  {
    const bars: THREE.BufferGeometry[] = [];
    const h = C_TOP - C_FLOOR - 0.1;
    for (let u = 0.08; u < 2 * CW; u += 0.14) bars.push(new THREE.CylinderGeometry(0.016, 0.016, h, 6).translate(u, h / 2, 0));
    for (const y of [0.15, h / 2, h - 0.12]) bars.push(new THREE.BoxGeometry(2 * CW, 0.05, 0.03).translate(CW, y, 0));
    const merged = g(mergeGeometries(bars.map(b => b.index ? b.toNonIndexed() : b).map(b => { b.deleteAttribute('uv'); return b; }), false)!);
    bars.forEach(b => b.dispose());
    const grating = new THREE.Mesh(merged, iron);
    // Hinged on the culvert's west jamb, swung out flat to the wall and sagging off its lower hinge.
    grating.position.set(-CW - 0.3, C_FLOOR + 0.02, Z_WALL + 0.06);
    grating.rotation.set(0, Math.PI * 0.92, 0.07);
    group.add(grating);
  }

  // ── The jetty, and the gangplank onto the wreck ─────────────────
  {
    // Planks laid across, edge to edge (a gap would let a foot through to the sand), not quite level.
    const rnd = seeded(1928);
    const step = 0.24;
    for (let z = JZ0, i = 0; z < JZ1; z += step, i++) {
      const lift = (rnd() - 0.5) * 0.012;
      box(wood, [JX0 + (rnd() - 0.5) * 0.06, JTOP - 0.06 + lift, z], [JX1 + (rnd() - 0.5) * 0.06, JTOP + lift, Math.min(JZ1, z + step)], 0.5);
    }
    // Stringers under them, and the piles they rest on, down into the water and the sand.
    for (const x of [JX0 + 0.12, JX1 - 0.12]) {
      box(darkWood, [x - 0.08, JTOP - 0.26, JZ0], [x + 0.08, JTOP - 0.06, JZ1], 1, false);
      for (let z = JZ0 + 0.4; z < JZ1; z += 2.6) {
        const foot = Math.min(sandAt(z), -1.3) - 1.2;
        const pile = new THREE.CylinderGeometry(0.11, 0.13, JTOP - foot, 8).translate(x, (JTOP + foot) / 2 - 0.06, z);
        add(darkWood, pile, false);
      }
    }
    // The gangplank: up from the jetty over her rail, and down the other side onto her deck.
    const slab = (from: THREE.Vector2, to: THREE.Vector2) => {
      const len = from.distanceTo(to), t = 0.06;
      const geo = new THREE.BoxGeometry(len, t, PLANK_W);
      scaleBoxUv(geo, len, t, PLANK_W, 0.5);
      geo.rotateZ(Math.atan2(to.y - from.y, to.x - from.x));
      const n = new THREE.Vector2(-(to.y - from.y), to.x - from.x).normalize();
      if (n.y < 0) n.negate();
      geo.translate((from.x + to.x) / 2 - n.x * t / 2, (from.y + to.y) / 2 - n.y * t / 2, PLANK_Z);
      add(wood, geo);
    };
    const peak = new THREE.Vector2(RAIL_X, PEAK);
    slab(new THREE.Vector2(JX1 - 0.35, JTOP + 0.005), peak);
    slab(peak, new THREE.Vector2(DECK_X, DECK_Y));
    // Battens across it for a foothold, too low to trip on.
    for (let k = 0.15; k < 0.95; k += 0.12) {
      for (const [a, b] of [[new THREE.Vector2(JX1 - 0.35, JTOP), peak], [peak, new THREE.Vector2(DECK_X, DECK_Y)]] as const) {
        const p = a.clone().lerp(b, k);
        box(darkWood, [p.x - 0.02, p.y - 0.01, PLANK_Z - PLANK_W / 2 + 0.04], [p.x + 0.02, p.y + 0.015, PLANK_Z + PLANK_W / 2 - 0.04], 0.5, false);
      }
    }
  }

  // ── Rocks at the beach's ends, where the sand runs out ──────────
  {
    const rnd = seeded(77);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const z = Z_WALL + rnd() * (Z_WATER - Z_WALL + 1.5);
        const x = side * (X_END - 1.6 + rnd() * 3.4);
        const s = 0.5 + rnd() * 1.3;
        const geo = new THREE.DodecahedronGeometry(s, 0);
        geo.scale(1 + rnd() * 0.5, 0.6 + rnd() * 0.5, 1 + rnd() * 0.4);
        geo.rotateY(rnd() * Math.PI);
        geo.translate(x, sandAt(z) + s * 0.2, z);
        add(rock, geo, false);
      }
      // Too broken to climb: the beach ends here.
      block([side * X_END - 0.6, -2, Z_WALL], [side * X_END + 0.6, 3, Z_WATER + 1]);
    }
    // A few on the sand itself, and kelp-black boulders at the waterline.
    for (let i = 0; i < 18; i++) {
      const x = (rnd() - 0.5) * 2 * (X_END - 3);
      const z = Z_WATER - rnd() * 4;
      if (Math.abs(x) < 1.5 || (x > JX0 - 1 && x < JX1 + 1)) continue;
      const s = 0.25 + rnd() * 0.55;
      const geo = new THREE.DodecahedronGeometry(s, 0);
      geo.scale(1 + rnd() * 0.5, 0.5 + rnd() * 0.4, 1 + rnd() * 0.4);
      geo.rotateY(rnd() * Math.PI);
      geo.translate(x, sandAt(z) + s * 0.1, z);
      add(rock, geo, false);
    }
  }

  for (const { mat, geos: list, solid } of bins.values()) {
    const merged = g(mergeGeometries(list, false)!);
    list.forEach(x => x.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = mat !== sand;
    mesh.updateMatrixWorld(true);
    group.add(mesh);
    if (solid) solids.push(mesh);
  }

  return {
    group,
    solids,
    culvert: {
      box: new THREE.Box3(new THREE.Vector3(-CW, C_FLOOR, zc1 + 0.4), new THREE.Vector3(CW, C_TOP, zc1 + 2.2)),
      // Just out of the culvert on the sand, looking down the beach to the wreck (world +z).
      arrive: { at: new THREE.Vector3(0, sandY(0, Z_WALL + 1.5), Z_WALL + 1.5), yaw: Math.PI },
    },
    dispose() {
      geos.forEach(x => x.dispose());
      mats.forEach(x => x.dispose());
      texs.forEach(x => x.dispose());
      group.removeFromParent();
    },
  };
}

/** Grey shore sand, salted with shell grit and darker grains. */
function paintSand() {
  const S = 512;
  const [c, ctx] = canvas(S);
  const rnd = seeded(19);
  ctx.fillStyle = '#9a9488';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 26000; i++) {
    const l = 30 + rnd() * 45;
    ctx.fillStyle = `hsla(${35 + rnd() * 20}, ${8 + rnd() * 14}%, ${l}%, ${0.25 + rnd() * 0.5})`;
    const s = 1 + rnd() * 2.2;
    ctx.fillRect(rnd() * S, rnd() * S, s, s);
  }
  // Wind ridges.
  for (let y = 0; y < S; y += 9 + rnd() * 10) {
    ctx.strokeStyle = `rgba(40,36,30,${0.06 + rnd() * 0.08})`;
    ctx.lineWidth = 2 + rnd() * 3;
    ctx.beginPath();
    for (let x = 0; x <= S; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 4);
    ctx.stroke();
  }
  return c;
}
