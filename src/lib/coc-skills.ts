/**
 * The full Call of Cthulhu 7th edition skill list, grouped the way the Roll20
 * sheet groups it: one long general list, then the specialised families that
 * take a bracketed specialism (Fighting, Firearms, Languages, Sciences).
 *
 * `base` is the starting percentage an investigator has in a skill they never
 * trained. A character's own sheet value overrides it when one exists — see
 * `resolveSkills()` — so the All Skills modal can offer every skill in the
 * game while still rolling the right target for the ones the investigator has
 * actually put points into.
 *
 * Two skills are derived from characteristics rather than fixed:
 *   Dodge            = DEX / 2
 *   Language (Own)   = EDU
 * Those carry a `derive` key instead of a `base`.
 */

export type SkillGroup = 'General' | 'Fighting' | 'Firearms' | 'Languages' | 'Sciences';

export type CoCSkill = {
  name: string;
  group: SkillGroup;
  /** Untrained starting percentage. Omitted when `derive` is present. */
  base?: number;
  /** Characteristic this skill's base is computed from. */
  derive?: { from: 'DEX' | 'EDU'; divisor: number };
};

export const COC_SKILLS: CoCSkill[] = [
  // ── General ────────────────────────────────────────────────────────
  { name: 'Accounting',             group: 'General', base: 5 },
  { name: 'Animal Handling',        group: 'General', base: 5 },
  { name: 'Anthropology',           group: 'General', base: 1 },
  { name: 'Appraise',               group: 'General', base: 5 },
  { name: 'Archaeology',            group: 'General', base: 1 },
  { name: 'Artillery',              group: 'General', base: 1 },
  { name: 'Art / Craft',            group: 'General', base: 5 },
  { name: 'Charm',                  group: 'General', base: 15 },
  { name: 'Climb',                  group: 'General', base: 20 },
  { name: 'Computer Use',           group: 'General', base: 5 },
  { name: 'Credit Rating',          group: 'General', base: 0 },
  { name: 'Cthulhu Mythos',         group: 'General', base: 0 },
  { name: 'Demolitions',            group: 'General', base: 1 },
  { name: 'Disguise',               group: 'General', base: 5 },
  { name: 'Diving',                 group: 'General', base: 1 },
  { name: 'Dodge',                  group: 'General', derive: { from: 'DEX', divisor: 2 } },
  { name: 'Drive Auto',             group: 'General', base: 20 },
  { name: 'Electrical Repair',      group: 'General', base: 10 },
  { name: 'Electronics',            group: 'General', base: 1 },
  { name: 'Fast Talk',              group: 'General', base: 5 },
  { name: 'First Aid',              group: 'General', base: 30 },
  { name: 'History',                group: 'General', base: 5 },
  { name: 'Hypnosis',               group: 'General', base: 1 },
  { name: 'Intimidate',             group: 'General', base: 15 },
  { name: 'Jump',                   group: 'General', base: 20 },
  { name: 'Law',                    group: 'General', base: 5 },
  { name: 'Library Use',            group: 'General', base: 20 },
  { name: 'Listen',                 group: 'General', base: 20 },
  { name: 'Locksmith',              group: 'General', base: 1 },
  { name: 'Mechanical Repair',      group: 'General', base: 10 },
  { name: 'Medicine',               group: 'General', base: 1 },
  { name: 'Natural World',          group: 'General', base: 10 },
  { name: 'Navigate',               group: 'General', base: 10 },
  { name: 'Occult',                 group: 'General', base: 5 },
  { name: 'Operate Heavy Machine',  group: 'General', base: 1 },
  { name: 'Persuade',               group: 'General', base: 10 },
  { name: 'Pilot',                  group: 'General', base: 1 },
  { name: 'Psychoanalysis',         group: 'General', base: 1 },
  { name: 'Psychology',             group: 'General', base: 10 },
  { name: 'Read Lips',              group: 'General', base: 1 },
  { name: 'Ride',                   group: 'General', base: 5 },
  { name: 'Sleight Of Hand',        group: 'General', base: 10 },
  { name: 'Spot Hidden',            group: 'General', base: 25 },
  { name: 'Stealth',                group: 'General', base: 20 },
  { name: 'Survival',               group: 'General', base: 10 },
  { name: 'Swim',                   group: 'General', base: 20 },
  { name: 'Throw',                  group: 'General', base: 20 },
  { name: 'Track',                  group: 'General', base: 10 },

  // ── Fighting ───────────────────────────────────────────────────────
  { name: 'Fighting (Brawl)',       group: 'Fighting', base: 25 },
  { name: 'Fighting (Axe)',         group: 'Fighting', base: 15 },
  { name: 'Fighting (Chainsaw)',    group: 'Fighting', base: 10 },
  { name: 'Fighting (Flail)',       group: 'Fighting', base: 10 },
  { name: 'Fighting (Garrote)',     group: 'Fighting', base: 15 },
  { name: 'Fighting (Spear)',       group: 'Fighting', base: 20 },
  { name: 'Fighting (Sword)',       group: 'Fighting', base: 20 },
  { name: 'Fighting (Whip)',        group: 'Fighting', base: 5 },

  // ── Firearms ───────────────────────────────────────────────────────
  { name: 'Firearms (Handgun)',        group: 'Firearms', base: 20 },
  { name: 'Firearms (Rifle / Shotgun)', group: 'Firearms', base: 25 },
  { name: 'Firearms (Bow)',            group: 'Firearms', base: 15 },
  { name: 'Firearms (Flamethrower)',   group: 'Firearms', base: 10 },
  { name: 'Firearms (Heavy Weapons)',  group: 'Firearms', base: 10 },
  { name: 'Firearms (Machine Gun)',    group: 'Firearms', base: 10 },
  { name: 'Firearms (Submachine Gun)', group: 'Firearms', base: 15 },

  // ── Languages ──────────────────────────────────────────────────────
  { name: 'Language (Own)',   group: 'Languages', derive: { from: 'EDU', divisor: 1 } },
  { name: 'Language (Other)', group: 'Languages', base: 1 },

  // ── Sciences ───────────────────────────────────────────────────────
  { name: 'Science (Astronomy)',   group: 'Sciences', base: 1 },
  { name: 'Science (Biology)',     group: 'Sciences', base: 1 },
  { name: 'Science (Botany)',      group: 'Sciences', base: 1 },
  { name: 'Science (Chemistry)',   group: 'Sciences', base: 1 },
  { name: 'Science (Cryptography)', group: 'Sciences', base: 1 },
  { name: 'Science (Engineering)', group: 'Sciences', base: 1 },
  { name: 'Science (Forensics)',   group: 'Sciences', base: 1 },
  { name: 'Science (Geology)',     group: 'Sciences', base: 1 },
  { name: 'Science (Mathematics)', group: 'Sciences', base: 10 },
  { name: 'Science (Meteorology)', group: 'Sciences', base: 1 },
  { name: 'Science (Pharmacy)',    group: 'Sciences', base: 1 },
  { name: 'Science (Physics)',     group: 'Sciences', base: 1 },
  { name: 'Science (Zoology)',     group: 'Sciences', base: 1 },
];

export const SKILL_GROUP_ORDER: SkillGroup[] = [
  'General', 'Fighting', 'Firearms', 'Languages', 'Sciences',
];

/** A catalogue skill resolved against one investigator. */
export type ResolvedSkill = CoCSkill & {
  /** The percentage this skill actually rolls under. */
  value: number;
  /** True when the value came from the investigator's sheet, not the base. */
  trained: boolean;
};

/**
 * Normalise for matching a sheet skill against a catalogue entry. Sheet names
 * are free text written by the GM ("Forensics / Autopsy 80%", "Sleight of
 * Hand"), so matching is case- and punctuation-insensitive, and a catalogue
 * specialism matches when the sheet names the specialism alone — "Sword"
 * matches "Fighting (Sword)".
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** The raw text inside brackets, before normalising flattens its separators. */
function rawSpecialism(name: string): string | null {
  const m = name.match(/\(([^)]+)\)/);
  return m ? m[1] : null;
}

function specialism(name: string): string | null {
  const raw = rawSpecialism(name);
  return raw ? normalise(raw) : null;
}

/**
 * Campaign sheets name skills in prose — "Forensics / Autopsy", "Medicine &
 * Surgery", "Fast Talk / Misdirection". The leading segment before a slash,
 * ampersand or bracket is the actual skill; the rest is flavour. Matching on
 * that segment stops the modal listing a character's trained "Medicine &
 * Surgery 75" *and* an untrained "Medicine 1" side by side, which would
 * invite rolling the wrong target.
 */
function leadSegment(name: string): string {
  return normalise(name.split(/[/&(]/)[0]);
}

/** Grammatical variants the segment rule alone cannot bridge. */
const SYNONYMS: Record<string, string> = {
  'intimidation': 'intimidate',
  'persuasion': 'persuade',
  'occult lore': 'occult',
  'hand to hand combat': 'brawl',
  'demolitions and mining operations': 'demolitions',
};

/** Every spelling of a sheet skill worth testing against the catalogue. */
function sheetKeys(name: string): string[] {
  const full = normalise(name);
  const lead = leadSegment(name);
  const keys = new Set([full, lead]);

  // A bracketed specialism can itself list several — "Science (Mathematics &
  // Physics)", "Firearms (Handgun & Trench Gun)" — so each segment is its own
  // candidate key, otherwise the compound never matches a catalogue entry.
  const raw = rawSpecialism(name);
  if (raw) {
    keys.add(normalise(raw));
    for (const part of raw.split(/[&,/]|\band\b/i)) keys.add(normalise(part));
  }
  for (const k of [full, lead]) {
    if (SYNONYMS[k]) keys.add(SYNONYMS[k]);
  }
  return [...keys].filter(Boolean);
}

/**
 * Layer an investigator's own skill values over the full catalogue, and fold
 * in any sheet skill the catalogue does not know about (the campaign's custom
 * ones — "Architecture & Engineering", "Clairvoyant Mapping") so the modal is
 * a superset of the pane, never a replacement that loses entries.
 */
export function resolveSkills(
  sheetSkills: { name: string; value: number }[] | undefined,
  abilities: Record<string, number>,
): ResolvedSkill[] {
  const sheet = sheetSkills ?? [];
  const keys = sheet.map(s => sheetKeys(s.name));
  const used = new Set<number>();

  const resolved: ResolvedSkill[] = COC_SKILLS.map(skill => {
    const name = normalise(skill.name);
    const spec = specialism(skill.name);
    // A specialised skill must be matched by its specialism, never by the
    // bare family word: "science" alone would otherwise claim the first
    // Science(...) row in the catalogue and roll the wrong target.
    const targets = (spec
      ? [name, spec]
      : [name, leadSegment(skill.name)]
    ).filter(Boolean) as string[];

    // Highest value wins when a sheet lists several matching entries, so a
    // specialised "Fighting (Sword) 60" is never masked by a generic 25.
    let best = -1;
    sheet.forEach((s, i) => {
      if (used.has(i)) return;
      if (!keys[i].some(k => targets.includes(k))) return;
      if (best === -1 || s.value > sheet[best].value) best = i;
    });

    if (best !== -1) {
      used.add(best);
      return { ...skill, value: sheet[best].value, trained: true };
    }

    const value = skill.derive
      ? Math.floor((abilities[skill.derive.from] ?? 0) / skill.derive.divisor)
      : skill.base ?? 0;
    return { ...skill, value, trained: false };
  });

  sheet.forEach((s, i) => {
    if (used.has(i)) return;
    resolved.push({ name: s.name, group: 'General', base: s.value, value: s.value, trained: true });
  });

  return resolved;
}

// ── Checks ───────────────────────────────────────────────────────────
// A check is d100 roll-under: beat the target, and beat it well enough for a
// better degree of success. 01 always crits; 100 always fumbles, as does
// 96-99 when the target is under 50.
export type CheckLevel = 'Critical' | 'Extreme' | 'Hard' | 'Success' | 'Failure' | 'Fumble';

export function checkLevel(roll: number, target: number): CheckLevel {
  if (roll === 1) return 'Critical';
  if (roll === 100) return 'Fumble';
  if (target < 50 && roll >= 96) return 'Fumble';
  if (roll <= Math.floor(target / 5)) return 'Extreme';
  if (roll <= Math.floor(target / 2)) return 'Hard';
  if (roll <= target) return 'Success';
  return 'Failure';
}

const LEVEL_RANK: Record<CheckLevel, number> = {
  Fumble: 0, Failure: 1, Success: 2, Hard: 3, Extreme: 4, Critical: 5,
};

/** Whether a result clears a check the Keeper set at `difficulty`. */
export function meetsDifficulty(level: CheckLevel, difficulty: 'Regular' | 'Hard' | 'Extreme' = 'Regular'): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[difficulty === 'Regular' ? 'Success' : difficulty];
}
