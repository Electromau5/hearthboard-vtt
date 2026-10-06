import * as THREE from 'three';
import type { HeldModel } from '@/lib/held-items';
import type { GunSound } from './gun-sounds';

/**
 * Reloads for the guns that have one (`HeldModel.reload`), played on the gun
 * in the investigator's hands by held-viewmodel.ts (guns with arms, the
 * AK-74u and the Tommy gun, reload with their own clips instead):
 *
 *  - `muzzle` — the wheel-lock, a muzzle-loader: muzzle up, powder poured,
 *    the ball rammed home with two strokes of the ramrod, then brought down
 *    and spanned with its key and the dog lowered onto the pan (the model's
 *    own animation, first 2.95 s of it).
 *
 * Everything is in the gun's own frame: metres, barrel along -Z, +Y up.
 * Keyframes ease between each other.
 */

export type ReloadRig = {
  duration: number;
  cues: [number, GunSound][];
  /** Poses the parts for `t` seconds in, and returns the gun's own offset to add to its hold. */
  apply: (t: number) => { pos: THREE.Vector3; rot: THREE.Euler };
  /** Back to how it was before the reload (parts home, ramrod away). */
  reset: () => void;
};

type Key = [number, ...number[]];

/** The value of a keyframe track at `t`, eased between keys. */
function sample(track: Key[], t: number): number[] {
  if (t <= track[0][0]) return track[0].slice(1);
  for (let i = 1; i < track.length; i++) {
    const [t1, ...b] = track[i];
    if (t <= t1) {
      const [t0, ...a] = track[i - 1];
      const u = (t - t0) / Math.max(t1 - t0, 1e-6);
      const s = u * u * (3 - 2 * u);
      return a.map((v, k) => v + (b[k] - v) * s);
    }
  }
  return track[track.length - 1].slice(1);
}

const out = { pos: new THREE.Vector3(), rot: new THREE.Euler() };

/**
 * Sets up the reload for a built gun, or returns null if it has none.
 * `item` is the gun in hand (gun frame); `model` the glTF scene inside it;
 * `clips` the glTF's animations.
 */
export function rigReload(view: HeldModel, item: THREE.Group, model: THREE.Object3D, clips: THREE.AnimationClip[]): ReloadRig | null {
  if (view.reload === 'muzzle') return muzzleReload(item, model, clips);
  return null;
}

// ── Wheel-lock ────────────────────────────────────────────────────

/** Where the bore opens, in the gun's frame: the middle of the model's most forward vertices. */
function findMuzzle(item: THREE.Group): THREE.Vector3 {
  item.updateMatrixWorld(true);
  const toItem = new THREE.Matrix4().copy(item.matrixWorld).invert();
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  item.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    const toLocal = new THREE.Matrix4().multiplyMatrices(toItem, m.matrixWorld);
    // A skinned gun's vertices only sit where they are drawn once its bones are applied.
    const skinned = (m as THREE.SkinnedMesh).isSkinnedMesh ? (m as THREE.SkinnedMesh) : null;
    skinned?.skeleton.update();
    for (let i = 0; i < pos.count; i += 3) {
      if (skinned) skinned.getVertexPosition(i, v);
      else v.fromBufferAttribute(pos, i);
      pts.push(v.applyMatrix4(toLocal).clone());
    }
  });
  let front = Infinity;
  for (const p of pts) front = Math.min(front, p.z);
  const near = pts.filter(p => p.z < front + 0.03);
  const c = near.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(Math.max(near.length, 1));
  return c.setZ(front);
}

function muzzleReload(item: THREE.Group, model: THREE.Object3D, clips: THREE.AnimationClip[]): ReloadRig {
  const muzzle = findMuzzle(item);
  // The ramrod: a long hickory rod with a brass tip, lying along the barrel.
  const ROD = 0.95;
  const rod = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, ROD, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.6 }));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xb58a3c, metalness: 1, roughness: 0.35 }));
  tip.position.y = -ROD / 2;
  rod.add(wood, tip);
  rod.rotation.x = -Math.PI / 2;   // the rod's -Y (its tip) down the bore, toward +Z
  rod.visible = false;
  rod.traverse(o => { o.frustumCulled = false; });
  item.add(rod);

  // The model's own lock: spanning the wheel and lowering the dog.
  const mixer = new THREE.AnimationMixer(model);
  const action = clips[0] ? mixer.clipAction(clips[0]) : null;
  if (action) { action.play(); action.paused = true; action.time = 0; mixer.update(0); }
  const SPAN_FROM = 3.1;
  const SPAN_SEC = 2.95;

  // Gun: [t, x, y, z, pitch, yaw, roll] — muzzle raised to load (low and to the
  // right, so the muzzle and the rod stay in view), then turned so the lock shows.
  const gun: Key[] = [
    [0, 0, 0, 0, 0, 0, 0],
    [0.6, 0.03, -0.17, -0.1, 0.62, 0.16, 0.12],
    [2.55, 0.03, -0.17, -0.1, 0.62, 0.16, 0.12],
    [3.1, -0.07, 0.03, -0.05, 0.12, 0.38, -0.35],
    [6.05, -0.07, 0.03, -0.05, 0.12, 0.38, -0.35],
    [6.5, 0, 0, 0, 0, 0, 0],
  ];
  // Ramrod: [t, shown, how far down the bore its tip is (m)].
  const ram: Key[] = [
    [0, 0, -0.2], [0.95, 0, -0.2],
    [1.0, 1, -0.2], [1.2, 1, 0], [1.55, 1, 0.42],     // first stroke
    [1.75, 1, 0.06], [2.1, 1, 0.45],                  // second, the ball seated
    [2.45, 1, -0.25], [2.5, 0, -0.25],
  ];

  return {
    duration: 6.5,
    cues: [[0.65, 'pour'], [1.22, 'rod'], [1.55, 'thunk'], [1.78, 'rod'], [2.1, 'thunk'], [2.18, 'rod'],
      [SPAN_FROM + 0.1, 'click'], [SPAN_FROM + 0.43, 'ratchet'], [SPAN_FROM + 2.0, 'click'], [SPAN_FROM + 2.25, 'click']],
    apply(t) {
      const [x, y, z, rx, ry, rz] = sample(gun, t);
      const [shown, depth] = sample(ram, t);
      rod.visible = shown > 0.5;
      // The rod's centre sits half its length back from its tip.
      rod.position.set(muzzle.x, muzzle.y, muzzle.z + depth - ROD / 2);
      if (action) {
        action.time = THREE.MathUtils.clamp(t - SPAN_FROM, 0, SPAN_SEC);
        mixer.update(0);
      }
      out.pos.set(x, y, z);
      out.rot.set(rx, ry, rz);
      return out;
    },
    // The lock keeps its spanned, dog-down state between reloads; only the rod goes away.
    reset() { rod.visible = false; },
  };
}
