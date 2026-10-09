/**
 * NPC Dialogue System — data schema (spec v1.0).
 *
 * Dialogue is topic-based: the investigator picks a preset question and asks
 * it straight, or pushes it with a conversational skill. Every interaction is
 * logged, and the log drives disposition, reputation (gossip) and cross-NPC
 * references. Authors write NPC files in src/lib/dialogue/npcs/; the director
 * (director.ts) owns all runtime state and keeps it in redis-storage.
 *
 * Adapted for a shared table rather than a single-player save:
 * - NPC runtime state is kept per investigator (`npc_states[npc][investigator]`)
 *   — the attendant regards Callahan and Finch differently. The fact registry,
 *   reputations, game time and log are the party's, shared.
 * - Answers may be a plain string or an object carrying their own effects (the
 *   spec's worked example gives a crit failure its own reputation hit and a
 *   crit success its own clue). Topic-level rewards apply on any skill success;
 *   a straight answer grants only what its own object says, unless the topic
 *   has no skills to push it with.
 */

export const SKILLS = ['charm', 'intimidate', 'persuade', 'deceive'] as const;
export type DialogueSkill = (typeof SKILLS)[number];
export type Asked = DialogueSkill | 'straight';

export const TIERS = ['crit_success', 'success', 'failure', 'crit_failure'] as const;
export type Tier = (typeof TIERS)[number];
export type Outcome = Tier | 'straight';

export const TIDES = ['flood', 'high', 'ebb', 'low'] as const;
export type TidePhase = (typeof TIDES)[number];
export type GameTime = { day: number; tide_phase: TidePhase };

/** `location:<id>` or `faction:<id>` → delta. */
export type ReputationDelta = Record<string, number>;

/** A line with its own effects. Anything left out falls back to the topic's. */
export type AnswerObject = {
  text: string;
  disposition_delta?: number;
  reveals_facts?: string[];
  unlocks_topics?: string[];
  sets_flags?: string[];
  grants_clue?: string | null;
  reputation_delta?: ReputationDelta;
};
export type Answer = string | AnswerObject;

export type UnlockCondition =
  | { type: 'topic_asked'; topic_id: string }
  | { type: 'caseboard_pin'; pin_id: string }
  | { type: 'disposition_min'; value: number }
  | { type: 'flag'; flag: string }
  | { type: 'fact_known'; fact_id: string };

export type Topic = {
  id: string;
  /** The preset question shown to the player. */
  prompt: string;
  /** Empty = straight only. */
  allowed_skills: DialogueSkill[];
  /** One condition, or several of which any may open it. */
  unlock_condition: UnlockCondition | UnlockCondition[] | null;
  /** Base DC for skill checks. */
  difficulty: number;
  /** Keyed `{skill}_{tier}`, plus `straight_success`. */
  answers: Record<string, Answer>;
  /** On any successful answer. */
  unlocks_topics?: string[];
  reveals_facts?: string[];
  /** Local to the NPC, or `global:<flag>` for world flags. */
  sets_flags?: string[];
  /** Case Board pin granted on success (see `clues` on the NPC). */
  grants_clue?: string | null;
  /** SAN the investigator pays for asking. */
  sanity_cost?: number;
  /** 0–3; intimidate is at least 2. Feeds the hunter's hearing. */
  noise_level?: number;
  /** false: locks once answered. true: `repeat_text`, with diminishing returns. */
  repeatable?: boolean;
  repeat_text?: string;
  /** Pins that make this topic relevant: +15 if one is on the board and connected. */
  relevant_pins?: string[];
  /** For deceive: the lie told, and the facts that would expose it. */
  lie?: { id: string; summary: string; exposed_by: string[] };
  /** Hidden from the list (e.g. `you_lied`) until something unlocks it. */
  hidden?: boolean;
};

export type Greeting = string | { text: string; audio?: string };

export type NpcRecord = {
  id: string;
  name: string;
  role: string;
  location_id: string;
  faction_id: string;
  /** Resistance per skill: <1 susceptible, >1 resistant. */
  personality: Record<DialogueSkill, number>;
  base_disposition: number;
  starting_topics: string[];
  greeting_variants: {
    first_meeting: Greeting;
    neutral: Greeting;
    friendly: Greeting;
    wary: Greeting;
    hostile: Greeting;
    /** fact_id → greeting, used when that fact is known here. */
    gossip?: Record<string, Greeting>;
  };
  /** fact_id → the line a `{gossip:fact_id}` slot becomes. */
  gossip_lines?: Record<string, string>;
  flags: string[];
  /** The place is lonely enough that a threat lands harder (+10 intimidate). */
  isolated?: boolean;
  /** Others see and hear what happens here (witnessed intimidation). Default true. */
  witnessed?: boolean;
  /** Investigators already met in play: their starting disposition. */
  known_investigators?: Record<string, { disposition: number }>;
  topics: Topic[];
  /** Case Board pins this NPC can hand over. */
  clues?: Record<string, { text: string; color?: string }>;
};

/** Facts are shared across NPCs. `gossip_spread` lets other NPCs hear of it. */
export type FactDef = { id: string; summary: string; gossip_spread?: boolean; contradicts?: string[] };

export type MemoryEntry = {
  entry_id: string;
  game_time: GameTime;
  npc_id: string;
  /** Extension: which investigator asked. */
  investigator: string;
  topic_id: string;
  skill_used: DialogueSkill | null;
  outcome_tier: Outcome;
  facts_revealed: string[];
  disposition_delta: number;
  reputation_delta: ReputationDelta | null;
  deception: { lie_id: string; believed: boolean } | null;
  /** Extension: the roll, for the GM view. */
  roll?: { d100: number; target: number; margin: number; mods: string[] };
  note: string;
  at: number;
};

export type NpcState = {
  disposition: number;
  topics_unlocked: string[];
  topics_asked: string[];
  /** Topics locked after being answered (non-repeatable). */
  topics_locked: string[];
  flags: string[];
  lies_believed: Record<string, boolean>;
  interaction_count: number;
};

export type FactEntry = { id: string; day: number; npc_id: string | null; location_id: string | null; faction_id: string | null };

/** Who used up a question for the party, and how. */
export type TopicClaim = { investigator: string; name: string; skill: DialogueSkill | null; outcome: Outcome; day: number };

export type DialogueSave = {
  version: 1;
  game_time: GameTime;
  npc_states: Record<string, Record<string, NpcState>>;
  reputations: Record<string, number>;
  /** Faction gossip waiting to land: applied when the day comes. */
  pending_gossip: { scope: string; delta: number; day: number }[];
  fact_registry: FactEntry[];
  world_flags: string[];
  interaction_log: MemoryEntry[];
  /**
   * Table rule: a question that can be pushed with a skill gets one attempt
   * for the whole party — straight or with one skill — then closes for
   * everyone. npc → topic → who asked it. Straight-only questions stay open.
   */
  topic_claims?: Record<string, Record<string, TopicClaim>>;
  /** Follow-ups an answer opened, for the whole party (npc → topic ids). */
  party_unlocked?: Record<string, string[]>;
};

/** What the pane is sent. Never carries answer text that has not been earned. */
export type TopicView = {
  id: string;
  prompt: string;
  skills: DialogueSkill[];
  asked: boolean;
  locked: boolean;
  sanity_cost: number;
  /** Someone in the party already used this question up. */
  claimed_by?: { name: string; skill: DialogueSkill | null; outcome: Outcome };
};

export type DialogueView = {
  npc: { id: string; name: string; role: string };
  investigator: { slug: string; name: string };
  greeting: { text: string; audio?: string };
  regard: 'hostile' | 'wary' | 'cordial' | 'warm' | 'trusting';
  topics: TopicView[];
  skill_levels: Record<DialogueSkill, number>;
  game_time: GameTime;
  /** Times this investigator has asked them anything. */
  interactions: number;
  /** The GM may speak as any investigator, to test. */
  speak_as?: { slug: string; name: string }[];
};

export type AskResult = {
  text: string;
  outcome: Outcome;
  skill: DialogueSkill | null;
  roll?: { d100: number; target: number };
  noise_level: number;
  sanity_paid: number;
  clue?: string;
  /** Topics this answer opened. */
  new_topics: string[];
  view: DialogueView;
};
