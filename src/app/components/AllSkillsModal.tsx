'use client';

import { useEffect, useMemo, useState } from 'react';
import { SKILL_GROUP_ORDER, type ResolvedSkill, type SkillGroup } from '@/lib/coc-skills';

interface Props {
  charName: string;
  skills: ResolvedSkill[];
  /** Same signature as the dashboard's rollCheck, minus the character name. */
  onRoll: (label: string, target: number) => void;
  onClose: () => void;
}

/**
 * The full Call of Cthulhu skill list for one investigator. Every row is a
 * roll button wired to the same `rollCheck` the Characters pane uses, so a
 * roll made here lands in the shared chat exactly like one made from the pane.
 *
 * Skills the investigator has trained show their sheet value; the rest show
 * the 7e base percentage, dimmed, so a player can still roll an untrained
 * skill without leaving the dashboard.
 */
export function AllSkillsModal({ charName, skills, onRoll, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [trainedOnly, setTrainedOnly] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = skills.filter(s => {
      if (trainedOnly && !s.trained) return false;
      return q === '' || s.name.toLowerCase().includes(q);
    });

    return SKILL_GROUP_ORDER
      .map(group => ({ group, items: matches.filter(s => s.group === group) }))
      .filter(g => g.items.length > 0);
  }, [skills, query, trainedOnly]);

  const trainedCount = useMemo(() => skills.filter(s => s.trained).length, [skills]);

  return (
    <div className="skills-veil" onClick={onClose} role="presentation">
      <div
        className="skills-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`All skills for ${charName}`}
      >
        <div className="skills-head">
          <div className="sm-titles">
            <h2>All Skills</h2>
            <p>{charName} · {trainedCount} trained of {skills.length} · click any skill to roll</p>
          </div>
          <button type="button" className="sm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="skills-tools">
          <input
            type="text"
            className="sm-search"
            placeholder="Search skills…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className={`sm-filter${trainedOnly ? ' active' : ''}`}
            onClick={() => setTrainedOnly(v => !v)}
          >
            Trained only
          </button>
        </div>

        <div className="skills-body">
          {groups.length === 0 && (
            <p className="sm-empty">No skill matches “{query}”.</p>
          )}
          {groups.map(({ group, items }) => (
            <section key={group} className="sm-group">
              <h3 className="sm-group-title">{group}</h3>
              <div className="sm-grid">
                {items.map(sk => (
                  <button
                    key={`${group}:${sk.name}`}
                    type="button"
                    className={`skill-roll-btn${sk.trained ? '' : ' untrained'}`}
                    title={`Roll ${sk.name} — d100 under ${sk.value}`}
                    onClick={() => onRoll(sk.name, sk.value)}
                  >
                    <span className="sr-name">{sk.name}</span>
                    <span className="sr-vals">
                      <span className="sr-val">{sk.value}%</span>
                      <span className="sr-split">
                        {Math.floor(sk.value / 2)}/{Math.floor(sk.value / 5)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
