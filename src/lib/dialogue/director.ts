import { randomUUID } from 'crypto';
import { readJSON, writeJSON } from '@/lib/redis-storage';
import { CHARACTERS, type Character } from '@/lib/characters';
import { mergeCharacter } from '@/lib/character-merge';
import { readCharacterOverrides, writeCharacterOverrides } from '@/lib/character-storage';
import type { WeatherState } from '@/lib/weather';
import { DIALOGUE_FACTS, DIALOGUE_NPCS } from './registry';
import {
  addReputation, advanceTime, answerFor, checkTarget, dispositionDelta, emptySave, landGossip, logEntry, pickGreeting,
  refreshTopics, regardOf, registerFacts, renderText, skillLevels, stateFor, tierOf, topicViews, claimOn,
  type BoardView, type Rand,
} from './engine';
import type {
  AnswerObject, AskResult, DialogueSave, DialogueSkill, DialogueView, NpcRecord, Outcome, ReputationDelta,
  TidePhase, Tier,
} from './types';

/**
 * DialogueDirector: the one owner of dialogue state. It loads the save from
 * redis-storage, applies the rules in engine.ts, writes back what changed, and
 * hands the pane only what the investigator has earned.
 *
 * Side effects outside the save: skill checks are posted to the shared chat,
 * clues are pinned to the Case Board, and SAN costs come off the sheet.
 */

const SAVE_PATH = 'dialogue/save.json';
const BOARD_PATH = 'board/state.json';   // the same key /api/board uses
const CHAT_PATH = 'chat/feed.json';

export const loadSave = async () => {
  const save = await readJSON<DialogueSave | null>(SAVE_PATH, null);
  return save?.version === 1 ? save : emptySave();
};
export const writeSave = (save: DialogueSave) => writeJSON(SAVE_PATH, save);

export type Speaker = { slug: string; name: string; character: Character | null; userId: string; isAdmin: boolean };

/** The player's investigator; the GM may speak as anyone (`as`), or as an unnamed visitor. */
export async function speakerFor(user: { id: string; role: string; assignedSlug?: string }, as?: string | null): Promise<Speaker> {
  const isAdmin = user.role === 'admin';
  const slug = (isAdmin && as) || user.assignedSlug || null;
  const base = slug ? CHARACTERS.find(c => c.slug === slug) : undefined;
  const character = base ? mergeCharacter(base, await readCharacterOverrides(base.slug)) : null;
  return character
    ? { slug: character.slug, name: character.name, character, userId: user.id, isAdmin }
    : { slug: 'keeper', name: 'A visitor', character: null, userId: user.id, isAdmin };
}

type BoardState = { items: { id: string; x: number; y: number }[]; connections: { fromId: string; toId: string }[]; strokes: unknown[] };
const readBoard = () => readJSON<BoardState>(BOARD_PATH, { items: [], connections: [], strokes: [] });
const boardView = (b: BoardState): BoardView => ({
  pins: new Set(b.items.map(i => i.id)),
  connected: new Set(b.connections.flatMap(c => [c.fromId, c.toId])),
});

/** Their level is built at night unless the GM's weather says otherwise. */
async function isNight(npc: NpcRecord) {
  const w = await readJSON<WeatherState | null>(`weather/${npc.location_id}.json`, null);
  return (w?.time ?? 'night') === 'night';
}

function view(npc: NpcRecord, save: DialogueSave, who: Speaker, board: BoardView, greeting?: DialogueView['greeting']): DialogueView {
  const st = stateFor(save, npc, who.slug);
  const visible = refreshTopics(npc, st, save, board);
  return {
    npc: { id: npc.id, name: npc.name, role: npc.role },
    investigator: { slug: who.slug, name: who.name },
    greeting: greeting ?? pickGreeting(npc, st, save, who.slug, DIALOGUE_FACTS),
    regard: regardOf(st.disposition),
    topics: topicViews(npc, st, visible, save),
    skill_levels: skillLevels(who.character),
    game_time: save.game_time,
    interactions: st.interaction_count,
    speak_as: who.isAdmin ? CHARACTERS.map(c => ({ slug: c.slug, name: c.name })) : undefined,
  };
}

export async function openDialogue(npcId: string, who: Speaker): Promise<DialogueView | null> {
  const npc = DIALOGUE_NPCS[npcId];
  if (!npc) return null;
  const [save, board] = await Promise.all([loadSave(), readBoard()]);
  landGossip(save);
  const v = view(npc, save, who, boardView(board));
  await writeSave(save);
  return v;
}

export class DialogueError extends Error {}

const CHAT_LEVEL: Record<Tier, string> = { crit_success: 'Extreme', success: 'Success', failure: 'Failure', crit_failure: 'Fumble' };
const VERB: Record<DialogueSkill, string> = { charm: 'charmed', intimidate: 'leaned on', persuade: 'reasoned with', deceive: 'lied to' };
const SKILL_LABEL: Record<DialogueSkill, string> = { charm: 'Charm', intimidate: 'Intimidate', persuade: 'Persuade', deceive: 'Deceive' };

export async function ask(npcId: string, who: Speaker, topicId: string, skill: DialogueSkill | null, rand: Rand = Math.random): Promise<AskResult> {
  const npc = DIALOGUE_NPCS[npcId];
  if (!npc) throw new DialogueError('No one here by that name.');
  const [save, boardState, night] = await Promise.all([loadSave(), readBoard(), isNight(npc)]);
  landGossip(save);
  const board = boardView(boardState);
  const st = stateFor(save, npc, who.slug);
  const before = refreshTopics(npc, st, save, board);
  const topic = npc.topics.find(t => t.id === topicId);
  if (!topic || !before.includes(topicId)) throw new DialogueError('You cannot ask that.');
  const claim = claimOn(save, npc, topic);
  if (claim) throw new DialogueError(`${claim.name} has already asked him that.`);
  if (st.topics_locked.includes(topicId)) throw new DialogueError('He has said all he will on that.');
  if (skill && !topic.allowed_skills.includes(skill)) throw new DialogueError('That will not work here.');

  // Deep lore costs the asker, whatever comes of it.
  let sanityPaid = 0;
  if (topic.sanity_cost && who.character) {
    const overrides = await readCharacterOverrides(who.slug);
    const current = who.character.vitals.sanity;
    sanityPaid = Math.min(topic.sanity_cost, current);
    await writeCharacterOverrides(who.slug, { ...overrides, vitals: { ...who.character.vitals, ...(overrides.vitals ?? {}), sanity: current - sanityPaid } });
  }

  const mine = save.interaction_log.filter(e => e.npc_id === npc.id && e.investigator === who.slug);
  const priorSuccesses = mine.filter(e => e.topic_id === topic.id && (e.outcome_tier === 'success' || e.outcome_tier === 'crit_success' || e.outcome_tier === 'straight')).length;

  let outcome: Outcome = 'straight';
  let answer: AnswerObject;
  let roll: { d100: number; target: number; margin: number; mods: string[] } | undefined;
  let rewardsFromTopic = false;
  let delta = 0;

  if (!skill) {
    if (topic.repeatable && priorSuccesses && topic.repeat_text) answer = { text: topic.repeat_text };
    else answer = answerFor(topic, 'straight', 'straight');
    rewardsFromTopic = topic.allowed_skills.length === 0;
    delta = answer.disposition_delta ?? 0;
  } else {
    const level = skillLevels(who.character)[skill];
    const { target, mods } = checkTarget(skill, { level, npc, topic, st, save, who: who.slug, board, night });
    const d100 = 1 + Math.floor(rand() * 100);
    const tier = tierOf(d100, target);
    outcome = tier;
    roll = { d100, target, margin: target - d100, mods };
    answer = answerFor(topic, skill, tier);
    rewardsFromTopic = tier === 'success' || tier === 'crit_success';
    delta = answer.disposition_delta ?? dispositionDelta(skill, tier, rand);
    // Diminishing returns: what they have already given up warms them less each time.
    if (delta > 0 && topic.repeatable && priorSuccesses) delta = Math.round(delta / 2 ** priorSuccesses);
  }

  const facts = [...(rewardsFromTopic ? topic.reveals_facts ?? [] : []), ...(answer.reveals_facts ?? [])];
  const unlocks = [...(rewardsFromTopic ? topic.unlocks_topics ?? [] : []), ...(answer.unlocks_topics ?? [])];
  const flags = [...(rewardsFromTopic ? topic.sets_flags ?? [] : []), ...(answer.sets_flags ?? [])];
  const clue = answer.grants_clue !== undefined ? answer.grants_clue : rewardsFromTopic ? topic.grants_clue ?? null : null;

  // Gossip: a threat is seen and heard; a charm that lands is talked about kindly.
  const rep: ReputationDelta = { ...(answer.reputation_delta ?? {}) };
  const bump = (scope: string, v: number) => { rep[scope] = (rep[scope] ?? 0) + v; };
  if (skill === 'intimidate' && npc.witnessed !== false) { bump(`location:${npc.location_id}`, -10); bump(`faction:${npc.faction_id}`, -5); }
  if (skill === 'charm' && outcome === 'crit_success') bump(`faction:${npc.faction_id}`, 5);
  addReputation(save, rep);

  let deception: { lie_id: string; believed: boolean } | null = null;
  if (skill === 'deceive' && topic.lie) {
    deception = { lie_id: topic.lie.id, believed: outcome === 'success' || outcome === 'crit_success' };
    st.lies_believed[topic.lie.id] = deception.believed;
  }

  st.disposition = Math.max(-100, Math.min(100, st.disposition + delta));
  for (const f of flags) {
    if (f.startsWith('global:')) { if (!save.world_flags.includes(f.slice(7))) save.world_flags.push(f.slice(7)); }
    else if (!st.flags.includes(f)) st.flags.push(f);
  }
  for (const id of unlocks) if (!st.topics_unlocked.includes(id)) st.topics_unlocked.push(id);
  // What one investigator opens, the party can follow up.
  const partyOpen = ((save.party_unlocked ??= {})[npc.id] ??= []);
  for (const id of unlocks) if (!partyOpen.includes(id)) partyOpen.push(id);
  // One attempt per question for the whole party, whatever came of it.
  if (topic.allowed_skills.length) {
    ((save.topic_claims ??= {})[npc.id] ??= {})[topic.id] = { investigator: who.slug, name: who.name, skill, outcome, day: save.game_time.day };
  }
  if (!st.topics_asked.includes(topic.id)) st.topics_asked.push(topic.id);
  st.interaction_count += 1;
  // Non-repeatable topics close once they have given what they will — or after a disaster.
  const answered = outcome === 'success' || outcome === 'crit_success' || (outcome === 'straight' && topic.allowed_skills.length === 0);
  if (!topic.repeatable && (answered || outcome === 'crit_failure') && !st.topics_locked.includes(topic.id)) st.topics_locked.push(topic.id);

  const exposed = registerFacts(save, facts, npc, DIALOGUE_NPCS, DIALOGUE_FACTS);

  let clueText: string | undefined;
  if (clue) clueText = await pinClue(npc, clue);

  const how = skill ? `${VERB[skill]} ${npc.name}` : `asked ${npc.name}`;
  logEntry(save, {
    entry_id: randomUUID(),
    game_time: { ...save.game_time },
    npc_id: npc.id,
    investigator: who.slug,
    topic_id: topic.id,
    skill_used: skill,
    outcome_tier: outcome,
    facts_revealed: facts,
    disposition_delta: delta,
    reputation_delta: Object.keys(rep).length ? rep : null,
    deception,
    roll,
    note: [
      `${who.name} ${how} about "${topic.prompt}" — ${outcome.replace('_', ' ')}`,
      facts.length ? `gave up ${facts.join(', ')}` : '',
      clue ? `pinned ${clue}` : '',
      deception ? (deception.believed ? `believes the lie (${deception.lie_id})` : `saw through the lie (${deception.lie_id})`) : '',
      exposed.length ? `exposed ${exposed.join(', ')}` : '',
      sanityPaid ? `cost ${sanityPaid} SAN` : '',
    ].filter(Boolean).join('; '),
    at: Date.now(),
  });

  const v = view(npc, save, who, board);
  const newTopics = v.topics.map(t => t.id).filter(id => !before.includes(id));
  await writeSave(save);
  if (skill && roll) await postCheck(who, npc, skill, roll.d100, roll.target, outcome as Tier);

  return {
    text: renderText(answer.text, save, npc, DIALOGUE_FACTS),
    outcome,
    skill,
    roll: roll ? { d100: roll.d100, target: roll.target } : undefined,
    noise_level: skill === 'intimidate' ? Math.max(2, topic.noise_level ?? 0) + (outcome === 'crit_failure' ? 1 : 0) : topic.noise_level ?? 0,
    sanity_paid: sanityPaid,
    clue: clueText,
    new_topics: newTopics,
    view: { ...v, greeting: { text: '' } },
  };
}

/** A clue lands on the Case Board as a note from the NPC, once. */
async function pinClue(npc: NpcRecord, pinId: string): Promise<string | undefined> {
  const clue = npc.clues?.[pinId];
  if (!clue) return undefined;
  const board = await readJSON<BoardState & { items: Record<string, unknown>[] }>(BOARD_PATH, { items: [], connections: [], strokes: [] });
  const id = `clue-${pinId}`;
  if (!board.items.some(i => i.id === id)) {
    board.items.push({
      id, type: 'note', x: 120 + Math.round(Math.random() * 420), y: 90 + Math.round(Math.random() * 260),
      rotation: (Math.random() - 0.5) * 6, text: clue.text, color: clue.color ?? '#fce7e7', author: npc.name,
    });
    await writeJSON(BOARD_PATH, board);
  }
  return clue.text;
}

/** Skill checks go to the shared chat like any other roll. */
async function postCheck(who: Speaker, npc: NpcRecord, skill: DialogueSkill, d100: number, target: number, tier: Tier) {
  const feed = await readJSON<Record<string, unknown>[]>(CHAT_PATH, []);
  feed.push({
    id: `dlg-${randomUUID()}`, type: 'roll', who: who.name, userId: who.userId, ts: Date.now(),
    formula: `1d100 vs ${SKILL_LABEL[skill]} (${npc.name.replace(/^The /, '')}) ${Math.max(0, target)}%`,
    rolls: [d100], total: d100, sides: 100, n: 1, target: Math.max(0, target),
    level: d100 <= 5 && tier === 'crit_success' ? 'Critical' : CHAT_LEVEL[tier],
  });
  if (feed.length > 100) feed.splice(0, feed.length - 100);
  await writeJSON(CHAT_PATH, feed);
}

// ── GM controls ───────────────────────────────────────────────────────────

export type GmAction =
  | { action: 'advance-day'; days?: number }
  | { action: 'set-tide'; tide: TidePhase }
  | { action: 'add-fact'; fact_id: string }
  | { action: 'set-disposition'; npc_id: string; investigator: string; value: number }
  | { action: 'reset-npc'; npc_id: string; investigator?: string }
  | { action: 'reset' };

export async function gmAction(a: GmAction): Promise<DialogueSave> {
  let save = await loadSave();
  switch (a.action) {
    case 'advance-day': advanceTime(save, Math.max(1, Math.min(30, a.days ?? 1))); break;
    case 'set-tide': save.game_time.tide_phase = a.tide; break;
    case 'add-fact': registerFacts(save, [a.fact_id], null, DIALOGUE_NPCS, DIALOGUE_FACTS); break;
    case 'set-disposition': {
      const npc = DIALOGUE_NPCS[a.npc_id];
      if (npc) stateFor(save, npc, a.investigator).disposition = Math.max(-100, Math.min(100, Math.round(a.value)));
      break;
    }
    case 'reset-npc': {
      if (a.investigator) delete save.npc_states[a.npc_id]?.[a.investigator];
      else { delete save.npc_states[a.npc_id]; delete save.party_unlocked?.[a.npc_id]; }
      // Their questions open again for the party.
      const claims = save.topic_claims?.[a.npc_id];
      if (claims) for (const [t, c] of Object.entries(claims)) if (!a.investigator || c.investigator === a.investigator) delete claims[t];
      save.interaction_log = save.interaction_log.filter(e => e.npc_id !== a.npc_id || (a.investigator && e.investigator !== a.investigator));
      break;
    }
    case 'reset': save = emptySave(); break;
  }
  await writeSave(save);
  return save;
}
