'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SafeLock } from '@/lib/walkthrough';

interface Props {
  title: string;
  text: string;
  lock: SafeLock;
  /** Every mark was hit: the level records the safe as open and says so in the chat. */
  onOpened: () => void;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

const SIZE = 340;                 // the dial's drawing, in px
const C = SIZE / 2;
const RING = 128;                 // radius of the track the pip runs on
const START_SPEED = 110;          // degrees a second
const SPEED_UP = 1.14;            // faster after every hit
const MISS_COST = 2;              // seconds off the clock for pressing outside a mark

type Mark = { at: number; hit: boolean };
type Phase = 'turning' | 'open' | 'failed';

/** Degrees round from 12 o'clock, clockwise, to a point on the dial. */
const polar = (deg: number, r: number) => {
  const a = (deg - 90) * Math.PI / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const arc = (from: number, to: number, r: number) => {
  const [x0, y0] = polar(from, r);
  const [x1, y1] = polar(to, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
/** How far apart two angles are, the short way round. */
const gap = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

/** Marks spread round the dial, never crowding each other or the pip's starting point. */
function scatter(count: number, width: number): Mark[] {
  const spacing = Math.max(width * 1.6, 300 / count * 0.6);
  for (let tries = 0; tries < 200; tries++) {
    const marks: Mark[] = [];
    for (let i = 0; i < 400 && marks.length < count; i++) {
      const at = Math.random() * 360;
      if (gap(at, 0) < width * 1.5) continue;
      if (marks.every(m => gap(m.at, at) >= spacing)) marks.push({ at, hit: false });
    }
    if (marks.length === count) return marks;
  }
  return Array.from({ length: count }, (_, i) => ({ at: (i + 1) * 360 / (count + 1), hit: false }));
}

/** Clicks of the mechanism, made on the spot: a tumbler falling, a slip, the bolts drawing back. */
function useMechanism() {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);
  return useCallback((kind: 'tick' | 'click' | 'slip' | 'bolt') => {
    try {
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      const t = ctx.currentTime;
      const knock = (at: number, freq: number, decay: number, gain: number) => {
        const len = Math.ceil(ctx.sampleRate * decay);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = freq;
        band.Q.value = 4;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(band).connect(g).connect(ctx.destination);
        src.start(t + at);
      };
      if (kind === 'tick') knock(0, 5200, 0.012, 0.18);
      if (kind === 'click') { knock(0, 2600, 0.04, 0.9); knock(0.03, 1400, 0.06, 0.6); }
      if (kind === 'slip') { knock(0, 420, 0.18, 0.9); knock(0.05, 260, 0.2, 0.6); }
      if (kind === 'bolt') { knock(0, 900, 0.08, 0.9); knock(0.18, 700, 0.12, 1); knock(0.42, 500, 0.25, 1.2); }
    } catch { /* no audio is no reason to stop */ }
  }, []);
}

/**
 * Cracking a safe's dial, over the blurred level: marks are scattered round
 * the dial and a pip runs round its rim. E (or Space, or a click) while the
 * pip is inside a mark sets that tumbler; it turns back the other way, a
 * little faster, as a combination dial does. A press outside every mark
 * slips and costs time. Every mark set before the clock runs out opens the
 * safe. Esc (handled by the modal) steps back from it.
 */
export function SafeCracker({ title, text, lock, onOpened, onClose }: Props) {
  const [minPts, maxPts] = lock.points ?? [3, 5];
  const seconds = lock.seconds ?? 15;
  const width = lock.markDeg ?? 26;

  const [marks, setMarks] = useState<Mark[]>(() => scatter(minPts + Math.floor(Math.random() * (maxPts - minPts + 1)), width));
  const [phase, setPhase] = useState<Phase>('turning');
  const [flash, setFlash] = useState<{ kind: 'hit' | 'miss'; key: number } | null>(null);
  const pipRef = useRef<SVGGElement>(null);
  const clockRef = useRef<SVGPathElement>(null);
  const clockTextRef = useRef<HTMLSpanElement>(null);
  const sound = useMechanism();

  // What the animation reads every frame without re-rendering.
  const run = useRef({ angle: 0, dir: 1, speed: START_SPEED, left: seconds, lastTick: 0 });
  const marksRef = useRef(marks);
  useEffect(() => { marksRef.current = marks; }, [marks]);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const onOpenedRef = useRef(onOpened);
  useEffect(() => { onOpenedRef.current = onOpened; }, [onOpened]);

  const restart = useCallback(() => {
    run.current = { angle: 0, dir: 1, speed: START_SPEED, left: seconds, lastTick: 0 };
    setMarks(scatter(minPts + Math.floor(Math.random() * (maxPts - minPts + 1)), width));
    setFlash(null);
    setPhase('turning');
  }, [seconds, minPts, maxPts, width]);

  const press = useCallback(() => {
    if (phaseRef.current === 'failed') { restart(); return; }
    if (phaseRef.current !== 'turning') return;
    const r = run.current;
    const i = marksRef.current.findIndex(m => !m.hit && gap(m.at, r.angle) <= width / 2);
    if (i < 0) {
      r.left = Math.max(0, r.left - MISS_COST);
      sound('slip');
      setFlash({ kind: 'miss', key: performance.now() });
      return;
    }
    const next = marksRef.current.map((m, j) => (j === i ? { ...m, hit: true } : m));
    marksRef.current = next;
    setMarks(next);
    setFlash({ kind: 'hit', key: performance.now() });
    if (next.every(m => m.hit)) {
      sound('bolt');
      phaseRef.current = 'open';
      setPhase('open');
      onOpenedRef.current();
      return;
    }
    sound('click');
    r.dir = -r.dir;
    r.speed *= SPEED_UP;
  }, [width, sound, restart]);

  // E, Space or Enter presses; Escape is the modal's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  // The pip goes round and the clock runs down.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = run.current;
      if (phaseRef.current === 'turning') {
        r.angle = ((r.angle + r.dir * r.speed * dt) % 360 + 360) % 360;
        r.left = Math.max(0, r.left - dt);
        // A faint tick every ten divisions, like the notches of a real dial.
        const notch = Math.floor(r.angle / 36);
        if (notch !== r.lastTick) { r.lastTick = notch; sound('tick'); }
        if (r.left <= 0) { phaseRef.current = 'failed'; setPhase('failed'); sound('slip'); }
      }
      pipRef.current?.setAttribute('transform', `rotate(${r.angle} ${C} ${C})`);
      const frac = r.left / seconds;
      if (clockRef.current) {
        clockRef.current.setAttribute('d', frac >= 0.999 ? arc(0, 359.99, RING + 30) : frac > 0.001 ? arc(0, frac * 360, RING + 30) : '');
        clockRef.current.setAttribute('stroke', frac < 0.25 ? 'var(--blood)' : 'var(--brass)');
      }
      if (clockTextRef.current) clockTextRef.current.textContent = r.left.toFixed(1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seconds, sound]);

  // Once it is open, a moment to see it before stepping back to the safe itself.
  useEffect(() => {
    if (phase !== 'open') return;
    const t = window.setTimeout(onClose, 1400);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  const set = marks.filter(m => m.hit).length;
  const status = phase === 'open' ? 'The bolts draw back'
    : phase === 'failed' ? 'The tumblers fall back'
    : `${set} of ${marks.length} tumblers set`;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 'min(460px, 92%)' }}>
        <div style={{ textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--r-md)', background: 'rgba(8,6,4,0.72)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--parchment)' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-text-2)', marginTop: 6, lineHeight: 1.5 }}>{text}</div>
        </div>

        <div
          onPointerDown={e => { e.preventDefault(); press(); }}
          style={{
            position: 'relative', width: SIZE, height: SIZE, maxWidth: '86vw', maxHeight: '86vw', cursor: 'pointer',
            animation: flash?.kind === 'miss' ? 'safe-shake 0.25s' : undefined,
          }}
          key={flash?.kind === 'miss' ? flash.key : undefined}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" aria-label={status} role="img">
            {/* The clock, round the outside */}
            <circle cx={C} cy={C} r={RING + 30} fill="none" stroke="rgba(201,148,79,0.12)" strokeWidth={3} />
            <path ref={clockRef} fill="none" strokeWidth={3} strokeLinecap="round" />
            {/* The dial face */}
            <circle cx={C} cy={C} r={RING + 18} fill="rgba(14,11,8,0.92)" stroke="var(--brass-dim)" strokeWidth={2} />
            <circle cx={C} cy={C} r={RING} fill="none" stroke="rgba(201,148,79,0.25)" strokeWidth={10} />
            {/* A hundred divisions, numbered every ten, as on a real dial */}
            {Array.from({ length: 100 }, (_, i) => {
              const long = i % 5 === 0;
              const [x0, y0] = polar(i * 3.6, RING - 14);
              const [x1, y1] = polar(i * 3.6, RING - (long ? 26 : 19));
              return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--brass-dim)" strokeWidth={long ? 2 : 1} />;
            })}
            {Array.from({ length: 10 }, (_, i) => {
              const [x, y] = polar(i * 36, RING - 40);
              return <text key={i} x={x} y={y} fill="var(--brass-dim)" fontSize={11} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font-mono)' }}>{i * 10}</text>;
            })}
            {/* The marks */}
            {marks.map((m, i) => (
              <path key={i} d={arc(m.at - width / 2, m.at + width / 2, RING)} fill="none"
                stroke={m.hit ? 'var(--forest)' : 'var(--brass)'} strokeWidth={m.hit ? 10 : 14} strokeLinecap="butt"
                opacity={m.hit ? 0.9 : 1} style={{ filter: m.hit ? undefined : 'drop-shadow(0 0 4px rgba(201,148,79,0.7))' }} />
            ))}
            {/* The knob */}
            <circle cx={C} cy={C} r={34} fill="#1d1712" stroke="var(--brass-dim)" strokeWidth={2} />
            <circle cx={C} cy={C} r={26} fill="none" stroke="rgba(201,148,79,0.3)" strokeWidth={1} strokeDasharray="2 3" />
            {/* The pip, with its pointer from the knob */}
            <g ref={pipRef}>
              <line x1={C} y1={C - 34} x2={C} y2={C - RING + 12} stroke="rgba(232,220,192,0.35)" strokeWidth={1.5} />
              <circle cx={C} cy={C - RING} r={8} fill="var(--parchment)" stroke="#000" strokeWidth={1.5}
                style={{ filter: 'drop-shadow(0 0 6px rgba(232,220,192,0.9))' }} />
            </g>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span ref={clockTextRef} style={{ ...mono, fontSize: 13, color: 'var(--parchment)' }} />
          </div>
        </div>

        <div style={{ ...mono, fontSize: 11, color: phase === 'open' ? 'var(--forest)' : phase === 'failed' || flash?.kind === 'miss' ? 'var(--blood)' : 'var(--brass)' }}>
          {status}
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--ink-text-2)', textAlign: 'center' }}>
          {phase === 'failed'
            ? <><span style={{ color: 'var(--brass)' }}>[E]</span> try again · <span style={{ color: 'var(--brass)' }}>[Esc]</span> step back</>
            : phase === 'open' ? null
            : <><span style={{ color: 'var(--brass)' }}>[E]</span> when the pip is on a mark · a slip costs {MISS_COST} s · <span style={{ color: 'var(--brass)' }}>[Esc]</span> step back</>}
        </div>
      </div>
      <style>{'@keyframes safe-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }'}</style>
    </div>
  );
}
