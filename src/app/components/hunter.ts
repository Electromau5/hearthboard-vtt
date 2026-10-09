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
 *
 * It may start penned (spec.cage): behind bars it only turns to stare at the
 * nearest investigator; when gamelord opens them it comes out hunting.
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
  /** 0 standing … 1 on its knees. */
  kneel: number;
  /** Shots it has taken, ever: each new one makes it flinch on every screen. */
  shot: number;
  /** Shots since it last got up; the third brings it down. */
  wounds: number;
  /** Seconds left on its knees, while it is down. */
  down?: number;
  /** Penned behind its bars (spec.cage), staring at `target`. */
  caged?: boolean;
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
  /** Whether spec.cage's door is down and in the way. */
  cageShut: boolean;
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
const DOWN_AFTER = 3;                          // shots that bring it to its knees
const DOWN_FOR = 120;                          // seconds it stays down
const KNEEL_IN = 0.9;                          // seconds to sink to its knees
const RISE = 2.5;                              // and to get up again
const STAGGER = 0.45;                          // seconds a shot stops it dead
const SLOW_FOR = 4;                            // seconds to shake off a shot's slowing
const LIMP = 0.12;                             // how much slower each wound leaves it, until it rises
const STARE_TURN = 1.6;                        // radians a second it turns its body, penned, to keep you in view
const STARE_RANGE = 25;                        // how far off it watches you through the bars

/** A map baked by `bake()`: [ix, iz, floor height] per cell, and each cell's neighbours. */
type BakedNav = { cell: number; nodes: [number, number, number][]; links: number[][] };
type NavNode = { x: number; y: number; z: number; ix: number; iz: number; n: number[] };
type State = 'wait' | 'wander' | 'pause' | 'chase' | 'search' | 'attack' | 'down' | 'rise';

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
    if (nav === 'loading') return;
    // A baked map only floods what has been queued since: the ground behind bars that have opened.
    if (nav === 'live' && !seeded) {
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

  // ── Its cage ──────────────────────────────────────────────────────
  // Behind the bars is off the baked map: opened, it is flooded from where the
  // creature stands, and the cells by the bars are looked at afresh so the
  // two join; shut, the links through the bars are cut.
  const cage = spec.cage;
  const inCage = (p: THREE.Vector3) => !!cage && p.x >= cage.min[0] && p.x <= cage.max[0] && p.z >= cage.min[1] && p.z <= cage.max[1];
  const byBars = (n: NavNode) => !!cage && n.x >= cage.min[0] - 1.2 && n.x <= cage.max[0] + 1.2 && n.z >= cage.min[1] - 1.2 && n.z <= cage.max[1] + 1.2;
  const openCage = (p: THREE.Vector3) => {
    if (nav === 'loading') return;
    const ix = Math.round(p.x / CELL), iz = Math.round(p.z / CELL);
    const g = world.groundAt(ix * CELL, iz * CELL, p.y + 0.3);
    if (g !== -Infinity && findNode(ix, iz, g) < 0) addNode(ix, iz, g);
    nodes.forEach((n, i) => { if (byBars(n) && !queue.slice(qi).includes(i)) queue.push(i); });
  };
  const shutCage = () => {
    nodes.forEach((a, ai) => {
      if (!byBars(a)) return;
      a.n = a.n.filter(bi => {
        if (passable(a, nodes[bi].x, nodes[bi].z) !== null) return true;
        nodes[bi].n = nodes[bi].n.filter(x => x !== ai);
        return false;
      });
    });
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
  let body: Body | null = null;
  let height = 1.9;
  new GLTFLoader().loadAsync(spec.model).then(gltf => {
    if (disposed) return;
    gltf.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; }   // skinned bounds lag the pose
    });
    root.add(gltf.scene);
    root.updateMatrixWorld(true);
    height = new THREE.Box3().setFromObject(gltf.scene, true).getSize(tmp).y || height;
    body = rigBody(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    const clip = (name: string) => gltf.animations.find(a => a.name === name) ?? gltf.animations[0];
    walk = mixer.clipAction(clip(spec.walkClip));
    attack = mixer.clipAction(clip(spec.attackClip));
    walk.play();
  }).catch(err => console.error('Hunter failed to load:', spec.model, err));

  // ── Wounds ────────────────────────────────────────────────────────
  // Shot, it reels and comes on slower; the third shot puts it on its knees.
  let wounds = 0;              // since it last got up
  let shotCount = 0;           // ever, shared so every screen sees it flinch
  let downFor = 0;
  let riseFor = 0;
  let kneel = 0;
  let staggerFor = 0;
  let slow = 0;
  let flinchT = Infinity;      // seconds since the last shot struck
  let flinchTwist = 1;
  let bledAt = -Infinity;
  /** How fast it can go, for its wounds: dead still as a shot lands, then dragging itself. */
  const gait = () => (staggerFor > 0 ? 0 : (1 - 0.55 * slow) * (1 - LIMP * wounds));

  /** A shot striking it, as every screen shows it: it flinches, cries out and bleeds. */
  const feelShot = (at: THREE.Vector3 | null) => {
    flinchT = 0;
    flinchTwist = Math.random() < 0.5 ? -1 : 1;
    cry();
    if (at) { bleed(at); bledAt = performance.now(); }
    else if (performance.now() - bledAt > 600) bleed(tmp2.set(pos.x, pos.y + height * (0.62 - 0.3 * kneel), pos.z));
  };

  /** The leader's side of a shot: `by` (a sense id) hit it, at `at` if known. */
  const wound = (by: number, at: THREE.Vector3 | null) => {
    shotCount++;
    feelShot(at);
    if (state === 'down' || state === 'rise') return;
    wounds++;
    if (wounds >= DOWN_AFTER) {
      state = 'down';
      downFor = DOWN_FOR;
      path = [];
      target = by;
      playAttack(false);
      return;
    }
    staggerFor = STAGGER;
    slow = 1;
    // It knows where that came from: it comes for whoever fired — if it can get out.
    const s = senses.find(x => x.id === by);
    if (s && state !== 'attack' && !penned) {
      target = by;
      lastSeen.copy(s.feet);
      lostFor = 0;
      state = 'chase';
      repathIn = 0;
    }
  };

  // Where its head turns, penned and staring: eased toward `gazeAt`, or back to ahead.
  const gaze = { on: false, yaw: 0, pitch: 0 };
  const gazeAt = new THREE.Vector3();
  /** Clip, then kneel, flinch and stare over it. The clip only rewrites what changed, so put it back first. */
  const moveBody = (dt: number) => {
    if (!mixer) return;
    body?.restore();
    mixer.update(dt);
    if (!body) return;
    body.keep();
    flinchT += dt;
    const f = flinchT < 0.08 ? Math.sin(flinchT / 0.08 * Math.PI / 2) : Math.exp(-(flinchT - 0.08) * 5);
    let gy = 0, gp = 0;
    if (gaze.on) {
      const dx = gazeAt.x - pos.x, dz = gazeAt.z - pos.z;
      gy = Math.atan2(dx, dz) - yaw;
      gy = THREE.MathUtils.clamp(Math.atan2(Math.sin(gy), Math.cos(gy)), -1.1, 1.1);
      gp = THREE.MathUtils.clamp(-Math.atan2(gazeAt.y - (pos.y + height * 0.9), Math.hypot(dx, dz)), -0.6, 0.5);
    }
    const ease = 1 - Math.exp(-dt * 6);
    gaze.yaw += (gy - gaze.yaw) * ease;
    gaze.pitch += (gp - gaze.pitch) * ease;
    const t = performance.now() / 1000;
    body.pose(kneel, flinchT === Infinity ? 0 : f, flinchTwist, t);
    body.look(gaze.yaw, gaze.pitch, gaze.on ? 1 : 0, t);
  };

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

  /**
   * Its cry when a round goes in: a wet smack, then a gurgling, falling bellow,
   * from where it stands. Made on the spot, a little different each time.
   */
  let throat: THREE.PositionalAudio | null = null;
  let throatIn: GainNode | null = null;
  const cry = () => {
    const ear = world.listener();
    if (!ear || ear.context.state !== 'running') return;
    const ac = ear.context;
    if (!throat || !throatIn) {
      throatIn = ac.createGain();
      throat = new THREE.PositionalAudio(ear);
      throat.setNodeSource(throatIn as unknown as AudioBufferSourceNode);
      throat.setRefDistance(3);
      throat.setRolloffFactor(1.2);
      throat.position.y = 1.6;
      root.add(throat);
    }
    if (!noise) {
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime;
    const vary = 0.8 + Math.random() * 0.4;
    const len = 0.7 + Math.random() * 0.4;
    // The round going in.
    const smack = ac.createBufferSource();
    smack.buffer = noise;
    const sf = ac.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 1400;
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0.9, t0);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    smack.connect(sf).connect(sg).connect(throatIn);
    smack.start(t0, Math.random() * 0.5, 0.12);
    // The bellow: two rough voices falling, shaken by a gurgle, through a wet throat.
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    const gurgle = ac.createOscillator();
    gurgle.frequency.value = 22 + Math.random() * 14;
    const depth = ac.createGain();
    depth.gain.value = 0.45;
    const am = ac.createGain();
    am.gain.value = 0.6;
    gurgle.connect(depth).connect(am.gain);
    const mouth = ac.createBiquadFilter();
    mouth.type = 'bandpass';
    mouth.Q.value = 3;
    mouth.frequency.setValueAtTime(900 * vary, t0);
    mouth.frequency.exponentialRampToValueAtTime(380 * vary, t0 + len);
    for (const [type, f0, detune] of [['sawtooth', 210, 0], ['square', 140, 9]] as const) {
      const v = ac.createOscillator();
      v.type = type;
      v.detune.value = detune;
      v.frequency.setValueAtTime(f0 * vary, t0 + 0.05);
      v.frequency.exponentialRampToValueAtTime(f0 * vary * 0.38, t0 + len);
      v.connect(am);
      v.start(t0 + 0.05);
      v.stop(t0 + len + 0.05);
    }
    am.connect(mouth).connect(g).connect(throatIn);
    gurgle.start(t0);
    gurgle.stop(t0 + len + 0.05);
  };

  /** Dark blood thrown from a wound, falling away. */
  const bloodTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(70,6,4,0.95)');
    g.addColorStop(0.6, 'rgba(50,4,3,0.7)');
    g.addColorStop(1, 'rgba(40,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const drops = Array.from({ length: 18 }, () => {
    const mat = new THREE.SpriteMaterial({ map: bloodTex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.visible = false;
    scene.add(s);
    return { s, mat, v: new THREE.Vector3(), age: 1, size: 0.05 };
  });
  let nextDrop = 0;
  const bleed = (at: THREE.Vector3) => {
    for (let i = 0; i < 6; i++) {
      const p = drops[nextDrop];
      nextDrop = (nextDrop + 1) % drops.length;
      p.s.position.copy(at);
      p.v.set((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
      p.size = 0.04 + Math.random() * 0.07;
      p.age = 0;
      p.s.visible = true;
    }
  };
  const updateBlood = (dt: number) => {
    for (const p of drops) {
      if (!p.s.visible) continue;
      p.age += dt / 0.7;
      if (p.age >= 1) { p.s.visible = false; continue; }
      p.v.y -= 9.8 * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (1 + p.age));
      p.mat.opacity = 1 - p.age;
    }
  };

  const pos = new THREE.Vector3(...(cage?.at ?? spec.start));
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
  let penned = false;          // behind its bars, the door down
  let cageWasShut: boolean | null = null;
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

  let seenShots = false;
  let lastFollow: HunterSnapshot | null = null;
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
    // A new shot in the leader's count: it flinches here too.
    if (snap.shot > shotCount && seenShots) feelShot(null);
    seenShots = true;
    shotCount = snap.shot;
    kneel += ((snap.kneel ?? 0) - kneel) * (1 - Math.exp(-dt * 8));
    // Penned, its head follows whoever the leader says it stares at.
    const eyed = snap.caged ? senses.find(x => x.id === snap.target) : undefined;
    gaze.on = !!eyed;
    if (eyed) gazeAt.copy(eyed.eye);
    if (snap.caged && snap.anim !== 'attack') walk.timeScale = snap.pace ? 0.6 : 0;
    moveBody(dt);
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
    // While everyone is busy (reading, asleep…) it holds still.
    senses = [frame.local, ...frame.others].filter(s => s.active);
    if (!senses.length || !mixer || !walk || nodes.length < 50) { hold(); return; }
    root.visible = true;
    const wasPenned = penned;
    penned = frame.cageShut && inCage(pos);
    // The bars come up: off the map behind them until it is flooded, and after whoever it was staring at.
    if (!penned && inCage(pos) && nearestNode(pos) < 0) openCage(pos);
    if (wasPenned && !penned && state !== 'down' && state !== 'rise') {
      const s = senses.find(x => x.id === target);
      if (s) { lastSeen.copy(s.feet); lostFor = 0; state = 'chase'; repathIn = 0; }
      at = -1;
    }
    if (at < 0 && !penned) {
      at = nearestNode(pos);
      if (at >= 0) pos.set(nodes[at].x, nodes[at].y, nodes[at].z);
    }
    gaze.on = false;

    // On its knees it hunts nobody; two minutes, and it gets up and comes on again.
    if (state === 'down' || state === 'rise') {
      if (state === 'down') {
        kneel = Math.min(1, kneel + dt / KNEEL_IN);
        if ((downFor -= dt) <= 0) { state = 'rise'; riseFor = RISE; }
      } else {
        kneel = Math.max(0, kneel - dt / RISE);
        if ((riseFor -= dt) <= 0) {
          kneel = 0;
          wounds = 0;
          slow = 0;
          // Back after whoever put it down — or whoever is nearest, if they have gone.
          const s = senses.find(x => x.id === target)
            ?? [...senses].sort((a, c) => a.feet.distanceToSquared(pos) - c.feet.distanceToSquared(pos))[0];
          target = s.id;
          lastSeen.copy(s.feet);
          lostFor = 0;
          state = 'chase';
          repathIn = 0;
        }
      }
      pace = 0;
      walk.timeScale = 0;
      moveBody(dt);
      root.position.copy(pos);
      root.rotation.y = yaw;
      return;
    }

    // Penned: it stands at its bars and stares at the nearest of you, turning to keep you in view.
    if (penned) {
      if (state === 'attack') playAttack(false);
      state = 'wait';
      path = [];
      let eyed: HunterSense | null = null, best = STARE_RANGE * STARE_RANGE;
      for (const s of senses) {
        const dd = s.feet.distanceToSquared(pos);
        if (dd < best) { best = dd; eyed = s; }
      }
      target = eyed?.id ?? -1;
      let turn = 0;
      if (eyed) {
        gaze.on = true;
        gazeAt.copy(eyed.eye);
        let dy = Math.atan2(eyed.feet.x - pos.x, eyed.feet.z - pos.z) - yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        // The head goes first; the body comes round after it, shuffling, once you are well off to one side.
        if (Math.abs(dy) > 0.35) turn = Math.sign(dy) * Math.min(Math.abs(dy) - 0.3, STARE_TURN * dt);
        yaw += turn;
      }
      pace = turn ? 0.5 : 0;
      walk.timeScale = turn ? 0.6 : 0;
      moveBody(dt);
      root.position.copy(pos);
      root.rotation.y = yaw;
      return;
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
        speed = (state === 'chase' ? spec.chaseSpeed : (spec.walkSpeed + spec.chaseSpeed) / 2) * gait();
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
      speed = spec.walkSpeed * gait();
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
    moveBody(dt);
    root.position.copy(pos);
    root.rotation.y = yaw;
  };

  const update = (dt: number, frame: HunterFrame) => {
    if (disposed) return;
    // The bars coming down cut the map through them, on every screen (any of them may lead next).
    if (cage && nav !== 'loading' && frame.cageShut !== cageWasShut) {
      if (frame.cageShut && cageWasShut === false) shutCage();
      cageWasShut = frame.cageShut;
    }
    buildSome();
    updateFeel(dt, frame.local);
    updateBlood(dt);
    staggerFor = Math.max(0, staggerFor - dt);
    slow = Math.max(0, slow - dt / SLOW_FOR);
    if (voice && kneel > 0 !== voice.playbackRate < 1) voice.setPlaybackRate(kneel > 0 ? 0.8 : 1);   // a lower, laboured sound while it is down
    if (frame.lead) {
      // Taking over from another leader: carry on from where it was shown, still down if it was.
      if (!leading) {
        at = -1; path = []; state = 'pause'; pauseFor = 0.5; target = -1; playAttack(false);
        wounds = lastFollow?.wounds ?? 0;
        if (lastFollow?.down) { state = 'down'; downFor = lastFollow.down; }
      }
      leading = true;
      hunt(dt, frame);
      updateSound(dt, (state === 'chase' || state === 'attack') && target === frame.local.id);
    } else {
      leading = false;
      senses = [frame.local, ...frame.others].filter(s => s.active);
      if (frame.follow) { lastFollow = frame.follow; followSnapshot(dt, frame.follow); }
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
        kneel: Math.round(kneel * 20) / 20, shot: shotCount, wounds,
        ...(state === 'down' ? { down: Math.ceil(downFor) } : {}),
        ...(penned ? { caged: true } : {}),
      };
    },
    /** Loaded and mapped: ready to lead. */
    get ready() { return !!mixer && nodes.length >= 50; },
    /** Its blow landed on the investigator at this screen (told by whoever leads it). */
    hit: onHit,
    /**
     * Where a shot along `ray` strikes it, if it does before `far` (what else
     * the round would hit); null on a miss.
     */
    struck(ray: THREE.Ray, far: number): THREE.Vector3 | null {
      if (!root.visible) return null;
      // A column of spheres from shins to head, lower and hunched forward on its knees.
      const tall = height * (1 - 0.33 * kneel);
      const lean = 0.18 * kneel;
      let best: THREE.Vector3 | null = null, bestD = far;
      for (const k of [0.25, 0.45, 0.62, 0.78, 0.92]) {
        const c = tmp.set(pos.x + Math.sin(yaw) * lean * k, pos.y + tall * k, pos.z + Math.cos(yaw) * lean * k);
        const hitAt = ray.intersectSphere(new THREE.Sphere(c, height * (k > 0.85 ? 0.08 : 0.12)), new THREE.Vector3());
        if (!hitAt) continue;
        const dist = hitAt.distanceTo(ray.origin);
        if (dist < bestD) { bestD = dist; best = hitAt; }
      }
      return best;
    },
    /** Shot by `by` (a sense id), at `at` if known. Only its leader calls this; the rest hear of it in the snapshot. */
    wound,
    /** Shows a shot landing at once, on a screen that doesn't lead it (the leader will confirm it). */
    showShot(at: THREE.Vector3) { bleed(at); bledAt = performance.now(); },
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
      throat?.disconnect();
      for (const p of drops) { scene.remove(p.s); p.mat.dispose(); }
      bloodTex.dispose();
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

// ── Its body, wounded ───────────────────────────────────────────────
// The model only walks and strikes; kneeling and flinching are posed here,
// over the clip, on a Mixamo rig whose figure faces +Z.

type Body = {
  /** Puts back what the clip last set, before the mixer runs (it skips values that haven't changed). */
  restore: () => void;
  /** Remembers what the clip set this frame. */
  keep: () => void;
  /** 0..1 on its knees; a flinch of 0..1, twisting to `twist` (±1); `t` in seconds, for its breath. */
  pose: (kneel: number, flinch: number, twist: number, t: number) => void;
  /** Turns the neck and head `yaw` (toward +X, radians) and `pitch` (down), and breathes slow and deep, by `w` 0..1. */
  look: (yaw: number, pitch: number, w: number, t: number) => void;
};

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const deg = THREE.MathUtils.degToRad;
const KNEE_CLEAR = 0.17;    // how high its lowest leg joint sits off the floor, kneeling

function rigBody(model: THREE.Object3D): Body | null {
  const bone = (name: string) => model.getObjectByName(`mixamorig${name}`) ?? model.getObjectByName(`mixamorig:${name}`) ?? null;
  const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
    'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm',
    'LeftToeBase', 'RightToeBase', 'LeftHand', 'RightHand'] as const;
  const b = {} as Record<(typeof names)[number], THREE.Object3D>;
  for (const n of names) {
    const o = bone(n);
    if (!o) { console.warn('Hunter: no', n, 'bone; it will not kneel or flinch'); return null; }
    b[n] = o;
  }
  const all = names.map(n => b[n]);

  const sceneQ = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const r = new THREE.Quaternion();
  /** Turns a bone about an axis of the figure (+X its left, +Y up, +Z ahead), whatever its parents do. */
  const turn = (o: THREE.Object3D, axis: THREE.Vector3, angle: number) => {
    if (!angle) return;
    o.parent!.updateWorldMatrix(true, false);
    model.getWorldQuaternion(sceneQ).invert();
    o.parent!.getWorldQuaternion(pq).premultiply(sceneQ);
    r.setFromAxisAngle(axis, angle);
    // local' = P⁻¹ · R · P · local
    o.quaternion.premultiply(pq).premultiply(r).premultiply(pq.invert());
  };

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  /** Swings a bone so it points (toward `child`) along `dir`, in the figure's frame. */
  const aim = (o: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) => {
    model.updateMatrixWorld(true);
    model.worldToLocal(o.getWorldPosition(from));
    model.worldToLocal(child.getWorldPosition(to));
    to.sub(from).normalize();
    o.parent!.updateWorldMatrix(true, false);
    model.getWorldQuaternion(sceneQ).invert();
    o.parent!.getWorldQuaternion(pq).premultiply(sceneQ);
    r.setFromUnitVectors(to, dir.clone().normalize());
    o.quaternion.premultiply(pq).premultiply(r).premultiply(pq.invert());
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // On its knees, worked out once from the rest pose (already a hunched crouch,
  // arms hanging): thighs down, shins flat behind, toes back; one hand braced
  // by its knee, the other clutching its belly; the head hanging.
  const rest = all.map(o => o.quaternion.clone());
  const restHips = b.Hips.position.clone();
  aim(b.LeftUpLeg, b.LeftLeg, v(0.18, -1, 0.3));
  aim(b.RightUpLeg, b.RightLeg, v(-0.18, -1, 0.3));
  aim(b.LeftLeg, b.LeftFoot, v(0.05, -0.12, -1));
  aim(b.RightLeg, b.RightFoot, v(-0.05, -0.12, -1));
  aim(b.LeftFoot, b.LeftToeBase, v(0, -0.4, -1));
  aim(b.RightFoot, b.RightToeBase, v(0, -0.4, -1));
  turn(b.Spine, X, deg(8));
  turn(b.Head, X, deg(18));
  aim(b.LeftArm, b.LeftForeArm, v(0.25, -0.8, 0.55));
  aim(b.LeftForeArm, b.LeftHand, v(0.05, -0.55, 0.85));
  aim(b.RightArm, b.RightForeArm, v(-0.2, -1, 0.35));
  aim(b.RightForeArm, b.RightHand, v(0.8, 0.1, 0.5));
  const kneelQ = all.map(o => o.quaternion.clone());
  all.forEach((o, i) => o.quaternion.copy(rest[i]));
  b.Hips.position.copy(restHips);

  // Kept on the floor as it sinks: the lowest joint of its legs, from where the
  // clip has it down to a knee's clearance, the hips moving to match.
  const legs = [b.LeftLeg, b.RightLeg, b.LeftFoot, b.RightFoot, b.LeftToeBase, b.RightToeBase];
  const p = new THREE.Vector3();
  const lowest = () => {
    model.updateMatrixWorld(true);
    return Math.min(...legs.map(o => model.worldToLocal(o.getWorldPosition(p)).y));
  };
  const lift = (dy: number) => {
    model.worldToLocal(b.Hips.getWorldPosition(p));
    p.y += dy;
    b.Hips.position.copy(b.Hips.parent!.worldToLocal(model.localToWorld(p)));
  };

  const kept = all.map(o => o.quaternion.clone());
  const keptHips = new THREE.Vector3();
  return {
    restore() {
      all.forEach((o, i) => o.quaternion.copy(kept[i]));
      b.Hips.position.copy(keptHips);
    },
    keep() {
      all.forEach((o, i) => kept[i].copy(o.quaternion));
      keptHips.copy(b.Hips.position);
    },
    pose(kneel, flinch, twist, t) {
      if (kneel > 0.001) {
        const w = kneel * kneel * (3 - 2 * kneel);
        const was = lowest();
        all.forEach((o, i) => o.quaternion.slerp(kneelQ[i], w));
        lift(THREE.MathUtils.lerp(was, KNEE_CLEAR, w) - lowest());
        // Heaving breaths, and the head lolling with them.
        const breath = Math.sin(t * 1.7);
        turn(b.Spine1, X, deg(3) * breath * w);
        turn(b.Head, X, deg(-4) * breath * w);
      }
      if (flinch > 0.001) {
        // Thrown back by the round, twisting away from it, the head snapping.
        turn(b.Spine, X, deg(-14) * flinch);
        turn(b.Spine, Y, deg(16) * twist * flinch);
        turn(b.Spine2, X, deg(-12) * flinch);
        turn(b.Neck, X, deg(-10) * flinch);
        turn(b.Head, X, deg(-20) * flinch);
        turn(b.LeftArm, Z, deg(18) * flinch);
        turn(b.RightArm, Z, deg(-18) * flinch);
      }
    },
    look(yaw, pitch, w, t) {
      turn(b.Neck, Y, yaw * 0.4);
      turn(b.Head, Y, yaw * 0.6);
      turn(b.Neck, X, pitch * 0.4);
      turn(b.Head, X, pitch * 0.6);
      if (w > 0) {
        const breath = Math.sin(t * 1.1);
        turn(b.Spine1, X, deg(2.5) * breath * w);
        turn(b.Spine2, X, deg(1.5) * breath * w);
      }
    },
  };
}
