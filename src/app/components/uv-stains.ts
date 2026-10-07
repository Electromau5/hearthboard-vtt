import * as THREE from 'three';
import type { UvStain } from '@/lib/walkthrough';

/**
 * Stains that only the Wood's lamp shows (see UvStain). Each mark is a decal
 * whose shader lights it by the lamps' cones alone: outside every cone it
 * draws nothing, so torchlight and lamplight never give it away. Blood is
 * drawn dark (it soaks up ultraviolet), brine glows (its salts fluoresce).
 *
 * Up to MAX_LAMPS lamps light the stains at once — the investigator's own and
 * those of anyone else in the level with theirs lit.
 */

export const MAX_LAMPS = 4;
/** The lamp's cone, in radians from its axis: full strength inside INNER, nothing beyond OUTER. */
export const CONE_OUTER = 0.42;
const CONE_INNER = 0.2;
/** Metres the lamp reaches. A Wood's filter passes little light; this is generous for play. */
export const LAMP_RANGE = 5.5;

export type UvLamp = { pos: THREE.Vector3; dir: THREE.Vector3; power: number };

/** One examinable part of a stain: a wall mark, or one footprint of a trail. */
export type StainPiece = { stain: UvStain; box: THREE.Box3; point: THREE.Vector3; normal: THREE.Vector3 };

const COS_OUTER = Math.cos(CONE_OUTER);
const COS_INNER = Math.cos(CONE_INNER);

/** How strongly the lamps light a surface at `point` facing `normal`, 0..1 — the shader's sum, on the CPU. */
export function uvLightAt(lamps: UvLamp[], point: THREE.Vector3, normal: THREE.Vector3) {
  let lit = 0;
  const l = new THREE.Vector3();
  for (const lamp of lamps) {
    if (lamp.power <= 0) continue;
    l.subVectors(point, lamp.pos);
    const d = l.length();
    if (d > LAMP_RANGE || d < 1e-3) continue;
    l.divideScalar(d);
    const cone = THREE.MathUtils.smoothstep(l.dot(lamp.dir), COS_OUTER, COS_INNER);
    const fall = (1 - d / LAMP_RANGE) ** 2;
    const face = THREE.MathUtils.clamp(-normal.dot(l) * 1.5, 0, 1);
    lit += cone * fall * face * lamp.power;
  }
  return Math.min(lit, 1);
}

// ── Shader ──────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  #define MAX_LAMPS ${MAX_LAMPS}
  uniform sampler2D uMask;
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uGlow;
  uniform vec3 uLampPos[MAX_LAMPS];
  uniform vec3 uLampDir[MAX_LAMPS];
  uniform float uLampPower[MAX_LAMPS];
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    float lit = 0.0;
    for (int i = 0; i < MAX_LAMPS; i++) {
      if (uLampPower[i] <= 0.0) continue;
      vec3 L = vWorld - uLampPos[i];
      float d = length(L);
      vec3 l = L / max(d, 1e-3);
      float cone = smoothstep(${COS_OUTER.toFixed(5)}, ${COS_INNER.toFixed(5)}, dot(l, uLampDir[i]));
      float fall = clamp(1.0 - d / ${LAMP_RANGE.toFixed(2)}, 0.0, 1.0);
      float face = clamp(-dot(normalize(vNormal), l) * 1.5, 0.0, 1.0);
      lit += cone * fall * fall * face * uLampPower[i];
    }
    lit = min(lit, 1.0);
    float m = texture2D(uMask, vUv).a;
    if (m * lit < 0.004) discard;
    // Fluorescence is added light; absorption is a dark film over the violet wash.
    gl_FragColor = uGlow > 0.5
      ? vec4(uColor * m * lit * uStrength, 1.0)
      : vec4(uColor, min(m * lit * uStrength, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const LOOK = {
  blood: { color: new THREE.Color(0x050001), strength: 1.6, glow: false },
  brine: { color: new THREE.Color(0x7dffc0), strength: 2.2, glow: true },
  ink: { color: new THREE.Color(0xa8c8ff), strength: 2.0, glow: true },
} as const;

// ── Masks ───────────────────────────────────────────────────────────
// Each mark is painted once onto a canvas in white; its alpha is the stain.

function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function canvasFor(w: number, h: number, pxPerM: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(16, Math.round(w * pxPerM));
  c.height = Math.max(16, Math.round(h * pxPerM));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = ctx.strokeStyle = '#fff';
  ctx.lineCap = ctx.lineJoin = 'round';
  return [c, ctx];
}

/** A run of liquid down a wall from (x, y), thinning and fading as it goes. */
function run(ctx: Ctx, rnd: () => number, x: number, y: number, len: number, width: number, alpha: number) {
  const steps = 24;
  let px = x;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const nx = px + (rnd() - 0.5) * width * 0.15;
    ctx.globalAlpha = alpha * (1 - t * 0.7);
    ctx.lineWidth = Math.max(1, width * (1 - t * 0.75));
    ctx.beginPath();
    ctx.moveTo(px, y + len * t);
    ctx.lineTo(nx, y + len * (t + 1 / steps));
    ctx.stroke();
    px = nx;
  }
  ctx.globalAlpha = alpha * 0.8;
  ctx.beginPath();
  ctx.arc(px, y + len, width * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** A hand pressed flat high on the wall, then dragged down it. */
function paintHandprint(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number) {
  const cx = w / 2;
  const palmY = 0.17 * ppm;
  // The drag: each finger and the heel of the hand leave a streak below the print.
  const tracks = [-0.032, -0.012, 0.009, 0.028, 0.0].map(o => cx + o * ppm);
  tracks.forEach((x, i) => {
    const width = (i === 4 ? 0.05 : 0.015) * ppm;
    const len = (h - palmY) * (0.55 + rnd() * 0.4);
    run(ctx, rnd, x, palmY, len, width, i === 4 ? 0.55 : 0.8);
  });
  ctx.globalAlpha = 0.9;
  // Palm and thumb.
  ctx.beginPath();
  ctx.ellipse(cx, palmY, 0.045 * ppm, 0.052 * ppm, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.02 * ppm;
  ctx.beginPath();
  ctx.moveTo(cx - 0.035 * ppm, palmY + 0.01 * ppm);
  ctx.lineTo(cx - 0.075 * ppm, palmY - 0.035 * ppm);
  ctx.stroke();
  // Fingers, splayed a little.
  [[-0.03, 0.07, -0.14], [-0.01, 0.085, -0.04], [0.01, 0.08, 0.04], [0.03, 0.06, 0.15]].forEach(([dx, len, ang]) => {
    const x0 = cx + dx * ppm;
    const y0 = palmY - 0.04 * ppm;
    ctx.lineWidth = 0.017 * ppm;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.sin(ang) * len * ppm, y0 - Math.cos(ang) * len * ppm);
    ctx.stroke();
  });
}

/** Cast-off from blows: a dense core, flung drops elongated along their flight, runs under the big ones. */
function paintSpatter(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number) {
  const ox = w * 0.38, oy = h * 0.42;
  // The ghost of the scrubbing: a faint cloud where a wet rag went round and round.
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.05 + rnd() * 0.05;
    ctx.beginPath();
    ctx.ellipse(ox + (rnd() - 0.3) * w * 0.5, oy + (rnd() - 0.4) * h * 0.5, w * (0.08 + rnd() * 0.12), h * (0.06 + rnd() * 0.1), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc(ox + (rnd() - 0.5) * 0.08 * ppm, oy + (rnd() - 0.5) * 0.06 * ppm, (0.012 + rnd() * 0.022) * ppm, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 140; i++) {
    // Mostly up and to the right — the arc of a swing.
    const ang = -0.6 + (rnd() - 0.5) * 2.6 + (rnd() < 0.2 ? Math.PI : 0);
    const r = (0.04 + -Math.log(1 - rnd() * 0.97) * 0.11) * ppm;
    const x = ox + Math.cos(ang) * r;
    const y = oy + Math.sin(ang) * r * 0.8;
    if (x < 4 || y < 4 || x > w - 4 || y > h - 4) continue;
    const size = Math.max(0.0015, 0.011 * Math.exp(-r / ppm / 0.18) * (0.4 + rnd())) * ppm;
    ctx.globalAlpha = 0.65 + rnd() * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * (1.6 + rnd()), size, 0, 0, Math.PI * 2);
    ctx.fill();
    // A tail of satellite droplets ahead of the drop.
    if (size > 0.004 * ppm && rnd() < 0.6) {
      ctx.beginPath();
      ctx.arc(size * 3.2, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (size > 0.006 * ppm && rnd() < 0.45) run(ctx, rnd, x, y, (0.05 + rnd() * 0.25) * ppm, size * 0.9, 0.7);
  }
}

/**
 * Liquid flung across a wall from no one place: drops scattered over the
 * whole patch, thickest in the middle, a few big enough to run.
 */
function paintSplash(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number) {
  for (let i = 0; i < 220; i++) {
    // Gaussian-ish about the centre, so the edges thin out.
    const x = w / 2 + (rnd() + rnd() + rnd() - 1.5) * w * 0.55;
    const y = h / 2 + (rnd() + rnd() + rnd() - 1.5) * h * 0.55;
    if (x < 4 || y < 4 || x > w - 4 || y > h - 4) continue;
    const size = (0.002 + Math.pow(rnd(), 3) * 0.016) * ppm;
    const ang = rnd() * Math.PI * 2;
    ctx.globalAlpha = 0.5 + rnd() * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * (1 + rnd() * 1.4), size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (size > 0.008 * ppm && rnd() < 0.5) run(ctx, rnd, x, y, (0.04 + rnd() * 0.2) * ppm, size * 0.8, 0.6);
  }
}

/** A circle, a three-tined staff with wavering tines, and a wave beneath — drawn with a wet finger. */
function paintGlyph(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
  const finger = 0.02 * ppm;
  const stroke = (pts: [number, number][]) => {
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.35 : 0.8;
      ctx.lineWidth = finger * (pass ? 1.5 : 1);
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = x + (rnd() - 0.5) * finger * 0.3, jy = y + (rnd() - 0.5) * finger * 0.3;
        if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy);
      });
      ctx.stroke();
    }
  };
  const ring: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI * 2.08;
    ring.push([cx + Math.cos(a) * R * (1 + (rnd() - 0.5) * 0.04), cy + Math.sin(a) * R * (1 + (rnd() - 0.5) * 0.04)]);
  }
  stroke(ring);
  stroke([[cx, cy + R * 0.75], [cx, cy - R * 0.35]]);
  for (const side of [-1, 0, 1]) {
    const tine: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      tine.push([cx + side * R * 0.3 * t + Math.sin(t * 9 + side) * R * 0.04, cy - R * 0.35 - t * R * 0.4]);
    }
    tine.unshift([cx, cy - R * 0.35]);
    stroke(tine);
  }
  const wave: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    wave.push([cx - R * 0.6 + t * R * 1.2, cy + R * 0.3 + Math.sin(t * Math.PI * 4) * R * 0.07]);
  }
  stroke(wave);
  // Runs from the wettest strokes.
  for (const x of [cx - R * 0.55, cx, cx + R * 0.2, cx + R * 0.5]) {
    run(ctx, rnd, x, cy + R * (0.3 + rnd() * 0.5), (0.05 + rnd() * 0.15) * ppm, finger * 0.7, 0.6);
  }
}

/** Words daubed with a finger — and, if `scrubbed`, wiped at with a rag until only the lamp can find them. */
function paintWriting(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number, lines: string[], scrubbed: boolean, ink: number) {
  const lineH = h / (lines.length + 0.4);
  const size = lineH * 0.78;
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, li) => {
    const widths = [...line].map(ch => ctx.measureText(ch).width * 1.02);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = (w - total) / 2 + (rnd() - 0.5) * size * 0.4;
    const base = lineH * (li + 1) + (rnd() - 0.5) * size * 0.1;
    [...line].forEach((ch, i) => {
      ctx.save();
      ctx.globalAlpha = ink * (0.75 + rnd() * 0.25);
      ctx.translate(x, base + (rnd() - 0.5) * size * 0.12 + i * size * 0.012);
      ctx.rotate((rnd() - 0.5) * 0.18);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      if (ch !== ' ' && rnd() < 0.3) run(ctx, rnd, x + widths[i] * (0.3 + rnd() * 0.4), base - size * 0.05, (0.03 + rnd() * 0.12) * ppm, size * 0.07, 0.6);
      x += widths[i];
    });
  });
  if (!scrubbed) return;
  // The rag: broad sideways wipes that take most of it off and smear the rest.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = 0.1 + rnd() * 0.22;
    ctx.lineWidth = (0.03 + rnd() * 0.06) * ppm;
    const y = rnd() * h;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * h * 0.3, w * 0.7, y + (rnd() - 0.5) * h * 0.3, w + 10, y + (rnd() - 0.5) * h * 0.2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 10; i++) {
    ctx.globalAlpha = 0.06 + rnd() * 0.08;
    ctx.lineWidth = (0.04 + rnd() * 0.05) * ppm;
    const y = h * (0.15 + rnd() * 0.7);
    ctx.beginPath();
    ctx.moveTo(w * rnd() * 0.3, y);
    ctx.lineTo(w * (0.7 + rnd() * 0.3), y + (rnd() - 0.5) * h * 0.15);
    ctx.stroke();
  }
}

/**
 * A message written to be found: small, hurried handwriting, left-aligned, the
 * lines drifting, the pen (or the finger dipped in milk) running thin and pooling.
 */
function paintNote(ctx: Ctx, w: number, h: number, rnd: () => number, lines: string[]) {
  const lineH = h / (lines.length + 0.6);
  const font = (px: number) => `600 ${px}px "Bradley Hand", "Segoe Script", "Comic Sans MS", cursive`;
  // As large as the space allows, but small enough that the longest line fits the width.
  let size = lineH * 0.6;
  ctx.font = font(size);
  const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
  if (widest > w * 0.88) size *= (w * 0.88) / widest;
  ctx.font = font(size);
  ctx.textBaseline = 'alphabetic';
  const tilt = (rnd() - 0.5) * 0.05;
  lines.forEach((line, li) => {
    let x = w * 0.05 + (rnd() - 0.2) * size * 0.4;
    const base = lineH * (li + 1);
    for (const word of line.split(' ')) {
      ctx.save();
      ctx.globalAlpha = 0.55 + rnd() * 0.45;
      ctx.translate(x, base + x * tilt + (rnd() - 0.5) * size * 0.08);
      ctx.rotate(tilt + (rnd() - 0.5) * 0.06);
      ctx.fillText(word, 0, 0);
      ctx.restore();
      x += ctx.measureText(word + ' ').width;
    }
  });
}

/**
 * A wide smear where something heavy and wet was dragged — the length of the
 * canvas runs along the drag: broken parallel streaks, the edges ragged, and a
 * clutching handprint here and there where it caught at the floor.
 */
function paintDrag(ctx: Ctx, w: number, h: number, ppm: number, rnd: () => number) {
  for (let k = 0; k < 26; k++) {
    const y = h * (0.15 + rnd() * 0.7);
    let x = rnd() * w * 0.1;
    ctx.lineWidth = (0.006 + rnd() * 0.03) * ppm;
    while (x < w) {
      const len = (0.15 + rnd() * 0.9) * ppm;
      ctx.globalAlpha = 0.15 + rnd() * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y + (rnd() - 0.5) * 3);
      ctx.lineTo(Math.min(w, x + len), y + (rnd() - 0.5) * h * 0.06);
      ctx.stroke();
      x += len + rnd() * 0.25 * ppm;
    }
  }
  // Fingers dragged sideways where a hand clutched at the boards.
  const grabs = Math.floor(w / ppm / 2.5);
  for (let g = 0; g < grabs; g++) {
    const gx = (g + 0.3 + rnd() * 0.4) * w / Math.max(1, grabs);
    const gy = h * (rnd() < 0.5 ? 0.12 : 0.88);
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.014 * ppm;
    for (let f = 0; f < 3; f++) {
      ctx.beginPath();
      ctx.moveTo(gx + f * 0.02 * ppm, gy);
      ctx.lineTo(gx + f * 0.02 * ppm - 0.14 * ppm, gy + (gy < h / 2 ? 1 : -1) * 0.05 * ppm);
      ctx.stroke();
    }
  }
}

const DRAG_WIDTH = 0.5;   // metres

const PRINT_SIZE: [number, number] = [0.2, 0.38];   // metres, toe at the top

/**
 * One bare right footprint, `s` of the way from a man's foot (0) to a webbed,
 * three-toed, clawed one (1): the man's print fades as the other grows through it.
 */
function paintFootprint(ctx: Ctx, w: number, h: number, ppm: number, s: number) {
  const cx = w / 2;
  // A man's foot, 0.26 m long, heel low on the canvas.
  ctx.globalAlpha = 0.9 * (1 - s);
  const heelY = h - 0.07 * ppm;
  ctx.beginPath();
  ctx.ellipse(cx + 0.004 * ppm, heelY, 0.03 * ppm, 0.04 * ppm, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 0.006 * ppm, heelY - 0.15 * ppm, 0.042 * ppm, 0.04 * ppm, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.022 * ppm;          // the outer edge of the arch
  ctx.beginPath();
  ctx.moveTo(cx + 0.02 * ppm, heelY - 0.02 * ppm);
  ctx.lineTo(cx + 0.03 * ppm, heelY - 0.13 * ppm);
  ctx.stroke();
  [[-0.03, 0.205, 0.016], [-0.008, 0.212, 0.011], [0.01, 0.207, 0.01], [0.025, 0.198, 0.009], [0.038, 0.185, 0.008]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(cx + dx * ppm, heelY - dy * ppm, r * ppm, 0, Math.PI * 2);
    ctx.fill();
  });
  // The other foot: narrow heel, long splayed toes, webbing, claws.
  ctx.globalAlpha = 0.9 * s;
  const len = 0.26 + 0.06 * s;
  const ball = heelY - 0.15 * ppm;
  ctx.beginPath();
  ctx.ellipse(cx, heelY, 0.022 * ppm, 0.04 * ppm, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.035 * ppm;
  ctx.beginPath();
  ctx.moveTo(cx, heelY);
  ctx.lineTo(cx, ball);
  ctx.stroke();
  const tips = [-0.42, 0, 0.42].map(a => {
    const L = (len - 0.15) * ppm * (a === 0 ? 1 : 0.85);
    return [cx + Math.sin(a) * L, ball - Math.cos(a) * L] as const;
  });
  ctx.globalAlpha = 0.45 * s;           // the web between the toes
  ctx.beginPath();
  ctx.moveTo(cx, ball + 0.01 * ppm);
  tips.forEach(([x, y]) => ctx.lineTo(x, y + 0.025 * ppm));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9 * s;
  tips.forEach(([x, y]) => {
    ctx.lineWidth = 0.016 * ppm;
    ctx.beginPath();
    ctx.moveTo(cx, ball);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.lineWidth = 0.005 * ppm;        // claw
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (x - cx) * 0.12, y - 0.03 * ppm);
    ctx.stroke();
  });
}

// ── Building ────────────────────────────────────────────────────────

export type UvStains = {
  group: THREE.Group;
  pieces: StainPiece[];
  /** Feeds this frame's lamps to every stain. */
  setLamps: (lamps: UvLamp[]) => void;
  dispose: () => void;
};

/**
 * Lays every stain into the level. `wallHit` finds a wall along a ray (point
 * and outward normal) and `floorAt` the floor height under (x, z); stains
 * whose wall or floor cannot be found are skipped, with a warning.
 */
export function createUvStains(
  stains: UvStain[],
  wallHit: (from: THREE.Vector3, dir: THREE.Vector3) => { point: THREE.Vector3; normal: THREE.Vector3 } | null,
  floorAt: (x: number, z: number, nearY: number) => number | null,
): UvStains {
  const group = new THREE.Group();
  const pieces: StainPiece[] = [];
  const owned: { dispose: () => void }[] = [];
  const lampPos = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3());
  const lampDir = Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3(0, 0, -1));
  const lampPower = new Array<number>(MAX_LAMPS).fill(0);

  const material = (kind: UvStain['kind'], mask: THREE.Texture) => {
    const look = LOOK[kind];
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMask: { value: mask },
        uColor: { value: look.color },
        uStrength: { value: look.strength },
        uGlow: { value: look.glow ? 1 : 0 },
        uLampPos: { value: lampPos },
        uLampDir: { value: lampDir },
        uLampPower: { value: lampPower },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,   // a left footprint is a mirrored right one
      blending: look.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    owned.push(mat);
    return mat;
  };
  const texture = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    owned.push(tex);
    return tex;
  };

  // Five stages of the foot, shared by every trail of a kind.
  const footprints = new Map<string, THREE.ShaderMaterial>();
  const footprint = (kind: UvStain['kind'], stage: number) => {
    const key = `${kind}/${stage}`;
    let mat = footprints.get(key);
    if (!mat) {
      const ppm = 640;
      const [c, ctx] = canvasFor(PRINT_SIZE[0], PRINT_SIZE[1], ppm);
      paintFootprint(ctx, c.width, c.height, ppm, stage / 4);
      mat = material(kind, texture(c));
      footprints.set(key, mat);
    }
    return mat;
  };

  for (const stain of stains) {
    const rnd = seeded(stain.id);
    if (stain.wall) {
      const { from, toward, size: [w, h], turnDeg = 0 } = stain.wall;
      const hit = wallHit(new THREE.Vector3(...from), new THREE.Vector3(...toward).normalize());
      if (!hit) { console.warn(`UV stain "${stain.id}" found no wall`); continue; }
      const ppm = Math.min(700, 900 / Math.max(w, h));
      const [c, ctx] = canvasFor(w, h, ppm);
      if (stain.mark === 'handprint') paintHandprint(ctx, c.width, c.height, ppm, rnd);
      else if (stain.mark === 'spatter') paintSpatter(ctx, c.width, c.height, ppm, rnd);
      else if (stain.mark === 'glyph') paintGlyph(ctx, c.width, c.height, ppm, rnd);
      // Solid letters glowing at full strength burn out to white; brine writes thinner.
      else if (stain.mark === 'writing') paintWriting(ctx, c.width, c.height, ppm, rnd, stain.words ?? [], !!stain.scrubbed, stain.kind === 'blood' ? 1 : 0.4);
      else if (stain.mark === 'note') paintNote(ctx, c.width, c.height, rnd, stain.words ?? []);
      const geo = new THREE.PlaneGeometry(w, h);
      owned.push(geo);
      if (stain.splash) {
        // The flung liquid goes on first, a little wider than the mark, so the mark reads over it.
        const sw = w * 1.3, sh = h * 1.4;
        const sppm = Math.min(700, 900 / Math.max(sw, sh));
        const [sc, sctx] = canvasFor(sw, sh, sppm);
        paintSplash(sctx, sc.width, sc.height, sppm, seeded(`${stain.id}/splash`));
        const sgeo = new THREE.PlaneGeometry(sw, sh);
        owned.push(sgeo);
        const splash = new THREE.Mesh(sgeo, material(stain.splash, texture(sc)));
        splash.position.copy(hit.point).addScaledVector(hit.normal, 0.003);
        splash.lookAt(hit.point.clone().add(hit.normal));
        splash.rotateZ(THREE.MathUtils.degToRad(turnDeg));
        splash.renderOrder = 1;
        group.add(splash);
      }
      const mesh = new THREE.Mesh(geo, material(stain.kind, texture(c)));
      mesh.position.copy(hit.point).addScaledVector(hit.normal, 0.004);
      mesh.lookAt(hit.point.clone().add(hit.normal));
      mesh.rotateZ(THREE.MathUtils.degToRad(turnDeg));
      mesh.renderOrder = 2;
      group.add(mesh);
      mesh.updateMatrixWorld(true);
      pieces.push({ stain, box: new THREE.Box3().setFromObject(mesh).expandByScalar(0.03), point: mesh.position.clone(), normal: hit.normal.clone() });
    }
    const up = new THREE.Vector3(0, 1, 0);
    const floorY = stain.floorY ?? 0;
    if (stain.mark === 'drag' && stain.floor && stain.floor.length > 1) {
      // One smear per straight run of the path, each painted to its own length.
      for (let i = 0; i < stain.floor.length - 1; i++) {
        const [ax, az] = stain.floor[i];
        const [bx, bz] = stain.floor[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const cx = (ax + bx) / 2, cz = (az + bz) / 2;
        const y = floorAt(cx, cz, floorY);
        if (y === null || len < 0.05) continue;
        const ppm = Math.min(300, 2048 / len);
        const [c, ctx] = canvasFor(len, DRAG_WIDTH, ppm);
        paintDrag(ctx, c.width, c.height, ppm, rnd);
        // Overlap the next run a little so the corners don't break.
        const geo = new THREE.PlaneGeometry(len + DRAG_WIDTH * 0.4, DRAG_WIDTH).rotateX(-Math.PI / 2);
        owned.push(geo);
        const mesh = new THREE.Mesh(geo, material(stain.kind, texture(c)));
        mesh.position.set(cx, y + 0.004, cz);
        mesh.rotation.y = Math.atan2(-(bz - az), bx - ax);
        mesh.renderOrder = 2;
        group.add(mesh);
        mesh.updateMatrixWorld(true);
        pieces.push({ stain, box: new THREE.Box3().setFromObject(mesh).expandByScalar(0.04), point: mesh.position.clone(), normal: up });
      }
    } else if (stain.floor && stain.floor.length > 1) {
      const path = stain.floor.map(([x, z]) => new THREE.Vector2(x, z));
      const total = path.slice(1).reduce((sum, p, i) => sum + p.distanceTo(path[i]), 0);
      const geo = new THREE.PlaneGeometry(...PRINT_SIZE).rotateX(-Math.PI / 2);
      owned.push(geo);
      // Strides lengthen as the feet do.
      let along = 0.15, side = 1, seg = 0, segStart = 0;
      while (along < total) {
        while (seg < path.length - 2 && along > segStart + path[seg + 1].distanceTo(path[seg])) {
          segStart += path[seg + 1].distanceTo(path[seg]);
          seg++;
        }
        const a = path[seg], b = path[seg + 1];
        const dir = b.clone().sub(a).normalize();
        const at = a.clone().addScaledVector(dir, along - segStart);
        const x = at.x + -dir.y * side * 0.1;
        const z = at.y + dir.x * side * 0.1;
        const y = floorAt(x, z, floorY);
        const t = along / total;
        if (y !== null) {
          const stage = Math.min(4, Math.round(t * 4));
          const mesh = new THREE.Mesh(geo, footprint(stain.kind, stage));
          mesh.position.set(x, y + 0.004, z);
          mesh.rotation.y = Math.atan2(-dir.x, -dir.y) + (rnd() - 0.5) * 0.2;
          if (side < 0) mesh.scale.x = -1;   // the left foot
          mesh.renderOrder = 2;
          group.add(mesh);
          mesh.updateMatrixWorld(true);
          pieces.push({ stain, box: new THREE.Box3().setFromObject(mesh).expandByScalar(0.04), point: mesh.position.clone(), normal: up });
        }
        side = -side;
        along += 0.55 + t * 0.25;
      }
    }
  }

  return {
    group,
    pieces,
    setLamps(lamps) {
      for (let i = 0; i < MAX_LAMPS; i++) {
        const l = lamps[i];
        lampPower[i] = l ? l.power : 0;
        if (l) { lampPos[i].copy(l.pos); lampDir[i].copy(l.dir); }
      }
    },
    dispose() {
      for (const o of owned) o.dispose();
      group.removeFromParent();
    },
  };
}
