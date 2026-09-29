'use client';

import { useEffect, useState } from 'react';
import type { ArchiveDoc } from '@/lib/walkthrough';

interface Props {
  title: string;
  /** The examinable's description, shown above the list. */
  intro: string;
  /** null while loading. */
  docs: ArchiveDoc[] | null;
  error: boolean;
  emptyText: string;
  shared: Set<string>;
  onShare: (doc: ArchiveDoc) => void;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

/**
 * What a cabinet, shelf or rack in a walkthrough holds: a list on the left and
 * the selected entry on the right, with its scan, footage or recording. Sits
 * over the 3D view like the reading card; E or Esc closes it (handled by the
 * modal), arrow keys move through the list.
 */
export function ArchiveBrowser({ title, intro, docs, error, emptyText, shared, onShare, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const doc = docs?.[Math.min(index, docs.length - 1)];

  useEffect(() => {
    if (!docs?.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setZoomed(false);
        setIndex(i => Math.max(0, Math.min(docs.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docs]);

  const single = docs?.length === 1;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: '3%',
    }}>
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.97)', border: '1px solid var(--brass-dim)',
        borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
          <span style={{ ...mono, fontSize: 8, color: 'var(--blood)', border: '1px solid var(--blood)', padding: '2px 6px', letterSpacing: '2px' }}>
            Confidential
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)' }}>{title}</span>
          {docs && !single && (
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)' }}>{docs.length} {docs.length === 1 ? 'entry' : 'entries'}</span>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              ...mono, fontSize: 9, padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-text-2)',
            }}
          >
            Back [E]
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* The list */}
          {!single && (
            <div style={{ width: '34%', minWidth: 180, borderRight: '1px solid rgba(201,148,79,0.12)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, lineHeight: 1.5, color: 'var(--ink-text-2)', borderBottom: '1px solid rgba(201,148,79,0.08)' }}>
                {intro}
              </p>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {error && <div style={{ padding: 14, fontSize: 12, color: 'var(--blood)' }}>The files could not be retrieved.</div>}
                {!error && !docs && <div style={{ ...mono, padding: 14, fontSize: 10, color: 'var(--ink-text-2)' }}>Opening…</div>}
                {docs?.length === 0 && <div style={{ padding: 14, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-text-2)' }}>{emptyText}</div>}
                {docs?.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => { setIndex(i); setZoomed(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '8px 14px', border: 'none', borderBottom: '1px solid rgba(201,148,79,0.06)',
                      background: d === doc ? 'rgba(201,148,79,0.12)' : 'transparent',
                      borderLeft: d === doc ? '2px solid var(--brass)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--parchment)', lineHeight: 1.3 }}>{d.title}</div>
                    {d.meta && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', marginTop: 2 }}>{d.meta}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* The selected entry */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10, overflowY: 'auto' }}>
            {doc ? (
              <>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--parchment)' }}>{doc.title}</div>
                  {doc.meta && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--brass)', marginTop: 3 }}>{doc.meta}</div>}
                </div>
                {doc.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.image}
                    alt={doc.title}
                    onClick={() => setZoomed(z => !z)}
                    style={zoomed
                      ? { width: '100%', height: 'auto', cursor: 'zoom-out', borderRadius: 'var(--r-sm)' }
                      : { maxWidth: '100%', maxHeight: single ? '68%' : '62%', objectFit: 'contain', alignSelf: 'center', cursor: 'zoom-in', borderRadius: 'var(--r-sm)', boxShadow: '0 4px 18px rgba(0,0,0,0.7)' }}
                  />
                )}
                {doc.video && (
                  <video key={doc.video} src={doc.video} controls style={{ width: '100%', maxHeight: '62%', background: '#000', borderRadius: 'var(--r-sm)' }} />
                )}
                {doc.audio && <audio key={doc.audio} src={doc.audio} controls style={{ width: '100%' }} />}
                {doc.text && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--parchment)', whiteSpace: 'pre-wrap' }}>{doc.text}</p>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)' }}>
                    {doc.image ? 'Click the scan to enlarge · ' : ''}{!single ? '↑ ↓ browse' : ''}
                  </span>
                  <button
                    onClick={() => onShare(doc)}
                    disabled={shared.has(doc.id)}
                    style={{
                      ...mono, fontSize: 9, padding: '5px 10px', borderRadius: 'var(--r-sm)',
                      cursor: shared.has(doc.id) ? 'default' : 'pointer',
                      background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
                      color: shared.has(doc.id) ? 'var(--ink-text-2)' : 'var(--brass)',
                    }}
                  >
                    {shared.has(doc.id) ? 'Shared with party' : 'Share with party'}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-text-2)' }}>{intro}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
