import { CHARACTERS } from '@/lib/characters';

/**
 * The party's resource index, as shown by the All Resources modal.
 *
 * Nothing here is invented: media entries point at assets already in `public/`,
 * and every carried item is read out of `CHARACTERS[].equipment`, so editing an
 * investigator's kit on their sheet changes what this lists. `carriedBy` is
 * likewise read from the character record, so a rename propagates.
 */

export type ResourceSection = 'Documents' | 'Artifacts' | 'Weapons & Hardware' | 'Medical';

export const RESOURCE_SECTIONS: ResourceSection[] = [
  'Documents', 'Artifacts', 'Weapons & Hardware', 'Medical',
];

/** How opening the entry behaves. `item` is a catalogue row with no viewer. */
export type ResourceKind = 'image' | 'video' | 'model' | 'item';

/**
 * `active` is what the party is carrying in the field. `archived` is held at
 * base — the Black Archive warehouse — and still fully listed, so nothing is
 * lost and anything can be pulled back later.
 */
export type ResourceStatus = 'active' | 'archived';

export type Resource = {
  id: string;
  name: string;
  section: ResourceSection;
  kind: ResourceKind;
  status: ResourceStatus;
  /** Asset path, for the kinds that open a viewer. */
  src?: string;
  /** Investigator carrying it, for equipment rows. */
  carriedBy?: string;
  detail?: string;
  /** Why it is where it is — the GM's standing note on this item. */
  note?: string;
};

/** GM-held material: the documents, footage and artifacts in `public/`. */
const MEDIA: Resource[] = [
  {
    id: 'doc-journal',
    name: 'Patient Journal',
    section: 'Documents',
    kind: 'image',
    status: 'active',
    src: '/journal-1.jpeg',
    detail: 'Bellevue Psychiatric Isolation Ward',
    note: 'Day 66 notes — aquatic hymns, pressure drops, Marsh bloodline ties.',
  },
  {
    id: 'doc-inmate-log',
    name: 'Inmate Census & Observation List',
    section: 'Documents',
    kind: 'image',
    status: 'active',
    src: '/inmate-log.jpeg',
    detail: 'Bellevue Psychiatric Isolation Ward',
    note: 'Subjects logged for "hereditary degeneracy"; aliases tied to Innsmouth lineages.',
  },
  {
    id: 'doc-marsh-dynasty',
    name: 'The Marsh Dynasty of Innsmouth',
    section: 'Documents',
    kind: 'image',
    status: 'active',
    src: '/marsh-family-tree.jpeg',
    detail: 'Project: Black Line · RESTRICTED',
    note: "Obed Marsh (1783–1878) down to the final documented descendant — an urban runaway in hiding with the 1st Artifact, holding the 'Acoustic Keystave' needed for Phase I triangulation. One entry is redacted.",
  },
  {
    id: 'doc-tomb-footage',
    name: 'Tomb Excavation Footage',
    section: 'Documents',
    kind: 'video',
    status: 'archived',
    src: '/tomb-1.mp4',
    detail: 'Project Deep Bedrock · recovered reel',
    note: 'Subterranean site footage, irrelevant to urban tracking. Held at the Black Archive until the dig begins.',
  },
  {
    id: 'art-cthulhu-relief',
    name: 'Cthulhu Bas Relief',
    section: 'Artifacts',
    kind: 'model',
    status: 'archived',
    src: '/cthulhu-relief.glb',
    detail: 'Pre-human stonework · 3D walkthrough',
    note: 'Psychic hazard — drains sanity while viewed. Secured in excelsior crates in cold storage until field decryption requires it.',
  },
];

/**
 * Per-item placement: which section it files under, whether the party carries
 * it or it sits at base, and the standing note explaining why.
 *
 * Keyed by the exact `equipment` string on the character sheet. An entry that
 * falls out of sync (because the sheet text was edited) is not dropped — it
 * lands active in Weapons & Hardware, the general kit section.
 * `unclassifiedEquipment()` reports any such drift.
 *
 * The active field roster is Callahan, Finch and Wright; Silas, Julian, Graves
 * and Winthrop are off-roster, which is why most of their kit is archived.
 */
type Placement = {
  section: ResourceSection;
  status: ResourceStatus;
  note?: string;
  /** Reassigns the item, for kit handed to another investigator or the pool. */
  carriedBy?: string;
};

const EQUIPMENT: Record<string, Placement> = {
  // ── Dr. Alistair Finch (active) ──────────────────────────────────
  "Master surgeon's dissection kit": { section: 'Medical', status: 'active',
    note: 'Field forensics, biological sampling, and covert seal manipulation.' },
  'Scalpel holster': { section: 'Medical', status: 'active',
    note: 'Worn under clothing — safe carry, quick access to precision blades.' },
  'Heavy rubber apron': { section: 'Medical', status: 'archived',
    note: 'Bulky mortuary barrier. Black Archive dissection room until anomalous cadaver work begins.' },
  '3 glass jars of formaldehyde-saline concentrate': { section: 'Medical', status: 'archived',
    note: 'Fragile liquid containers — kept at the base laboratory to prevent breakage in transit.' },
  'Mortuary bypass credentials': { section: 'Documents', status: 'active',
    note: 'Safehouse sanitation, off-record transit, bypassing municipal medical oversight.' },

  // ── Thomas "Mack" Callahan (active) ──────────────────────────────
  'Colt M1911 .45 ACP pistol (3 spare magazines)': { section: 'Weapons & Hardware', status: 'active',
    note: 'Primary firearm (80%) against underworld ambushes.' },
  'Trench knife with brass knuckle grip': { section: 'Weapons & Hardware', status: 'active',
    note: 'Concealed silent weapon (75%); enables his free reaction.' },
  'Worn trench coat': { section: 'Weapons & Hardware', status: 'active',
    note: 'Conceals firearm and knife on public streets without raising alarm.' },
  'PI badge': { section: 'Documents', status: 'active',
    note: 'Street-level identity tracing, questioning municipal staff, door-to-door canvassing under cover.' },
  'Scarred silver lighter with unknown initials': { section: 'Artifacts', status: 'active',
    note: 'Pocket tool — revealing invisible ink, lighting cigarettes for bribes. Ties to his amnesia thread.' },

  // ── Arthur Wright (active) ───────────────────────────────────────
  'Solid brass drafting compass': { section: 'Weapons & Hardware', status: 'active',
    note: 'Pocket-portable — quick spatial measurements and structural checks.' },
  "Surveyor's theodolite": { section: 'Weapons & Hardware', status: 'archived',
    note: 'Heavy tripod survey device; unnecessary for tracking a person through urban alleys.' },
  '2 sticks of industrial mining dynamite': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Carrying explosives downtown risks fatal collateral and spikes Exposure (+1 to +2 tokens). Secured in military crates.' },
  'Blasting caps with crimpers': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Stored alongside the dynamite at the warehouse.' },
  'Roll of reinforced blueprint parchment': { section: 'Documents', status: 'archived',
    note: 'Bulky drafting roll for cyclopean structures; archived until subterranean sites are breached.' },

  // ── Silas "The Great" Vance (off-roster) ─────────────────────────
  'Concealed brass lockpick kit': { section: 'Weapons & Hardware', status: 'active',
    carriedBy: 'Party pool (Callahan)',
    note: 'Transferred — the active trio has no dedicated burglar. Compact enough for covert entry.' },
  '4 smoke/flash pellets': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster asset; stored at base.' },
  'Silk flash-cloth': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster stage prop.' },
  'Weighted defense cane (1d6 damage)': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster weapon.' },
  'Marked syndicate debt note': { section: 'Documents', status: 'archived',
    note: 'Off-roster item; locked in the archive safe.' },

  // ── Julian Sterling (off-roster) ─────────────────────────────────
  'Hand-cranked 35mm Bell & Howell Eyemo camera': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster hardware; kept locked in storage.' },
  'Wooden tripod': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster hardware.' },
  '4 raw nitrate film rolls': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Volatile flammable stock — kept in cool storage.' },
  'Magnesium powder dish': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster flash tool.' },
  'Chemical developing kit': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Bulky laboratory kit; left at base.' },

  // ── Richard Pickman Graves (off-roster) ──────────────────────────
  'Tin of pig-bristle brushes': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster asset.' },
  'Oil paint tubes': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster asset.' },
  'Palette knife': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster tool.' },
  'Heavy charcoal sketchbook': { section: 'Documents', status: 'archived',
    note: 'Off-roster tool.' },
  'Pocket sketchbook of cemetery vault cross-sections': { section: 'Documents', status: 'archived',
    note: 'Off-roster tool; archived at base.' },

  // ── Percival Montgomery Winthrop (off-roster) ────────────────────
  'Pearl-handled .32 ACP pocket revolver': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster weapon; stored in the archive gun rack.' },
  'Frayed Savile Row tailored suit': { section: 'Weapons & Hardware', status: 'archived',
    note: 'Off-roster attire.' },
  'Gold pocket watch with broken hands': { section: 'Artifacts', status: 'archived',
    note: 'Off-roster; stored in the vault.' },
  'Personal signet ring': { section: 'Artifacts', status: 'archived',
    note: 'Off-roster; stored in the vault.' },
  'Leather ledger of bankrupt assets': { section: 'Documents', status: 'archived',
    note: 'Off-roster flavour item; archived at base.' },
};

const DEFAULT_PLACEMENT: Placement = { section: 'Weapons & Hardware', status: 'active' };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Equipment strings with no explicit placement — sheet edits since this was written. */
export function unclassifiedEquipment(): string[] {
  return CHARACTERS.flatMap(c => c.equipment).filter(e => !(e in EQUIPMENT));
}

function carriedResources(): Resource[] {
  return CHARACTERS.flatMap(c =>
    c.equipment.map(item => {
      const place = EQUIPMENT[item] ?? DEFAULT_PLACEMENT;
      return {
        id: `kit-${c.slug}-${slug(item)}`,
        name: item,
        section: place.section,
        kind: 'item' as ResourceKind,
        status: place.status,
        carriedBy: place.carriedBy ?? c.name,
        note: place.note,
      };
    })
  );
}

/** The full index, rebuilt from the current character data on each call. */
export function allResources(): Resource[] {
  return [...MEDIA, ...carriedResources()];
}

/** Just the field kit. */
export function activeResources(): Resource[] {
  return allResources().filter(r => r.status === 'active');
}

/** Just what is held at base, retrievable at any time. */
export function archivedResources(): Resource[] {
  return allResources().filter(r => r.status === 'archived');
}
