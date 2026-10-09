import type { FactDef, NpcRecord } from './types';
import { SKILLS, TIERS } from './types';
import chiefAttendant from './npcs/chief-attendant.json';
import factList from './facts.json';

/**
 * Every NPC's dialogue file and the shared fact list. Server-side only: the
 * files hold every answer, earned or not, so they never reach the browser.
 * To add an NPC, drop a JSON file in ./npcs and list it here.
 */
const FILES = [chiefAttendant] as unknown as NpcRecord[];

export const DIALOGUE_NPCS: Record<string, NpcRecord> = Object.fromEntries(FILES.map(n => [n.id, n]));
export const DIALOGUE_FACTS: Record<string, FactDef> = Object.fromEntries((factList as FactDef[]).map(f => [f.id, f]));

/** Authoring mistakes in an NPC file, as readable lines. Empty when the file is sound. */
export function validateNpc(npc: NpcRecord): string[] {
  const errs: string[] = [];
  const ids = new Set(npc.topics.map(t => t.id));
  const answerKeys = new Set(['straight_success', 'any_failure', ...SKILLS.flatMap(s => TIERS.map(t => `${s}_${t}`))]);
  const fact = (id: string, where: string) => { if (!DIALOGUE_FACTS[id]) errs.push(`${where}: unknown fact "${id}"`); };
  for (const id of npc.starting_topics) if (!ids.has(id)) errs.push(`starting_topics: unknown topic "${id}"`);
  for (const t of npc.topics) {
    const at = `topic ${t.id}`;
    if (!t.answers.straight_success) errs.push(`${at}: no straight_success`);
    for (const [k, a] of Object.entries(t.answers)) {
      if (!answerKeys.has(k)) errs.push(`${at}: bad answer key "${k}"`);
      const skill = k.split('_')[0];
      if (skill !== 'straight' && skill !== 'any' && !t.allowed_skills.includes(skill as never)) errs.push(`${at}: answer "${k}" for a skill it doesn't allow`);
      if (typeof a !== 'string') {
        for (const f of a.reveals_facts ?? []) fact(f, `${at}.${k}`);
        for (const u of a.unlocks_topics ?? []) if (!ids.has(u)) errs.push(`${at}.${k}: unlocks unknown topic "${u}"`);
        if (a.grants_clue && !npc.clues?.[a.grants_clue]) errs.push(`${at}.${k}: unknown clue "${a.grants_clue}"`);
      }
    }
    for (const f of t.reveals_facts ?? []) fact(f, at);
    for (const f of t.lie?.exposed_by ?? []) fact(f, `${at}.lie`);
    for (const u of t.unlocks_topics ?? []) if (!ids.has(u)) errs.push(`${at}: unlocks unknown topic "${u}"`);
    if (t.grants_clue && !npc.clues?.[t.grants_clue]) errs.push(`${at}: unknown clue "${t.grants_clue}"`);
    const conds = t.unlock_condition == null ? [] : Array.isArray(t.unlock_condition) ? t.unlock_condition : [t.unlock_condition];
    for (const c of conds) {
      if (c.type === 'topic_asked' && !ids.has(c.topic_id)) errs.push(`${at}: gate on unknown topic "${c.topic_id}"`);
      if (c.type === 'fact_known') fact(c.fact_id, `${at} gate`);
    }
  }
  for (const id of Object.keys(npc.greeting_variants.gossip ?? {})) fact(id, 'greeting gossip');
  for (const id of Object.keys(npc.gossip_lines ?? {})) fact(id, 'gossip_lines');
  return errs;
}
