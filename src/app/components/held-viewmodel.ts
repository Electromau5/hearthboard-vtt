import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { HeldModel } from '@/lib/held-items';

/**
 * The inventory item in the investigator's right hand, first-person, for the
 * items that have a model (src/lib/held-items.ts) — the revolver, so far.
 * Like the Wood's lamp it is drawn in its own scene over the level after the
 * depth buffer is cleared, so it never sinks into a wall.
 *
 * Changing what is held lowers the old item out of view before the new one
 * comes up; models load on first use and are kept for the visit.
 */

/** Seconds to bring an item up, or put it away. */
const DRAW_SEC = 0.32;

export type HeldViewmodel = {
  /** Render after the level: `renderer.clearDepth()` then this. */
  render: (renderer: THREE.WebGLRenderer) => void;
  /** What to hold, or null for empty-handed. */
  setItem: (view: HeldModel | null) => void;
  /** How strongly the torch lights the hand, 0..1 — it follows the torch's flicker and switch. */
  setTorch: (k: number) => void;
  /** Advance by `dt`; `look` is how far the view turned this frame (yaw, pitch), `pace` 0..1 walking speed. */
  update: (dt: number, look: [number, number], pace: number) => void;
  /** Whether anything is on screen. */
  readonly visible: boolean;
  resize: (aspect: number) => void;
  dispose: () => void;
};

export function createHeldViewmodel(renderer: THREE.WebGLRenderer, aspect: number): HeldViewmodel {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.01, 5);
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(o: T) => { owned.push(o); return o; };

  // Dim reflected room for the steel, and a warm wash as if from the torch beside it.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = own(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0x4a5670, 0x0c0906, 0.3));
  const torchSpill = new THREE.DirectionalLight(0xffe0b0, 0.9);
  torchSpill.position.set(-0.4, 0.6, 0.5);
  scene.add(torchSpill);

  const skin = own(new THREE.MeshStandardMaterial({ color: 0xc89272, roughness: 0.7, envMapIntensity: 0.3 }));
  const cuff = own(new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85, envMapIntensity: 0.2 }));
  const sleeve = own(new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95, envMapIntensity: 0.1 }));

  const rig = new THREE.Group();      // sway and bob
  camera.add(rig);
  scene.add(camera);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  /** One built item (model and hand) per model file, made on first use. */
  const built = new Map<string, Promise<THREE.Group>>();

  /**
   * The model with the grip at the origin, and a right hand closed round it:
   * palm on the right of the grip, three fingers wrapped across its front, the
   * index finger forward along the trigger, thumb high on the left, then the
   * wrist, cuff and sleeve running back toward the camera.
   */
  const build = (view: HeldModel) => {
    let p = built.get(view.model);
    if (!p) {
      p = loader.loadAsync(view.model).then(gltf => {
        const item = new THREE.Group();
        const model = gltf.scene;
        model.rotation.set(...view.orient);
        model.scale.setScalar(view.scale);
        model.position.set(...view.grip).multiplyScalar(-view.scale).applyEuler(model.rotation);
        item.add(model);
        if (view.hand) {
          const add = (geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number], rot?: [number, number, number], parent: THREE.Object3D = item) => {
            own(geo);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(...at);
            if (rot) m.rotation.set(...rot);
            parent.add(m);
            return m;
          };
          // The grip rakes back about 15°; the hand follows it.
          const hand = new THREE.Group();
          hand.rotation.x = -0.26;
          item.add(hand);
          add(new RoundedBoxGeometry(0.026, 0.078, 0.062, 3, 0.012), skin, [0.022, -0.004, 0.006], undefined, hand);
          [-0.004, -0.022, -0.04].forEach((y, i) => {
            const len = [0.034, 0.033, 0.028][i];
            add(new THREE.CapsuleGeometry(0.0088 - i * 0.0004, len, 4, 10), skin, [0.004, y, -0.026], [0, 0, Math.PI / 2], hand);
            add(new THREE.SphereGeometry(0.0084 - i * 0.0004, 10, 8), skin, [-0.017, y, -0.016], undefined, hand);   // curled fingertip
          });
          // Index finger laid forward along the frame, over the trigger guard.
          add(new THREE.CapsuleGeometry(0.0086, 0.05, 4, 10), skin, [0.012, 0.016, -0.05], [Math.PI / 2, 0, 0.1], hand);
          // Thumb high on the left, pointing forward.
          add(new THREE.CapsuleGeometry(0.0095, 0.038, 4, 10), skin, [-0.016, 0.022, -0.012], [Math.PI / 2 - 0.35, 0, -0.2], hand);
          const wrist = new THREE.Group();
          wrist.position.set(0.028, -0.036, 0.04);
          wrist.rotation.set(-0.95, 0.2, 0.3);
          hand.add(wrist);
          add(new THREE.CylinderGeometry(0.023, 0.025, 0.07, 16), skin, [0, -0.03, 0], undefined, wrist);
          add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), cuff, [0, -0.07, 0], undefined, wrist);
          add(new THREE.CylinderGeometry(0.04, 0.046, 0.3, 20), sleeve, [0, -0.23, 0], undefined, wrist);
        }
        item.traverse(o => { o.frustumCulled = false; });
        item.visible = false;
        rig.add(item);
        return item;
      });
      built.set(view.model, p);
    }
    return p;
  };

  // ── State ───────────────────────────────────────────────────────
  let wanted: HeldModel | null = null;     // what should be in hand
  let shown: HeldModel | null = null;      // what is in hand (or going away)
  let shownItem: THREE.Group | null = null;
  let raise = 0;                           // 0 out of view .. 1 up
  let bobPhase = 0;
  const sway = new THREE.Vector2();
  const ease = (t: number) => t * t * (3 - 2 * t);
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const lowered = new THREE.Vector3();
  let disposed = false;

  return {
    render(r) {
      if (raise <= 0.001 || !shownItem) return;
      r.render(scene, camera);
    },
    setTorch(k) {
      torchSpill.intensity = 0.9 * THREE.MathUtils.clamp(k, 0, 1);
    },
    setItem(view) {
      wanted = view;
      if (view) void build(view).catch(err => console.error('Held item failed to load:', view.model, err));
    },
    update(dt, [dYaw, dPitch], pace) {
      // Put the old item away before the new one comes up.
      if (shown !== wanted) {
        raise = Math.max(0, raise - dt / DRAW_SEC);
        if (raise === 0) {
          if (shownItem) shownItem.visible = false;
          shown = wanted;
          shownItem = null;
        }
      }
      if (shown && !shownItem) {
        const view = shown;
        void build(view).then(item => {
          if (!disposed && shown === view) { shownItem = item; item.visible = true; }
        }).catch(() => {});
      }
      if (shown === wanted && shownItem) raise = Math.min(1, raise + dt / DRAW_SEC);

      sway.x = THREE.MathUtils.damp(sway.x, THREE.MathUtils.clamp(dYaw * 2.2, -0.06, 0.06), 10, dt);
      sway.y = THREE.MathUtils.damp(sway.y, THREE.MathUtils.clamp(dPitch * 2.2, -0.05, 0.05), 10, dt);
      bobPhase += dt * (4 + pace * 5);
      const bob = pace * 0.006;
      rig.position.set(sway.x * 0.4 + Math.cos(bobPhase) * bob, -sway.y * 0.4 + Math.abs(Math.sin(bobPhase)) * bob * 1.3, 0);
      rig.rotation.set(sway.y * 0.6, sway.x * 0.8, 0);

      if (shownItem && shown) {
        // Coming up from below and to the right, muzzle low.
        const r = ease(raise);
        const [x, y, z] = shown.pos;
        lowered.set(x + 0.05, y - 0.3, z + 0.1);
        shownItem.position.lerpVectors(lowered, new THREE.Vector3(x, y, z), r);
        qa.setFromEuler(new THREE.Euler(shown.rot[0] - 1.0, shown.rot[1] + 0.3, shown.rot[2]));
        qb.setFromEuler(new THREE.Euler(...shown.rot));
        shownItem.quaternion.slerpQuaternions(qa, qb, r);
      }
    },
    get visible() { return raise > 0.001 && !!shownItem; },
    resize(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposed = true;
      for (const p of built.values()) {
        void p.then(item => item.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) {
            for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
            mat.dispose();
          }
        })).catch(() => {});
      }
      for (const o of owned) o.dispose();
    },
  };
}
