import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Birds } from '@/lib/walkthrough';
import type { TimeOfDay } from '@/lib/weather';

/**
 * Birds crossing a level now and then (a level's `birds`): every `everySec` a
 * flock of `count` flies over `over`, and the next flock comes back the other
 * way. Passes are worked out from the wall clock, seeded by their number, so
 * everyone in the level sees the same birds at the same moment without a word
 * to the server. They fly only at the times of day the level lists.
 *
 * With `cries`, each bird calls now and then while it is up, from where it
 * is: loud overhead, fading as it goes. Audio waits for `listener()` — the
 * level makes one on the first click or key, as browsers require.
 */
export type Flock = {
  /** `now` is Date.now(); `time` the level's current time of day. */
  update: (dt: number, now: number, time: TimeOfDay) => void;
  dispose: () => void;
};

/** Seconds a flock takes to cross. */
const CROSS_SEC = 18;
/** Metres from `over` where a flock starts and ends — out in the haze. */
const REACH = 46;
/** Seconds between one bird's calls, fewest and most. */
const CRY_GAP: [number, number] = [3.5, 9];

/** A small seeded generator (mulberry32), so every client draws the same flock. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFlock(scene: THREE.Scene, cfg: Birds, listener: () => THREE.AudioListener | null): Flock {
  const [minCount, maxCount] = cfg.count;
  const birds: { root: THREE.Object3D; mixer: THREE.AnimationMixer; voice: THREE.PositionalAudio | null; nextCry: number }[] = [];
  let disposed = false;

  // The calls, decoded once. Decoding needs no user gesture; playing does.
  const cries: AudioBuffer[] = [];
  const audioLoader = new THREE.AudioLoader();
  for (const url of cfg.cries ?? []) {
    audioLoader.loadAsync(url).then(buf => { if (!disposed) cries.push(buf); })
      .catch(err => console.error('Bird call failed to load:', url, err));
  }

  new GLTFLoader().loadAsync(cfg.model).then(gltf => {
    if (disposed) return;
    // Scale to the real wingspan (the model's longest side), and wrap so the
    // flight code can treat +Z as the way it flies (the model faces +Z).
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    const size = box.getSize(new THREE.Vector3());
    const scale = cfg.wingspan / Math.max(size.x, size.y, size.z);
    const clip = gltf.animations[0];
    for (let i = 0; i < maxCount; i++) {
      const model = cloneSkinned(gltf.scene);
      model.scale.setScalar(scale);
      model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
      model.traverse(o => { o.frustumCulled = false; if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      const root = new THREE.Group();
      root.add(model);
      root.visible = false;
      scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.timeScale = 0.85 + (i % 3) * 0.12;   // no two beat in step
        action.time = (i * 0.21) % clip.duration;
        action.play();
      }
      birds.push({ root, mixer, voice: null, nextCry: 0.5 + i * 0.9 });
    }
  }).catch(err => console.error('Birds failed to load:', cfg.model, err));

  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const at = new THREE.Vector3();

  return {
    update(dt, now, time) {
      if (!birds.length) return;
      const flying = cfg.times.includes(time);
      const pass = Math.floor(now / 1000 / cfg.everySec);
      const into = now / 1000 - pass * cfg.everySec;
      // Passes go in pairs: out one way, back the other.
      const pair = seeded(Math.floor(pass / 2) * 7919 + 13);
      const heading = pair() * Math.PI * 2 + (pass % 2 ? Math.PI : 0);
      const rand = seeded(pass * 104729 + 7);
      const count = minCount + Math.floor(rand() * (maxCount - minCount + 1));
      dir.set(Math.sin(heading), 0, Math.cos(heading));
      side.set(dir.z, 0, -dir.x);
      const [ox, oz] = cfg.over;
      const [lowest, highest] = cfg.height;

      birds.forEach((b, i) => {
        // Each bird's own place in the loose flock, drawn in order so every client agrees.
        const lateral = (rand() - 0.5) * 14;
        const height = lowest + rand() * (highest - lowest);
        const lag = rand() * 3;
        const pace = 0.9 + rand() * 0.2;
        const sway = rand() * Math.PI * 2;
        const u = ((into - lag) * pace) / CROSS_SEC;
        const show = flying && i < count && u > 0 && u < 1;
        b.root.visible = show;
        if (!show) {
          b.nextCry = 0.5 + Math.random() * 2;   // the first call comes soon after it appears
          return;
        }
        b.mixer.update(dt);
        const along = (u * 2 - 1) * REACH;
        const drift = Math.sin(u * Math.PI * 2 + sway) * 2.5;
        at.set(ox, height + Math.sin(u * 9 + sway) * 0.6, oz)
          .addScaledVector(dir, along)
          .addScaledVector(side, lateral + drift);
        b.root.position.copy(at);
        // Face the way it flies; bank into its drift.
        b.root.rotation.set(0, heading, -Math.cos(u * Math.PI * 2 + sway) * 0.35, 'YXZ');

        // Now and then it calls, from where it is.
        b.nextCry -= dt;
        const ear = listener();
        if (b.nextCry <= 0 && cries.length && ear) {
          b.nextCry = CRY_GAP[0] + Math.random() * (CRY_GAP[1] - CRY_GAP[0]);
          if (!b.voice) {
            b.voice = new THREE.PositionalAudio(ear);
            b.voice.setRefDistance(9);
            b.voice.setRolloffFactor(1.1);
            b.root.add(b.voice);
          }
          if (!b.voice.isPlaying) {
            b.voice.setBuffer(cries[Math.floor(Math.random() * cries.length)]);
            b.voice.setPlaybackRate(0.92 + Math.random() * 0.16);   // no two quite alike
            b.voice.setVolume(0.55 + Math.random() * 0.3);
            b.voice.play();
          }
        }
      });
    },
    dispose() {
      disposed = true;
      for (const b of birds) {
        if (b.voice?.isPlaying) b.voice.stop();
        b.voice?.disconnect();
        b.mixer.stopAllAction();
        b.root.removeFromParent();
        b.root.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) mat.dispose();
        });
      }
    },
  };
}
