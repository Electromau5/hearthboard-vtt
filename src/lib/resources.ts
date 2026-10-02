import { CHARACTERS } from '@/lib/characters';

/**
 * The party's resource index, as shown by the All Resources modal.
 *
 * Nothing here is invented: media entries point at assets already in `public/`,
 * and every carried item is read out of `CHARACTERS[].equipment`, so editing an
 * investigator's kit on their sheet changes what this lists. `carriedBy` is
 * likewise read from the character record, so a rename propagates.
 */

export type ResourceSection = 'Documents' | 'Patient Files' | 'Artifacts' | 'Weapons & Hardware' | 'Medical';

export const RESOURCE_SECTIONS: ResourceSection[] = [
  'Documents', 'Patient Files', 'Artifacts', 'Weapons & Hardware', 'Medical',
];

/** How opening the entry behaves. `item` is a catalogue row with no viewer. */
export type ResourceKind = 'image' | 'video' | 'audio' | 'model' | 'item';

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
  /** Sub-section within its tab; see RESOURCE_GROUPS for the order. */
  group?: string;
  /**
   * For a multi-image entry (a portrait series, a paged report): every image
   * in reading order. Opening the entry starts the lightbox on the first.
   */
  pages?: string[];
};

/**
 * Sub-sections per tab, in display order. Groups name where material came
 * from or what it is, never what it means — "Federal Files", not "Order
 * Members" — so the index cannot spoil a connection the players should make.
 * An active item with no group lists under "Other" at the end of its tab.
 */
export const RESOURCE_GROUPS: Record<ResourceSection, string[]> = {
  'Documents': ['Historical Records', 'Federal Files', 'Photographs', 'On Your Person'],
  'Patient Files': ['Ward Records', 'Admission Cards', 'Bestiary'],
  'Artifacts': [],
  'Weapons & Hardware': ['Firearms & Blades', 'Tools & Entry', 'Clothing'],
  'Medical': [],
};

const report = (slug: string, pageCount: number) =>
  Array.from({ length: pageCount }, (_, i) => `/bestiary/${slug}-${i + 1}.jpeg`);

/**
 * Black Archive Xenobiology Memoranda Nos. 7–10, each a paged entry. Pages
 * are rendered from the Drive PDFs (1200px JPEG). Classifications are as
 * printed on each cover.
 */
const BESTIARY_REPORTS: Resource[] = ([
  { id: 'best-deep-one', name: 'Deep One', slug: 'deep-one', pageCount: 5, memo: 7,
    note: 'Homo abyssalis (provisional). Anatomy, biology & tactical vulnerabilities.' },
  { id: 'best-elder-thing', name: 'Elder Thing', slug: 'elder-thing', pageCount: 4, memo: 8,
    note: 'Archaeocyte antarctica (provisional). From Lake expedition salvage.' },
  { id: 'best-shoggoth', name: 'Shoggoth', slug: 'shoggoth', pageCount: 5, memo: 9,
    note: 'Proteus gigas (provisional). Filed cry, associated with all encounters: "Tekeli-li."' },
  { id: 'best-shub-niggurath', name: 'Shub-Niggurath', slug: 'shub-niggurath', pageCount: 4, memo: 10,
    note: 'The Black Goat of the Woods with a Thousand Young. Outer God — engagement not advised.' },
] as const).map(({ id, name, slug, pageCount, memo, note }) => {
  const pages = report(slug, pageCount);
  return {
    id, name, note, pages,
    src: pages[0],
    section: 'Patient Files' as ResourceSection,
    group: 'Bestiary',
    kind: 'image' as ResourceKind,
    status: 'active' as ResourceStatus,
    detail: `Xenobiology Memorandum No. ${memo} · ${pageCount} pages`,
  };
});

/** GM-held material: the documents, footage and artifacts in `public/`. */
const MEDIA: Resource[] = [
  {
    id: 'doc-journal',
    name: 'Patient Journal',
    section: 'Patient Files',
    group: 'Ward Records',
    kind: 'image',
    status: 'active',
    src: '/journal-1.jpeg',
    detail: 'Bellevue Psychiatric Isolation Ward',
    note: 'Day 66 notes — aquatic hymns, pressure drops, Marsh bloodline ties.',
  },
  {
    id: 'doc-inmate-log',
    name: 'Inmate Census & Observation List',
    section: 'Patient Files',
    group: 'Ward Records',
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
    group: 'Historical Records',
    kind: 'image',
    status: 'active',
    src: '/marsh-family-tree.jpeg',
    detail: 'Project: Black Line · RESTRICTED',
    note: "Obed Marsh (1783–1878) down to the final documented descendant — an urban runaway in hiding with the 1st Artifact, holding the 'Acoustic Keystave' needed for Phase I triangulation. One entry is redacted.",
  },
  {
    id: 'doc-innsmouth-post-1838',
    name: 'The Innsmouth Post — Capt. Obed Marsh Returned',
    section: 'Documents',
    group: 'Historical Records',
    kind: 'image',
    status: 'active',
    src: '/innsmouth-post-1838.jpeg',
    detail: 'The Innsmouth Post · Friday, June 22, 1838',
    note: 'Marsh returns from the Carolines with islanders "much given to the water" and talk of gold-like ornaments; announces Marsh & Co. and a new seamen\'s society.',
  },
  {
    // The 24 names are the Bellevue admission cards' (PATIENT_FILES). The note
    // deliberately does not say so — that is the players' connection to make.
    id: 'doc-seized-order-ledger',
    name: 'Seized Order Ledger — Oath Roll',
    section: 'Documents',
    group: 'Federal Files',
    kind: 'image',
    status: 'active',
    src: '/seized-order-ledger.webp',
    detail: 'Esoteric Order of Dagon · Seized, U.S. Treasury Dept., Feb. 1926',
    note: 'Twenty-four sworn names, most struck through. Beneath them: "the sea keeps what is crossed —"',
  },
  // One family, one studio sitting a year. The father turns further from the
  // lens each year and the plate decays around him. The note describes only
  // what is visible; the family is unnamed in the source material.
  {
    id: 'doc-family-portraits',
    name: 'Family Portraits, 1911–1914',
    section: 'Documents',
    group: 'Photographs',
    kind: 'image',
    status: 'active',
    src: '/family-portraits/1911.webp',
    pages: [1911, 1912, 1913, 1914].map(y => `/family-portraits/${y}.webp`),
    detail: '4 studio portraits · one sitting a year',
    note: 'A father, mother, son and daughter, photographed yearly. Each year the father turns further from the lens, and the plate decays around him.',
  },
  // Xenobiology reports, rendered page by page from the source PDFs.
  ...BESTIARY_REPORTS,
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
 * Bellevue Psychiatric Isolation Ward admission cards, all dated Oct. 26, 1932.
 * Names and admission numbers are as typed on the cards — several share a
 * number (32-094, 32-111), which is the cards' own, not a transcription slip.
 */
const ADMISSION_CARDS: Resource[] = [
  { id: 'pf-robert-coltrane', name: 'Robert Coltrane', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/01-robert-coltrane.webp', detail: 'Ad. No. 32-094 · Dr. H. Wexler',
    note: 'Acute paranoia; mutters to himself. Believes he is watched through the walls; refuses food and medication.' },
  { id: 'pf-abner-smith', name: 'Abner Smith', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/02-abner-smith.webp', detail: 'Ad. No. 32-011 · Dr. R. Holloway',
    note: 'Manic, rapid speech, sibilant whispering. Keeps to himself. Room 7B.' },
  { id: 'pf-eleanor-vance', name: 'Eleanor Vance', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/03-eleanor-vance.webp', detail: 'Ad. No. 32-045 · Dr. H. Lindeman',
    note: 'Melancholic and catatonic; will not speak. No food taken in 48 hours. Room 7.' },
  { id: 'pf-arthur-jermyn', name: 'Arthur Jermyn', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/04-arthur-jermyn.webp', detail: 'Ad. No. 32-111 · Dr. H. Langley',
    note: 'Obsessive; claims hereditary degeneracy in his family. Sleepless, disturbed by nightmares. Room 12B.' },
  { id: 'pf-zadok-allen', name: 'Zadok Allen', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/05-zadok-allen.webp', detail: 'Ad. No. 32-105 · Dr. L. Hartmann',
    note: 'Delirium tremens. Believes he is aboard a vessel; hears voices at sea. No visitors permitted.' },
  { id: 'pf-francis-wayland-thurston', name: 'Francis Wayland Thurston', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/06-francis-wayland-thurston.webp', detail: 'Ad. No. 32-120 · Dr. L. Marlowe',
    note: 'Anxiety and hysterical episodes. Hears an unseen presence in the dark; sleepless three days.' },
  { id: 'pf-wiltur-jermyn', name: 'Wiltur Jermyn', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/07-wiltur-jermyn.webp', detail: 'Ad. No. 32-111 · Dr. H. Calder',
    note: 'Catatonic; refuses food and water. Found unresponsive in a cold apartment.' },
  { id: 'pf-henner-france', name: 'Henner France', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/08-henner-france.webp', detail: 'Ad. No. 32-034 · Dr. W. Sloane',
    note: 'Melancholia, hysteria. Withdrawn, avoids eye contact; reports nightmares and tremors.' },
  { id: 'pf-tamath-salton', name: 'Tamath Salton', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/09-tamath-salton.webp', detail: 'Ad. No. 32-043 · Dr. L. Harrow',
    note: 'Manic, restless. Reports seeing figures in the dark. Room 7.' },
  { id: 'pf-jenesr-richard', name: 'Jenesr Richard', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/10-jenesr-richard.webp', detail: 'Ad. No. 32-094 · Dr. H. Whitcombe',
    note: 'Manic; hears “hissing, serpentine” whispers at night. No sleep in 72 hours; restraint ordered.' },
  { id: 'pf-toma-welington', name: 'Toma Welington', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/11-toma-welington.webp', detail: 'Ad. No. 32-047 · Dr. H. Greer',
    note: 'Delirious; reports visions, restless through the night, muttering incoherently.' },
  { id: 'pf-arthur-jortane', name: 'Arthur Jortane', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/12-arthur-jortane.webp', detail: 'Ad. No. 32-094 · Ward 3B',
    note: 'Obsessive; hereditary degeneracy. Intrusive thoughts; family history of mental illness.' },
  { id: 'pf-herhard-jermyn', name: 'Herhard Jermyn', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/13-herhard-jermyn.webp', detail: 'Ad. No. 32-111 · Dr. L.K. Morrison',
    note: 'Delirium tremens; hallucinations and tremors. Address: 122 E. 30th St., New York.' },
  { id: 'pf-kamara-olmover', name: 'Kamara Olmover', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/14-kamara-olmover.webp', detail: 'Ad. No. 32-015 · Dr. H. L. Varnum',
    note: 'Alcoholic hysteria; visual and auditory distress. Locked observation, Isolation 4B.' },
  { id: 'pf-taylor-garrier', name: 'Taylor Garrier', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/15-taylor-garrier.webp', detail: 'Ad. No. 32-046 · Dr. H. L. Morrison',
    note: 'Manic, anxious; racing thoughts. Sedated and observed overnight.' },
  { id: 'pf-jamies-martnee', name: 'Jamies Martnee', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/16-jamies-martnee.webp', detail: 'Ad. No. 32-057 · Dr. R. Cole',
    note: 'Manic, hysterical outbursts; claims voices. Sedated 20:30. Room 4B, no visitors.' },
  { id: 'pf-einon-warnene', name: 'Einon. Warnene', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/17-einon-warnene.webp', detail: 'Ad. No. 32-089 · Dr. H. L. Morse',
    note: 'Fixated on hats — claims they “speak to him”; believes staff are altering them. Ward 3.' },
  { id: 'pf-robert-colmane', name: 'Robert Colmane', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/18-robert-colmane.webp', detail: 'Ad. No. 32-099 · Dr. H. Stein',
    note: 'Catatonic stupor, waxy flexibility; no reaction to stimuli. Ward 4B.' },
  { id: 'pf-marcis-wayland', name: 'Marcis Wayland', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/19-marcis-wayland.webp', detail: 'Ad. No. 32-121 · Dr. H. L. Kline',
    note: 'Delusions and auditory hallucinations; responds to unseen voices. Isolation Ward No. 4.' },
  { id: 'pf-taylor-salvace', name: 'Taylor Salvace', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/20-taylor-salvace.webp', detail: 'Ad. No. 32-126 · Dr. H. Calloway',
    note: 'Withdrawn; visual disturbances, unresponsive to speech. Locked, restricted access.' },
  { id: 'pf-leiran-bentin', name: 'Leiran Bentin', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/21-leiran-bentin.webp', detail: 'Ad. No. 32-111 · Dr. H. Kline',
    note: 'Hears whispers from the walls; mutters of “shadows moving in the corner”. Room 7B.' },
  { id: 'pf-carryenn-milon', name: 'Carryenn Milon', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/22-carryenn-milon.webp', detail: 'Ad. No. 32-109 · L. H. Kerr, M.D.',
    note: 'Brought in by the NYPD 23rd Precinct, screaming; claims she is watched and followed.' },
  { id: 'pf-panicura-cheone', name: 'Panicura Cheone', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/23-panicura-cheone.webp', detail: 'Ad. No. 32-194 · Dr. H. Morrow',
    note: 'Acute paranoia; insists the walls whisper at night, food is poisoned. Cell 7B.' },
  { id: 'pf-natthens-wallen', name: 'Natthens Wallen', section: 'Patient Files', kind: 'image', status: 'active',
    src: '/patient-files/24-natthens-wallen.webp', detail: 'Ad. No. 32-101 · Room 4B',
    note: 'Believes he is watched through the walls and that staff are conspiring.' },
];

const surname = (name: string) => name.trim().split(/\s+/).pop()!.toLowerCase();

/** Admission cards, filed A–Z by surname so a name can be found by eye. */
const PATIENT_FILES: Resource[] = ADMISSION_CARDS
  .map(r => ({ ...r, group: 'Admission Cards' }))
  .sort((x, y) => surname(x.name).localeCompare(surname(y.name)) || x.name.localeCompare(y.name));

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
  group?: string;
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
  'Mortuary bypass credentials': { section: 'Documents', group: 'On Your Person', status: 'active',
    note: 'Safehouse sanitation, off-record transit, bypassing municipal medical oversight.' },

  // ── Thomas "Mack" Callahan (active) ──────────────────────────────
  'Colt M1911 .45 ACP pistol (3 spare magazines)': { section: 'Weapons & Hardware', group: 'Firearms & Blades', status: 'active',
    note: 'Primary firearm (80%) against underworld ambushes.' },
  'Trench knife with brass knuckle grip': { section: 'Weapons & Hardware', group: 'Firearms & Blades', status: 'active',
    note: 'Concealed silent weapon (75%); enables his free reaction.' },
  'Worn trench coat': { section: 'Weapons & Hardware', group: 'Clothing', status: 'active',
    note: 'Conceals firearm and knife on public streets without raising alarm.' },
  'PI badge': { section: 'Documents', group: 'On Your Person', status: 'active',
    note: 'Street-level identity tracing, questioning municipal staff, door-to-door canvassing under cover.' },
  'Scarred silver lighter with unknown initials': { section: 'Artifacts', status: 'active',
    note: 'Pocket tool — revealing invisible ink, lighting cigarettes for bribes. Ties to his amnesia thread.' },

  // ── Arthur Wright (active) ───────────────────────────────────────
  'Solid brass drafting compass': { section: 'Weapons & Hardware', group: 'Tools & Entry', status: 'active',
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
  'Concealed brass lockpick kit': { section: 'Weapons & Hardware', group: 'Tools & Entry', status: 'active',
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
        group: place.group,
        kind: 'item' as ResourceKind,
        status: place.status,
        carriedBy: place.carriedBy ?? c.name,
        note: place.note,
      };
    })
  );
}

/** Shared kit that is on no investigator's sheet — held in the party pool. */
const PARTY_KIT: Resource[] = [
  {
    id: 'kit-party-large-flashlight',
    name: 'Large flashlight',
    section: 'Weapons & Hardware',
    group: 'Firearms & Blades',
    kind: 'item',
    status: 'active',
    carriedBy: 'Party pool',
    note: 'Heavy-duty electric torch — lights cellars, tunnels and night work, and doubles as a club in a pinch.',
  },
];

/** The full index, rebuilt from the current character data on each call. */
export function allResources(): Resource[] {
  return [...MEDIA, ...PATIENT_FILES, ...carriedResources(), ...PARTY_KIT];
}

/** Just the field kit. */
export function activeResources(): Resource[] {
  return allResources().filter(r => r.status === 'active');
}

/** Just what is held at base, retrievable at any time. */
export function archivedResources(): Resource[] {
  return allResources().filter(r => r.status === 'archived');
}
