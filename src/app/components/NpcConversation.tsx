'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NpcSpot } from '@/lib/walkthrough';

interface Props {
  npc: NpcSpot;
  onClose: () => void;
}

type Line = { from: 'npc' | 'you'; text: string };
type Turn = { from: 'them' | 'npc'; text: string };
type Answer = { reply: string; audio?: string; meetings: number; regard: string; recent?: Turn[] };

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

/** How the NPC's regard reads to the investigator. */
const REGARD: Record<string, string> = {
  trusting: 'He trusts you',
  warm: 'He is warming to you',
  cordial: 'He is civil',
  wary: 'He is wary of you',
  hostile: 'He wants you gone',
};

/** Speech, with any *stage direction* set in italics. */
function Spoken({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith('*') && part.endsWith('*')
          ? <em key={i} style={{ color: 'var(--ink-text-2)' }}>{part.slice(1, -1)}</em>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

/**
 * A conversation with someone in the level. Opening it walks the investigator
 * up to them, and they greet them as they remember them (see /api/npc/[id]).
 * Enter sends; Esc closes (handled here and by the modal). The input keeps its
 * keys from the level, so typing E or F does not work the level.
 */
export function NpcConversation({ npc, onClose }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [earlier, setEarlier] = useState<Turn[]>([]);
  const [meetings, setMeetings] = useState(0);
  const [regard, setRegard] = useState('');
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ask = useCallback(async (body: { opening?: boolean; message?: string }) => {
    setWaiting(true);
    setError('');
    try {
      const res = await fetch(`/api/npc/${npc.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Answer & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No answer.');
      setLines(prev => [...prev, { from: 'npc', text: data.reply }]);
      setMeetings(data.meetings);
      setRegard(data.regard);
      if (data.recent) setEarlier(data.recent);
      if (data.audio) {
        audioRef.current?.pause();
        audioRef.current = new Audio(data.audio);
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No answer.');
    } finally {
      setWaiting(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [npc.id]);

  // Walk up to them once, when the pane opens.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void ask({ opening: true });
    return () => { audioRef.current?.pause(); };
  }, [ask]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, waiting]);

  const send = () => {
    const said = text.trim();
    if (!said || waiting) return;
    setLines(prev => [...prev, { from: 'you', text: said }]);
    setText('');
    void ask({ message: said });
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75))', padding: '0 0 18px',
    }}>
      <div style={{
        width: 'min(640px, 92%)', maxHeight: '78%', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.96)', border: '1px solid var(--brass-dim)',
        borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)' }}>{npc.name}</span>
          <span style={{ flex: 1 }} />
          {meetings > 0 && (
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)' }}>
              {meetings === 1 ? 'First meeting' : `Met ${meetings} times`}
              {regard && <> · <span style={{ color: regard === 'wary' || regard === 'hostile' ? 'var(--blood)' : 'var(--brass)' }}>{REGARD[regard] ?? regard}</span></>}
            </span>
          )}
        </div>

        <div ref={scrollRef} style={{ padding: '12px 16px', overflowY: 'auto', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {earlier.length > 0 && (
            <div style={{ opacity: 0.5, borderBottom: '1px dashed rgba(201,148,79,0.2)', paddingBottom: 8 }}>
              <div style={{ ...mono, fontSize: 8, color: 'var(--ink-text-2)', marginBottom: 4 }}>Last time</div>
              {earlier.map((t, i) => (
                <div key={i} style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--parchment)' }}>
                  <span style={{ color: 'var(--ink-text-2)' }}>{t.from === 'them' ? 'You: ' : ''}</span><Spoken text={t.text} />
                </div>
              ))}
            </div>
          )}
          {lines.map((l, i) => l.from === 'npc' ? (
            <p key={i} style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.6, color: 'var(--parchment)' }}>
              <Spoken text={l.text} />
            </p>
          ) : (
            <p key={i} style={{ margin: 0, alignSelf: 'flex-end', maxWidth: '85%', fontSize: 13, lineHeight: 1.55, color: 'var(--brass)', textAlign: 'right' }}>
              {l.text}
            </p>
          ))}
          {waiting && (
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-text-2)' }}>
              {lines.length ? 'He considers you…' : 'He looks up from the register…'}
            </p>
          )}
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--blood)', fontStyle: 'italic' }}>{error}</p>}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 12px', borderTop: '1px solid rgba(201,148,79,0.12)' }}>
          <textarea
            ref={inputRef}
            value={text}
            maxLength={600}
            rows={2}
            placeholder={`Say something to ${npc.name.replace(/^The /, 'the ')}…`}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              // Keep keys out of the level: E would close the pane, F toggle the torch, WASD walk.
              e.stopPropagation();
              if (e.key === 'Tab') e.preventDefault();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
            style={{
              flex: 1, resize: 'none', background: 'rgba(0,0,0,0.35)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)', padding: '7px 9px', outline: 'none',
              fontSize: 13, lineHeight: 1.5, color: 'var(--parchment)', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={send} disabled={!text.trim() || waiting} style={button(!!text.trim() && !waiting)}>Say [Enter]</button>
            <button onClick={onClose} style={{ ...button(false), border: '1px solid var(--line)', background: 'transparent' }}>Leave [Esc]</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const button = (live: boolean): React.CSSProperties => ({
  ...mono, fontSize: 9, padding: '6px 10px', borderRadius: 'var(--r-sm)',
  cursor: live ? 'pointer' : 'default', whiteSpace: 'nowrap',
  background: 'rgba(201,148,79,0.08)', border: '1px solid var(--brass-dim)',
  color: live ? 'var(--brass)' : 'var(--ink-text-2)',
});
