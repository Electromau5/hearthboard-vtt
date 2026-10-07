'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { meetsDifficulty, type CheckLevel, type ResolvedSkill } from '@/lib/coc-skills';
import type { ObjectCheck } from '@/lib/walkthrough';

/** The investigator making the attempt, resolved against the full skill list. */
export type Investigator = {
  name: string;
  skills: ResolvedSkill[];
  characteristics: Record<string, number>;
  luck?: number;
  slug?: string;
  /** What they carry, from the merged character sheet — the walkthrough's inventory. */
  equipment?: string[];
};

/** One skill tried on one object. Kept by the walkthrough, so it survives closing the card. */
export type Attempt = {
  skill: string;
  target: number;
  roll: number;
  level: CheckLevel;
  pushed: boolean;
  passed: boolean;
  text: string;
};

interface Props {
  objectTitle: string;
  checks: ObjectCheck[];
  investigator: Investigator;
  /** This object's attempts, by skill. */
  attempts: Record<string, Attempt>;
  /** Rolls d100 under `target` (posting it to the party chat) and returns the result. */
  roll: (skill: string, target: number) => { roll: number; level: CheckLevel };
  onAttempt: (a: Attempt) => void;
  onShare: (skill: string, text: string) => void;
  /** Skills whose current result has been shared to the party chat. */
  shared: ReadonlySet<string>;
  /** Pins a result to the case board as a note. Omitted, and there is no Save button. */
  onSave?: (skill: string, note: string) => Promise<void>;
  /** Skills whose current result is already on the case board. */
  saved?: ReadonlySet<string>;
}

const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'];

const LEVEL_TEXT: Record<CheckLevel, string> = {
  Critical: 'Critical success', Extreme: 'Extreme success', Hard: 'Hard success',
  Success: 'Success', Failure: 'Failure', Fumble: 'Fumble',
};
const LEVEL_COLOR: Record<CheckLevel, string> = {
  Critical: '#e0b45c', Extreme: 'var(--arcane)', Hard: 'var(--forest)',
  Success: 'var(--forest)', Failure: 'var(--ink-text-2)', Fumble: 'var(--blood)',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type ListMode = 'all' | 'suggested';

/** What the investigator rolls under for `skill` — a characteristic, Luck, or a skill. */
function targetFor(inv: Investigator, skill: string): number {
  if (skill === 'Luck') return inv.luck ?? 0;
  if (skill in inv.characteristics) return inv.characteristics[skill];
  return inv.skills.find(s => norm(s.name) === norm(skill))?.value ?? 0;
}

/** The text a result earns: the object's own for a skill written for it, a shrug otherwise. */
function outcome(check: ObjectCheck | undefined, skill: string, level: CheckLevel, pushed: boolean, objectTitle: string) {
  const passed = meetsDifficulty(level, check?.difficulty);
  if (!check) {
    return {
      passed,
      text: passed
        ? `You bring your ${skill} to bear on the ${objectTitle.toLowerCase()}. It tells you nothing the eye had not already caught.`
        : `Nothing comes of it.`,
    };
  }
  if (passed) {
    const text = level === 'Extreme' || level === 'Critical' ? check.extreme ?? check.hard ?? check.success
      : level === 'Hard' ? check.hard ?? check.success
      : check.success;
    return { passed, text };
  }
  return { passed, text: level === 'Fumble' || pushed ? check.fumble ?? check.failure : check.failure };
}

/**
 * "Use a skill" on an examined object. By default every characteristic, Luck
 * and skill is listed the same way whether or not the object answers to it, so
 * the players work out for themselves what is worth trying; each player can
 * switch to "Suggested", which lists only the checks written for the object
 * (their wording and difficulty stay hidden either way). A roll lands in
 * the party chat like any other check; what it turns up shows here, for the
 * investigator to share or keep. Each skill gets one roll per object — a
 * failure can be pushed once, as in Call of Cthulhu, at the risk of worse.
 */
export function SkillCheckPane({ objectTitle, checks, investigator, attempts, roll, onAttempt, onShare, shared, onSave, saved }: Props) {
  const [query, setQuery] = useState('');
  // Every object opens on all skills; Suggested lasts only while this card is open.
  const [mode, setMode] = useState<ListMode>('all');
  const [shown, setShown] = useState<string | null>(null);
  // The skill whose result is being pinned right now, and the last one that failed to pin.
  const [saving, setSaving] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState<string | null>(null);

  const save = (a: Attempt) => {
    if (!onSave || saving) return;
    setSaving(a.skill);
    setSaveFailed(null);
    onSave(a.skill, `${objectTitle} · ${a.skill}${a.pushed ? ' (pushed)' : ''} · ${LEVEL_TEXT[a.level]}\n\n${a.text}\n\n— ${investigator.name}`).then(
      () => setSaving(null),
      () => { setSaving(null); setSaveFailed(a.skill); },
    );
  };

  const attempt = (skill: string, push = false) => {
    const prior = attempts[skill];
    if (prior && !push) { setShown(skill); return; }
    const target = targetFor(investigator, skill);
    const r = roll(push ? `${skill}, pushed` : skill, target);
    const check = checks.find(c => norm(c.skill) === norm(skill));
    const { passed, text } = outcome(check, skill, r.level, push, objectTitle);
    onAttempt({ skill, target, roll: r.roll, level: r.level, pushed: push, passed, text });
    setShown(skill);
    setSaveFailed(null);
  };

  const options = useMemo(() => {
    const q = norm(query);
    const chars = [...CHARACTERISTICS.filter(k => k in investigator.characteristics), ...(investigator.luck !== undefined ? ['Luck'] : [])]
      .map(name => ({ name, value: targetFor(investigator, name) }));
    // Trained skills first, then the rest of the catalogue; nothing marks the ones the object answers to.
    const skills = [...investigator.skills.filter(s => s.trained), ...investigator.skills.filter(s => !s.trained)]
      .map(s => ({ name: s.name, value: s.value }));
    const all = [...chars, ...skills];
    // Suggested: only what the object answers to, under the investigator's own name for it where they have one.
    const list = mode === 'all' ? all : checks
      .map(c => all.find(s => norm(s.name) === norm(c.skill)) ?? { name: c.skill, value: targetFor(investigator, c.skill) })
      .filter((s, i, arr) => arr.findIndex(o => norm(o.name) === norm(s.name)) === i);
    return list.filter(s => !q || norm(s.name).includes(q));
  }, [query, investigator, mode, checks]);

  const result = shown ? attempts[shown] : undefined;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(201,148,79,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--ink-text-2)' }}>
          {investigator.name} · use a skill
        </div>
        <div role="group" aria-label="Which skills to list" style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
          {(['suggested', 'all'] as const).map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              title={m === 'suggested' ? 'List only the skills that matter for this object' : 'List every skill'}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
                padding: '3px 8px', cursor: 'pointer', border: 'none',
                background: mode === m ? 'rgba(201,148,79,0.18)' : 'transparent',
                color: mode === m ? 'var(--brass)' : 'var(--ink-text-2)',
              }}
            >
              {m === 'suggested' ? 'Suggested' : 'All skills'}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)',
          background: 'rgba(0,0,0,0.35)', border: `1px solid ${LEVEL_COLOR[result.level]}`,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span>{result.skill}{result.pushed ? ' (pushed)' : ''} {result.target}%</span>
            <span style={{ color: 'var(--ink-text-2)' }}>rolled</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: LEVEL_COLOR[result.level] }}>{String(result.roll).padStart(2, '0')}</span>
            <span style={{ color: LEVEL_COLOR[result.level], letterSpacing: '0.5px' }}>{LEVEL_TEXT[result.level]}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--parchment)', margin: '8px 0 0', fontStyle: 'italic' }}>
            {result.text}
          </p>
          {saveFailed === result.skill && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blood)', marginTop: 8, textAlign: 'right' }}>
              Could not reach the case board. Try again.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            {!result.passed && !result.pushed && result.level !== 'Fumble' && result.skill !== 'Luck' && (
              <button type="button" onClick={() => attempt(result.skill, true)} style={btn('var(--blood)')}
                title="Roll again — but fail a pushed roll and something worse happens">
                Push the roll
              </button>
            )}
            <button
              type="button"
              disabled={shared.has(result.skill)}
              onClick={() => onShare(result.skill, `tried ${result.skill} on the ${objectTitle.toLowerCase()} (${LEVEL_TEXT[result.level].toLowerCase()}) — ${result.text}`)}
              style={btn(shared.has(result.skill) ? 'var(--ink-text-2)' : 'var(--brass)')}
            >
              {shared.has(result.skill) ? 'Shared with party' : 'Share with party'}
            </button>
            {onSave && (
              <button
                type="button"
                disabled={!!saving || !!saved?.has(result.skill)}
                onClick={() => save(result)}
                title="Pin this finding to the case board as a note"
                style={btn(saved?.has(result.skill) ? 'var(--ink-text-2)' : 'var(--forest)')}
              >
                {saved?.has(result.skill) ? 'On the case board' : saving === result.skill ? 'Saving…' : 'Save to case board'}
              </button>
            )}
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Find a skill…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        // Keep typing out of the walkthrough's own keys (F torch, E back, Tab markers).
        onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }}
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '5px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment)',
          background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: '32vh', overflowY: 'auto', paddingRight: 2 }}>
        {options.length === 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-text-2)' }}>
            {mode === 'suggested' && !query ? 'Nothing here calls for a particular skill. Try All skills.' : `No skill matches “${query}”.`}
          </span>
        )}
        {options.map(s => {
          const done = attempts[s.name];
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => attempt(s.name)}
              title={done ? `${LEVEL_TEXT[done.level]} — already tried` : `Roll ${s.name} — d100 under ${s.value}`}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                padding: '3px 7px', borderRadius: 'var(--r-sm)',
                background: shown === s.name ? 'rgba(201,148,79,0.14)' : 'transparent',
                border: `1px solid ${done ? LEVEL_COLOR[done.level] : 'var(--line)'}`,
                color: done ? LEVEL_COLOR[done.level] : 'var(--parchment)',
              }}
            >
              {s.name} <span style={{ color: 'var(--ink-text-2)' }}>{s.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const btn = (color: string): CSSProperties => ({
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase',
  padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
  background: 'rgba(201,148,79,0.08)', border: `1px solid ${color}`, color,
});
