import type { Character } from '@/lib/characters';
import { resolveSkills } from '@/lib/coc-skills';
import {
  SKILLS, TIDES,
  type Answer, type AnswerObject, type Asked, type DialogueSave, type DialogueSkill, type DialogueView,
  type FactDef, type GameTime, type MemoryEntry, type NpcRecord, type NpcState, type Outcome, type Tier,
  type Topic, type TopicView, type UnlockCondition,
} from './types';

/**
 * The rules of the dialogue system, as pure functions over a save. No storage
 * and no requests here — director.ts does the reading and writing — so every
 * rule can be exercised with a fixed `rand`.
 */

export type Rand = () => number;
/** What the Case Board shows: pin ids present, and those with a string tied to them. */
export type BoardView = { pins: Set<string>; connected: Set<string> };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const between = (rand: Rand, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

export function emptySave(): DialogueSave {
  return {
    version: 1,
    game_time: { day: 1, tide_phase: 'flood' },
    npc_states: {},
    reputations: {},
    pending_gossip: [],
    fact_registry: [],
    world_flags: [],
    interaction_log: [],
  };
}

export function stateFor(save: DialogueSave, npc: NpcRecord, who: string): NpcState {
  const byNpc = (save.npc_states[npc.id] ??= {});
  return (byNpc[who] ??= {
    disposition: npc.known_investigators?.[who]?.disposition ?? npc.base_disposition,
    topics_unlocked: [...npc.starting_topics],
    topics_asked: [],
    topics_locked: [],
    flags: [...npc.flags],
    lies_believed: {},
    interaction_count: 0,
  });
}

export function regardOf(d: number): DialogueView['regard'] {
  if (d >= 60) return 'trusting';
  if (d >= 40) return 'warm';
  if (d > -20) return 'cordial';
  if (d > -60) return 'wary';
  return 'hostile';
}

// ── Skill levels ──────────────────────────────────────────────────────────

const SHEET_SKILL: Record<DialogueSkill, string> = {
  charm: 'Charm', intimidate: 'Intimidate', persuade: 'Persuade', deceive: 'Fast Talk',
};

/**
 * 1–10 per skill, from the investigator's sheet: the matching Call of Cthulhu
 * skill (Charm, Intimidate, Persuade, Fast Talk for deceive), so sheet edits
 * change what the checks roll against. 2 + value/12.5: an untrained Charm 15
 * is a 3, Mack's Intimidation 70 an 8, Percival's Persuasion 85 a 9.
 */
export function skillLevels(character: Character | null): Record<DialogueSkill, number> {
  if (!character) return { charm: 5, intimidate: 5, persuade: 5, deceive: 5 };
  const resolved = resolveSkills(character.skills, character.characteristics);
  const out = {} as Record<DialogueSkill, number>;
  for (const skill of SKILLS) {
    const value = resolved.find(s => s.name === SHEET_SKILL[skill])?.value ?? 0;
    out[skill] = clamp(Math.round(2 + value / 12.5), 1, 10);
  }
  return out;
}

// ── Facts, gossip and text ────────────────────────────────────────────────

export const factKnown = (save: DialogueSave, id: string) => save.fact_registry.some(f => f.id === id);

/**
 * Whether word of a fact has reached this NPC: they gave it up themselves, or
 * it is gossip (`gossip_spread`) that happened at their location, or among
 * their faction at least a day ago.
 */
export function factKnownHere(save: DialogueSave, npc: NpcRecord, id: string, facts: Record<string, FactDef>): boolean {
  return save.fact_registry.some(f => f.id === id && (
    f.npc_id === npc.id ||
    (!!facts[id]?.gossip_spread && (
      f.location_id === npc.location_id ||
      (f.faction_id === npc.faction_id && save.game_time.day >= f.day + 1)
    ))
  ));
}

/** Fills `{gossip:fact_id}` slots: the NPC's line if word has reached them, otherwise nothing. */
export function renderText(text: string, save: DialogueSave, npc: NpcRecord, facts: Record<string, FactDef>): string {
  return text
    .replace(/\{gossip:([a-z0-9_]+)\}/gi, (_, id: string) =>
      factKnownHere(save, npc, id, facts) ? (npc.gossip_lines?.[id] ?? '') : '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function pickGreeting(npc: NpcRecord, st: NpcState, save: DialogueSave, who: string, facts: Record<string, FactDef>) {
  const g = npc.greeting_variants;
  let chosen = g.neutral;
  const gossip = Object.entries(g.gossip ?? {}).find(([id]) => factKnownHere(save, npc, id, facts));
  if (gossip) chosen = gossip[1];
  else if (st.interaction_count === 0 && !npc.known_investigators?.[who]) chosen = g.first_meeting;
  else if (st.disposition <= -60) chosen = g.hostile;
  else if (st.disposition <= -20) chosen = g.wary;
  else if (st.disposition >= 40) chosen = g.friendly;
  const { text, audio } = typeof chosen === 'string' ? { text: chosen, audio: undefined } : chosen;
  return { text: renderText(text, save, npc, facts), audio };
}

// ── Topics ────────────────────────────────────────────────────────────────

function conditionMet(c: UnlockCondition, npcId: string, st: NpcState, save: DialogueSave, board: BoardView): boolean {
  switch (c.type) {
    case 'topic_asked': return st.topics_asked.includes(c.topic_id) || !!save.topic_claims?.[npcId]?.[c.topic_id];
    case 'caseboard_pin': return board.pins.has(c.pin_id) || board.pins.has(`clue-${c.pin_id}`);
    case 'disposition_min': return st.disposition >= c.value;
    case 'flag': return c.flag.startsWith('global:') ? save.world_flags.includes(c.flag.slice(7)) : st.flags.includes(c.flag);
    case 'fact_known': return factKnown(save, c.fact_id);
  }
}

/**
 * The topics on offer, in the file's order: a topic shows once it has been
 * opened (starting, or unlocked by an answer) or has a gate of its own that
 * is now met — and never while its gate is shut. Hidden topics (the
 * `you_lied` confrontation) show only once something opens them.
 * `topics_unlocked` keeps everything ever opened; a gate that shuts again
 * (regard falling below `disposition_min`) hides a topic without losing it.
 */
export function refreshTopics(npc: NpcRecord, st: NpcState, save: DialogueSave, board: BoardView): string[] {
  const visible = npc.topics.filter(t => {
    const conds = t.unlock_condition == null ? [] : Array.isArray(t.unlock_condition) ? t.unlock_condition : [t.unlock_condition];
    const gateOpen = !conds.length || conds.some(c => conditionMet(c, npc.id, st, save, board));
    const opened = st.topics_unlocked.includes(t.id) || npc.starting_topics.includes(t.id) || !!save.party_unlocked?.[npc.id]?.includes(t.id);
    if (t.hidden) return opened && gateOpen;
    return gateOpen && (opened || conds.length > 0);
  }).map(t => t.id);
  for (const id of visible) if (!st.topics_unlocked.includes(id)) st.topics_unlocked.push(id);
  return visible;
}

/** The party's claim on a question, if the table rule applies to it and someone has used it up. */
export function claimOn(save: DialogueSave, npc: NpcRecord, topic: Topic) {
  return topic.allowed_skills.length ? save.topic_claims?.[npc.id]?.[topic.id] ?? null : null;
}

export function topicViews(npc: NpcRecord, st: NpcState, visible: string[], save: DialogueSave): TopicView[] {
  return visible.map(id => npc.topics.find(t => t.id === id)!).filter(Boolean).map(t => {
    const claim = claimOn(save, npc, t);
    return {
      id: t.id,
      prompt: t.prompt,
      skills: t.allowed_skills,
      asked: st.topics_asked.includes(t.id) || !!claim,
      locked: st.topics_locked.includes(t.id) || !!claim,
      sanity_cost: t.sanity_cost ?? 0,
      ...(claim ? { claimed_by: { name: claim.name, skill: claim.skill, outcome: claim.outcome } } : {}),
    };
  });
}

// ── Checks ────────────────────────────────────────────────────────────────

export type CheckContext = {
  level: number;
  npc: NpcRecord;
  topic: Topic;
  st: NpcState;
  save: DialogueSave;
  who: string;
  board: BoardView;
  night: boolean;
};

/**
 * d100 ≤ (skill × 8) + situational mods − (difficulty × personality[skill]).
 * Returns the target and the modifiers that went into it, in words, for the GM.
 */
export function checkTarget(skill: DialogueSkill, c: CheckContext): { target: number; mods: string[] } {
  const mods: string[] = [];
  let mod = 0;
  const add = (v: number, why: string) => { if (v) { mod += v; mods.push(`${v > 0 ? '+' : ''}${v} ${why}`); } };

  if ((c.topic.relevant_pins ?? []).some(p => c.board.connected.has(p) || c.board.connected.has(`clue-${p}`))) add(15, 'case board');
  if ((c.save.reputations[`faction:${c.npc.faction_id}`] ?? 0) >= 40) add(10, 'faction reputation');
  const mine = c.save.interaction_log.filter(e => e.npc_id === c.npc.id && e.investigator === c.who);
  if (mine.some(e => e.skill_used === skill && (e.outcome_tier === 'failure' || e.outcome_tier === 'crit_failure'))) add(-20, 'wise to you');
  if (skill === 'intimidate' && (c.night || c.npc.isolated)) add(10, c.npc.isolated ? 'isolated' : 'night');
  if (skill === 'charm' && c.st.interaction_count >= 3 && !mine.some(e => e.outcome_tier === 'failure' || e.outcome_tier === 'crit_failure')) add(10, 'rapport');
  // Pushing what they have already given up: each earlier success makes it harder.
  const before = mine.filter(e => e.topic_id === c.topic.id && (e.outcome_tier === 'success' || e.outcome_tier === 'crit_success')).length;
  if (c.topic.repeatable && before) add(-10 * before, 'asked before');
  // Reputation shifts every DC at that scope by a quarter of it.
  const rep = (c.save.reputations[`location:${c.npc.location_id}`] ?? 0) + (c.save.reputations[`faction:${c.npc.faction_id}`] ?? 0);
  add(Math.trunc(rep / 4), 'reputation');

  const resist = c.npc.personality[skill] ?? 1;
  const target = Math.round(c.level * 8 + mod - c.topic.difficulty * resist);
  return { target, mods: [`${c.level * 8} skill ${c.level}`, ...mods, `−${Math.round(c.topic.difficulty * resist)} DC ${c.topic.difficulty}×${resist}`] };
}

export function tierOf(d100: number, target: number): Tier {
  const margin = target - d100;
  if (d100 <= 5 || margin >= 30) return 'crit_success';
  if (d100 >= 96 || margin <= -30) return 'crit_failure';
  return margin >= 0 ? 'success' : 'failure';
}

/** How a check moves their regard. Being leaned on never warms anyone. */
export function dispositionDelta(skill: DialogueSkill, tier: Tier, rand: Rand): number {
  if (skill === 'intimidate') {
    return { crit_success: -between(rand, 2, 4), success: -between(rand, 4, 8), failure: -between(rand, 6, 10), crit_failure: -20 }[tier];
  }
  return { crit_success: between(rand, 8, 15), success: between(rand, 3, 5), failure: -between(rand, 3, 8), crit_failure: -between(rand, 10, 20) }[tier];
}

/** The answer for this skill and tier, falling back toward the plainer lines. */
export function answerFor(topic: Topic, asked: Asked, tier: Outcome): AnswerObject {
  const chain = asked === 'straight' || tier === 'straight'
    ? ['straight_success']
    : tier === 'crit_success' ? [`${asked}_crit_success`, `${asked}_success`, 'straight_success']
    : tier === 'success' ? [`${asked}_success`, 'straight_success']
    : tier === 'crit_failure' ? [`${asked}_crit_failure`, `${asked}_failure`, 'any_failure']
    : [`${asked}_failure`, 'any_failure'];
  const found: Answer | undefined = chain.map(k => topic.answers[k]).find(Boolean);
  if (!found) return { text: tier === 'straight' || tier.endsWith('success') ? '…' : 'He says nothing.' };
  return typeof found === 'string' ? { text: found } : found;
}

// ── Time, gossip and lies ─────────────────────────────────────────────────

/** Feelings fade ±5 a day toward 0; grudges at half the rate. */
export function drift(d: number): number {
  if (d > 0) return Math.max(0, d - 5);
  if (d < 0) return Math.min(0, d + 2.5);
  return 0;
}

export function advanceTime(save: DialogueSave, days: number, tide?: GameTime['tide_phase']) {
  for (let i = 0; i < days; i++) {
    save.game_time.day += 1;
    for (const byWho of Object.values(save.npc_states)) for (const st of Object.values(byWho)) st.disposition = drift(st.disposition);
  }
  if (tide) save.game_time.tide_phase = tide;
  else if (days === 0) save.game_time.tide_phase = TIDES[(TIDES.indexOf(save.game_time.tide_phase) + 1) % TIDES.length];
  landGossip(save);
}

/** Faction members hear within a day. */
export function landGossip(save: DialogueSave) {
  save.pending_gossip = save.pending_gossip.filter(g => {
    if (save.game_time.day < g.day) return true;
    save.reputations[g.scope] = clamp((save.reputations[g.scope] ?? 0) + g.delta, -100, 100);
    return false;
  });
}

export function addReputation(save: DialogueSave, delta: Record<string, number>) {
  for (const [scope, v] of Object.entries(delta)) {
    if (scope.startsWith('faction:')) save.pending_gossip.push({ scope, delta: v, day: save.game_time.day + 1 });
    else save.reputations[scope] = clamp((save.reputations[scope] ?? 0) + v, -100, 100);
  }
}

/**
 * Records facts in the registry, then checks every believed lie: a fact that
 * exposes one costs that NPC's regard 25 for whoever told it, and opens their
 * `you_lied` confrontation. Returns the lies exposed.
 */
export function registerFacts(
  save: DialogueSave, ids: string[], source: NpcRecord | null, npcs: Record<string, NpcRecord>, facts: Record<string, FactDef>,
): string[] {
  for (const id of ids) {
    if (factKnown(save, id)) continue;
    save.fact_registry.push({ id, day: save.game_time.day, npc_id: source?.id ?? null, location_id: source?.location_id ?? null, faction_id: source?.faction_id ?? null });
  }
  const exposed: string[] = [];
  for (const [npcId, byWho] of Object.entries(save.npc_states)) {
    const npc = npcs[npcId];
    if (!npc) continue;
    for (const st of Object.values(byWho)) {
      for (const [lieId, believed] of Object.entries(st.lies_believed)) {
        if (!believed) continue;
        const lie = npc.topics.find(t => t.lie?.id === lieId)?.lie;
        const byFact = lie?.exposed_by.some(f => factKnown(save, f));
        const byContradiction = save.fact_registry.some(f => facts[f.id]?.contradicts?.includes(lieId));
        if (!byFact && !byContradiction) continue;
        st.lies_believed[lieId] = false;
        st.disposition = clamp(st.disposition - 25, -100, 100);
        if (!st.topics_unlocked.includes('you_lied')) st.topics_unlocked.push('you_lied');
        exposed.push(lieId);
      }
    }
  }
  return exposed;
}

export const LOG_KEEP = 500;
export function logEntry(save: DialogueSave, e: MemoryEntry) {
  save.interaction_log.push(e);
  if (save.interaction_log.length > LOG_KEEP) save.interaction_log.splice(0, save.interaction_log.length - LOG_KEEP);
}
