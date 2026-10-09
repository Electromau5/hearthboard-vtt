'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { PROP_LIBRARY, type PropAssetId } from '@/lib/prop-library';
import type { DressedProp } from '@/lib/walkthrough';
import type { Dressing, DropSpot } from './set-dressing';

/**
 * gamelord's set-dressing mode, over a walkthrough level: a tray of the prop
 * library along the bottom, dragged (or clicked, then clicked again) into the
 * level; dressed props picked up and moved by dragging, turned with the wheel
 * or Q/E, duplicated and removed. The mouse is free while it is open, so the
 * view turns with a drag on empty space instead; WASD still walks.
 */

type Props = {
  /** The scene's side of it (set-dressing.ts), once the level has loaded. */
  api: RefObject<Dressing | null>;
  items: DressedProp[];
  onChange: (next: DressedProp[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Turns the view by a pointer movement in pixels. */
  onLook: (dx: number, dy: number) => void;
  onExit: () => void;
  saveError: boolean;
  onRetry: () => void;
};

const ASSETS = Object.keys(PROP_LIBRARY) as PropAssetId[];
const STEP = 15;
const newKey = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
const turn = (deg: number, by: number) => ((Math.round(deg + by) % 360) + 360) % 360;

const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' } as const;
const btn = (on = false) => ({
  ...mono, fontSize: 9, padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
  background: on ? 'rgba(201,148,79,0.18)' : 'rgba(0,0,0,0.35)',
  border: `1px solid ${on ? 'var(--brass)' : 'var(--line)'}`,
  color: on ? 'var(--brass)' : 'var(--ink-text-2)',
});

export function SetDressing({ api, items, onChange, onUndo, canUndo, onLook, onExit, saveError, onRetry }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  // The prop to drop next, turned as it will stand.
  const [armed, setArmed] = useState<{ asset: PropAssetId; turnDeg: number } | null>(null);
  const [picked, setSelected] = useState<string | null>(null);
  // A dressed prop being dragged to somewhere new.
  const [moving, setMoving] = useState<{ key: string; turnDeg: number } | null>(null);
  const [catalog, setCatalog] = useState<string>('All');
  const [copied, setCopied] = useState(false);
  const spot = useRef<DropSpot | null>(null);
  // A press on the level: where it began, and what it turned into.
  const press = useRef<{ x: number; y: number; kind: 'look' | 'empty' | 'prop'; key?: string; dragged: boolean } | null>(null);

  const byKey = useMemo(() => new Map(items.map(i => [i.key, i])), [items]);
  // A selection that has gone (undone, or cleared) is no selection.
  const selected = picked && byKey.has(picked) ? picked : null;
  const sel = selected ? byKey.get(selected) : undefined;

  // Refs for the handlers that outlive a render (keys, the wheel).
  const state = useRef({ armed, selected, moving, items });
  useEffect(() => { state.current = { armed, selected, moving, items }; }, [armed, selected, moving, items]);

  // The ghost: what is armed, or what is being moved.
  useEffect(() => {
    const ghost = moving ? { asset: byKey.get(moving.key)?.asset ?? null, turnDeg: moving.turnDeg } : armed;
    api.current?.setGhost(ghost?.asset ?? null, ghost?.turnDeg ?? 0);
    if (!ghost) spot.current = null;
  }, [api, armed, moving, byKey]);
  useEffect(() => { api.current?.select(selected); }, [api, selected]);
  useEffect(() => { api.current?.lift(moving?.key ?? null); }, [api, moving]);
  // Leaving the mode leaves nothing behind in the level.
  useEffect(() => () => {
    api.current?.setGhost(null, 0);
    api.current?.select(null);
    api.current?.lift(null);
  }, [api]);

  const ndcOf = (e: { clientX: number; clientY: number }) => {
    const r = surface.current!.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  /** Turns whatever is in hand: the armed prop, the one being moved, or the selected one. */
  const rotate = useCallback((by: number) => {
    const { armed: a, moving: m, selected: s, items: list } = state.current;
    if (m) setMoving({ ...m, turnDeg: turn(m.turnDeg, by) });
    else if (a) setArmed({ ...a, turnDeg: turn(a.turnDeg, by) });
    else if (s) onChange(list.map(i => (i.key === s ? { ...i, turnDeg: turn(i.turnDeg, by) } : i)));
  }, [onChange]);

  const remove = useCallback(() => {
    const { selected: s, items: list } = state.current;
    if (!s) return;
    onChange(list.filter(i => i.key !== s));
    setSelected(null);
  }, [onChange]);

  const duplicate = useCallback(() => {
    const { selected: s, items: list } = state.current;
    const item = list.find(i => i.key === s);
    if (item) { setArmed({ asset: item.asset, turnDeg: item.turnDeg }); setSelected(null); }
  }, []);

  // Keys while dressing: nothing else in the level hears them but walking.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const { armed: a, moving: m, selected: s } = state.current;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (m) setMoving(null);
        else if (a) setArmed(null);
        else if (s) setSelected(null);
        else onExit();
      } else if (e.code === 'KeyP' && !e.repeat && !mod) onExit();
      else if (e.code === 'KeyQ') rotate(e.shiftKey ? -1 : -STEP);
      else if (e.code === 'KeyE') rotate(e.shiftKey ? 1 : STEP);
      else if ((e.code === 'Delete' || e.code === 'Backspace') && !e.repeat) { e.preventDefault(); remove(); }
      else if (mod && e.code === 'KeyZ' && !e.repeat) { e.preventDefault(); onUndo(); }
      else if (mod && e.code === 'KeyD' && !e.repeat) { e.preventDefault(); duplicate(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, onUndo, rotate, remove, duplicate]);

  // The wheel turns it; not passive, so the page does not scroll as well.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 1) return;
      rotate((e.deltaY > 0 ? 1 : -1) * (e.altKey ? 1 : STEP));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [rotate]);

  const onPointerDown = (e: React.PointerEvent) => {
    surface.current?.setPointerCapture(e.pointerId);
    if (e.button === 2) { press.current = { x: e.clientX, y: e.clientY, kind: 'look', dragged: false }; return; }
    if (e.button !== 0 || armed) return;
    const key = api.current?.pick(ndcOf(e)) ?? null;
    if (key) setSelected(key);
    press.current = { x: e.clientX, y: e.clientY, kind: key ? 'prop' : 'empty', key: key ?? undefined, dragged: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && !p.dragged && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) {
      p.dragged = true;
      // Dragging a dressed prop picks it up; dragging anywhere else turns the view.
      if (p.kind === 'prop' && p.key) {
        const item = byKey.get(p.key);
        if (item) setMoving({ key: item.key, turnDeg: item.turnDeg });
      }
    }
    if (p?.dragged && p.kind !== 'prop') { onLook(e.movementX, e.movementY); return; }
    if (armed || moving) spot.current = api.current?.aim(ndcOf(e)) ?? null;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (moving) {
      const to = spot.current;
      // Dropped on a wall or nothing: it goes back where it was.
      if (to) {
        onChange(items.map((i): DressedProp => {
          if (i.key !== moving.key) return i;
          return { key: i.key, asset: i.asset, p: to.p, turnDeg: moving.turnDeg, ...(to.up ? { up: to.up } : {}) };
        }));
      }
      setMoving(null);
      return;
    }
    if (p?.kind === 'empty' && !p.dragged) setSelected(null);
    if (armed && e.button === 0 && !p?.dragged) {
      const to = spot.current ?? api.current?.aim(ndcOf(e)) ?? null;
      if (!to) return;
      const item: DressedProp = { key: newKey(), asset: armed.asset, p: to.p, turnDeg: armed.turnDeg, ...(to.up ? { up: to.up } : {}) };
      onChange([...items, item]);
      // Shift keeps the same prop in hand, for a row of crates.
      if (!e.shiftKey) { setArmed(null); setSelected(item.key); }
    }
  };

  // Dropped from a drag that began in the tray.
  const onTrayDown = (asset: PropAssetId) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setSelected(null);
    setArmed(a => (a?.asset === asset ? null : { asset, turnDeg: a?.turnDeg ?? 0 }));
  };

  const catalogs = useMemo(() => ['All', ...new Set(ASSETS.map(a => PROP_LIBRARY[a].catalog.split('/')[0]))], []);
  const shownAssets = ASSETS.filter(a => catalog === 'All' || PROP_LIBRARY[a].catalog.startsWith(catalog));

  const copyCode = async () => {
    const r = (n: number) => Math.round(n * 100) / 100;
    const lines = items.map(i => `    { asset: '${i.asset}', at: [${r(i.p[0])}, ${r(i.p[2])}], y: ${r(i.p[1])}, turnDeg: ${Math.round(i.turnDeg)} },`);
    try {
      await navigator.clipboard.writeText(`  placements: [\n${lines.join('\n')}\n  ],\n`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Could not copy:', err);
    }
  };

  const clearAll = () => {
    if (items.length && window.confirm(`Take all ${items.length} dressed props out of this level, for everyone?`)) {
      onChange([]);
      setSelected(null);
    }
  };

  const help = moving ? 'Release to set it down · wheel or Q/E turns · Esc puts it back'
    : armed ? 'Click the level to set it down (Shift keeps it in hand) · wheel or Q/E turns · Esc cancels'
    : sel ? 'Drag it to move · wheel or Q/E turns · Delete removes · Ctrl/⌘ D duplicates'
    : 'Drag a prop from the tray into the level · click one to select it · drag empty space to look · WASD walks';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }}>
      {/* The level itself: aiming, dropping, picking, looking. */}
      <div
        ref={surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { if (!press.current) api.current?.aim(null); }}
        onContextMenu={e => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', cursor: moving ? 'grabbing' : armed ? 'copy' : 'default', touchAction: 'none' }}
      />

      {/* What is going on, and what can be done with the selected prop. */}
      <div style={{
        position: 'absolute', top: 10, left: 10, maxWidth: 360, pointerEvents: 'auto',
        background: 'rgba(10,8,6,0.82)', border: '1px solid var(--brass-dim)', borderRadius: 'var(--r-lg)', padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ ...mono, fontSize: 9, color: 'var(--brass)', letterSpacing: '2px' }}>Set dressing</span>
          <span style={{ ...mono, fontSize: 8, color: 'var(--ink-text-2)' }}>{items.length} placed</span>
          {saveError && (
            <button onClick={onRetry} style={{ ...btn(), color: 'var(--blood)', borderColor: 'var(--blood)' }} title="The last change did not save">Not saved · retry</button>
          )}
          <button onClick={onExit} style={{ ...btn(), marginLeft: 'auto' }} title="Leave set dressing [P]">Done [P]</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-text-2)', lineHeight: 1.4 }}>{help}</div>
        {(sel || armed) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink-text)', marginRight: 4 }}>
              {PROP_LIBRARY[(sel ?? armed)!.asset].name}
            </span>
            <button onClick={() => rotate(-STEP)} style={btn()} title="Turn left [Q]">⟲ {STEP}°</button>
            <button onClick={() => rotate(STEP)} style={btn()} title="Turn right [E]">⟳ {STEP}°</button>
            {sel && <button onClick={duplicate} style={btn()} title="Another like it [Ctrl/⌘ D]">Duplicate</button>}
            {sel && <button onClick={remove} style={{ ...btn(), color: 'var(--blood)' }} title="Take it out [Delete]">Remove</button>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={onUndo} disabled={!canUndo} style={{ ...btn(), opacity: canUndo ? 1 : 0.4 }} title="Undo [Ctrl/⌘ Z]">Undo</button>
          <button onClick={() => void copyCode()} disabled={!items.length} style={{ ...btn(copied), opacity: items.length ? 1 : 0.4 }} title="Copy this level's dressing as placements code, to make it permanent in the level's source">
            {copied ? 'Copied' : 'Copy as code'}
          </button>
          <button onClick={clearAll} disabled={!items.length} style={{ ...btn(), opacity: items.length ? 1 : 0.4 }}>Clear all</button>
        </div>
      </div>

      {/* The tray: the prop library, by catalog. */}
      <div style={{
        position: 'absolute', left: 10, right: 10, bottom: 10, pointerEvents: 'auto',
        background: 'rgba(10,8,6,0.85)', border: '1px solid var(--brass-dim)', borderRadius: 'var(--r-lg)', padding: '6px 8px 8px',
      }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {catalogs.map(c => (
            <button key={c} onClick={() => setCatalog(c)} aria-pressed={catalog === c} style={btn(catalog === c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {shownAssets.map(a => {
            const prop = PROP_LIBRARY[a];
            const on = armed?.asset === a;
            return (
              <button
                key={a}
                onPointerDown={onTrayDown(a)}
                title={`${prop.name} — ${prop.size[0]} × ${prop.size[1]} × ${prop.size[2]} m${prop.solid ? '' : ' · can be walked through'}\n${prop.credit}`}
                style={{
                  flex: '0 0 auto', width: 84, padding: 4, cursor: 'grab', borderRadius: 'var(--r-sm)',
                  background: on ? 'rgba(201,148,79,0.18)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${on ? 'var(--brass)' : 'var(--line)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a 128 px thumbnail behind auth; next/image adds nothing */}
                <img src={prop.preview} alt="" draggable={false} width={60} height={60} style={{ pointerEvents: 'none' }} />
                <span style={{ fontSize: 10, color: on ? 'var(--brass)' : 'var(--ink-text-2)', lineHeight: 1.15, textAlign: 'center' }}>{prop.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
