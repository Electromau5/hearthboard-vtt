'use client';

import { useEffect, useRef, useState } from 'react';
import type { Typewriter } from '@/lib/walkthrough';

interface Props {
  title: string;
  typewriter: Typewriter;
  author: string;
  /** Called once a note has been filed, so the level can show it straight away. */
  onPinned: () => void;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };
const typeface = '"Courier Prime", "Courier New", Courier, monospace';

type Status = 'typing' | 'pinning' | 'pinned' | 'error';

/**
 * A sheet of paper in the typewriter: type a note and pin it. Sits over the 3D
 * view like the reading card. Esc closes it (handled by the modal); Ctrl/⌘ +
 * Enter pins. Every other key goes to the page, so E, F and Tab type as
 * letters here instead of working the level.
 */
export function TypewriterPane({ title, typewriter, author, onPinned, onClose }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('typing');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Focus after the key that opened the pane has finished, or its "e" lands on the sheet.
  useEffect(() => {
    const id = window.setTimeout(() => areaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const blank = !text.trim();
  const busy = status === 'pinning';

  const pin = () => {
    if (blank || busy) return;
    setStatus('pinning');
    typewriter.pin(text.trim(), author).then(
      () => { setStatus('pinned'); setText(''); onPinned(); },
      () => setStatus('error'),
    );
  };

  const another = () => {
    setStatus('typing');
    areaRef.current?.focus();
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        width: 'min(520px, 88%)', maxHeight: '92%', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.97)', border: '1px solid var(--brass-dim)',
        borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
          <span style={{ ...mono, fontSize: 8, color: 'var(--blood)', border: '1px solid var(--blood)', padding: '2px 6px', letterSpacing: '2px' }}>
            Confidential
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)' }}>{title}</span>
        </div>

        <div style={{ padding: '14px 18px 4px', minHeight: 0, overflowY: 'auto' }}>
          {status === 'pinned' ? (
            <div style={{ padding: '28px 8px', textAlign: 'center' }}>
              <div style={{ ...mono, fontSize: 10, color: 'var(--forest)' }}>Pinned to the case board</div>
              <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--ink-text-2)' }}>
                It&apos;s on the corkboard in the case room, and on everyone&apos;s board.
              </p>
            </div>
          ) : (
            // The sheet in the carriage.
            <div style={{
              background: '#f2ead6', borderRadius: 2, padding: '16px 18px 10px',
              boxShadow: 'inset 0 0 30px rgba(120,90,40,0.18), 0 6px 18px rgba(0,0,0,0.6)',
            }}>
              <textarea
                ref={areaRef}
                value={text}
                maxLength={typewriter.maxLength}
                disabled={busy}
                placeholder="Type your note…"
                onChange={e => { setText(e.target.value); if (status === 'error') setStatus('typing'); }}
                onKeyDown={e => {
                  // Keep keys out of the level: E would close the pane, F toggle the torch, WASD walk.
                  e.stopPropagation();
                  if (e.key === 'Tab') e.preventDefault();
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pin(); }
                  if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                }}
                rows={8}
                style={{
                  width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: typeface, fontSize: 15, lineHeight: 1.55, color: '#1d1a16',
                  letterSpacing: '0.2px',
                }}
              />
              <div style={{ textAlign: 'right', fontFamily: typeface, fontSize: 10, color: 'rgba(29,26,22,0.5)' }}>
                {text.length} / {typewriter.maxLength}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: status === 'error' ? 'var(--blood)' : 'var(--ink-text-2)' }}>
            {status === 'error' ? 'The note could not be pinned. Try again.'
              : status === 'pinned' ? '' : 'Ctrl / ⌘ + Enter to pin'}
          </span>
          <span style={{ flex: 1 }} />
          {status === 'pinned' ? (
            <button onClick={another} style={button(true)}>Type another</button>
          ) : (
            <button onClick={pin} disabled={blank || busy} style={button(!blank && !busy)}>
              {busy ? 'Pinning…' : typewriter.pinLabel}
            </button>
          )}
          <button onClick={onClose} style={{ ...button(false), border: '1px solid var(--line)', background: 'transparent' }}>
            Back [Esc]
          </button>
        </div>
      </div>
    </div>
  );
}

const button = (live: boolean): React.CSSProperties => ({
  ...mono, fontSize: 9, padding: '5px 10px', borderRadius: 'var(--r-sm)',
  cursor: live ? 'pointer' : 'default',
  background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
  color: live ? 'var(--brass)' : 'var(--ink-text-2)',
});
