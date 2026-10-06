import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ArmsRig, HeldModel } from '@/lib/held-items';
import { rigReload, type ReloadRig } from './reloads';
import type { GunSounds } from './gun-sounds';

/**
 * The inventory item in the investigator's right hand, first-person, for the
 * items that have a model (src/lib/held-items.ts) — the revolver, so far.
 * Like the Wood's lamp it is drawn in its own scene over the level after the
 * depth buffer is cleared, so it never sinks into a wall.
 *
 * Changing what is held lowers the old item out of view before the new one
 * comes up; models load on first use and are kept for the visit.
 *
 * A gun made with its own arms and clips (`HeldModel.arms`, the AK-74u) is
 * played rather than posed: drawn, idled, fired, reloaded, inspected and
 * holstered by its clips, seen from the eye it was made for, which slides to
 * the sights while aiming.
 */

/** Seconds to bring an item up, or put it away. */
const DRAW_SEC = 0.32;

/**
 * A model as made, turned and scaled to `view` (see HeldModel): its barrel
 * along -Z, +Y up, real size, and the grip at the origin. Also gives where the
 * left hand goes, in the same space, for long guns. Shared by the hand and by
 * pickups lying in a level, so both agree.
 */
export function prepareHeldModel(model: THREE.Object3D, view: HeldModel): { root: THREE.Group; support: THREE.Vector3 | null } {
  // A rig with arms lies on a bench as the gun alone: no arms, no spare magazine.
  if (view.arms) {
    const { benchHide, benchCollapse, gunBone } = view.arms;
    const drop: THREE.Object3D[] = [];
    const fold: THREE.Object3D[] = [];
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh && [m.material].flat().some(mat => benchHide.includes(mat.name))) drop.push(m);
      if (benchCollapse.includes(o.name)) fold.push(o);
    });
    for (const o of drop) o.removeFromParent();
    // Folded into the gun, or the point it shrinks to still stretches the box.
    model.updateMatrixWorld(true);
    const into = model.getObjectByName(gunBone)?.getWorldPosition(new THREE.Vector3());
    for (const o of fold) {
      if (into && o.parent) o.position.copy(o.parent.worldToLocal(into.clone()));
      o.scale.setScalar(0);
    }
    model.updateMatrixWorld(true);
    model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.update(); });
  }
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const at = (f: [number, number, number]) => new THREE.Vector3(...f).multiply(size).add(box.min);
  const grip = at(view.gripAt);
  const inner = new THREE.Group();
  inner.add(model);
  inner.position.copy(grip).negate();
  const root = new THREE.Group();
  root.rotation.set(...view.orient);
  root.scale.setScalar(view.length / Math.max(size.x, size.y, size.z));
  root.add(inner);
  root.updateMatrix();
  const support = view.supportAt ? at(view.supportAt).sub(grip).applyMatrix4(root.matrix) : null;
  root.traverse(o => { o.frustumCulled = false; });
  return { root, support };
}

export type HeldViewmodel = {
  /** Render after the level: `renderer.clearDepth()` then this. */
  render: (renderer: THREE.WebGLRenderer) => void;
  /** What to hold, or null for empty-handed. */
  setItem: (view: HeldModel | null) => void;
  /** Loads and builds an item ahead of time, so it comes up (and reloads) at once when taken. */
  preload: (view: HeldModel) => void;
  /** How strongly the torch lights the hand, 0..1 — it follows the torch's flicker and switch. */
  setTorch: (k: number) => void;
  /** Advance by `dt`; `look` is how far the view turned this frame (yaw, pitch), `pace` 0..1 walking speed. */
  update: (dt: number, look: [number, number], pace: number) => void;
  /** Reloads what is in hand, if it can be (see reloads.ts) and is not already; false if not. */
  reload: (sounds: GunSounds | null) => boolean;
  /** A gun with arms: the trigger held or let go, aiming down the sights or not. */
  setTrigger: (down: boolean) => void;
  setAim: (down: boolean) => void;
  /** A gun with arms: turn it over to look at it; false if busy. */
  inspect: () => boolean;
  /** Shots and dry clicks since the last call (for the flash on the level, the holes and the sound). */
  takeShots: () => { shots: number; dry: number };
  /** How far into aiming down the sights, 0..1. */
  readonly aim: number;
  /** Rounds left, for a gun with arms in hand; null otherwise. */
  readonly ammo: { rounds: number; max: number } | null;
  /** A reload is under way. */
  readonly reloading: boolean;
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
  // The muzzle flash lighting the hands and the gun, out ahead of them.
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 1.6, 2);
  muzzleLight.position.set(0.06, -0.04, -0.6);
  camera.add(muzzleLight);
  const flashTex = own((() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,250,225,1)');
    g.addColorStop(0.25, 'rgba(255,200,110,0.9)');
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    // A four-pointed star of flame round a hot core.
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 14 : i % 4 ? 40 : 64;
      const a = (i / 16) * Math.PI * 2;
      ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })());

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
  /** Each built item's reload, where it has one. */
  const rigs = new Map<THREE.Group, ReloadRig>();
  /** Built guns with arms, and how each is being played. */
  const armsBy = new Map<THREE.Group, ArmsPlay>();
  let trigger = false;
  let aiming = false;
  let shotsOut = 0;
  let dryOut = 0;

  type Clip = keyof ArmsRig['clips'];
  type ArmsPlay = {
    rig: ArmsRig;
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    acts: Record<Clip, THREE.AnimationAction>;
    current: THREE.AnimationAction | null;
    /** What the clip playing is for, and seconds until it is done; null at idle. */
    busy: 'draw' | 'shoot' | 'reload' | 'inspect' | 'holster' | null;
    left: number;
    rounds: number;
    cooldown: number;
    /** A dry click per press of the trigger, not per frame. */
    clicked: boolean;
    aim: number;
    flash: THREE.Sprite;
    flashFor: number;
    hush: (() => void) | null;
  };

  const buildArms = (view: HeldModel & { arms: ArmsRig }, gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => {
    const rig = view.arms;
    const item = new THREE.Group();
    const model = gltf.scene;
    item.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const acts = Object.fromEntries(Object.entries(rig.clips).map(([k, name]) => {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (!clip) throw new Error(`${view.model} has no clip ${name}`);
      const act = mixer.clipAction(clip);
      if (k !== 'idle') { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
      return [k, act];
    })) as Record<Clip, THREE.AnimationAction>;
    // The flash rides the gun's own bone, so it follows the recoil.
    const flash = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
    flash.visible = false;
    const bone = model.getObjectByName(rig.gunBone);
    if (bone) {
      bone.add(flash);
      flash.position.set(...rig.muzzle);
      model.updateMatrixWorld(true);
      flash.scale.setScalar(0.13 / bone.getWorldScale(new THREE.Vector3()).x);
    }
    model.traverse(o => { o.frustumCulled = false; });
    armsBy.set(item, { rig, model, mixer, acts, current: null, busy: null, left: 0, rounds: rig.rounds, cooldown: 0, clicked: false, aim: 0, flash, flashFor: 0, hush: null });
    return item;
  };

  /** Starts a clip from its beginning, fading the others out. */
  const play = (st: ArmsPlay, clip: Clip, fade: number, busy: ArmsPlay['busy']) => {
    const act = st.acts[clip];
    for (const a of Object.values(st.acts)) if (a !== act && a.isRunning()) a.fadeOut(fade);
    act.reset().setEffectiveWeight(1).fadeIn(fade).play();
    st.current = act;
    st.busy = busy;
    st.left = busy ? act.getClip().duration : 0;
  };
  const stopArms = (st: ArmsPlay) => {
    st.hush?.();
    st.hush = null;
    st.mixer.stopAllAction();
    st.current = null;
    st.busy = null;
    st.flash.visible = false;
  };

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
        if (view.arms) {
          const item = buildArms(view as HeldModel & { arms: ArmsRig }, gltf);
          item.visible = false;
          rig.add(item);
          return item;
        }
        const item = new THREE.Group();
        const { root, support } = prepareHeldModel(gltf.scene, view);
        item.add(root);
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
          // A long gun's fore-grip: the left hand cupped under it, its forearm
          // running back and down out of the bottom of the view.
          if (support) {
            const left = new THREE.Group();
            left.position.copy(support);
            item.add(left);
            add(new RoundedBoxGeometry(0.07, 0.026, 0.06, 3, 0.011), skin, [0, -0.03, 0], [0, 0, 0.15], left);
            [-0.02, 0, 0.02].forEach(z => add(new THREE.CapsuleGeometry(0.0085, 0.03, 4, 10), skin, [0.03, -0.006, z], [0, 0, 0.5], left));
            add(new THREE.CapsuleGeometry(0.0095, 0.03, 4, 10), skin, [-0.028, -0.004, 0.006], [0, 0, -0.5], left);
            const arm = new THREE.Group();
            arm.position.set(-0.01, -0.05, 0.03);
            arm.rotation.set(-1.15, -0.25, -0.25);
            left.add(arm);
            add(new THREE.CylinderGeometry(0.022, 0.025, 0.08, 16), skin, [0, -0.04, 0], undefined, arm);
            add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 20), cuff, [0, -0.085, 0], undefined, arm);
            add(new THREE.CylinderGeometry(0.04, 0.046, 0.34, 20), sleeve, [0, -0.26, 0], undefined, arm);
          }
        }
        item.traverse(o => { o.frustumCulled = false; });
        const reload = rigReload(view, item, gltf.scene, gltf.animations);
        if (reload) rigs.set(item, reload);
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
  const qr = new THREE.Quaternion();
  let disposed = false;
  // The reload playing, if any: its rig, how far in, and how to silence it.
  let reloading: { rig: ReloadRig; t: number; hush: () => void } | null = null;
  const armsNow = () => (shownItem ? armsBy.get(shownItem) ?? null : null);
  const endReload = () => {
    if (!reloading) return;
    reloading.rig.reset();
    reloading.hush();
    reloading = null;
  };

  return {
    render(r) {
      if (raise <= 0.001 || !shownItem) return;
      r.render(scene, camera);
    },
    setTorch(k) {
      torchSpill.intensity = 0.9 * THREE.MathUtils.clamp(k, 0, 1);
    },
    preload(view) {
      void build(view).catch(err => console.error('Held item failed to load:', view.model, err));
    },
    setItem(view) {
      wanted = view;
      if (view) void build(view).catch(err => console.error('Held item failed to load:', view.model, err));
    },
    update(dt, [dYaw, dPitch], pace) {
      // Put the old item away before the new one comes up; a reload stops where it is.
      if (shown !== wanted) {
        endReload();
        // A gun with arms is holstered by its own clip.
        const st = armsNow();
        if (st && st.busy !== 'holster') { st.hush?.(); st.hush = null; play(st, 'holster', 0.08, 'holster'); }
        raise = Math.max(0, raise - dt / (st ? st.acts.holster.getClip().duration : DRAW_SEC));
        if (raise === 0) {
          if (st) stopArms(st);
          if (shownItem) shownItem.visible = false;
          shown = wanted;
          shownItem = null;
        }
      }
      if (shown && !shownItem) {
        const view = shown;
        void build(view).then(item => {
          if (!disposed && shown === view) {
            shownItem = item;
            item.visible = true;
            const st = armsBy.get(item);
            if (st) play(st, 'draw', 0, 'draw');
          }
        }).catch(() => {});
      }
      if (shown === wanted && shownItem) raise = Math.min(1, raise + dt / DRAW_SEC);

      sway.x = THREE.MathUtils.damp(sway.x, THREE.MathUtils.clamp(dYaw * 2.2, -0.06, 0.06), 10, dt);
      sway.y = THREE.MathUtils.damp(sway.y, THREE.MathUtils.clamp(dPitch * 2.2, -0.05, 0.05), 10, dt);
      bobPhase += dt * (4 + pace * 5);
      // Down the sights, the gun is held steady.
      const steady = 1 - 0.85 * (armsNow()?.aim ?? 0);
      const bob = pace * 0.006 * steady;
      rig.position.set((sway.x * 0.4 + Math.cos(bobPhase) * bob) * steady, (-sway.y * 0.4 + Math.abs(Math.sin(bobPhase)) * bob * 1.3) * steady, 0);
      rig.rotation.set(sway.y * 0.6 * steady, sway.x * 0.8 * steady, 0);

      const st = armsNow();
      if (st && shownItem) {
        shownItem.position.set(0, 0, 0);
        shownItem.quaternion.identity();
        st.cooldown -= dt;
        const ready = shown === wanted && raise >= 1;
        // Fire while the trigger is held: the shot cuts through an inspection, not a draw or a reload.
        if (trigger && ready && (!st.busy || st.busy === 'shoot' || st.busy === 'inspect')) {
          if (st.rounds > 0 && st.cooldown <= 0) {
            st.rounds--;
            st.cooldown = 60 / st.rig.rpm;
            play(st, 'shoot', 0.02, 'shoot');
            st.flashFor = 0.05;
            st.flash.material.rotation = Math.random() * Math.PI;
            shotsOut++;
          } else if (st.rounds === 0 && !st.clicked) {
            st.clicked = true;
            dryOut++;
          }
        }
        if (!trigger) st.clicked = false;
        // A clip done goes back to idle; a reload done fills the magazine.
        if (st.busy && (st.left -= dt) <= 0.12 && st.busy !== 'holster') {
          if (st.busy === 'reload') { st.rounds = st.rig.rounds; st.hush = null; }
          play(st, 'idle', 0.18, null);
        }
        st.aim = THREE.MathUtils.damp(st.aim, aiming && ready && (!st.busy || st.busy === 'shoot') ? 1 : 0, 14, dt);
        const [hx, hy, hz] = st.rig.eye;
        const [ax, ay, az] = st.rig.aimEye;
        st.model.position.set(-(hx + (ax - hx) * st.aim), -(hy + (ay - hy) * st.aim), -(hz + (az - hz) * st.aim));
        st.mixer.update(dt);
        st.flashFor -= dt;
        st.flash.visible = st.flashFor > 0;
        muzzleLight.intensity = st.flashFor > 0 ? 6 : 0;
        const fov = st.rig.fov + (st.rig.aimFov - st.rig.fov) * st.aim;
        if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      } else {
        muzzleLight.intensity = 0;
        if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
      }

      if (shownItem && shown && !st) {
        // Coming up from below and to the right, muzzle low.
        const r = ease(raise);
        const [x, y, z] = shown.pos;
        lowered.set(x + 0.05, y - 0.3, z + 0.1);
        shownItem.position.lerpVectors(lowered, new THREE.Vector3(x, y, z), r);
        qa.setFromEuler(new THREE.Euler(shown.rot[0] - 1.0, shown.rot[1] + 0.3, shown.rot[2]));
        qb.setFromEuler(new THREE.Euler(...shown.rot));
        shownItem.quaternion.slerpQuaternions(qa, qb, r);
        // The reload's own movement, on top of the hold.
        if (reloading) {
          reloading.t += dt;
          const off = reloading.rig.apply(Math.min(reloading.t, reloading.rig.duration));
          shownItem.position.add(off.pos);
          shownItem.quaternion.multiply(qr.setFromEuler(off.rot));
          if (reloading.t >= reloading.rig.duration) endReload();
        }
      }
    },
    reload(sounds) {
      if (reloading || !shownItem || shown !== wanted || raise < 0.99) return false;
      const st = armsNow();
      if (st) {
        if ((st.busy && st.busy !== 'shoot' && st.busy !== 'inspect') || st.rounds === st.rig.rounds) return false;
        const empty = st.rounds === 0;
        play(st, empty ? 'reloadEmpty' : 'reload', 0.15, 'reload');
        st.hush = sounds ? sounds.play(empty ? st.rig.reloadEmptyCues : st.rig.reloadCues) : null;
        return true;
      }
      const r = rigs.get(shownItem);
      if (!r) return false;
      reloading = { rig: r, t: 0, hush: sounds ? sounds.play(r.cues) : () => {} };
      return true;
    },
    get reloading() { return !!reloading || armsNow()?.busy === 'reload'; },
    setTrigger(down) { trigger = down; },
    setAim(down) { aiming = down; },
    inspect() {
      const st = armsNow();
      if (!st || st.busy || shown !== wanted || raise < 0.99) return false;
      play(st, 'inspect', 0.2, 'inspect');
      return true;
    },
    takeShots() {
      const out = { shots: shotsOut, dry: dryOut };
      shotsOut = dryOut = 0;
      return out;
    },
    get aim() { return armsNow()?.aim ?? 0; },
    get ammo() {
      const st = armsNow();
      return st && shown === wanted ? { rounds: st.rounds, max: st.rig.rounds } : null;
    },
    get visible() { return raise > 0.001 && !!shownItem; },
    resize(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposed = true;
      endReload();
      for (const st of armsBy.values()) stopArms(st);
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
