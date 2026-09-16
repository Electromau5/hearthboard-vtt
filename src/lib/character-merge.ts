import type { Character } from "@/lib/characters";

/**
 * Layer stored overrides on top of the compiled-in character definition.
 *
 * This is the single source of truth for what a character currently *is*.
 * Any view that renders a character — sheet, dossier grid, admin list, the VTT
 * board — must go through a merged record, never the raw `CHARACTERS` array,
 * or edits (a renamed investigator, adjusted vitals) will not show up there.
 */
export function mergeCharacter(base: Character, overrides: Partial<Character>): Character {
  return {
    ...base,
    ...overrides,
    vitals: { ...base.vitals, ...(overrides.vitals ?? {}) },
    characteristics: { ...base.characteristics, ...(overrides.characteristics ?? {}) },
    skills: overrides.skills ?? base.skills,
    abilities: overrides.abilities ?? base.abilities,
    hooks: overrides.hooks ?? base.hooks,
    equipment: overrides.equipment ?? base.equipment,
  };
}

/**
 * As `mergeCharacter`, but swaps the internal avatar storage URL for the
 * client-safe proxy route. Use for anything sent to the browser.
 */
export function mergeCharacterForClient(
  base: Character,
  overrides: Partial<Character>
): Character {
  const merged = mergeCharacter(base, overrides);
  if (merged.avatar) merged.avatar = `/api/characters/${merged.slug}/avatar`;
  return merged;
}
