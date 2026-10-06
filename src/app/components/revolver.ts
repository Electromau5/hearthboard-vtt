import * as THREE from 'three';
import type { HeldModel, RevolverRig } from '@/lib/held-items';
import { sample, type Key } from './reloads';
import type { GunSound, GunSounds } from './gun-sounds';
import type { SpentCase } from './held-viewmodel';

/**
 * The Detective Special in borrowed hands (held-items.ts `revolver`): the
 * AK-74u rig's arms, with its own gun hidden, posed rather than played. The
 * rig's idle clip gives the fingers and the breathing; the gun is placed in
 * view and each hand is reached to it by two-bone IK — the right to its grip,
 * the left wrapped under it — so the same hands can do what no clip in the
 * rig does: work the trigger double-action, swing the crane out, punch the
 * ejector rod and feed the chambers one round at a time.
 *
 *  - Fire (left click, once per press): the trigger comes back, the hammer
 *    rises and the cylinder turns a chamber (clockwise from behind, as a Colt
 *    does); the hammer falls on a live round or clicks on a spent one. The
 *    cases stay in the gun.
 *  - Reload (R): the cylinder swung out, muzzle up, the rod punched so all six
 *    drop to the floor, muzzle down, six rounds from the pocket seated one by
 *    one with the cylinder turned a chamber between each, then snapped shut.
 *  - Inspect (V): swung out, the chambers looked over, spun, flicked shut.
 *
 * Frames: "gun frame" is the revolver's own, metres, its grip at the origin,
 * barrel along -Z, +Y up. Hold poses are in the hands' camera space.
 */

type V3 = [number, number, number];
/** A hand reached for in the gun frame: the wrist, which way the fingers run, which way the palm faces. */
type Reach = { at: V3; fingers: V3; palm: V3 };

export type Revolver = {
  /** The arms and the gun, to hang under the viewmodel's sway. */
  item: THREE.Group;
  /** After the clip, pose it all: `raise` 0 (away) .. 1 (up), the trigger and aim held or not, `ready` when it may fire. */
  update: (dt: number, s: { raise: number; trigger: boolean; aiming: boolean; ready: boolean }) => void;
  reload: (sounds: GunSounds | null) => boolean;
  inspect: (sounds: GunSounds | null) => boolean;
  /** Put away: whatever was under way stops where it is (rounds seated so far stay seated). */
  stop: () => void;
  readonly busy: 'reload' | 'inspect' | null;
  readonly aim: number;
  readonly fov: number;
  readonly rounds: number;
  readonly max: number;
};

const ROUNDS = 6;
const STEP = Math.PI / 3;
/** Double-action pull, seconds; and how soon after a shot the trigger can be pulled again. */
const PULL = 0.11;
const RESET = 0.22;
const HAMMER_BACK = 0.62;   // radians, about its pin
const TRIGGER_BACK = -0.38;
const CRANE_OUT = 1.45;     // radians, about the crane's pivot below the barrel
const RELOAD_SEC = 4.6;
const INSPECT_SEC = 2.7;

/**
 * The reload, beat by beat (seconds). Gun poses are camera space, [x, y, z,
 * pitch, yaw, roll], the hold itself at either end.
 */
const LOAD = { from: 1.3, each: 0.4 };
const RELOAD_GUN: Key[] = [
  [0.3, 0.05, -0.12, -0.33, 0.15, 0.1, -0.45],    // brought in, rolled right: thumb on the latch
  [0.55, 0.04, -0.11, -0.32, 0.25, 0.1, -0.6],    // the cylinder falls open to the left
  [0.85, 0.03, -0.08, -0.3, 1.2, 0.15, 0],        // muzzle up
  [0.92, 0.03, -0.075, -0.3, 1.25, 0.15, 0],
  [1.0, 0.03, -0.085, -0.3, 1.18, 0.15, 0],       // the rod punched: a jolt
  [1.3, -0.03, -0.06, -0.34, -0.876, 0.655, 0.395],   // muzzle down, the chambers turned up to the right hand
  [3.7, -0.03, -0.06, -0.34, -0.876, 0.655, 0.395],
  [3.95, 0.04, -0.12, -0.32, 0.05, 0.25, 0.35],   // upright, rolled left: the cylinder swings home
  [4.1, 0.05, -0.13, -0.33, 0.05, 0.25, 0.2],
];
const RELOAD_CRANE: Key[] = [[0, 0], [0.35, 0], [0.55, 1], [3.95, 1], [4.08, 0]];
/** How far the rod has pushed the cases out of their chambers (m); they fall at EJECTED. */
const RELOAD_EJECT: Key[] = [[0, 0], [0.9, 0], [0.98, 0.026]];
const EJECTED = 0.98;
/** The right hand on the grip (1) or off it (0): away to the pocket, then feeding rounds. */
const RELOAD_GRIP: Key[] = [[0, 1], [0.6, 1], [0.8, 0], [3.72, 0], [3.95, 1]];
const RELOAD_CUES: [number, GunSound][] = [
  [0.3, 'latch'], [0.42, 'crane'], [0.93, 'eject'],
  ...Array.from({ length: ROUNDS }, (_, j): [number, GunSound][] => [
    [LOAD.from + j * LOAD.each + 0.27, 'round'],
    [LOAD.from + j * LOAD.each + 0.37, 'index'],
  ]).flat(),
  [4.06, 'close'],
];

const INSPECT_GUN: Key[] = [
  [0.35, 0.05, -0.12, -0.33, 0.15, 0.1, -0.5],
  [0.6, 0.03, -0.1, -0.3, 0.05, 0.45, -0.75],     // open, turned to look into the chambers
  [1.7, 0.03, -0.1, -0.3, 0.12, 0.5, -0.7],
  [1.95, 0.05, -0.12, -0.33, 0.1, 0.2, 0.55],     // flicked over to the left: shut
  [2.15, 0.05, -0.12, -0.33, 0.08, 0.2, 0.3],
];
const INSPECT_CRANE: Key[] = [[0, 0], [0.4, 0], [0.6, 1], [1.88, 1], [1.98, 0]];
/** The spin: turns of the cylinder (in chambers), coasting to a stop on a chamber. */
const INSPECT_SPIN: Key[] = [[0, 0], [0.85, 0], [1.6, 12]];
const INSPECT_CUES: [number, GunSound][] = [[0.35, 'latch'], [0.47, 'crane'], [0.85, 'spin'], [1.96, 'close']];

/** The left hand: wrapped under the right at the hip, cradling the frame with the crane open, its thumb on the rod. */
const CRADLE: Reach = { at: [-0.045, -0.025, -0.01], fingers: [0.35, 0.45, -0.8], palm: [0.6, 0.8, 0.1] };
const THUMB_ROD: Reach = { at: [-0.04, -0.02, -0.03], fingers: [0.3, 0.55, -0.75], palm: [0.6, 0.75, 0.2] };
/**
 * Rounds go into the chamber that is two along from the top at rest: with the
 * crane out it sits at one o'clock, nearest the right hand.
 */
const FEED_AT = 2;
/** The right hand feeding a round, in the camera's frame: in from the right, fingers to the left. */
const FEED = { fingers: [-0.8, -0.5, -0.4] as V3, palm: [-0.3, -0.6, 0.7] as V3 };
const reachKeys = (keys: [number, Reach][]): Key[] => keys.map(([t, r]) => [t, ...r.at, ...r.fingers, ...r.palm]);

export function createRevolver(
  view: HeldModel & { revolver: RevolverRig },
  gun: THREE.Group,
  rigGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] },
  prepare: (model: THREE.Object3D, view: HeldModel) => { root: THREE.Group },
  hands: THREE.Camera,
  flashMaterial: THREE.SpriteMaterial,
  emit: { shot: () => void; dry: () => void; drop: (c: SpentCase) => void },
): Revolver {
  const cfg = view.revolver;
  const item = new THREE.Group();
  const model = rigGltf.scene;
  item.add(model);
  model.position.set(...cfg.eye).negate();
  model.updateMatrixWorld(true);
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && [m.material].flat().some(mat => cfg.hide.includes(mat.name))) m.visible = false;
  });
  const bone = (name: string) => {
    const b = model.getObjectByName(name);
    if (!b) throw new Error(`${cfg.rig} has no bone ${name}`);
    return b;
  };
  const gunBone = bone(cfg.gunBone);
  const [rUpper, rFore, rHand] = cfg.arms.right.map(bone);
  const [lUpper, lFore, lHand] = cfg.arms.left.map(bone);
  const [rThumb, rIndex] = cfg.arms.rightTips.map(bone);

  // The revolver, its grip where the rig's right hand closes, carried by the gun bone.
  const { root } = prepare(gun, view);
  const holder = new THREE.Group();
  holder.position.set(...cfg.mount);
  holder.add(root);
  model.add(holder);
  model.updateMatrixWorld(true);
  gunBone.attach(holder);

  const part = (name: string) => {
    const p = gun.getObjectByName(name);
    if (!p) throw new Error(`${view.model} has no ${name}`);
    return p;
  };
  const hammer = part(cfg.parts.hammer);
  const trigger = part(cfg.parts.trigger);
  const crane = part(cfg.parts.crane);
  const cylinder = part(cfg.parts.cylinder);
  const rest = new Map([hammer, trigger, crane, cylinder].map(b => [b, b.quaternion.clone()]));

  // ── The six rounds, out of the skinned mesh and onto the cylinder ──────
  // Each is its own mesh in the cylinder's frame (its axis is the cylinder's
  // +Y), so it can be pushed out, dropped, and seated again one at a time.
  let roundsMesh: THREE.SkinnedMesh | null = null;
  gun.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && [m.material].flat().some(mat => mat.name === cfg.parts.rounds)) roundsMesh = m;
  });
  if (!roundsMesh) throw new Error(`${view.model} has no ${cfg.parts.rounds} mesh`);
  const chambers = splitRounds(roundsMesh, cylinder as THREE.Bone);
  for (const c of chambers) cylinder.add(c.mesh);
  (roundsMesh as THREE.SkinnedMesh).visible = false;
  const toLocalLen = 1 / cylinder.getWorldScale(new THREE.Vector3()).x * holder.getWorldScale(new THREE.Vector3()).x;
  type Chamber = 'live' | 'spent' | 'empty';
  const state: Chamber[] = Array(ROUNDS).fill('live');

  // ── Where the bore, the muzzle and the sights are, in the gun frame ─────
  model.updateMatrixWorld(true);
  const toGun = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const top = chambers[0].center.clone().applyMatrix4(cylinder.matrixWorld).applyMatrix4(toGun);
  const pts = gunPoints(gun, toGun);
  const front = pts.reduce((m, p) => Math.min(m, p.z), Infinity);
  const muzzle = new THREE.Vector3(top.x, top.y, front);
  const cylRear = chambers.reduce((m, c) => Math.max(m, c.rear.clone().applyMatrix4(cylinder.matrixWorld).applyMatrix4(toGun).z), -Infinity);
  // Front sight: the highest point in the last centimetre; rear: the top strap's groove over the cylinder's back.
  const frontSight = pts.filter(p => p.z < front + 0.012 && Math.abs(p.x) < 0.004).reduce((m, p) => (p.y > m.y ? p : m), new THREE.Vector3(0, -1, 0));
  const rearSight = pts.filter(p => Math.abs(p.z - cylRear) < 0.006 && Math.abs(p.x) < 0.0025).reduce((m, p) => (p.y > m.y ? p : m), new THREE.Vector3(0, -1, 0));
  rearSight.setX(0);
  frontSight.setX(0);

  // The muzzle flash, at the muzzle.
  const flash = new THREE.Sprite(flashMaterial);
  flash.visible = false;
  flash.position.copy(muzzle);
  flash.scale.setScalar(0.09);
  holder.add(flash);
  let flashFor = 0;

  // ── Poses ────────────────────────────────────────────────────────────
  const m4 = (pos: V3 | THREE.Vector3, rot: V3 | THREE.Euler) => new THREE.Matrix4().compose(
    pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(rot instanceof THREE.Euler ? rot : new THREE.Euler(...rot)),
    new THREE.Vector3(1, 1, 1));
  const hold = m4(cfg.hold.pos, cfg.hold.rot);
  // Down the sights: the line from the rear groove to the front blade along the
  // eye's line (just under it), the rear groove `sightAt` ahead of the eye.
  const sightPitch = Math.atan2(frontSight.y - rearSight.y, rearSight.z - frontSight.z);
  const aimRot = new THREE.Euler(-sightPitch, 0, 0);
  // The eye a centimetre over the strap, looking down it to the blade.
  const aimPos = new THREE.Vector3(0, -0.01, -cfg.sightAt).sub(rearSight.clone().applyEuler(aimRot));
  const aimHold = m4(aimPos, aimRot);
  // Put away: low, muzzle down, out of view.
  const away = m4([cfg.hold.pos[0] + 0.04, cfg.hold.pos[1] - 0.32, cfg.hold.pos[2] + 0.12], [cfg.hold.rot[0] - 1.1, cfg.hold.rot[1] + 0.3, cfg.hold.rot[2]]);

  // ── Bones posed by hand: put back before the clip, kept after it ────────
  const posed = [gunBone, rUpper, rFore, rHand, lUpper, lFore, lHand];
  const kept = posed.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  const unpose = () => posed.forEach((b, i) => { b.position.copy(kept[i].p); b.quaternion.copy(kept[i].q); b.scale.copy(kept[i].s); });
  const keep = () => posed.forEach((b, i) => { kept[i].p.copy(b.position); kept[i].q.copy(b.quaternion); kept[i].s.copy(b.scale); });

  const mixer = new THREE.AnimationMixer(model);
  const idle = THREE.AnimationClip.findByName(rigGltf.animations, cfg.idle);
  if (!idle) throw new Error(`${cfg.rig} has no clip ${cfg.idle}`);
  mixer.clipAction(idle).play();
  model.traverse(o => { o.frustumCulled = false; });

  // ── State ────────────────────────────────────────────────────────────
  let turns = 0;              // the cylinder's turn, in chambers (whole at rest)
  let pull = -1;              // seconds into a trigger pull, or -1
  let sincePull = 9;
  let pressed = false;
  let kick = 9;               // seconds since the last shot (recoil)
  let aim = 0;
  let busy: Revolver['busy'] = null;
  let t = 0;
  let hush: (() => void) | null = null;
  let gunKeys: Key[] = [];
  let loaded = 0;             // rounds seated in this reload
  let dropped = false;
  let spinFrom = 0;
  const pocket = new THREE.Vector3(0.3, -0.45, -0.1);
  const freeAt = new THREE.Vector3().copy(pocket);
  const freeQ = new THREE.Quaternion();

  /** The chamber now at place `k` round the cylinder (0 under the hammer, then the way it turns). */
  const chamberAt = (k: number) => (((k - Math.round(turns)) % ROUNDS) + ROUNDS) % ROUNDS;
  const atTop = () => chamberAt(0);

  const tmpM = new THREE.Matrix4();
  const tmpP = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const blend = (a: THREE.Matrix4, b: THREE.Matrix4, k: number, out: THREE.Matrix4) => {
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), s = new THREE.Vector3();
    a.decompose(pa, qa, s);
    b.decompose(pb, qb, s);
    return out.compose(pa.lerp(pb, k), qa.slerp(qb, k), s.set(1, 1, 1));
  };
  const poseOf = (k: number[]) => m4([k[0], k[1], k[2]], [k[3], k[4], k[5]]);
  const holdNow = new THREE.Matrix4();
  const target = new THREE.Matrix4();

  const handQ = (fingers: THREE.Vector3, palm: THREE.Vector3) => {
    const y = fingers.normalize();
    const z = palm.addScaledVector(y, -palm.dot(y)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
  };
  /** A reach in the gun frame, to world: wrist position and hand turn. */
  const reachWorld = (r: number[]) => {
    const gq = holder.getWorldQuaternion(new THREE.Quaternion());
    return {
      at: new THREE.Vector3(r[0], r[1], r[2]).applyMatrix4(holder.matrixWorld),
      q: handQ(new THREE.Vector3(r[3], r[4], r[5]).applyQuaternion(gq), new THREE.Vector3(r[6], r[7], r[8]).applyQuaternion(gq)),
    };
  };
  const support = [...cfg.support.at, ...cfg.support.fingers, ...cfg.support.palm];
  const reloadLeft = reachKeys([[0, cfg.support], [0.3, CRADLE], [0.88, CRADLE], [0.95, THUMB_ROD], [1.05, CRADLE], [3.9, CRADLE], [4.45, cfg.support]]);
  const inspectLeft = reachKeys([[0, cfg.support], [0.4, CRADLE], [1.85, CRADLE], [2.5, cfg.support]]);
  const poleR = new THREE.Vector3(0.45, -0.5, -0.1);
  const poleL = new THREE.Vector3(-0.3, -0.5, -0.1);

  const setCrane = (k: number) => crane.quaternion.copy(rest.get(crane)!).multiply(tmpQ.setFromAxisAngle(Z, CRANE_OUT * k));
  const setCylinder = (chambersTurned: number) => cylinder.quaternion.copy(rest.get(cylinder)!).multiply(tmpQ.setFromAxisAngle(Y, STEP * chambersTurned));
  const setHammer = (k: number) => hammer.quaternion.copy(rest.get(hammer)!).multiply(tmpQ.setFromAxisAngle(X, HAMMER_BACK * k));
  const setTrigger = (k: number) => trigger.quaternion.copy(rest.get(trigger)!).multiply(tmpQ.setFromAxisAngle(X, TRIGGER_BACK * k));
  const showRounds = () => chambers.forEach((c, i) => { c.mesh.visible = state[i] !== 'empty'; c.mesh.position.set(0, 0, 0); });
  showRounds();
  // Where the chamber being fed sits on the crane, whatever the cylinder's turn:
  // the cylinder's frame as if it had not turned.
  const slot = new THREE.Object3D();
  slot.position.copy(cylinder.position);
  slot.quaternion.copy(rest.get(cylinder)!);
  crane.add(slot);

  /** The end of a reload or an inspection, or either cut short. */
  const settle = () => {
    hush?.();
    hush = null;
    turns = Math.round(turns);
    busy = null;
    t = 0;
    setCrane(0);
    setCylinder(turns);
    showRounds();
  };

  const start = (what: 'reload' | 'inspect', sounds: GunSounds | null) => {
    busy = what;
    t = 0;
    pull = -1;
    loaded = 0;
    dropped = false;
    spinFrom = turns;
    const keys = what === 'reload' ? RELOAD_GUN : INSPECT_GUN;
    const end = what === 'reload' ? RELOAD_SEC : INSPECT_SEC;
    const h = cfg.hold;
    gunKeys = [[0, ...h.pos, ...h.rot], ...keys, [end, ...h.pos, ...h.rot]];
    hush = sounds ? sounds.play(what === 'reload' ? RELOAD_CUES : INSPECT_CUES) : null;
  };

  return {
    item,
    get busy() { return busy; },
    get aim() { return aim; },
    get fov() { return cfg.fov + (cfg.aimFov - cfg.fov) * aim; },
    get rounds() { return state.filter(s => s === 'live').length; },
    max: ROUNDS,
    reload(sounds) {
      if (busy || pull >= 0) return false;
      if (state.every(s => s === 'live')) return false;
      start('reload', sounds);
      return true;
    },
    inspect(sounds) {
      if (busy || pull >= 0) return false;
      start('inspect', sounds);
      return true;
    },
    stop() {
      settle();
      pull = -1;
      setHammer(0);
      setTrigger(0);
      flash.visible = false;
    },
    update(dt, s) {
      unpose();
      mixer.update(dt);
      model.updateMatrixWorld(true);
      keep();

      // ── The trigger: double action, one shot per press ──
      sincePull += dt;
      kick += dt;
      if (!s.trigger) pressed = false;
      if (s.trigger && !pressed && s.ready && !busy && pull < 0 && sincePull > RESET) {
        pressed = true;
        pull = 0;
      }
      let hammerK = 0;
      let triggerK = 0;
      if (pull >= 0) {
        pull += dt;
        const k = Math.min(1, pull / PULL);
        triggerK = k;
        hammerK = k;
        setCylinder(turns + k);
        if (k >= 1) {
          turns += 1;
          pull = -1;
          sincePull = 0;
          const c = atTop();
          if (state[c] === 'live') {
            state[c] = 'spent';
            kick = 0;
            flashFor = 0.05;
            flashMaterial.rotation = Math.random() * Math.PI;
            emit.shot();
          } else emit.dry();
        }
      } else if (!busy) {
        // The trigger runs forward again after the shot.
        triggerK = Math.max(0, 1 - sincePull / 0.09);
        setCylinder(turns);
      }
      setHammer(hammerK);
      setTrigger(triggerK);
      flashFor -= dt;
      flash.visible = flashFor > 0;

      // ── Where the gun is ──
      aim = THREE.MathUtils.damp(aim, s.aiming && s.ready && !busy ? 1 : 0, 14, dt);
      blend(hold, aimHold, aim, holdNow);
      blend(away, holdNow, s.raise * s.raise * (3 - 2 * s.raise), target);
      let grip = 1;
      let left = support;
      if (busy) {
        t += dt;
        const end = busy === 'reload' ? RELOAD_SEC : INSPECT_SEC;
        target.copy(poseOf(sample(gunKeys, t)));
        setCrane(sample(busy === 'reload' ? RELOAD_CRANE : INSPECT_CRANE, t)[0]);
        if (busy === 'reload') {
          grip = sample(RELOAD_GRIP, t)[0];
          left = sample(reloadLeft, t);
          reloadParts(t);
        } else {
          left = sample(inspectLeft, t);
          setCylinder(spinFrom + Math.round(sample(INSPECT_SPIN, t)[0] * 1000) / 1000);
          if (t > 1.6) turns = spinFrom + 12;
        }
        if (t >= end) settle();
      }
      // Recoil: the muzzle flips up and the gun comes back into the hands, then settles.
      if (kick < 0.35) {
        const k = kick < 0.035 ? kick / 0.035 : Math.pow(1 - (kick - 0.035) / 0.315, 2);
        target.multiply(tmpM.makeRotationX(0.26 * k)).premultiply(tmpM.makeTranslation(0, 0.012 * k, 0.03 * k));
      }

      // The gun bone carries the revolver: set it so the grip lands on the target.
      model.updateMatrixWorld(true);
      const rel = tmpM.copy(gunBone.matrixWorld).invert().multiply(rHand.matrixWorld).clone();
      const goal = new THREE.Matrix4().multiplyMatrices(item.matrixWorld, target).multiply(new THREE.Matrix4().copy(holder.matrix).invert());
      setWorld(gunBone, goal);

      // ── The hands ──
      // Right: on the grip as the clip holds it, or free (the pocket, a round).
      const gripW = new THREE.Matrix4().multiplyMatrices(gunBone.matrixWorld, rel);
      gripW.decompose(tmpP, tmpQ, tmpS);
      if (grip < 1) {
        const free = rightFree(t) ?? { at: tmpP.clone(), q: tmpQ.clone() };
        freeAt.lerp(free.at, 1 - Math.exp(-dt * 16));
        freeQ.slerp(free.q, 1 - Math.exp(-dt * 16));
        tmpP.lerp(freeAt, 1 - grip);
        tmpQ.slerp(freeQ, 1 - grip);
      } else {
        freeAt.copy(tmpP);
        freeQ.copy(tmpQ);
      }
      reach(rUpper, rFore, rHand, tmpP, tmpQ, poleR.clone().applyMatrix4(item.matrixWorld));
      const l = reachWorld(left);
      reach(lUpper, lFore, lHand, l.at, l.q, poleL.clone().applyMatrix4(item.matrixWorld));
      model.updateMatrixWorld(true);
    },
  };

  /** During a reload: the rounds pushed out and dropped, then seated one by one. */
  function reloadParts(at: number) {
    const push = sample(RELOAD_EJECT, at)[0];
    if (!dropped) {
      for (const c of chambers) c.mesh.position.copy(c.axis).multiplyScalar(-push * toLocalLen);
      if (at >= EJECTED) {
        dropped = true;
        model.updateMatrixWorld(true);
        const back = new THREE.Vector3(0, 0, 1).transformDirection(holder.matrixWorld);
        const toHands = new THREE.Matrix4().copy(hands.matrixWorld).invert();
        chambers.forEach((c, i) => {
          if (state[i] !== 'empty') {
            emit.drop({
              at: c.center.clone().applyMatrix4(c.mesh.matrixWorld).applyMatrix4(toHands),
              dir: back.clone().transformDirection(toHands).multiplyScalar(0.35),
              shell: cfg.shell,
              drop: true,
            });
          }
          state[i] = 'empty';
          c.mesh.visible = false;
          c.mesh.position.set(0, 0, 0);
        });
      }
      return;
    }
    // Feeding: round j comes in from behind its chamber and is pushed home, then the cylinder turns a chamber.
    const j = Math.floor((at - LOAD.from) / LOAD.each);
    const u = (at - LOAD.from) / LOAD.each - j;
    if (j >= 0 && j < ROUNDS) {
      while (loaded < j) { loaded++; turns += 1; }
      const c = chamberAt(FEED_AT);
      const ch = chambers[c];
      ch.mesh.visible = true;
      ch.mesh.position.copy(ch.axis).multiplyScalar(-feedDepth(u) * toLocalLen);
      if (u > 0.76) state[c] = 'live';
      // The cylinder turns on to the next chamber once this one is home.
      setCylinder(turns + (u > 0.8 ? smooth((u - 0.8) / 0.2) : 0));
    } else if (j >= ROUNDS) {
      while (loaded < ROUNDS) { loaded++; turns += 1; }
      setCylinder(turns);
    }
  }

  /** The right hand off the grip: to the pocket, holding the round being seated, or (null) back to the grip. */
  function rightFree(at: number) {
    const j = Math.floor((at - LOAD.from + 0.15) / LOAD.each);
    if (dropped && j >= ROUNDS) return null;
    if (busy !== 'reload' || !dropped || j < 0) {
      // Down by the coat pocket, out of view.
      return { at: pocket.clone().applyMatrix4(item.matrixWorld), q: handQ(new THREE.Vector3(0, -1, -0.3).transformDirection(item.matrixWorld), new THREE.Vector3(-1, 0, 0).transformDirection(item.matrixWorld)) };
    }
    // Pinching the round by its back end, as it goes into the chamber at the top of the crane.
    const u = (at - LOAD.from) / LOAD.each - j;
    const roundBack = slot.localToWorld(chambers[FEED_AT].rear.clone().addScaledVector(chambers[FEED_AT].axis, -feedDepth(u) * toLocalLen));
    const q = handQ(new THREE.Vector3(...FEED.fingers).transformDirection(item.matrixWorld), new THREE.Vector3(...FEED.palm).transformDirection(item.matrixWorld));
    const tipsInHand = tipsOffset();
    return { at: roundBack.sub(tipsInHand.applyQuaternion(q)), q };
  }

  /** Where the thumb and index fingertips meet, from the wrist, in the hand's own frame (as the clip curls them). */
  function tipsOffset() {
    const inv = new THREE.Matrix4().copy(rHand.matrixWorld).invert();
    const mid = rThumb.getWorldPosition(new THREE.Vector3()).add(rIndex.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const local = mid.applyMatrix4(inv).multiply(rHand.getWorldScale(new THREE.Vector3()));
    return local;
  }
}

/** How far behind its chamber a round is (m), `u` 0..1 through its turn: brought in, pushed home. Before its turn, held ready. */
function feedDepth(u: number) {
  if (u < 0) return 0.076;
  return u < 0.68 ? 0.07 * (1 - smooth(u / 0.68)) + 0.006 : 0.006 * (1 - smooth((u - 0.68) / 0.08));
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const smooth = (u: number) => { const k = THREE.MathUtils.clamp(u, 0, 1); return k * k * (3 - 2 * k); };

function setWorld(o: THREE.Object3D, world: THREE.Matrix4) {
  o.parent!.updateWorldMatrix(true, false);
  const local = new THREE.Matrix4().copy(o.parent!.matrixWorld).invert().multiply(world);
  local.decompose(o.position, o.quaternion, o.scale);
  o.updateMatrixWorld(true);
}

function setWorldQuat(o: THREE.Object3D, q: THREE.Quaternion) {
  const pq = o.parent!.getWorldQuaternion(new THREE.Quaternion());
  o.quaternion.copy(pq.invert().multiply(q));
  o.updateMatrixWorld(true);
}

/** Turns `o` so that the world direction `from` (out of it) comes round to `to`. */
function swing(o: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  const d = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  setWorldQuat(o, d.multiply(o.getWorldQuaternion(new THREE.Quaternion())));
}

/**
 * Two-bone IK: the upper arm and forearm turned so the wrist reaches `at`,
 * the elbow bending out toward `pole`, then the hand turned to `q` (world).
 */
function reach(upper: THREE.Object3D, fore: THREE.Object3D, hand: THREE.Object3D, at: THREE.Vector3, q: THREE.Quaternion, pole: THREE.Vector3) {
  upper.updateWorldMatrix(true, true);
  const s = upper.getWorldPosition(new THREE.Vector3());
  const e = fore.getWorldPosition(new THREE.Vector3());
  const w = hand.getWorldPosition(new THREE.Vector3());
  const a = s.distanceTo(e);
  const b = e.distanceTo(w);
  const toT = at.clone().sub(s);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) * 1.001, (a + b) * 0.999);
  const dir = toT.normalize();
  const side = pole.clone().sub(s);
  side.addScaledVector(dir, -side.dot(dir)).normalize();
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const elbow = s.clone().addScaledVector(dir, a * cos).addScaledVector(side, a * Math.sqrt(Math.max(0, 1 - cos * cos)));
  swing(upper, e.clone().sub(s), elbow.clone().sub(s));
  const e2 = fore.getWorldPosition(new THREE.Vector3());
  const w2 = hand.getWorldPosition(new THREE.Vector3());
  swing(fore, w2.sub(e2), s.clone().addScaledVector(dir, d).sub(e2));
  setWorldQuat(hand, q);
}

/** All the gun's vertices as drawn, in the frame `toFrame` takes world points to. */
function gunPoints(gun: THREE.Object3D, toFrame: THREE.Matrix4) {
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  gun.traverse(o => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.visible) return;
    m.skeleton.update();
    const n = m.geometry.getAttribute('position').count;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, v);
      pts.push(v.clone().applyMatrix4(m.matrixWorld).applyMatrix4(toFrame));
    }
  });
  return pts;
}

/**
 * The rounds' skinned mesh split into its six cartridges, each a plain mesh in
 * the cylinder bone's frame, ordered round from the top chamber (bore-aligned
 * at rest) the way the cylinder turns, so chamber k comes under the hammer
 * after the cylinder has turned back k chambers.
 */
function splitRounds(mesh: THREE.SkinnedMesh, cylinder: THREE.Bone) {
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position');
  const ci = mesh.skeleton.bones.indexOf(cylinder);
  // Mesh bind space to the cylinder's own frame.
  const toCyl = new THREE.Matrix4().multiplyMatrices(mesh.skeleton.boneInverses[ci], mesh.bindMatrix);
  const local = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toCyl));
  // Round the cylinder's axis (its +Y, the gun's -Z) from the top chamber (its
  // +Z, the gun's +Y) toward its +X (the gun's right): the way it turns.
  const angle = (v: THREE.Vector3) => Math.atan2(v.x, v.z);
  const k = (v: THREE.Vector3) => ((Math.round(angle(v) / STEP) % ROUNDS) + ROUNDS) % ROUNDS;
  const index = geo.getIndex();
  const groups: number[][] = Array.from({ length: ROUNDS }, () => []);
  const tri = index ? index.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const mid = local[a].clone().add(local[b]).add(local[c]).divideScalar(3);
    groups[k(mid)].push(a, b, c);
  }
  return groups.map(ids => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(ids.length * 3);
    const uv = geo.getAttribute('uv');
    const nrm = geo.getAttribute('normal');
    const u = uv ? new Float32Array(ids.length * 2) : null;
    const n = nrm ? new Float32Array(ids.length * 3) : null;
    const normalTo = new THREE.Matrix3().getNormalMatrix(toCyl);
    const nv = new THREE.Vector3();
    const center = new THREE.Vector3();
    let rear = -Infinity;
    ids.forEach((id, i) => {
      local[id].toArray(p, i * 3);
      center.add(local[id]);
      if (u && uv) { u[i * 2] = uv.getX(id); u[i * 2 + 1] = uv.getY(id); }
      if (n && nrm) nv.fromBufferAttribute(nrm, id).applyMatrix3(normalTo).normalize().toArray(n, i * 3);
      // Its back end: furthest along -Y (toward the shooter).
      if (-local[id].y > rear) rear = -local[id].y;
    });
    center.divideScalar(Math.max(ids.length, 1));
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    if (u) g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
    if (n) g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    const m = new THREE.Mesh(g, mesh.material);
    m.frustumCulled = false;
    return {
      mesh: m,
      center,
      /** The middle of its back end (case head), cylinder frame. */
      rear: new THREE.Vector3(center.x, -rear, center.z),
      /** Toward the muzzle along the cylinder. */
      axis: new THREE.Vector3(0, 1, 0),
    };
  });
}
