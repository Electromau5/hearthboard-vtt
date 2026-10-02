'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const MAX_ZOOM = 6;
const CLICK_ZOOM = 2.5;

interface Props {
  src: string;
  alt: string;
  /** Styles the box the image is fitted into; it should have a definite size. */
  style?: React.CSSProperties;
}

type View = { s: number; tx: number; ty: number };

/**
 * A document scan that can be read closely: it starts fitted to its box, a
 * click zooms in on that spot (and a click when zoomed fits it again), the
 * wheel zooms around the cursor, and dragging pans. Remount it (key={src}) to
 * reset the view for a new image.
 */
export function ZoomableImage({ src, alt, style }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = natural.w && box.w ? Math.min(box.w / natural.w, box.h / natural.h) : 0;

  // Keeps the image covering the box once it is bigger than it, and centred while it is smaller.
  const clamp = useCallback((v: View): View => {
    const dw = natural.w * fit * v.s, dh = natural.h * fit * v.s;
    const tx = dw <= box.w ? (box.w - dw) / 2 : Math.min(0, Math.max(box.w - dw, v.tx));
    const ty = dh <= box.h ? (box.h - dh) / 2 : Math.min(0, Math.max(box.h - dh, v.ty));
    return { s: v.s, tx, ty };
  }, [natural, fit, box]);

  // Clamped on every render, so a resize or a newly loaded image re-fits it.
  const shown = clamp(view);

  const zoomAt = useCallback((s: number, px: number, py: number) => {
    setView(v => {
      v = clamp(v);
      const next = Math.min(MAX_ZOOM, Math.max(1, s));
      const k = next / v.s;
      return clamp({ s: next, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k });
    });
  }, [clamp]);

  // The wheel listener must not be passive, or the page scrolls instead of zooming.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView(raw => {
        const v = clamp(raw);
        const next = Math.min(MAX_ZOOM, Math.max(1, v.s * factor));
        const k = next / v.s;
        const px = e.clientX - r.left, py = e.clientY - r.top;
        return clamp({ s: next, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: shown.tx, ty: shown.ty, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setView(v => clamp({ s: v.s, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (shown.s > 1) setView({ s: 1, tx: 0, ty: 0 });
    else zoomAt(CLICK_ZOOM, e.clientX - r.left, e.clientY - r.top);
  };

  const zoomed = shown.s > 1.001;
  const button: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 'var(--r-sm)', cursor: 'pointer',
    background: 'rgba(10,8,6,0.85)', border: '1px solid var(--brass-dim)', color: 'var(--parchment)',
    fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1,
  };

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'relative', overflow: 'hidden', touchAction: 'none', userSelect: 'none',
        cursor: zoomed ? 'grab' : 'zoom-in',
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        // A cached scan can finish loading before onLoad is attached, so check on mount too.
        ref={el => { if (el?.complete && el.naturalWidth && !natural.w) setNatural({ w: el.naturalWidth, h: el.naturalHeight }); }}
        onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{
          position: 'absolute', left: 0, top: 0, maxWidth: 'none',
          width: natural.w * fit * shown.s || undefined,
          height: natural.h * fit * shown.s || undefined,
          transform: `translate(${shown.tx}px, ${shown.ty}px)`,
          visibility: fit ? 'visible' : 'hidden',
          pointerEvents: 'none',
        }}
      />
      <div
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 4, alignItems: 'center' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginRight: 4, textShadow: '0 1px 2px #000' }}>
          {Math.round(shown.s * 100)}%
        </span>
        <button type="button" aria-label="Zoom out" style={button} onClick={() => zoomAt(shown.s / 1.5, box.w / 2, box.h / 2)}>−</button>
        <button type="button" aria-label="Zoom in" style={button} onClick={() => zoomAt(shown.s * 1.5, box.w / 2, box.h / 2)}>+</button>
        <button type="button" aria-label="Fit to view" style={{ ...button, width: 'auto', padding: '0 8px', fontSize: 9, letterSpacing: '1px' }} onClick={() => setView({ s: 1, tx: 0, ty: 0 })}>FIT</button>
      </div>
    </div>
  );
}
