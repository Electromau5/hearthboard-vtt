/**
 * The noises a gun makes in the hands: the reloads in held-viewmodel.ts, and
 * a shot or a dry click from a gun that fires (`fire`).
 * All made with Web Audio except two recordings: the wheel-lock's spanning
 * ratchet (public/sounds/ratchet.mp3, CC0) and the revolver's report
 * (public/sounds/revolver-shot.mp3, a real handgun shot, CC BY-SA 4.0 — see
 * public/props/CREDITS.txt). Each reload plays through its own bus, so putting
 * the gun down mid-reload silences what is still to come.
 */

export type GunSound = 'latch' | 'scrape' | 'clack' | 'boltBack' | 'boltHome' | 'pour' | 'rod' | 'thunk' | 'ratchet' | 'click' | 'shot' | 'dry' | 'tink'
  | 'revolver' | 'crane' | 'eject' | 'round' | 'index' | 'close' | 'spin';

export type GunSounds = {
  /** Plays `cues` (seconds after now) on a fresh bus; call the returned function to cut them off. */
  play: (cues: [number, GunSound][]) => () => void;
  /** One sound, now, on a bus that is never cut: a shot, a dry click, a case landing (`loud` 0..1). */
  fire: (name: GunSound, loud?: number) => void;
};

const recordings = new Map<string, Promise<AudioBuffer | null>>();

export function createGunSounds(ctx: AudioContext, out: AudioNode): GunSounds {
  const recording = (url: string) => {
    let p = recordings.get(url);
    if (!p) {
      p = fetch(url)
        .then(r => r.arrayBuffer())
        .then(b => ctx.decodeAudioData(b))
        .catch(err => { console.error('Gun sound failed to load:', url, err); return null; });
      recordings.set(url, p);
    }
    return p;
  };
  const ratchet = recording('/sounds/ratchet.mp3');
  const report = recording('/sounds/revolver-shot.mp3');
  /** A recording, at `at` (or as soon as it has loaded), a little faster or slower each time. */
  const playRecording = (buf: Promise<AudioBuffer | null>, bus: AudioNode, at: number, rate: number, gain: number) => {
    void buf.then(b => {
      if (!b) return;
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(bus);
      src.start(Math.max(at, ctx.currentTime));
    });
  };
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
    ratchet: (bus, at) => playRecording(ratchet, bus, at, 1.15, 0.8),
    // A small sharp snap: the pan cover, the dog coming down.
    click: (bus, at) => { burst(bus, at, 4000, 7, 0.5, 0.025); tone(bus, at, 3500, 0.05, 0.04); },
    // A rifle round indoors: the crack, the boom in the chest, the room ringing after.
    shot: (bus, at) => {
      burst(bus, at, 2400, 0.7, 1.4, 0.07);
      burst(bus, at, 600, 0.8, 1.2, 0.16);
      tone(bus, at, 95, 1.0, 0.22, 'triangle');
      burst(bus, at + 0.03, 1200, 0.5, 0.18, 0.55, 500);
    },
    // A spent brass case landing on the floor.
    tink: (bus, at) => { tone(bus, at, 5200 + Math.random() * 1600, 0.05, 0.09); tone(bus, at, 8300 + Math.random() * 900, 0.025, 0.05); },
    // The hammer on an empty chamber.
    dry: (bus, at) => { burst(bus, at, 3000, 5, 0.45, 0.03); tone(bus, at, 1800, 0.06, 0.04); },
    // The .38: a recorded handgun shot, and under it the room taking the blast.
    revolver: (bus, at) => {
      playRecording(report, bus, at, 0.95 + Math.random() * 0.08, 1.3);
      tone(bus, at, 85, 0.6, 0.2, 'triangle');
      burst(bus, at + 0.04, 1100, 0.5, 0.14, 0.6, 450);
    },
    // A Colt's latch drawn back and the cylinder swinging out on its crane.
    crane: (bus, at) => { burst(bus, at, 2600, 4, 0.3, 0.05); burst(bus, at + 0.03, 1500, 2, 0.12, 0.14, 2400); tone(bus, at + 0.12, 2100, 0.05, 0.06); },
    // The ejector rod punched: a knock, then six cases rattling out of their chambers.
    eject: (bus, at) => {
      tone(bus, at, 260, 0.35, 0.07);
      burst(bus, at, 2400, 3, 0.5, 0.04);
      for (let i = 0; i < 6; i++) tone(bus, at + 0.03 + i * 0.012 + Math.random() * 0.01, 3800 + Math.random() * 2600, 0.035, 0.07);
    },
    // A cartridge slid into its chamber, its rim seating against the ejector.
    round: (bus, at) => { burst(bus, at, 3400, 3, 0.12, 0.06, 2600); tone(bus, at + 0.05, 4600 + Math.random() * 600, 0.04, 0.05); burst(bus, at + 0.05, 2000, 4, 0.14, 0.02); },
    // The cylinder thumbed round a chamber.
    index: (bus, at) => { burst(bus, at, 4200, 8, 0.18, 0.018); tone(bus, at, 3900, 0.025, 0.03); },
    // The cylinder snapped home into the frame and the latch catching it.
    close: (bus, at) => { burst(bus, at, 2000, 2.5, 0.85, 0.05); tone(bus, at, 210, 0.4, 0.09); burst(bus, at + 0.025, 3600, 6, 0.4, 0.03); },
    // Spun freely: its pawl ticking over the ratchet, slowing to a stop.
    spin: (bus, at) => {
      let t = at;
      for (let i = 0, gap = 0.028; i < 24; i++, gap *= 1.09) { burst(bus, t, 4300, 9, 0.1 * (1 - i / 30), 0.012); t += gap; }
    },
  };
  const fireBus = ctx.createGain();
  fireBus.gain.value = 0.55;
  fireBus.connect(out);

  return {
    play(cues) {
      const bus = ctx.createGain();
      bus.gain.value = 0.7;
      bus.connect(out);
      const now = ctx.currentTime + 0.02;
      for (const [after, name] of cues) sounds[name](bus, now + after);
      return () => { bus.gain.setValueAtTime(0, ctx.currentTime); bus.disconnect(); };
    },
    fire(name, loud = 1) {
      const bus = loud === 1 ? fireBus : ctx.createGain();
      if (bus !== fireBus) {
        (bus as GainNode).gain.value = 0.55 * loud;
        bus.connect(out);
        window.setTimeout(() => bus.disconnect(), 400);
      }
      sounds[name](bus, ctx.currentTime + 0.005);
    },
  };
}
