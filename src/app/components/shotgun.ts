import * as THREE from 'three';
import type { HeldModel, ShotgunRig } from '@/lib/held-items';
import { sample, type Key } from './reloads';
import type { GunSound, GunSounds } from './gun-sounds';
import type { SpentCase } from './held-viewmodel';
import { reach, setWorld, type Revolver } from './revolver';

/**
 * The Remington 870 in borrowed hands (held-items.ts `shotgun`): the AK-74u
 * rig's arms, its own gun hidden, posed like the revolver's (revolver.ts). The
 * idle clip gives the fingers and the breathing; the gun is placed in view and
 * each hand reached to it by two-bone IK — the right to the wrist of the stock,
 * the left to the fore-end — so the hands can do what no clip in the rig does.
 *
 *  - Fire (left click, once per press): the shell in the chamber goes off with a
 *    heavy kick, then the left hand pumps — the fore-end back, the empty hull
 *    flung out of the port, forward again, a fresh shell up from the magazine.
 *    With the chamber empty the trigger only clicks.
 *  - Reload (R): the gun rolled over to bare the loading port, and the left
 *    hand fetches shells from the coat one at a time and thumbs each up into
 *    the magazine. If the chamber was empty, the first one is pumped into it
 *    before the rest go in. A pull of the trigger cuts the loading short after
 *    the shell in hand.
 *  - Inspect (V): turned to the light, the fore-end drawn half back to see the
 *    brass in the chamber, and closed.
 *
 * Frames: "gun frame" is the shotgun's own, metres, its grip at the origin,
 * barrel along -Z, +Y up, right side +X. Hold poses are in the hands' camera space.
 */

type V3 = [number, number, number];

/** Seconds: each step of a reload, the pump, and how soon after the shot the hand goes to pump. */
const STEP_SEC = { in: 0.35, shell: 0.62, out: 0.3, rack: 0.5 } as const;
const PUMP_SEC = 0.42;
const PUMP_AFTER = 0.2;
const INSPECT_SEC = 2.4;
/** The fore-end through a pump, from its start: back, a beat, home. */
const PUMP_K: Key[] = [[0, 0], [0.13, 1], [0.18, 1], [0.32, 0]];
const PUMP_BACK = 0.12;   // the hull flies out here
const PUMP_HOME = 0.3;    // and the next shell is chambered here
const PUMP_CUES: [number, GunSound][] = [[0.02, 'pumpBack'], [0.22, 'pumpHome']];

/** The gun rolled over for loading, in camera space: [x, y, z, pitch, yaw, roll]. */
const LOAD_POSE = [0.05, -0.2, -0.2, 0.22, 0.12, -0.8];
/** Down by the coat, out of view: where the left hand fetches each shell. */
const POUCH = new THREE.Vector3(-0.2, -0.45, -0.1);

const INSPECT_GUN: Key[] = [
  [0, 0, 0, 0, 0, 0, 0],
  [0.4, -0.04, 0.03, -0.05, 0.12, -0.55, 0.35],   // brought in and turned: the right side and its port to the eye
  [2.0, -0.04, 0.03, -0.05, 0.1, -0.6, 0.3],
  [2.4, 0, 0, 0, 0, 0, 0],
];
const INSPECT_FOREND: Key[] = [[0, 0], [0.75, 0], [0.95, 0.5], [1.55, 0.5], [1.7, 0]];
const INSPECT_CUES: [number, GunSound][] = [[0.75, 'scrape'], [1.62, 'clack']];

export function createShotgun(
  view: HeldModel & { shotgun: ShotgunRig },
  gun: THREE.Group,
  rigGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] },
  prepare: (model: THREE.Object3D, view: HeldModel) => { root: THREE.Group },
  hands: THREE.Camera,
  flashMaterial: THREE.SpriteMaterial,
  emit: { shot: () => void; dry: () => void; drop: (c: SpentCase) => void },
): Revolver {
  const cfg = view.shotgun;
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
  const [lThumb, lIndex] = cfg.arms.leftTips.map(bone);

  // The shotgun, its grip where the rig's right hand closes, carried by the gun bone.
  const { root } = prepare(gun, view);
  // The model is made 1.0 m long; drawn at `view.length`, every measure on it scales alike.
  const fit = root.scale.x;
  const holder = new THREE.Group();
  holder.position.set(...cfg.mount);
  holder.add(root);
  model.add(holder);
  model.updateMatrixWorld(true);
  gunBone.attach(holder);

  const forend = gun.getObjectByName(cfg.forend);
  if (!forend) throw new Error(`${view.model} has no ${cfg.forend}`);
  const forendRest = forend.position.clone();
  // Metres in the gun frame, in the fore-end's parent's units.
  const toLocalLen = holder.getWorldScale(new THREE.Vector3()).x / forend.parent!.getWorldScale(new THREE.Vector3()).x;
  // The fore-end slides along the gun's +Z (back toward the receiver), in its parent's frame.
  const back = new THREE.Vector3(0, 0, 1).transformDirection(holder.matrixWorld)
    .transformDirection(new THREE.Matrix4().copy(forend.parent!.matrixWorld).invert());
  const stroke = cfg.stroke * fit;
  const setForend = (k: number) => forend.position.copy(forendRest).addScaledVector(back, stroke * k * toLocalLen);

  const P = (v: V3) => new THREE.Vector3(...v).multiplyScalar(fit);
  const pts = { muzzle: P(cfg.points.muzzle), bead: P(cfg.points.bead), rear: P(cfg.points.rear), ejection: P(cfg.points.ejection), loading: P(cfg.points.loading) };

  // The muzzle flash.
  const flash = new THREE.Sprite(flashMaterial);
  flash.visible = false;
  flash.position.copy(pts.muzzle);
  flash.scale.setScalar(0.2);
  holder.add(flash);
  let flashFor = 0;

  // A shell to load: red paper hull, brass head; along the gun's Z, its crimp forward (-Z).
  const [sr, sl] = [cfg.shell[0] * fit, cfg.shell[1] * fit];
  const shell = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x9a1c18, roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc09040, metalness: 0.6, roughness: 0.35 });
  const hullGeo = new THREE.CylinderGeometry(sr, sr, sl * 0.8, 14).rotateX(Math.PI / 2).translate(0, 0, -sl * 0.1);
  const headGeo = new THREE.CylinderGeometry(sr * 1.06, sr * 1.06, sl * 0.2, 14).rotateX(Math.PI / 2).translate(0, 0, sl * 0.4);
  shell.add(new THREE.Mesh(hullGeo, hullMat), new THREE.Mesh(headGeo, headMat));
  shell.traverse(o => { o.frustumCulled = false; });
  shell.visible = false;
  holder.add(shell);
  /** The shell's head, where the thumb is, in its own frame. */
  const shellRear = new THREE.Vector3(0, 0, sl / 2);

  // ── Poses ────────────────────────────────────────────────────────────
  const m4 = (pos: V3 | THREE.Vector3, rot: V3 | THREE.Euler) => new THREE.Matrix4().compose(
    pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(rot instanceof THREE.Euler ? rot : new THREE.Euler(...rot)),
    new THREE.Vector3(1, 1, 1));
  const hold = m4(cfg.hold.pos, cfg.hold.rot);
  // Down the sights: the rib from the receiver's back to the bead along the eye's
  // line, just under it, the receiver's back `sightAt` ahead of the eye.
  const sightPitch = Math.atan2(pts.bead.y - pts.rear.y, pts.rear.z - pts.bead.z);
  const aimRot = new THREE.Euler(-sightPitch, 0, 0);
  const aimPos = new THREE.Vector3(0, -0.032, -cfg.sightAt).sub(pts.rear.clone().applyEuler(aimRot));
  const aimHold = m4(aimPos, aimRot);
  const loadHold = m4([LOAD_POSE[0], LOAD_POSE[1], LOAD_POSE[2]], [LOAD_POSE[3], LOAD_POSE[4], LOAD_POSE[5]]);
  const away = m4([cfg.hold.pos[0] + 0.05, cfg.hold.pos[1] - 0.35, cfg.hold.pos[2] + 0.1], [cfg.hold.rot[0] - 1.0, cfg.hold.rot[1] + 0.3, cfg.hold.rot[2]]);

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
  type Chamber = 'live' | 'spent' | 'empty';
  let chamber: Chamber = 'live';
  let tube = cfg.tube;
  let pressed = false;
  let kick = 9;               // seconds since the last shot (recoil)
  let pump = -1;              // seconds into a pump, or -1
  let pumpAt = -1;            // seconds until a pump starts, or -1
  let pumpEjected = false;
  let pumpFed = false;
  let pumpHush: (() => void) | null = null;
  let aim = 0;
  let busy: Revolver['busy'] = null;
  let t = 0;
  let hush: (() => void) | null = null;
  // The reload, step by step; and whether the trigger has cut it short.
  type Step = keyof typeof STEP_SEC;
  let steps: Step[] = [];
  let step = 0;
  let stepT = 0;
  let cut = false;
  let rolled = 0;             // 0 at the shoulder … 1 rolled over for loading
  let loadedThis = false;     // the shell in hand has gone in
  let sounds: GunSounds | null = null;
  let leftLoose = 0;          // the left hand's hold on the fore-end let go, 0..1
  let shellInHand = false;    // the shell rides in the hand (to the port) rather than on its path in the gun

  const tmpM = new THREE.Matrix4();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const blend = (a: THREE.Matrix4, b: THREE.Matrix4, k: number, out: THREE.Matrix4) => {
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), s = new THREE.Vector3();
    a.decompose(pa, qa, s);
    b.decompose(pb, qb, s);
    return out.compose(pa.lerp(pb, k), qa.slerp(qb, k), s.set(1, 1, 1));
  };
  const holdNow = new THREE.Matrix4();
  const target = new THREE.Matrix4();

  const handQ = (fingers: THREE.Vector3, palm: THREE.Vector3) => {
    const y = fingers.normalize();
    const z = palm.addScaledVector(y, -palm.dot(y)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
  };
  /** A reach in the gun frame, to world: wrist position and hand turn. */
  const gunReach = (at: THREE.Vector3, fingers: V3, palm: V3) => {
    const gq = holder.getWorldQuaternion(new THREE.Quaternion());
    return {
      at: at.clone().applyMatrix4(holder.matrixWorld),
      q: handQ(new THREE.Vector3(...fingers).applyQuaternion(gq), new THREE.Vector3(...palm).applyQuaternion(gq)),
    };
  };
  const poleR = new THREE.Vector3(0.45, -0.5, -0.1);
  const poleL = new THREE.Vector3(-0.45, -0.55, 0.05);

  /** Where the left thumb and index tips meet, from the wrist, in the hand's own frame (as the clip curls them). */
  const tipsOffset = () => {
    const inv = new THREE.Matrix4().copy(lHand.matrixWorld).invert();
    const mid = lThumb.getWorldPosition(new THREE.Vector3()).add(lIndex.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    return mid.applyMatrix4(inv).multiply(lHand.getWorldScale(new THREE.Vector3()));
  };
  /** Holding a shell under the port: fingers forward and up the gun, palm up to its belly. */
  const SHELL_FINGERS: V3 = [0.15, 0.45, -0.88];
  const SHELL_PALM: V3 = [0.2, 1, 0.25];
  /** The shell's path into the magazine, its head's place in the gun frame: under the port, up into it, forward into the tube. */
  const PATH: Key[] = (() => {
    const L = pts.loading;
    return [
      [0, L.x, L.y - 0.06, L.z + 0.05],
      [0.45, L.x, L.y - 0.012, L.z + 0.04],
      [1, L.x, L.y + 0.004, L.z - 0.02],
    ];
  })();
  /** The wrist that has the shell's head between thumb and finger, with the shell at `pos` (gun frame). */
  const holdingShell = (pos: THREE.Vector3) => {
    const r = gunReach(new THREE.Vector3(), SHELL_FINGERS, SHELL_PALM);
    const head = pos.clone().add(shellRear).applyMatrix4(holder.matrixWorld);
    return { at: head.sub(tipsOffset().applyQuaternion(r.q)), q: r.q };
  };
  const waitPos = new THREE.Vector3(PATH[0][1], PATH[0][2] - 0.02, PATH[0][3] + 0.02);

  const startPump = () => {
    pump = 0;
    pumpEjected = false;
    pumpFed = false;
    pumpHush?.();
    pumpHush = sounds ? sounds.play(PUMP_CUES) : null;
  };
  /** The pump at `p` seconds in: the hull out on the way back, the next shell up on the way home. */
  const pumpTo = (p: number) => {
    if (!pumpEjected && p >= PUMP_BACK) {
      pumpEjected = true;
      if (chamber !== 'empty') {
        model.updateMatrixWorld(true);
        const toHands = new THREE.Matrix4().copy(hands.matrixWorld).invert();
        emit.drop({
          at: pts.ejection.clone().applyMatrix4(holder.matrixWorld).applyMatrix4(toHands),
          dir: new THREE.Vector3(1, 0.5, 0.25).normalize().transformDirection(holder.matrixWorld).transformDirection(toHands),
          shell: cfg.shell,
          color: chamber === 'live' ? 0x9a1c18 : 0x7a2420,
        });
      }
      chamber = 'empty';
    }
    if (!pumpFed && p >= PUMP_HOME) {
      pumpFed = true;
      if (tube > 0) { tube--; chamber = 'live'; }
    }
    return sample(PUMP_K, p)[0];
  };

  const settle = () => {
    hush?.();
    hush = null;
    busy = null;
    t = 0;
    steps = [];
    rolled = 0;
    leftLoose = 0;
    shell.visible = false;
    setForend(0);
  };

  /** The steps of a reload from here: shells for the magazine, and the chamber filled first if it is empty. */
  const plan = (): Step[] => {
    const room = cfg.tube - tube;
    if (chamber === 'live') return room > 0 ? ['in', ...Array<Step>(room).fill('shell'), 'out'] : [];
    if (tube > 0 && room === 0) return ['rack'];
    if (tube > 0) return ['rack', 'in', ...Array<Step>(room + 1).fill('shell'), 'out'];
    return ['in', 'shell', 'out', 'rack', 'in', ...Array<Step>(cfg.tube).fill('shell'), 'out'];
  };

  return {
    item,
    get busy() { return busy; },
    get aim() { return aim; },
    get fov() { return cfg.fov + (cfg.aimFov - cfg.fov) * aim; },
    get rounds() { return tube + (chamber === 'live' ? 1 : 0); },
    max: cfg.tube + 1,
    reload(s) {
      if (busy || pump >= 0 || pumpAt >= 0) return false;
      const p = plan();
      if (!p.length) return false;
      sounds = s;
      busy = 'reload';
      steps = p;
      step = 0;
      stepT = 0;
      cut = false;
      loadedThis = false;
      if (steps[0] === 'rack') startPump();
      return true;
    },
    inspect(s) {
      if (busy || pump >= 0 || pumpAt >= 0) return false;
      busy = 'inspect';
      t = 0;
      hush = s ? s.play(INSPECT_CUES) : null;
      return true;
    },
    stop() {
      settle();
      pumpHush?.();
      pumpHush = null;
      // A pump cut short still finishes in the gun: the hull out, the next shell in.
      if (pump >= 0 || pumpAt >= 0) { pumpTo(PUMP_HOME); }
      pump = -1;
      pumpAt = -1;
      flash.visible = false;
    },
    update(dt, s) {
      unpose();
      mixer.update(dt);
      model.updateMatrixWorld(true);
      keep();
      // The left shoulder forward (cfg.shoulder): set after the bones are kept, so it never adds up.
      const sh = lUpper.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...cfg.shoulder).transformDirection(item.matrixWorld).multiplyScalar(new THREE.Vector3(...cfg.shoulder).length() * (1 - 0.75 * aim)));
      lUpper.position.copy(lUpper.parent!.worldToLocal(sh));
      model.updateMatrixWorld(true);

      // ── The trigger: one shot to a press, then the pump ──
      kick += dt;
      if (!s.trigger) pressed = false;
      const press = s.trigger && !pressed;
      if (press) pressed = true;
      if (press && busy === 'reload') cut = true;
      if (press && s.ready && !busy && pump < 0 && pumpAt < 0) {
        if (chamber === 'live') {
          chamber = 'spent';
          kick = 0;
          flashFor = 0.06;
          flashMaterial.rotation = Math.random() * Math.PI;
          emit.shot();
          pumpAt = PUMP_AFTER;
        } else emit.dry();
      }
      if (pumpAt >= 0) {
        pumpAt -= dt;
        if (pumpAt < 0) { pumpAt = -1; startPump(); }
      }
      let forendK = 0;
      if (pump >= 0) {
        pump += dt;
        forendK = pumpTo(pump);
        if (pump >= PUMP_SEC) { pump = -1; pumpHush = null; }
      }
      flashFor -= dt;
      flash.visible = flashFor > 0;

      // ── Where the gun is ──
      aim = THREE.MathUtils.damp(aim, s.aiming && s.ready && !busy ? 1 : 0, 14, dt);
      blend(hold, aimHold, aim, holdNow);
      // Left hand: on the fore-end, or (by `leftLoose`) wherever the reload wants it.
      let free: { at: THREE.Vector3; q: THREE.Quaternion } | null = null;
      if (busy === 'reload') {
        stepT += dt;
        const kind = steps[step];
        const u = Math.min(1, stepT / STEP_SEC[kind]);
        if (kind === 'in') { rolled = smooth(u); leftLoose = smooth(u); }
        if (kind === 'out') { rolled = 1 - smooth(u); leftLoose = 1 - smooth(u); }
        if (kind === 'rack') { rolled = 0; leftLoose = 0; }
        blend(holdNow, loadHold, rolled, holdNow);
        if (kind === 'shell') free = shellStep(u);
        else if (kind === 'in' || kind === 'out') {
          model.updateMatrixWorld(true);
          free = gunReach(waitPos, SHELL_FINGERS, SHELL_PALM);
        }
        if (stepT >= STEP_SEC[kind]) {
          if (kind === 'shell' && !loadedThis) { tube = Math.min(cfg.tube, tube + 1); }
          loadedThis = false;
          stepT = 0;
          step++;
          if (cut && step < steps.length) {
            // Cut short: no more shells; roll back up, and fill the chamber if it is empty.
            const rest: Step[] = rolled > 0.5 || steps[step] === 'shell' ? ['out'] : [];
            if (chamber !== 'live' && tube > 0) rest.push('rack');
            steps = [...steps.slice(0, step), ...rest];
            cut = false;
          }
          if (step >= steps.length) settle();
          else if (steps[step] === 'rack') startPump();
        }
      }
      blend(away, holdNow, s.raise * s.raise * (3 - 2 * s.raise), target);
      if (busy === 'inspect') {
        t += dt;
        const k = sample(INSPECT_GUN, t);
        target.multiply(m4([k[0], k[1], k[2]], [k[3], k[4], k[5]]));
        forendK = sample(INSPECT_FOREND, t)[0];
        if (t >= INSPECT_SEC) settle();
      }
      setForend(forendK);
      // Recoil: a hard shove back into the shoulder and the muzzle climbing, then settling.
      if (kick < 0.45) {
        const k = kick < 0.03 ? kick / 0.03 : Math.pow(1 - (kick - 0.03) / 0.42, 2);
        target.multiply(tmpM.makeRotationX(0.3 * k)).premultiply(tmpM.makeTranslation(0, 0.015 * k, 0.07 * k));
      }

      // The gun bone carries the shotgun: set it so the grip lands on the target.
      model.updateMatrixWorld(true);
      const rel = tmpM.copy(gunBone.matrixWorld).invert().multiply(rHand.matrixWorld).clone();
      const goal = new THREE.Matrix4().multiplyMatrices(item.matrixWorld, target).multiply(new THREE.Matrix4().copy(holder.matrix).invert());
      setWorld(gunBone, goal);
      model.updateMatrixWorld(true);

      // ── The hands ──
      const gripW = new THREE.Matrix4().multiplyMatrices(gunBone.matrixWorld, rel);
      const rp = new THREE.Vector3(), rq = new THREE.Quaternion();
      gripW.decompose(rp, rq, new THREE.Vector3());
      reach(rUpper, rFore, rHand, rp, rq, poleR.clone().applyMatrix4(item.matrixWorld));
      // Left: on the fore-end, riding it back and forth.
      const onForend = gunReach(P(cfg.support.at).add(new THREE.Vector3(0, 0, stroke * forendK)), cfg.support.fingers, cfg.support.palm);
      let l = onForend;
      if (free && leftLoose > 0) {
        l = { at: onForend.at.clone().lerp(free.at, leftLoose), q: onForend.q.clone().slerp(free.q, leftLoose) };
      }
      reach(lUpper, lFore, lHand, l.at, l.q, poleL.clone().applyMatrix4(item.matrixWorld));
      model.updateMatrixWorld(true);
      // A shell in the hand rides between thumb and finger until it is at the port.
      if (shellInHand) {
        const head = lHand.localToWorld(tipsOffset().divide(lHand.getWorldScale(new THREE.Vector3())));
        shell.position.copy(holder.worldToLocal(head)).sub(shellRear);
        shell.quaternion.identity();
      }
    },
  };

  /**
   * One shell, `u` 0..1 through its step: the hand down to the coat and back
   * with it, the shell offered up under the port and thumbed in, the hand back.
   * Returns where the left hand goes.
   */
  function shellStep(u: number) {
    model.updateMatrixWorld(true);
    leftLoose = 1;
    shellInHand = false;
    const pouch = {
      at: POUCH.clone().applyMatrix4(item.matrixWorld),
      q: handQ(new THREE.Vector3(0, -1, -0.2).transformDirection(item.matrixWorld), new THREE.Vector3(1, 0, 0).transformDirection(item.matrixWorld)),
    };
    const wait = gunReach(waitPos, SHELL_FINGERS, SHELL_PALM);
    const start = new THREE.Vector3(PATH[0][1], PATH[0][2], PATH[0][3]);
    if (u < 0.3) {
      shell.visible = false;
      const k = smooth(u / 0.3);
      return { at: wait.at.clone().lerp(pouch.at, k), q: wait.q.clone().slerp(pouch.q, k) };
    }
    if (u < 0.62) {
      const k = smooth((u - 0.3) / 0.32);
      const offer = holdingShell(start);
      shell.visible = u > 0.36;
      shellInHand = true;
      return { at: pouch.at.clone().lerp(offer.at, k), q: pouch.q.clone().slerp(offer.q, k) };
    }
    if (u < 0.9) {
      const k = (u - 0.62) / 0.28;
      const [x, y, z] = sample(PATH, k);
      const pos = new THREE.Vector3(x, y, z);
      shell.visible = k < 0.9;
      shell.position.copy(pos);
      shell.quaternion.identity();
      if (k >= 0.6 && !loadedThis) {
        loadedThis = true;
        tube = Math.min(cfg.tube, tube + 1);
        sounds?.play([[0, 'load']]);
      }
      return holdingShell(pos);
    }
    shell.visible = false;
    const k = smooth((u - 0.9) / 0.1);
    const end = holdingShell(new THREE.Vector3(PATH[2][1], PATH[2][2], PATH[2][3]));
    return { at: end.at.clone().lerp(wait.at, k), q: end.q.clone().slerp(wait.q, k) };
  }
}

const smooth = (u: number) => { const k = THREE.MathUtils.clamp(u, 0, 1); return k * k * (3 - 2 * k); };
