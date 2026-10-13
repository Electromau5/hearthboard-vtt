import * as THREE from 'three';
import type { RadioSet, RadioStation } from '@/lib/walkthrough';

/**
 * A walkthrough's radio or gramophone, heard from where it stands through a
 * 1930s cabinet speaker. A gramophone, or a set with no `dial`, plays its one
 * record. A set with a dial can be tuned across the AM band: each station
 * fades in as the needle nears it and out into static as it passes. Stations
 * that loop keep broadcast time (the same moment for everyone, whenever they
 * tune in); a one-off broadcast starts from the top each time it is found, and
 * leaves dead air when it ends.
 */

/** The AM band a dial sweeps, in kc. */
export const BAND = [540, 1600] as const;
/** One notch of the wheel: the band's 10 kc channels. */
export const STEP = 10;
/** How far either side of a station it can still be heard through the static. */
const WIDTH = 12;

/** Every station a set can pick up, low to high: its own, then the band's. */
export function stationsOf(set: RadioSet): RadioStation[] {
  if (!set.dial) return [{ kc: 0, name: '', src: set.src, loop: set.loop }];
  const own: RadioStation = { kc: set.dial.at, name: set.dial.name, src: set.src, loop: set.loop };
  const rest = (set.dial.stations ?? []).filter(s => Math.abs(s.kc - own.kc) >= WIDTH * 2);
  return [own, ...rest].sort((a, b) => a.kc - b.kc);
}

/** How clearly a station comes in with the needle at `kc`: 1 dead on, 0 lost. */
const clarity = (kc: number, st: RadioStation) => Math.max(0, 1 - Math.abs(kc - st.kc) / WIDTH);

/** The station the needle is on, if it is near enough to make out. */
export function stationAt(set: RadioSet, kc: number): RadioStation | null {
  return stationsOf(set).find(st => clarity(kc, st) >= 0.5) ?? null;
}

export type Tuner = {
  readonly on: boolean;
  setOn: (on: boolean) => void;
  /** Turn the needle to `kc` (a set without a dial ignores it). */
  tune: (kc: number) => void;
  dispose: () => void;
};

/**
 * Built on the first switch-on (audio needs a gesture). `onEnded` is called
 * when a set with no dial finishes a one-off record: it switches itself off.
 */
export function createTuner(
  set: RadioSet, ear: THREE.AudioListener, at: THREE.Vector3, scene: THREE.Scene, onEnded: () => void,
): Tuner {
  const ctx = ear.context;
  const tunable = !!set.dial;
  let on = false;
  let kc = set.dial?.at ?? 0;

  const sound = new THREE.PositionalAudio(ear);
  const mix = ctx.createGain();
  sound.setNodeSource(mix);
  sound.setRefDistance(set.refDistance);
  sound.setRolloffFactor(1.4);
  sound.setVolume(set.volume);
  // Cut the lows and highs: a 1930s cabinet speaker, not a gramophone.
  const low = ctx.createBiquadFilter();
  low.type = 'highpass';
  low.frequency.value = 250;
  const high = ctx.createBiquadFilter();
  high.type = 'lowpass';
  high.frequency.value = 3800;
  sound.setFilters([low, high]);
  sound.position.copy(at);
  scene.add(sound);

  // Static: white noise, narrowed to the speaker's hiss.
  let hiss: GainNode | null = null;
  let noise: AudioBufferSourceNode | null = null;
  if (tunable) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.6;
    hiss = ctx.createGain();
    hiss.gain.value = 0;
    noise.connect(band).connect(hiss).connect(mix);
    noise.start();
  }

  // Each station's own player, wired in the first time the needle finds it.
  type Channel = { st: RadioStation; el: HTMLAudioElement; gain: GainNode | null; heard: boolean };
  const channels: Channel[] = stationsOf(set).map((st) => {
    const el = new Audio(st.src);
    el.loop = st.loop ?? true;
    el.preload = 'none';
    return { st, el, gain: null, heard: false };
  });
  for (const ch of channels) {
    ch.el.addEventListener('ended', () => { if (!tunable) onEnded(); });
  }

  /** Where a station that never stops would be just now. */
  const broadcastTime = (el: HTMLAudioElement) => {
    const sync = () => { if (Number.isFinite(el.duration) && el.duration > 0) el.currentTime = (Date.now() / 1000) % el.duration; };
    if (Number.isFinite(el.duration)) sync();
    else el.addEventListener('loadedmetadata', sync, { once: true });
  };

  const mixDown = () => {
    let clearest = 0;
    for (const ch of channels) {
      const k = !on ? 0 : tunable ? clarity(kc, ch.st) : 1;
      clearest = Math.max(clearest, k);
      if (k > 0 && !ch.heard) {
        if (!ch.gain) {
          ch.gain = ctx.createGain();
          ctx.createMediaElementSource(ch.el).connect(ch.gain).connect(mix);
        }
        // Found again: a broadcast from the top, a station wherever it has got to.
        // (A gramophone just carries on from where it was stopped.)
        if (!ch.el.loop) ch.el.currentTime = 0;
        else if (tunable) broadcastTime(ch.el);
        ch.el.play().catch(() => {});
        ch.heard = true;
      } else if (k === 0 && ch.heard) {
        ch.el.pause();
        ch.heard = false;
      }
      ch.gain?.gain.setTargetAtTime(k * k, ctx.currentTime, 0.04);
    }
    // A little hiss even on a station; a roar between them.
    hiss?.gain.setTargetAtTime(on ? 0.04 + 0.3 * (1 - clearest) : 0, ctx.currentTime, 0.04);
  };

  return {
    get on() { return on; },
    setOn(next) {
      on = next;
      if (on && ctx.state !== 'running') void ctx.resume();
      mixDown();
    },
    tune(next) {
      if (!tunable) return;
      kc = THREE.MathUtils.clamp(next, BAND[0], BAND[1]);
      mixDown();
    },
    dispose() {
      for (const ch of channels) {
        ch.el.pause();
        ch.el.removeAttribute('src');
      }
      noise?.stop();
      sound.disconnect();
      scene.remove(sound);
    },
  };
}
