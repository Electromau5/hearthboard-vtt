'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NpcSpot } from '@/lib/walkthrough';
import type { AskResult, DialogueSkill, DialogueView, Outcome } from '@/lib/dialogue/types';

interface Props {
  npc: NpcSpot;
  onClose: () => void;
  /** An answer was loud (a threat, a shout): 1–3, for whatever in the level is listening. */
  onNoise?: (level: number) => void;
  /** Switch to free conversation (NpcConversation), when the NPC has a persona. */
  onSpeakFreely?: () => void;
}

type Line =
  | { kind: 'npc'; text: string }
  | { kind: 'you'; text: string; skill: DialogueSkill | null }
  | { kind: 'roll'; skill: DialogueSkill; outcome: Outcome; d100: number; target: number }
  | { kind: 'note'; text: string; tone?: 'good' | 'bad' };

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

const SKILL_LABEL: Record<DialogueSkill, string> = { charm: 'Charm', intimidate: 'Intimidate', persuade: 'Persuade', deceive: 'Deceive' };
/** How the investigator says it, when pushing. */
const SKILL_MANNER: Record<DialogueSkill, string> = {
  charm: 'with your warmest smile', intimidate: 'leaning on the bars', persuade: 'reasonably', deceive: 'with a straight face',
};
const OUTCOME_LABEL: Record<Outcome, string> = {
  straight: '', crit_success: 'Critical success', success: 'Success', failure: 'Failure', crit_failure: 'Critical failure',
};
const REGARD: Record<DialogueView['regard'], string> = {
  trusting: 'He trusts you', warm: 'He is warming to you', cordial: 'He is civil', wary: 'He is wary of you', hostile: 'He wants you gone',
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
 * Topic dialogue (src/lib/dialogue): the investigator picks a question and
 * asks it straight, or pushes it with Charm, Intimidate, Persuade or Deceive.
 * Pushes roll on the server; the result, the answer and whatever it opened
 * come back together. Esc leaves (the modal handles it too).
 */
export function DialoguePane({ npc, onClose, onNoise, onSpeakFreely }: Props) {
  const [view, setView] = useState<DialogueView | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState('');
  const [as, setAs] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const open = useCallback(async (speakAs: string | null) => {
    setWaiting(true);
    setError('');
    try {
      const res = await fetch(`/api/dialogue/${npc.id}${speakAs ? `?as=${encodeURIComponent(speakAs)}` : ''}`, { cache: 'no-store' });
      const data = await res.json() as DialogueView & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'He does not look up.');
      setView(data);
      setLines([{ kind: 'npc', text: data.greeting.text }]);
      setFresh([]);
      if (data.greeting.audio) {
        audioRef.current?.pause();
        audioRef.current = new Audio(data.greeting.audio);
        audioRef.current.play().catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'He does not look up.');
    } finally {
      setWaiting(false);
    }
  }, [npc.id]);

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void open(null);
    return () => { audioRef.current?.pause(); };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, waiting]);

  const ask = async (topicId: string, skill: DialogueSkill | null) => {
    if (waiting || !view) return;
    const topic = view.topics.find(t => t.id === topicId);
    if (!topic) return;
    audioRef.current?.pause();
    setLines(prev => [...prev, { kind: 'you', text: topic.prompt, skill }]);
    setWaiting(true);
    setError('');
    try {
      const res = await fetch(`/api/dialogue/${npc.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicId, skill, as }),
      });
      const data = await res.json() as AskResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'He says nothing.');
      const next: Line[] = [];
      if (data.skill && data.roll) next.push({ kind: 'roll', skill: data.skill, outcome: data.outcome, d100: data.roll.d100, target: data.roll.target });
      next.push({ kind: 'npc', text: data.text });
      if (data.sanity_paid) next.push({ kind: 'note', text: `You lose ${data.sanity_paid} SAN.`, tone: 'bad' });
      if (data.clue) next.push({ kind: 'note', text: `Pinned to the Case Board: ${data.clue}`, tone: 'good' });
      setLines(prev => [...prev, ...next]);
      setFresh(data.new_topics);
      setView(v => v ? { ...data.view, greeting: v.greeting } : data.view);
      if (data.noise_level > 0) onNoise?.(data.noise_level);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'He says nothing.');
    } finally {
      setWaiting(false);
    }
  };

  const topics = view?.topics ?? [];
  const open_ = topics.filter(t => !t.locked);
  const closed = topics.filter(t => t.locked);

  return (
    <div
      onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.78))', padding: '0 0 18px',
      }}
    >
      <div style={{
        width: 'min(720px, 94%)', maxHeight: '84%', display: 'flex', flexDirection: 'column',
        background: 'rgba(14,11,8,0.96)', border: '1px solid var(--brass-dim)',
        borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--parchment)' }}>{npc.name}</span>
          {view && (
            <span style={{ ...mono, fontSize: 9, color: view.regard === 'wary' || view.regard === 'hostile' ? 'var(--blood)' : 'var(--brass)' }}>
              {REGARD[view.regard]}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {view?.speak_as && (
            <select
              value={as ?? ''}
              onChange={e => { const v = e.target.value || null; setAs(v); void open(v); }}
              style={{ ...mono, fontSize: 9, background: 'rgba(0,0,0,0.4)', color: 'var(--brass)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '2px 4px' }}
              title="Speak as (GM)"
            >
              <option value="">Speak as: visitor</option>
              {view.speak_as.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          )}
          {view && (
            <span style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)' }}>
              Day {view.game_time.day} · {view.game_time.tide_phase} tide
            </span>
          )}
        </div>

        <div ref={scrollRef} style={{ padding: '12px 16px', overflowY: 'auto', minHeight: 110, maxHeight: '38vh', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {lines.map((l, i) => {
            if (l.kind === 'npc') return (
              <p key={i} style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.6, color: 'var(--parchment)' }}><Spoken text={l.text} /></p>
            );
            if (l.kind === 'you') return (
              <p key={i} style={{ margin: 0, alignSelf: 'flex-end', maxWidth: '85%', fontSize: 13, lineHeight: 1.5, color: 'var(--brass)', textAlign: 'right' }}>
                {l.text}{l.skill && <em style={{ color: 'var(--ink-text-2)' }}> — {SKILL_MANNER[l.skill]}</em>}
              </p>
            );
            if (l.kind === 'roll') {
              const good = l.outcome === 'success' || l.outcome === 'crit_success';
              return (
                <div key={i} style={{ ...mono, fontSize: 9, color: good ? 'var(--forest)' : 'var(--blood)', alignSelf: 'center' }}>
                  {SKILL_LABEL[l.skill]} · rolled {l.d100} vs {Math.max(0, l.target)} · {OUTCOME_LABEL[l.outcome]}
                </div>
              );
            }
            return (
              <div key={i} style={{ fontSize: 11, fontStyle: 'italic', color: l.tone === 'bad' ? 'var(--blood)' : l.tone === 'good' ? 'var(--forest)' : 'var(--ink-text-2)' }}>{l.text}</div>
            );
          })}
          {waiting && (
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-text-2)' }}>
              {view ? 'He considers you…' : 'He looks up from the register…'}
            </p>
          )}
          {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--blood)', fontStyle: 'italic' }}>{error}</p>}
        </div>

        <div style={{ borderTop: '1px solid rgba(201,148,79,0.12)', padding: '8px 10px', overflowY: 'auto', maxHeight: '34vh' }}>
          {open_.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 'var(--r-sm)', background: fresh.includes(t.id) ? 'rgba(201,148,79,0.08)' : 'transparent' }}>
              <button
                onClick={() => void ask(t.id, null)}
                disabled={waiting}
                style={{
                  flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: '2px 0', cursor: waiting ? 'default' : 'pointer',
                  fontSize: 13, lineHeight: 1.4, color: t.asked ? 'var(--ink-text-2)' : 'var(--parchment)', fontFamily: 'inherit',
                }}
              >
                {fresh.includes(t.id) && <span style={{ ...mono, fontSize: 8, color: 'var(--brass)', marginRight: 6 }}>New</span>}
                {t.prompt}
                {t.sanity_cost > 0 && <span style={{ ...mono, fontSize: 8, color: 'var(--arcane)', marginLeft: 6 }}>SAN −{t.sanity_cost}</span>}
              </button>
              {t.skills.map(s => (
                <button key={s} onClick={() => void ask(t.id, s)} disabled={waiting} title={`${SKILL_LABEL[s]} (level ${view?.skill_levels[s] ?? '?'})`} style={chip(!waiting, s === 'intimidate')}>
                  {SKILL_LABEL[s]} {view?.skill_levels[s]}
                </button>
              ))}
            </div>
          ))}
          {closed.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed rgba(201,148,79,0.15)' }}>
              <div style={{ ...mono, fontSize: 8, color: 'var(--ink-text-2)', marginBottom: 2 }}>Already asked</div>
              {closed.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-text-2)', padding: '1px 4px' }}>
                  <span style={{ flex: 1, opacity: 0.6 }}>{t.prompt}</span>
                  {t.claimed_by && (
                    <span style={{ ...mono, fontSize: 8, opacity: 0.8 }}>
                      {t.claimed_by.name}{t.claimed_by.skill ? ` · ${SKILL_LABEL[t.claimed_by.skill]}` : ' · straight'}{t.claimed_by.outcome !== 'straight' ? ` · ${OUTCOME_LABEL[t.claimed_by.outcome]}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '8px 14px 10px', borderTop: '1px solid rgba(201,148,79,0.12)', justifyContent: 'flex-end' }}>
          {onSpeakFreely && <button onClick={onSpeakFreely} style={{ ...chip(true, false), border: '1px solid var(--line)', background: 'transparent' }}>Speak freely…</button>}
          <button onClick={onClose} style={{ ...chip(true, false), border: '1px solid var(--line)', background: 'transparent' }}>Leave [Esc]</button>
        </div>
      </div>
    </div>
  );
}

const chip = (live: boolean, loud: boolean): React.CSSProperties => ({
  ...mono, fontSize: 8, padding: '4px 7px', borderRadius: 'var(--r-sm)', whiteSpace: 'nowrap',
  cursor: live ? 'pointer' : 'default',
  background: 'rgba(201,148,79,0.08)', border: `1px solid ${loud ? 'rgba(160,40,40,0.5)' : 'var(--brass-dim)'}`,
  color: live ? 'var(--brass)' : 'var(--ink-text-2)',
});
