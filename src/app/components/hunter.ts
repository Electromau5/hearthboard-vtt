import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Hunter } from '@/lib/walkthrough';

/**
 * A creature that roams the level and hunts whoever it sees (see Hunter).
 *
 * It finds its own way: from its start it floods a grid of walkable cells,
 * stepping by the same rules as the investigator (walls, furniture, stair
 * height), so it learns both floors through the stairwell. The flood runs a
 * few milliseconds a frame; it starts roaming over what it already knows.
 *
 * Everyone in the level sees the same one. One client leads it (the lowest
 * connection id, see `leadsHunter` in presence.ts): it hunts every
 * investigator in the level, by what their presence says of them, and shares
 * where it is; the others only show it there, and are told when its blows land
 * on them. Alone, or offline, a client leads its own.
 */

/** What the level offers: the same collision the investigator walks by. */
export type HunterWorld = {
  groundAt: (x: number, z: number, from: number) => number;
  wallDist: (origin: THREE.Vector3, dir: THREE.Vector3, far: number) => number;
  hitsFurniture: (x: number, z: number, y: number) => boolean;
  /** The level's ear, once the first click or key has allowed sound. */
  listener: () => THREE.AudioListener | null;
  /** Whether a point stands in lamplight. */
  litAt: (p: THREE.Vector3) => boolean;
  radius: number;
  step: number;
};

/** An investigator, as the creature perceives them this frame. */
export type HunterSense = {
  /** Who: a connection id (the local one is -1 while offline). */
  id: number;
  /** False while the level is loading or they are reading, asleep or in a pane: it leaves them be. */
  active: boolean;
  /** Awake, but nothing it can find: gamelord, walking unseen. */
  hidden?: boolean;
  feet: THREE.Vector3;
  eye: THREE.Vector3;
  /** Where the camera looks (unit). */
  look: THREE.Vector3;
  torchOn: boolean;
  /** The noise they make: 0 standing still or crouched, 1 walking, 2 running. */
  noise: 0 | 1 | 2;
};

/** Where the hunter is and what it is doing, as its leader shares it. */
export type HunterSnapshot = {
  p: [number, number, number];
  yaw: number;
  anim: 'walk' | 'attack';
  /** Metres per second it is going; the walk clip plays to match. */
  pace: number;
  /** Whom it is after (a sense id), while `chasing`. */
  target: number;
  chasing: boolean;
};

/** What the hunter is given each frame. */
export type HunterFrame = {
  /** The investigator at this screen. */
  local: HunterSense;
  /** Everyone else in the level; only the leader hunts them. */
  others: HunterSense[];
  /** Whether this client leads it; otherwise it shows `follow`, if there is one. */
  lead: boolean;
  follow: HunterSnapshot | null;
  /** Its blow landed on someone else (by sense id): tell them. */
  onBlow: (id: number) => void;
};

const CELL = 0.4;
const MAX_NODES = 12000;
const BUILD_MS = 3;
const EYE = 1.7;
const FOV = THREE.MathUtils.degToRad(80);      // half-angle it can see across
const TORCH_HALF = 0.52;                       // the torch's cone (SpotLight angle)
const REACH = 1.25;                            // close enough to strike
const LEAVE = 1.9;                             // the player has got away from the strike
const TRACK = 14;                              // once hunting, how far it keeps you in sight
const GIVE_UP = 4;                             // seconds out of sight before it stops chasing
const HIT_AT = 0.5;                            // seconds into the attack clip the blow lands
const MUSIC_IN = 1;                            // seconds for the chase music to swell
const MUSIC_OUT = 3;                           // and to die away once it gives up

/** A map baked by `bake()`: [ix, iz, floor height] per cell, and each cell's neighbours. */
type BakedNav = { cell: number; nodes: [number, number, number][]; links: number[][] };
type NavNode = { x: number; y: number; z: number; ix: number; iz: number; n: number[] };
type State = 'wait' | 'wander' | 'pause' | 'chase' | 'search' | 'attack';

const band = (y: number) => Math.round(y / 1.2);
const key = (ix: number, iz: number, b: number) => `${ix},${iz},${b}`;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function createHunter(spec: Hunter, scene: THREE.Scene, mount: HTMLElement, world: HunterWorld) {
  // ── Navigation grid ───────────────────────────────────────────────
  const nodes: NavNode[] = [];
  const index = new Map<string, number>();
  const queue: number[] = [];
  let qi = 0;
  let seeded = false;
  // A baked map (spec.nav) saves the flood, which costs tens of seconds of raycasts.
  let nav: 'loading' | 'baked' | 'live' = spec.nav ? 'loading' : 'live';
  if (spec.nav) {
    fetch(spec.nav)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: BakedNav) => {
        for (const [ix, iz, y] of data.nodes) {
          index.set(key(ix, iz, band(y)), nodes.length);
          nodes.push({ x: ix * CELL, y, z: iz * CELL, ix, iz, n: [] });
        }
        data.links.forEach((list, i) => { nodes[i].n = list; });
        nav = 'baked';
      })
      .catch(err => { console.warn('Hunter: no baked map, mapping live:', err); nav = 'live'; });
  }
  const o = new THREE.Vector3();
  const d = new THREE.Vector3();

  const addNode = (ix: number, iz: number, y: number) => {
    const i = nodes.length;
    nodes.push({ x: ix * CELL, y, z: iz * CELL, ix, iz, n: [] });
    index.set(key(ix, iz, band(y)), i);
    queue.push(i);
    return i;
  };
  const findNode = (ix: number, iz: number, y: number) => {
    for (const b of [band(y), band(y) - 1, band(y) + 1]) {
      const i = index.get(key(ix, iz, b));
      if (i !== undefined && Math.abs(nodes[i].y - y) <= world.step + 0.01) return i;
    }
    return -1;
  };
  /** Floor height one cell over, if the creature can step there; else null. */
  const passable = (a: NavNode, nx: number, nz: number) => {
    const len = Math.hypot(nx - a.x, nz - a.z);
    d.set((nx - a.x) / len, 0, (nz - a.z) / len);
    for (const h of [0.45, 1.3]) {
      if (world.wallDist(o.set(a.x, a.y + h, a.z), d, world.radius + len + 0.01) < world.radius + len) return null;
    }
    const g = world.groundAt(nx, nz, a.y);
    if (g === -Infinity || Math.abs(g - a.y) > world.step) return null;
    if (spec.ceiling !== undefined && g > spec.ceiling) return null;
    if (world.hitsFurniture(nx, nz, Math.max(g, a.y))) return null;
    return g;
  };
  const buildSome = (budgetMs = BUILD_MS) => {
    if (nav !== 'live') return;
    if (!seeded) {
      const [sx, sy, sz] = spec.start;
      const ix = Math.round(sx / CELL), iz = Math.round(sz / CELL);
      const g = world.groundAt(ix * CELL, iz * CELL, sy + 0.2);
      if (g === -Infinity) return;
      addNode(ix, iz, g);
      seeded = true;
    }
    const end = performance.now() + budgetMs;
    while (qi < queue.length && nodes.length < MAX_NODES && performance.now() < end) {
      const ai = queue[qi++];
      const a = nodes[ai];
      for (const [dx, dz] of DIRS) {
        const ix = a.ix + dx, iz = a.iz + dz;
        const known = findNode(ix, iz, a.y);
        if (known >= 0 && (a.n.includes(known) || nodes[known].n.includes(ai))) continue;
        const g = passable(a, ix * CELL, iz * CELL);
        if (g === null) continue;
        const found = findNode(ix, iz, g);
        const bi = found >= 0 ? found : addNode(ix, iz, g);
        if (!a.n.includes(bi)) a.n.push(bi);
        if (!nodes[bi].n.includes(ai)) nodes[bi].n.push(ai);
      }
    }
  };

  const nearestNode = (p: THREE.Vector3) => {
    const cx = Math.round(p.x / CELL), cz = Math.round(p.z / CELL);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= 3 && best < 0; r++) {
      for (let ix = cx - r; ix <= cx + r; ix++) {
        for (let iz = cz - r; iz <= cz + r; iz++) {
          for (const b of [band(p.y), band(p.y) - 1, band(p.y) + 1]) {
            const i = index.get(key(ix, iz, b));
            if (i === undefined || nodes[i].n.length === 0) continue;
            const n = nodes[i];
            if (Math.abs(n.y - p.y) > 1) continue;
            const dd = (n.x - p.x) ** 2 + (n.z - p.z) ** 2;
            if (dd < bestD) { bestD = dd; best = i; }
          }
        }
      }
    }
    return best;
  };

  /** A* over the grid; the path excludes `from`. */
  const findPath = (from: number, to: number): number[] | null => {
    if (from < 0 || to < 0) return null;
    if (from === to) return [];
    const h = (i: number) => Math.hypot(nodes[i].x - nodes[to].x, nodes[i].y - nodes[to].y, nodes[i].z - nodes[to].z);
    const g = new Map<number, number>([[from, 0]]);
    const came = new Map<number, number>();
    const heap: [number, number][] = [[h(from), from]];
    const closed = new Set<number>();
    const push = (f: number, i: number) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top[1];
    };
    while (heap.length) {
      const cur = pop();
      if (cur === to) {
        const path = [to];
        let k = to;
        while (came.has(k) && came.get(k) !== from) { k = came.get(k)!; path.push(k); }
        return path.reverse();
      }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const gc = g.get(cur)!;
      for (const nb of nodes[cur].n) {
        if (closed.has(nb)) continue;
        const a = nodes[cur], b = nodes[nb];
        const ng = gc + Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (ng < (g.get(nb) ?? Infinity)) {
          g.set(nb, ng);
          came.set(nb, cur);
          push(ng + h(nb), nb);
        }
      }
    }
    return null;
  };

  // ── The creature ──────────────────────────────────────────────────
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  let mixer: THREE.AnimationMixer | null = null;
  let walk: THREE.AnimationAction | null = null;
  let attack: THREE.AnimationAction | null = null;
  let disposed = false;
  new GLTFLoader().loadAsync(spec.model).then(gltf => {
    if (disposed) return;
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }   // skinned bounds lag the pose
    });
    root.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = (name: string) => gltf.animations.find(a => a.name === name) ?? gltf.animations[0];
    walk = mixer.clipAction(clip(spec.walkClip));
    attack = mixer.clipAction(clip(spec.attackClip));
    walk.play();
  }).catch(err => console.error('Hunter failed to load:', spec.model, err));

  // ── Sound ─────────────────────────────────────────────────────────
  // Its own noise comes from where it stands; the chase music plays over it, everywhere.
  let voiceBuf: AudioBuffer | null = null;
  let musicBuf: AudioBuffer | null = null;
  const audioLoader = new THREE.AudioLoader();
  if (spec.sound) audioLoader.loadAsync(spec.sound).then(b => { voiceBuf = b; }).catch(err => console.error('Hunter sound failed:', err));
  if (spec.chaseMusic) audioLoader.loadAsync(spec.chaseMusic).then(b => { musicBuf = b; }).catch(err => console.error('Chase music failed:', err));
  let voice: THREE.PositionalAudio | null = null;
  let music: THREE.Audio | null = null;
  let musicLevel = 0;
  const updateSound = (dt: number, chasing: boolean) => {
    const ear = world.listener();
    if (!ear || ear.context.state !== 'running') return;
    if (!voice && voiceBuf && root.visible) {
      voice = new THREE.PositionalAudio(ear);
      voice.setBuffer(voiceBuf);
      voice.setLoop(true);
      voice.setRefDistance(2);
      voice.setRolloffFactor(1.6);
      voice.setVolume(0.9);
      voice.position.y = 1.5;
      root.add(voice);
      // Start somewhere in the loop, so it never sounds freshly begun.
      voice.offset = Math.random() * voiceBuf.duration;
      voice.play();
    }
    if (!music && musicBuf) {
      music = new THREE.Audio(ear);
      music.setBuffer(musicBuf);
      music.setLoop(true);
      music.setVolume(0);
    }
    if (!music) return;
    musicLevel = chasing ? Math.min(1, musicLevel + dt / MUSIC_IN) : Math.max(0, musicLevel - dt / MUSIC_OUT);
    if (musicLevel > 0 && !music.isPlaying) music.play();
    music.setVolume(0.75 * musicLevel);
    // Once it has died away, rewind: the next chase starts from the top.
    if (musicLevel === 0 && music.isPlaying) music.stop();
  };

  /**
   * A blow landing, made on the spot: a claw's whoosh, a heavy thump in the
   * chest and a wet tear — a little different every time. In your ears, not
   * placed in the room: it is happening to you.
   */
  let noise: AudioBuffer | null = null;
  const playHit = () => {
    const ear = world.listener();
    if (!ear || ear.context.state !== 'running') return;
    const ac = ear.context;
    const out = ear.getInput();
    if (!noise) {
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime;
    const vary = 0.85 + Math.random() * 0.3;
    const burst = (start: number, length: number, filter: BiquadFilterType, freq: number, peak: number, sweepTo?: number) => {
      const src = ac.createBufferSource();
      src.buffer = noise;
      src.playbackRate.value = vary;
      const f = ac.createBiquadFilter();
      f.type = filter;
      f.frequency.setValueAtTime(freq * vary, start);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo * vary, start + length);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, length / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, start + length);
      src.connect(f).connect(g).connect(out);
      src.start(start, Math.random() * 0.5, length + 0.05);
    };
    // The swipe, rising as the claws come across.
    burst(t0, 0.16, 'bandpass', 500, 0.35, 2600);
    // The blow: a low thud with a body behind it.
    const thump = ac.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(95 * vary, t0 + 0.06);
    thump.frequency.exponentialRampToValueAtTime(38, t0 + 0.32);
    const tg = ac.createGain();
    tg.gain.setValueAtTime(0.0001, t0 + 0.06);
    tg.gain.exponentialRampToValueAtTime(0.9, t0 + 0.07);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    thump.connect(tg).connect(out);
    thump.start(t0 + 0.06);
    thump.stop(t0 + 0.4);
    burst(t0 + 0.06, 0.18, 'lowpass', 900, 0.8);
    // The tear.
    burst(t0 + 0.08, 0.12, 'highpass', 2800, 0.25);
  };

  const pos = new THREE.Vector3(...spec.start);
  let yaw = Math.random() * Math.PI * 2;
  let state: State = 'wait';
  let path: number[] = [];
  let at = -1;                 // the node it last stood on
  let pauseFor = 0;
  let repathIn = 0;
  let senseIn = 0;
  let lostFor = 0;
  let seesYou = false;
  let lastAttackTime = 0;
  let target = -1;             // whom it is after (a sense id)
  let senses: HunterSense[] = [];
  let pace = 0;
  let leading = true;
  const lastSeen = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const playAttack = (on: boolean) => {
    if (!walk || !attack) return;
    if (on && !attack.isRunning()) {
      attack.reset().play();
      attack.crossFadeFrom(walk, 0.2, false);
      lastAttackTime = 0;
    } else if (!on && attack.isRunning()) {
      walk.reset().play();
      walk.crossFadeFrom(attack, 0.25, false);
      attack.stop();
    }
  };

  const wanderSomewhere = () => {
    // Now and then toward someone in its reach, as if it smelt them.
    if (spec.scent && Math.random() < spec.scent) {
      const near = senses.filter(s => nearestNode(s.feet) >= 0);
      const s = near[Math.floor(Math.random() * near.length)];
      if (s) {
        tmp.set(s.feet.x + (Math.random() - 0.5) * 8, s.feet.y, s.feet.z + (Math.random() - 0.5) * 8);
        const goal = nearestNode(tmp);
        const p = goal >= 0 ? findPath(at, goal) : null;
        if (p && p.length > 2) { path = p; state = 'wander'; return; }
      }
    }
    for (let tries = 0; tries < 6; tries++) {
      const target = Math.floor(Math.random() * nodes.length);
      const p = findPath(at, target);
      if (p && p.length > 4) { path = p; state = 'wander'; return; }
    }
    state = 'pause';
    pauseFor = 1;
  };

  /** Can it see the investigator from where it stands? */
  const canSee = (s: HunterSense, hunting: boolean) => {
    o.set(pos.x, pos.y + EYE, pos.z);
    d.subVectors(s.eye, o);
    const dist = d.length();
    if (dist < 0.01) return true;
    // A torch beam on it gives you away from any distance, whichever way it faces.
    tmp.set(pos.x, pos.y + 1.3, pos.z).sub(s.eye);
    const inBeam = s.torchOn && s.look.angleTo(tmp) < TORCH_HALF;
    if (hunting) {
      if (dist > TRACK && !inBeam) return false;
    } else {
      if (!inBeam) {
        // Otherwise only lamplight shows you, close to — or the dark, closer still — and only in front of it.
        const lit = dist <= spec.sightLit && world.litAt(s.feet);
        const dark = spec.sightDark !== undefined && dist <= spec.sightDark;
        if (!lit && !dark) return false;
        tmp2.set(Math.sin(yaw), 0, Math.cos(yaw));
        tmp.set(d.x, 0, d.z);
        if (tmp.lengthSq() > 1e-4 && tmp2.angleTo(tmp) > FOV) return false;
      }
    }
    d.divideScalar(dist);
    return world.wallDist(o, d, dist) >= dist - 0.05;
  };

  // ── What the investigator feels ───────────────────────────────────
  // Red claw marks on the screen, a bloody vignette, and a blur facing it.
  const marks = document.createElement('canvas');
  Object.assign(marks.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '2' });
  const vignette = document.createElement('div');
  Object.assign(vignette.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '2', opacity: '0',
    background: 'radial-gradient(ellipse at center, rgba(177,72,63,0) 30%, rgba(150,20,15,0.85) 100%)',
  });
  mount.append(marks, vignette);
  const ctx = marks.getContext('2d')!;
  let hurt = 0;
  let fear = 0;
  let joltT = 0;
  const jolt = new THREE.Vector3();

  const slash = () => {
    const w = marks.width, h = marks.height;
    const cx = w * (0.25 + Math.random() * 0.5), cy = h * (0.25 + Math.random() * 0.5);
    const ang = (Math.random() - 0.5) * 1.6 + Math.PI / 4 * (Math.random() < 0.5 ? 1 : -1);
    const len = Math.min(w, h) * (0.3 + Math.random() * 0.2);
    const gap = Math.min(w, h) * 0.04;
    const drips: [number, number, number][] = [];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.shadowColor = 'rgba(120,0,0,0.7)';
    ctx.shadowBlur = gap * 0.5;
    for (let k = -1; k <= 1; k++) {
      const off = k * gap;
      const grad = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      grad.addColorStop(0, 'rgba(110,0,0,0)');
      grad.addColorStop(0.2, 'rgba(140,8,6,0.9)');
      grad.addColorStop(0.8, 'rgba(120,4,4,0.85)');
      grad.addColorStop(1, 'rgba(110,0,0,0)');
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = gap * (0.16 + Math.random() * 0.1);
      ctx.beginPath();
      ctx.moveTo(-len / 2, off);
      ctx.quadraticCurveTo(0, off + gap * (Math.random() - 0.3) * 1.5, len / 2, off + gap * 0.4);
      ctx.stroke();
      // A drip or two from each gash, to run straight down the screen.
      for (let j = 0; j < 1 + Math.round(Math.random()); j++) {
        const x = (Math.random() - 0.5) * len * 0.7;
        drips.push([cx + Math.cos(ang) * x - Math.sin(ang) * off, cy + Math.sin(ang) * x + Math.cos(ang) * off, gap * (0.6 + Math.random() * 2)]);
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(120,6,4,0.8)';
    for (const [x, y, l] of drips) ctx.fillRect(x - 1, y, 2, l);
  };

  const onHit = () => {
    playHit();
    hurt = Math.min(1, hurt + 0.55);
    joltT = 0.25;
    slash();
  };

  const updateFeel = (dt: number, s: HunterSense) => {
    const w = Math.round(mount.clientWidth), h = Math.round(mount.clientHeight);
    if (w && (marks.width !== w || marks.height !== h)) { marks.width = w; marks.height = h; }
    // The marks fade over several seconds.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.4)})`;
    ctx.fillRect(0, 0, marks.width, marks.height);
    ctx.restore();
    hurt = Math.max(0, hurt - dt * 0.22);
    vignette.style.opacity = (hurt * (0.85 + 0.15 * Math.sin(performance.now() / 180))).toFixed(3);

    // Face to face: close, in view, nothing between.
    let facing = false;
    if (root.visible && s.active) {
      tmp.set(pos.x, pos.y + 1.4, pos.z).sub(s.eye);
      const dist = tmp.length();
      if (dist < 6 && s.look.angleTo(tmp) < 0.7) {
        facing = world.wallDist(s.eye.clone(), tmp.clone().normalize(), dist) >= dist - 0.3;
      }
    }
    fear = facing ? Math.min(1, fear + dt / 1.2) : Math.max(0, fear - dt / 2.5);

    joltT = Math.max(0, joltT - dt);
    const j = joltT * 0.12;
    jolt.set((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j);
  };

  // ── Each frame ────────────────────────────────────────────────────
  /** Stands where it is, not moving: loading, or nobody to hunt. */
  const hold = () => {
    root.visible = !!mixer && nodes.length > 0;
    if (walk) walk.timeScale = 0;
    root.position.copy(pos);
    pace = 0;
  };

  /** Someone else leads it: ease to where they say it is, doing what they say. */
  const followSnapshot = (dt: number, snap: HunterSnapshot) => {
    if (!mixer || !walk) { hold(); return; }
    root.visible = true;
    tmp.fromArray(snap.p);
    if (pos.distanceTo(tmp) > 4) pos.copy(tmp);
    else pos.lerp(tmp, 1 - Math.exp(-dt * 10));
    let dy = snap.yaw - yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += dy * (1 - Math.exp(-dt * 10));
    playAttack(snap.anim === 'attack');
    pace = snap.pace;
    walk.timeScale = snap.anim === 'attack' ? 1 : pace / spec.walkSpeed;
    mixer.update(dt);
    root.position.copy(pos);
    root.rotation.y = yaw;
  };

  /** Listens for footsteps: the nearest walker or runner it can hear, if any. */
  const hearSomeone = () => {
    if (!spec.hear) return null;
    let best: HunterSense | null = null, bestD = Infinity;
    for (const s of senses) {
      const range = s.noise === 2 ? spec.hear.run : s.noise === 1 ? spec.hear.walk : 0;
      if (!range || Math.abs(s.feet.y - pos.y) > 1.6) continue;
      const dist = Math.hypot(s.feet.x - pos.x, s.feet.z - pos.z);
      if (dist <= range && dist < bestD) { bestD = dist; best = s; }
    }
    return best;
  };
  let listenIn = 0;

  const hunt = (dt: number, frame: HunterFrame) => {
    // While everyone is busy (reading, asleep…) it holds still; it hunts only those it could find.
    const awake = [frame.local, ...frame.others].filter(s => s.active);
    senses = awake.filter(s => !s.hidden);
    if (!awake.length || !mixer || !walk || nodes.length < 50) { hold(); return; }
    root.visible = true;
    if (at < 0) {
      at = nearestNode(pos);
      if (at >= 0) pos.set(nodes[at].x, nodes[at].y, nodes[at].z);
    }

    // Look for anyone a few times a second; keep after the one it has, while it can see them.
    if ((senseIn -= dt) <= 0) {
      senseIn = 0.1;
      const hunting = state === 'chase' || state === 'attack';
      const current = senses.find(s => s.id === target);
      let seen: HunterSense | null = hunting && current && canSee(current, true) ? current : null;
      if (!seen) {
        let best = Infinity;
        for (const s of senses) {
          if (!canSee(s, hunting)) continue;
          const dd = s.feet.distanceToSquared(pos);
          if (dd < best) { best = dd; seen = s; }
        }
      }
      seesYou = !!seen;
      if (seen) {
        if (seen.id !== target && state === 'attack') { playAttack(false); state = 'chase'; }
        target = seen.id;
        lastSeen.copy(seen.feet);
        lostFor = 0;
        if (!hunting) { state = 'chase'; repathIn = 0; }
      } else if (!hunting && (listenIn -= 0.1) <= 0) {
        // Footsteps: it goes to see.
        const heard = hearSomeone();
        if (heard) {
          listenIn = 1;
          lastSeen.copy(heard.feet);
          const p = findPath(at, nearestNode(heard.feet));
          if (p) { path = p; state = 'search'; }
        }
      }
    }
    if (!seesYou) lostFor += dt;

    let speed = 0;
    let face: number | null = null;
    const s = senses.find(x => x.id === target);
    const toYou = s ? Math.hypot(s.feet.x - pos.x, s.feet.z - pos.z) : Infinity;
    const sameFloor = !!s && Math.abs(s.feet.y - pos.y) < 1;

    if (state === 'attack') {
      if (s) face = Math.atan2(s.feet.x - pos.x, s.feet.z - pos.z);
      if (!sameFloor || toYou > LEAVE) { playAttack(false); state = 'chase'; repathIn = 0; }
      else if (attack) {
        // The blow lands once per swing.
        const tNow = attack.time;
        if (tNow < lastAttackTime) lastAttackTime = 0;   // the swing looped
        if (lastAttackTime < HIT_AT && tNow >= HIT_AT) {
          if (target === frame.local.id) onHit(); else frame.onBlow(target);
        }
        lastAttackTime = tNow;
      }
    } else if (state === 'chase' || state === 'search') {
      if (state === 'chase' && lostFor > GIVE_UP) { state = 'search'; path = findPath(at, nearestNode(lastSeen)) ?? []; }
      if (state === 'chase' && s && sameFloor && toYou < REACH && seesYou) {
        state = 'attack';
        playAttack(true);
      } else {
        if (state === 'chase' && (repathIn -= dt) <= 0) {
          repathIn = 0.4;
          const goal = nearestNode(seesYou && s ? s.feet : lastSeen);
          const p = findPath(at, goal);
          if (p) path = p;
        }
        // Chasing, flat out; going to look, warily.
        speed = state === 'chase' ? spec.chaseSpeed : (spec.walkSpeed + spec.chaseSpeed) / 2;
        // In the last stretch, close straight in — unless a wall or a low roof is in the way.
        if (state === 'chase' && seesYou && s && sameFloor && toYou < 2.5) {
          path = [];
          face = Math.atan2(s.feet.x - pos.x, s.feet.z - pos.z);
          const stepLen = Math.min(speed * dt, Math.max(0, toYou - REACH * 0.8));
          d.set(Math.sin(face), 0, Math.cos(face));
          const clear = [0.45, 1.3].every(h => world.wallDist(o.set(pos.x, pos.y + h, pos.z), d, world.radius + stepLen + 0.01) >= world.radius + stepLen);
          if (clear) {
            pos.x += d.x * stepLen;
            pos.z += d.z * stepLen;
            const g = world.groundAt(pos.x, pos.z, pos.y);
            if (g !== -Infinity && Math.abs(g - pos.y) < world.step) pos.y = g;
            const near = nearestNode(pos);
            if (near >= 0) at = near;
          } else {
            speed = 0;
          }
        } else if (path.length === 0 && state === 'search') {
          state = 'pause';
          pauseFor = 2 + Math.random() * 2;
        }
      }
    } else if (state === 'pause' || state === 'wait') {
      if ((pauseFor -= dt) <= 0) wanderSomewhere();
    } else if (state === 'wander') {
      speed = spec.walkSpeed;
      if (path.length === 0) { state = 'pause'; pauseFor = 1 + Math.random() * 3; }
    }

    // Walk the path.
    if (speed > 0 && path.length > 0) {
      let budget = speed * dt;
      while (budget > 0 && path.length > 0) {
        const n = nodes[path[0]];
        const dx = n.x - pos.x, dz = n.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= budget) {
          pos.set(n.x, n.y, n.z);
          at = path.shift()!;
          budget -= dist;
        } else {
          pos.x += dx / dist * budget;
          pos.z += dz / dist * budget;
          pos.y += (n.y - pos.y) * Math.min(1, budget / dist);
          face ??= Math.atan2(dx, dz);
          budget = 0;
        }
      }
      if (face === null && path.length > 0) face = Math.atan2(nodes[path[0]].x - pos.x, nodes[path[0]].z - pos.z);
    }

    // Turn toward where it is going, not instantly.
    if (face !== null) {
      let dy = face - yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += Math.sign(dy) * Math.min(Math.abs(dy), 7 * dt);
    }
    pace = state === 'attack' ? 0 : speed;
    walk.timeScale = state === 'attack' ? 1 : speed / spec.walkSpeed;
    mixer.update(dt);
    root.position.copy(pos);
    root.rotation.y = yaw;
  };

  const update = (dt: number, frame: HunterFrame) => {
    if (disposed) return;
    buildSome();
    updateFeel(dt, frame.local);
    if (frame.lead) {
      // Taking over from another leader: carry on from where it was shown.
      if (!leading) { at = -1; path = []; state = 'pause'; pauseFor = 0.5; target = -1; playAttack(false); }
      leading = true;
      hunt(dt, frame);
      updateSound(dt, (state === 'chase' || state === 'attack') && target === frame.local.id);
    } else {
      leading = false;
      if (frame.follow) followSnapshot(dt, frame.follow);
      else hold();
      updateSound(dt, !!frame.follow?.chasing && frame.follow.target === frame.local.id);
    }
  };

  return {
    update,
    /** Where it is and what it is doing, for the others, while this client leads it. */
    snapshot(): HunterSnapshot {
      return {
        p: [pos.x, pos.y, pos.z], yaw, anim: state === 'attack' ? 'attack' : 'walk', pace,
        target, chasing: state === 'chase' || state === 'attack',
      };
    },
    /** Loaded and mapped: ready to lead. */
    get ready() { return !!mixer && nodes.length >= 50; },
    /** Its blow landed on the investigator at this screen (told by whoever leads it). */
    hit: onHit,
    /**
     * Floods the whole level now and returns the map as JSON, for spec.nav.
     * Rebake whenever the level's model changes: with the level open, call it
     * through a temporary window hook and save the result under public/.
     */
    bake() {
      nav = 'live';
      buildSome(1e9);
      const baked: BakedNav = { cell: CELL, nodes: nodes.map(n => [n.ix, n.iz, Math.round(n.y * 1000) / 1000]), links: nodes.map(n => n.n) };
      return JSON.stringify(baked);
    },
    /** Blur in px from facing it. */
    get blur() { const e = fear * fear * (3 - 2 * fear); return e * 3.5; },
    /** A shake to add to the camera this frame. */
    jolt,
    dispose() {
      disposed = true;
      if (voice?.isPlaying) voice.stop();
      if (music?.isPlaying) music.stop();
      voice?.disconnect();
      music?.disconnect();
      scene.remove(root);
      root.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
          mat.dispose();
        }
      });
      marks.remove();
      vignette.remove();
    },
  };
}
