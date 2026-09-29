import * as THREE from 'three';

const FADE_FROM = 10;   // metres: fully visible nearer than this
const FADE_TO = 15;     // gone beyond this
const SIZE = 0.16;      // world size of a marker, metres

/** A brass ring with a diamond in it, drawn once and shared by every marker. */
function markerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#e0b56e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2d39a';
  ctx.beginPath();
  ctx.moveTo(64, 38);
  ctx.lineTo(88, 64);
  ctx.lineTo(64, 90);
  ctx.lineTo(40, 64);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Floating markers over everything in a walkthrough that can be examined or
 * used, so players can see what is interactive. They bob gently, fade out with
 * distance, hide behind walls (depth-tested), and the one in focus swells.
 */
export function createInteractMarkers(targets: { id: string; box: THREE.Box3 }[]) {
  const group = new THREE.Group();
  const tex = markerTexture();
  const items = targets.map((t, i) => {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    const sprite = new THREE.Sprite(mat);
    const c = t.box.getCenter(new THREE.Vector3());
    const base = new THREE.Vector3(c.x, t.box.max.y + 0.22, c.z);
    sprite.position.copy(base);
    sprite.scale.setScalar(SIZE);
    sprite.renderOrder = 10;
    group.add(sprite);
    return { id: t.id, sprite, mat, base, phase: i * 1.7 };
  });

  const update = (camera: THREE.Vector3, t: number, focusId: string | null) => {
    for (const m of items) {
      const d = camera.distanceTo(m.base);
      const fade = THREE.MathUtils.clamp((FADE_TO - d) / (FADE_TO - FADE_FROM), 0, 1);
      const focused = m.id === focusId;
      m.sprite.visible = fade > 0;
      m.mat.opacity = fade * (focused ? 1 : 0.7 + 0.2 * Math.sin(t * 2.4 + m.phase));
      m.sprite.position.set(m.base.x, m.base.y + Math.sin(t * 1.6 + m.phase) * 0.03, m.base.z);
      // Grow with distance past arm's length, so far markers stay legible on screen.
      m.sprite.scale.setScalar(SIZE * Math.max(1, d / 3.5) * (focused ? 1.45 : 1));
    }
  };

  const dispose = () => {
    for (const m of items) m.mat.dispose();
    tex.dispose();
    group.clear();
  };

  return { group, update, dispose };
}
