import * as THREE from 'three';
import type { PinNote } from '@/lib/walkthrough';

// Case-board items are 160×90 px notes and 180×140 px pictures, positioned by
// their top-left corner (InvestigationBoard.tsx).
const NOTE_PX = { w: 160, h: 90 };
const IMAGE_PX = { w: 180, h: 140 };
const PX = 0.0022;            // metres per board pixel at full size
const TEX_W = 320;
const CARD_TEX_W = 512;       // index cards carry more text, so they get more pixels

type Threads = { from: string; to: string; color: string }[];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function noteTexture(n: PinNote, aspect: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = n.title ? CARD_TEX_W : TEX_W;
  c.height = Math.round(c.width / aspect);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = n.color || '#f5f0e0';
  ctx.fillRect(0, 0, c.width, c.height);
  // Age the paper: darker toward the edges.
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.7);
  g.addColorStop(0, 'rgba(90,70,40,0)');
  g.addColorStop(1, 'rgba(90,70,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#2a211a';
  const text = n.text?.trim() ?? '';
  // Index cards are typed: a heading over a red rule, then the body in the same face.
  const face = n.title ? '"Courier New", Courier, monospace' : 'Georgia, serif';
  const style = n.title ? '' : 'italic ';
  let top = 0;
  if (n.title) {
    ctx.font = `bold 30px ${face}`;
    ctx.fillText(n.title.toUpperCase(), 18, 42, c.width - 36);
    ctx.fillStyle = 'rgba(160,40,30,0.7)';
    ctx.fillRect(14, 54, c.width - 28, 2);
    ctx.fillStyle = '#2a211a';
    top = 44;
  }
  let size = 26;
  ctx.font = `${style}${size}px ${face}`;
  let lines = wrap(ctx, text, c.width - 32);
  while (lines.length * size * 1.15 > c.height - 30 - top && size > 12) {
    size -= 1;
    ctx.font = `${style}${size}px ${face}`;
    lines = wrap(ctx, text, c.width - 32);
  }
  lines.forEach((l, i) => ctx.fillText(l, 16, top + 22 + size + i * size * 1.15));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A pinned photograph: white border, the picture once it loads, its caption underneath. */
function photoTexture(n: PinNote, aspect: number, onReady: () => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = Math.round(TEX_W / aspect);
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pad = 12;
  const capH = n.caption ? 30 : pad;
  const draw = (img?: HTMLImageElement) => {
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(0, 0, c.width, c.height);
    const w = c.width - pad * 2;
    const h = c.height - pad - capH;
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(pad, pad, w, h);
    if (img) {
      const s = Math.max(w / img.width, h / img.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, pad, w, h);
      ctx.clip();
      ctx.drawImage(img, pad + (w - img.width * s) / 2, pad + (h - img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore();
    }
    if (n.caption) {
      ctx.fillStyle = '#2a211a';
      ctx.font = 'italic 18px Georgia, serif';
      ctx.fillText(n.caption.slice(0, 32), pad, c.height - 10);
    }
    tex.needsUpdate = true;
  };
  draw();
  if (n.image) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { draw(img); onReady(); };
    img.src = n.image;
  }
  return tex;
}

/**
 * The case board's notes, pinned to a corkboard in a walkthrough. Build it once,
 * add `group` under the level's "Pinboard" node, and call `update` whenever the
 * board is fetched; it rebuilds only when the board has changed.
 */
export function createPinboard(size: [number, number]) {
  const group = new THREE.Group();
  const [W, H] = size;
  let last = '';
  const owned: { dispose: () => void }[] = [];
  const pinGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x9a1a14, roughness: 0.4 });

  const clear = () => {
    group.clear();
    for (const o of owned) o.dispose();
    owned.length = 0;
  };

  const update = (notes: PinNote[], threads: Threads) => {
    const key = JSON.stringify([notes, threads]);
    if (key === last) return;
    last = key;
    clear();
    if (!notes.length) return;

    // Keep the players' own arrangement, scaled to fit the cork.
    const centres = notes.map(n => {
      const px = n.w && n.h ? { w: n.w, h: n.h } : n.image ? IMAGE_PX : NOTE_PX;
      return { n, px, cx: n.x + px.w / 2, cy: n.y + px.h / 2 };
    });
    const xs = centres.map(c => c.cx);
    const ys = centres.map(c => c.cy);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = (lo: number, hi: number) => Math.max(hi - lo, 1);
    const s = Math.min(PX, (W - 0.5) / span(minX, maxX), (H - 0.4) / span(minY, maxY));
    // Paper shrinks with the layout, but not so far it can't be read up close.
    const paper = Math.max(0.55, Math.min(1, s / PX));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const at = new Map<string, THREE.Vector3>();
    centres.forEach(({ n, px, cx, cy }, i) => {
      const w = px.w * PX * paper;
      const h = px.h * PX * paper;
      // The node's -Z faces the room; someone facing the board has its -X on their right.
      const pos = new THREE.Vector3(-(cx - midX) * s, -(cy - midY) * s, -0.012 - i * 0.0006);
      at.set(n.id, pos);
      const geo = new THREE.PlaneGeometry(w, h);
      const tex = n.image ? photoTexture(n, w / h, () => {}) : noteTexture(n, w / h);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.rotation.set(0, Math.PI, THREE.MathUtils.degToRad(n.rotation ?? 0));
      mesh.receiveShadow = true;
      group.add(mesh);
      owned.push(geo, mat, tex);
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(pos.x, pos.y + h / 2 - 0.02, pos.z - 0.008);
      group.add(pin);
    });

    // Red string between connected notes, stretched pin to pin.
    const pts: number[] = [];
    const cols: number[] = [];
    const col = new THREE.Color();
    for (const t of threads) {
      const a = at.get(t.from), b = at.get(t.to);
      if (!a || !b) continue;
      col.set(t.color || '#e63946');
      pts.push(a.x, a.y + 0.03, -0.03, b.x, b.y + 0.03, -0.03);
      cols.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }
    if (pts.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true });
      group.add(new THREE.LineSegments(geo, mat));
      owned.push(geo, mat);
    }
  };

  const dispose = () => {
    clear();
    pinGeo.dispose();
    pinMat.dispose();
  };

  return { group, update, dispose };
}
