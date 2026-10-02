import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The investigator's Wood's lamp, held in the right hand at the bottom of the
 * screen like a first-person weapon. A 1930s portable ultraviolet lamp: a
 * black crinkle-enamel housing with cooling fins and a nickel bezel round a
 * near-black lens of Wood's glass (nickel-oxide glass that passes ultraviolet
 * and stops almost all visible light), a Bakelite pistol grip, and a braided
 * cord down to the battery and ballast box on the belt.
 *
 * It is drawn in its own scene over the level, after the depth buffer is
 * cleared, so it never sinks into a wall the investigator stands against.
 *
 * Its mercury tube does not light at once: switched on, it strikes with a
 * stutter and warms to full over a second or so, humming as it goes.
 */

/** Seconds to raise or lower the lamp. */
const DRAW_SEC = 0.42;
/** Seconds for the tube to warm to full. */
const WARM_SEC = 1.3;

/** Where the lamp sits in view, and where it goes when holstered — camera space. */
const HELD = { pos: new THREE.Vector3(0.2, -0.205, -0.5), rot: new THREE.Euler(0.2, 0.62, 0.1) };
const LOWERED = { pos: new THREE.Vector3(0.24, -0.52, -0.26), rot: new THREE.Euler(-1.1, 0.5, 0.3) };

export type WoodsLamp = {
  /** Render after the level: `renderer.clearDepth()` then this. */
  render: (renderer: THREE.WebGLRenderer) => void;
  /** Raise (true) or holster (false). */
  setDrawn: (drawn: boolean) => void;
  /** Throw the switch. The tube only lights while the lamp is up. */
  setSwitch: (on: boolean) => void;
  /** Advance by `dt`; `look` is how far the view turned this frame (yaw, pitch), `pace` 0..1 walking speed. */
  update: (dt: number, look: [number, number], pace: number) => void;
  /** 0..1 — how strongly the tube is burning now, flicker and all. */
  readonly power: number;
  /** Whether any of the lamp is on screen. */
  readonly visible: boolean;
  resize: (aspect: number) => void;
  dispose: () => void;
};

function crinkleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function plateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 140;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b9ae92';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#5a5040';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
  ctx.fillStyle = '#2a241a';
  ctx.textAlign = 'center';
  ctx.font = '700 38px Georgia, serif';
  ctx.fillText("WOOD'S LIGHT", c.width / 2, 58);
  ctx.font = '600 22px Georgia, serif';
  ctx.fillText('ULTRA-VIOLET · NO. 7 · BOSTON', c.width / 2, 100);
  // Rivets.
  for (const x of [22, c.width - 22]) {
    ctx.beginPath();
    ctx.arc(x, c.height / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function braidTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3b2c1f';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#6b5236';
  ctx.lineWidth = 5;
  for (let i = -64; i < 128; i += 12) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
  }
  ctx.strokeStyle = '#24190f';
  ctx.lineWidth = 3;
  for (let i = -64; i < 128; i += 12) {
    ctx.beginPath(); ctx.moveTo(i + 64, 0); ctx.lineTo(i, 64); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 30);
  return tex;
}

/** A soft violet bloom for the lens, drawn additively. */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(200,160,255,1)');
  g.addColorStop(0.25, 'rgba(130,70,255,0.55)');
  g.addColorStop(1, 'rgba(60,10,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWoodsLamp(renderer: THREE.WebGLRenderer, aspect: number): WoodsLamp {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.01, 5);
  const owned: { dispose: () => void }[] = [];
  const own = <T extends { dispose: () => void }>(o: T) => { owned.push(o); return o; };

  // A little reflected room for the nickel to catch, kept dim so the lamp reads as in the dark.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = own(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0x4a5670, 0x0c0906, 0.5));
  // The lens lights the hand that holds it.
  const spill = new THREE.PointLight(0x7a3cff, 0, 0.6, 2);
  spill.position.set(0, 0.06, -0.16);

  const crinkle = own(crinkleTexture());
  const enamel = own(new THREE.MeshStandardMaterial({ color: 0x151311, roughness: 0.75, metalness: 0.3, bumpMap: crinkle, bumpScale: 0.6, envMapIntensity: 0.4 }));
  const nickel = own(new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.28, metalness: 1, envMapIntensity: 0.9 }));
  const bakelite = own(new THREE.MeshStandardMaterial({ color: 0x2e1a10, roughness: 0.32, metalness: 0, envMapIntensity: 0.7 }));
  const lensMat = own(new THREE.MeshStandardMaterial({ color: 0x0b0512, roughness: 0.08, metalness: 0.2, emissive: 0x6a2cff, emissiveIntensity: 0, envMapIntensity: 1.2 }));
  const plateMat = own(new THREE.MeshStandardMaterial({ map: own(plateTexture()), roughness: 0.4, metalness: 0.6, envMapIntensity: 0.6 }));
  const braid = own(new THREE.MeshStandardMaterial({ map: own(braidTexture()), roughness: 0.95 }));
  const skin = own(new THREE.MeshStandardMaterial({ color: 0xc89272, roughness: 0.7, envMapIntensity: 0.3 }));
  const cuff = own(new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85, envMapIntensity: 0.2 }));
  const sleeve = own(new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95, envMapIntensity: 0.1 }));

  const lamp = new THREE.Group();     // origin at the grip, barrel along -Z
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number], rot?: [number, number, number], parent: THREE.Object3D = lamp) => {
    own(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...at);
    if (rot) m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const alongZ: [number, number, number] = [Math.PI / 2, 0, 0];

  // Housing, fins, rear cap.
  add(new THREE.CylinderGeometry(0.041, 0.041, 0.15, 32), enamel, [0, 0.075, -0.035], alongZ);
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.047, 0.047, 0.004, 32), enamel, [0, 0.075, 0.01 + i * 0.009], alongZ);
  add(new THREE.SphereGeometry(0.041, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), nickel, [0, 0.075, 0.04], [Math.PI / 2, 0, 0]).scale.set(1, 0.45, 1);
  // The hood flares round the lens, ringed in nickel.
  add(new THREE.CylinderGeometry(0.052, 0.043, 0.035, 32, 1, true), enamel, [0, 0.075, -0.125], alongZ);
  add(new THREE.TorusGeometry(0.052, 0.0045, 10, 40), nickel, [0, 0.075, -0.142]);
  add(new THREE.TorusGeometry(0.041, 0.004, 10, 40), nickel, [0, 0.075, -0.112]);
  add(new THREE.CircleGeometry(0.041, 40), lensMat, [0, 0.075, -0.114], [0, Math.PI, 0]);
  const glowMat = own(new THREE.SpriteMaterial({ map: own(glowTexture()), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(0, 0.075, -0.13);
  glow.scale.setScalar(0.16);
  lamp.add(glow, spill);
  // Maker's plate on the left flank, where the holder sees it.
  add(new THREE.PlaneGeometry(0.062, 0.0225), plateMat, [-0.0415, 0.077, -0.055], [0, -Math.PI / 2, 0]);
  // Toggle switch on the top, behind the hood.
  add(new THREE.CylinderGeometry(0.008, 0.009, 0.006, 16), nickel, [0, 0.118, -0.01]);
  const toggle = add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.022, 8), nickel, [0, 0.128, -0.01]);
  // Pistol grip, raked back, with a nickel ferrule where it meets the housing.
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 20), nickel, [0, 0.035, 0.008]);
  const grip = add(new THREE.CapsuleGeometry(0.0165, 0.085, 6, 16), bakelite, [0, -0.025, 0.02], [0.28, 0, 0]);
  grip.scale.set(0.85, 1, 1.1);
  // The cord, out of the butt of the grip and down to the belt.
  const cordPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.075, 0.04), new THREE.Vector3(0.004, -0.12, 0.07),
    new THREE.Vector3(0.03, -0.24, 0.07), new THREE.Vector3(0.07, -0.45, 0.02),
  ]);
  add(new THREE.TubeGeometry(cordPath, 24, 0.0055, 8), braid, [0, 0, 0]);

  // The right hand round the grip: back of the hand to the right, fingers
  // across the front, thumb up the left side, then cuff and sleeve.
  add(new RoundedBoxGeometry(0.03, 0.085, 0.07, 3, 0.013), skin, [0.026, -0.018, 0.012], [0.28, 0.1, 0.05]);
  [0.012, -0.009, -0.03, -0.05].forEach((y, i) => {
    const len = [0.036, 0.038, 0.036, 0.03][i];
    add(new THREE.CapsuleGeometry(0.0092 - i * 0.0005, len, 4, 10), skin, [0.002, y, -0.012 + y * 0.28], [0, 0.15, Math.PI / 2]);
    add(new THREE.SphereGeometry(0.0088 - i * 0.0005, 10, 8), skin, [-0.019, y + 0.001, -0.002 + y * 0.28]);   // curled fingertip
  });
  add(new THREE.CapsuleGeometry(0.0098, 0.04, 4, 10), skin, [-0.017, 0.028, 0.004], [-0.9, 0, 0.35]);
  const wrist = new THREE.Group();
  wrist.position.set(0.035, -0.04, 0.05);
  wrist.rotation.set(-0.75, 0.25, 0.35);
  lamp.add(wrist);
  add(new THREE.CylinderGeometry(0.024, 0.026, 0.07, 16), skin, [0, -0.03, 0], undefined, wrist);
  add(new THREE.CylinderGeometry(0.031, 0.031, 0.03, 20), cuff, [0, -0.07, 0], undefined, wrist);
  add(new THREE.CylinderGeometry(0.04, 0.046, 0.3, 20), sleeve, [0, -0.23, 0], undefined, wrist);

  lamp.traverse(o => { o.frustumCulled = false; });
  const rig = new THREE.Group();      // sway and bob, on top of the hold
  rig.add(lamp);
  camera.add(rig);
  scene.add(camera);

  // ── State ───────────────────────────────────────────────────────
  let drawn = false;
  let switched = true;
  let raise = 0;                      // 0 holstered .. 1 up
  let warm = 0;                       // 0 cold .. 1 burning steady
  let strike = 0;                     // seconds since the tube last struck
  let power = 0;
  let bobPhase = 0;
  const sway = new THREE.Vector2();
  const ease = (t: number) => t * t * (3 - 2 * t);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();

  // The ballast's hum: a 120-cycle buzz, low under everything. Started on the
  // first draw — a key press, so the browser lets the audio run.
  let audio: { ctx: AudioContext; gain: GainNode } | null = null;
  const startHum = () => {
    if (audio || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 120;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(low).connect(gain).connect(ctx.destination);
    osc.start();
    audio = { ctx, gain };
  };

  return {
    render(r) {
      if (raise <= 0.001) return;
      r.render(scene, camera);
    },
    setDrawn(d) {
      if (d === drawn) return;
      drawn = d;
      if (d) startHum();
    },
    setSwitch(on) {
      switched = on;
      toggle.rotation.x = on ? -0.5 : 0.5;
    },
    update(dt, [dYaw, dPitch], pace) {
      raise = THREE.MathUtils.clamp(raise + (drawn ? dt : -dt) / DRAW_SEC, 0, 1);
      const r = ease(raise);

      // The tube burns only while the lamp is up and switched on; it cools at once.
      const burning = switched && raise > 0.85;
      if (burning) {
        if (warm === 0) strike = 0;
        warm = Math.min(1, warm + dt / WARM_SEC);
        strike += dt;
      } else {
        warm = 0;
      }
      // Striking: a few hard stutters, then a climb to full with a faint shimmer.
      const stutter = strike < 0.35 ? (Math.random() < 0.45 ? 0.05 : 0.6) : 1;
      power = burning ? Math.min(1, ease(warm) * stutter * (0.96 + Math.random() * 0.04)) : 0;
      lensMat.emissiveIntensity = power * 2.2;
      glowMat.opacity = power * 0.85;
      spill.intensity = power * 0.25;
      if (audio) audio.gain.gain.setTargetAtTime(power * 0.018, audio.ctx.currentTime, 0.05);

      // The hand lags the view a little, and bobs with the stride.
      sway.x = THREE.MathUtils.damp(sway.x, THREE.MathUtils.clamp(dYaw * 2.2, -0.06, 0.06), 10, dt);
      sway.y = THREE.MathUtils.damp(sway.y, THREE.MathUtils.clamp(dPitch * 2.2, -0.05, 0.05), 10, dt);
      bobPhase += dt * (4 + pace * 5);
      const bob = pace * 0.006;
      rig.position.set(sway.x * 0.4 + Math.cos(bobPhase) * bob, -sway.y * 0.4 + Math.abs(Math.sin(bobPhase)) * bob * 1.3, 0);
      rig.rotation.set(sway.y * 0.6, sway.x * 0.8, 0);

      lamp.position.lerpVectors(LOWERED.pos, HELD.pos, r);
      qa.setFromEuler(LOWERED.rot);
      qb.setFromEuler(HELD.rot);
      lamp.quaternion.slerpQuaternions(qa, qb, r);
    },
    get power() { return power; },
    get visible() { return raise > 0.001; },
    resize(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    dispose() {
      for (const o of owned) o.dispose();
      void audio?.ctx.close();
      audio = null;
    },
  };
}
