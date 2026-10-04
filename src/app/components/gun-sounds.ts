/**
 * The noises a gun makes in the hands, for the reloads in held-viewmodel.ts.
 * All made with Web Audio except the wheel-lock's spanning ratchet, which is a
 * recording (public/sounds/ratchet.mp3, CC0). Each reload plays through its
 * own bus, so putting the gun down mid-reload silences what is still to come.
 */

export type GunSound = 'latch' | 'scrape' | 'clack' | 'boltBack' | 'boltHome' | 'pour' | 'rod' | 'thunk' | 'ratchet' | 'click';

export type GunSounds = {
  /** Plays `cues` (seconds after now) on a fresh bus; call the returned function to cut them off. */
  play: (cues: [number, GunSound][]) => () => void;
};

let ratchet: Promise<AudioBuffer | null> | null = null;

export function createGunSounds(ctx: AudioContext, out: AudioNode): GunSounds {
  if (!ratchet) {
    ratchet = fetch('/sounds/ratchet.mp3')
      .then(r => r.arrayBuffer())
      .then(b => ctx.decodeAudioData(b))
      .catch(err => { console.error('Ratchet sound failed to load:', err); return null; });
  }
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  /** A burst of noise through a band, shaped by an attack and a decay. */
  const burst = (bus: AudioNode, at: number, freq: number, q: number, gain: number, dur: number, sweepTo?: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, at);
    if (sweepTo) band.frequency.linearRampToValueAtTime(sweepTo, at + dur);
    band.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + Math.min(0.004, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    src.connect(band).connect(g).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  };
  /** A ringing metal ping, or a low body thump. */
  const tone = (bus: AudioNode, at: number, freq: number, gain: number, dur: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  const sounds: Record<GunSound, (bus: AudioNode, at: number) => void> = {
    // A spring catch letting go.
    latch: (bus, at) => { burst(bus, at, 3200, 6, 0.6, 0.035); tone(bus, at, 2900, 0.08, 0.05); },
    // Steel sliding along steel.
    scrape: (bus, at) => burst(bus, at, 1800, 2.5, 0.22, 0.32, 3200),
    // A drum or magazine seating home: a sharp crack with weight behind it.
    clack: (bus, at) => { burst(bus, at, 2200, 3, 0.9, 0.06); burst(bus, at + 0.012, 900, 2, 0.5, 0.08); tone(bus, at, 150, 0.5, 0.12); },
    // The Thompson's cocking knob drawn back, then let fly home.
    boltBack: (bus, at) => { burst(bus, at, 1400, 2, 0.35, 0.12, 2600); burst(bus, at + 0.11, 3000, 5, 0.7, 0.04); },
    boltHome: (bus, at) => { burst(bus, at, 2600, 4, 0.9, 0.05); tone(bus, at, 180, 0.45, 0.1); tone(bus, at, 2400, 0.06, 0.08); },
    // Black powder poured down the barrel: a fine dry hiss.
    pour: (bus, at) => burst(bus, at, 6500, 1.2, 0.12, 0.45, 5200),
    // The ramrod's long scrape down the bore, and its bump on the charge.
    rod: (bus, at) => burst(bus, at, 900, 3, 0.25, 0.34, 1500),
    thunk: (bus, at) => { tone(bus, at, 120, 0.55, 0.14); burst(bus, at, 700, 2, 0.4, 0.06); },
    // The wheel spanned with its key.
    ratchet: (bus, at) => {
      void ratchet?.then(buf => {
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = 1.15;
        const g = ctx.createGain();
        g.gain.value = 0.8;
        src.connect(g).connect(bus);
        src.start(Math.max(at, ctx.currentTime));
      });
    },
    // A small sharp snap: the pan cover, the dog coming down.
    click: (bus, at) => { burst(bus, at, 4000, 7, 0.5, 0.025); tone(bus, at, 3500, 0.05, 0.04); },
  };

  return {
    play(cues) {
      const bus = ctx.createGain();
      bus.gain.value = 0.7;
      bus.connect(out);
      const now = ctx.currentTime + 0.02;
      for (const [after, name] of cues) sounds[name](bus, now + after);
      return () => { bus.gain.setValueAtTime(0, ctx.currentTime); bus.disconnect(); };
    },
  };
}
