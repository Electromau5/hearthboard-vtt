/**
 * The Black Archive — Project Deep Bedrock's command centre in a decommissioned
 * cold-storage warehouse on Boston Harbour. A first-person walkthrough level
 * (see walkthrough.ts) built in Summer Engine (~/dev/my-summer-game,
 * tools/build_archive_cli.gd) and exported to /black-archive.glb by
 * `tools/export_archive.sh` in that project.
 *
 * Unlike the house and the vessel, most of what is here is live: the case
 * room's corkboard carries the investigation board's notes beside typed
 * session-recap cards (session-recaps.ts), and the cabinets, shelves and racks
 * open the same records as All Resources.
 */

import { allResources, type Resource, type ResourceSection } from './resources';
import { RECAP_ACT, SESSION_RECAPS } from './session-recaps';
import { INNSMOUTH_SCENES } from './innsmouth-scenes';
import type { ArchiveDoc, Collection, Examinable, MapPin, PinNote, RadioSet, Typewriter, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  // The nave
  war_table: {
    title: 'Discussion Table',
    text: 'A long oak table under a single enamelled lamp, its top scarred with cigarette burns. A chart of Boston Harbour is weighted flat with a brass compass. The chairs have been pushed back as if everyone left at once.',
  },
  wireless: {
    title: 'Wireless Set',
    text: 'A cabinet wireless on the end of the table, a strip of tape across its dial reading MILES — LOGISTICS.',
  },
  artifacts: {
    title: 'Artefact Cage',
    text: 'A wire-mesh cage padlocked shut, its shelves stacked with the Archive’s acquisitions. Every item carries a catalogue tag, and every tag is stamped CONFIDENTIAL.',
  },
  // Case Room
  case_board: {
    title: 'Case Board',
    text: 'Typed recaps of every session so far on the left; the party\u2019s own notes and photographs pinned beside them, joined by lengths of string.',
  },
  typewriter_desk: {
    title: 'Typewriter Desk',
    text: 'A desk with an Underwood typewriter on it, a half-typed report still in the carriage. The ribbon is nearly dry. Carbons are stacked face down beside it.',
  },
  // Records
  patient_files: {
    title: 'Patient Files',
    text: 'Bellevue admission cards, October 1932, obtained by means nobody wrote down. The cabinets are indexed by admission number, and several numbers repeat.',
  },
  documents: {
    title: 'Document Archive',
    text: 'Shelves of archive boxes: journals, family trees, recovered reels and field recordings, all catalogued under Project Deep Bedrock.',
  },
  // Cartography
  innsmouth_map: {
    title: 'Map of Innsmouth',
    text: 'The chart of Innsmouth, mounted on the wall with red pins in it.',
  },
  map_table: {
    title: 'Map Table',
    text: 'A working copy of the Innsmouth chart, with dividers and a ruler laid across the harbour mouth.',
  },
  // Armory
  armory: {
    title: 'Gun Racks',
    text: 'Sgt. Miles keeps the rifles racked and oiled, and the pistols hang on a pegboard above them. Everything is signed out in her ledger.',
  },
  explosives: {
    title: 'Explosives Crate',
    text: 'Two crates stencilled EXPLOSIVES, with a bundle of dynamite on the lid. Carrying any of it out of this building will be noticed.',
  },
  medical: {
    title: 'Medical Cabinet',
    text: 'A white enamel cabinet with a red cross on the door, stocked for field surgery.',
  },
};

// ── Collections ─────────────────────────────────────────────────────────────

/** A resource as an archive entry: media opens its viewer, kit shows who has it. */
function toDoc(r: Resource): ArchiveDoc {
  const where = r.carriedBy
    ? (r.status === 'active' ? `Carried by ${r.carriedBy}` : `Held at the Black Archive · issued to ${r.carriedBy}`)
    : (r.status === 'archived' ? 'Held at the Black Archive' : undefined);
  const doc: ArchiveDoc = {
    id: r.id,
    title: r.name,
    meta: [r.detail, where].filter(Boolean).join(' · ') || undefined,
    text: r.note,
  };
  if (r.kind === 'image') doc.image = r.src;
  else if (r.kind === 'video') doc.video = r.src;
  else if (r.kind === 'audio') doc.audio = r.src;
  // The relief is a 3D model; the archive shows its photograph.
  else if (r.kind === 'model') doc.image = '/cthulhu-relief-preview.png';
  return doc;
}

/**
 * A multi-image entry (a paged report, a portrait series) becomes one archive
 * entry per image, so ↑/↓ reads through it rather than showing only page 1.
 */
function toDocs(r: Resource): ArchiveDoc[] {
  if (!r.pages || r.pages.length < 2) return [toDoc(r)];
  const base = toDoc(r);
  return r.pages.map((src, i) => ({
    ...base,
    id: `${r.id}-${i + 1}`,
    title: `${r.name} (${i + 1}/${r.pages!.length})`,
    image: src,
  }));
}

const section = (...sections: ResourceSection[]) => async () =>
  allResources().filter(r => sections.includes(r.section)).flatMap(toDocs);

type BoardItem = {
  id: string; type: 'note' | 'image'; x: number; y: number; rotation?: number;
  text?: string; imageUrl?: string; caption?: string; color?: string; author?: string;
};
type BoardState = { items: BoardItem[]; connections: { fromId: string; toId: string; color: string }[] };

async function fetchBoard(): Promise<BoardState> {
  const res = await fetch('/api/board', { cache: 'no-store' });
  if (!res.ok) throw new Error(`board ${res.status}`);
  return res.json();
}

const recapDocs = (): ArchiveDoc[] => SESSION_RECAPS.map(r => ({
  id: r.id, title: r.title, meta: `Session ${r.session} recap · ${RECAP_ACT}`, text: r.text,
}));

/** The session recaps, then the case board's notes and pictures; blank notes are left out. */
async function boardDocs(): Promise<ArchiveDoc[]> {
  // The recaps are compiled in, so the board still opens if the fetch fails.
  const board = await fetchBoard().catch(() => ({ items: [], connections: [] } as BoardState));
  return [...recapDocs(), ...board.items
    .filter(i => (i.type === 'note' ? !!i.text?.trim() : !!i.imageUrl))
    .map((i, n) => i.type === 'note'
      ? { id: i.id, title: i.text!.trim().split('\n')[0].slice(0, 60), meta: `Note ${n + 1} · pinned by ${i.author ?? 'unknown'}`, text: i.text }
      : { id: i.id, title: i.caption?.trim() || 'Photograph', meta: `Pinned by ${i.author ?? 'unknown'}`, image: i.imageUrl })];
}

const INNSMOUTH_MAP: ArchiveDoc[] = [{
  id: 'innsmouth-map',
  title: 'Innsmouth, Massachusetts',
  meta: 'Cartography · Project Deep Bedrock',
  image: '/innsmouth-map.jpeg',
  text: 'The town from the Marsh Refinery down to the reef and breakwater, with the party’s leads pinned.',
}];

const COLLECTIONS: Record<string, Collection> = {
  case_board: { load: boardDocs, emptyText: 'Nothing is written on the case board yet. Notes added there are pinned here.' },
  patient_files: { load: section('Patient Files'), emptyText: 'The drawers are empty.' },
  documents: { load: section('Documents'), emptyText: 'The shelves are empty.' },
  artifacts: { load: section('Artifacts'), emptyText: 'The cage is empty.' },
  armory: { load: section('Weapons & Hardware'), emptyText: 'The racks are empty.' },
  medical: { load: section('Medical'), emptyText: 'The cabinet is empty.' },
  innsmouth_map: { load: async () => INNSMOUTH_MAP, emptyText: '' },
  map_table: { load: async () => INNSMOUTH_MAP, emptyText: '' },
};

// Corkboard layout, in case-board pixels (the pinboard scales it to the cork):
// recap cards in a grid on the left, the live board fitted into the space to their right.
const RECAP_COLS = 4;
const CARD = { w: 280, h: 200 };
const PITCH = { x: 300, y: 220 };
const NOTE_SIZE = { note: { w: 160, h: 90 }, image: { w: 180, h: 140 } };

/** The recap cards and everything on the case board, pinned to the case-room corkboard. */
async function boardPins() {
  const board = await fetchBoard().catch(() => ({ items: [], connections: [] } as BoardState));
  const rows = Math.ceil(SESSION_RECAPS.length / RECAP_COLS);
  const recaps: PinNote[] = SESSION_RECAPS.map((r, i) => ({
    id: r.id,
    x: (i % RECAP_COLS) * PITCH.x,
    y: Math.floor(i / RECAP_COLS) * PITCH.y,
    w: CARD.w, h: CARD.h,
    title: `S${r.session} · ${r.title}`,
    text: r.text,
    color: r.color ?? '#ebe3cc',
    // A slight, fixed skew per card, as if pinned by hand.
    rotation: ((i * 37) % 7) - 3,
  }));

  // Keep the players' own arrangement, shrunk to fit beside the recaps if need be.
  const box = { x: RECAP_COLS * PITCH.x + 60, w: 780, h: rows * PITCH.y - 20 };
  const size = (t: BoardItem['type']) => NOTE_SIZE[t];
  const minX = Math.min(...board.items.map(i => i.x));
  const minY = Math.min(...board.items.map(i => i.y));
  const maxX = Math.max(...board.items.map(i => i.x + size(i.type).w));
  const maxY = Math.max(...board.items.map(i => i.y + size(i.type).h));
  const k = Math.min(1, box.w / Math.max(maxX - minX, 1), box.h / Math.max(maxY - minY, 1));
  const live: PinNote[] = board.items.map(i => ({
    id: i.id,
    x: box.x + (i.x - minX) * k,
    y: (i.y - minY) * k,
    rotation: i.rotation,
    text: i.type === 'note' ? i.text : undefined,
    image: i.type === 'image' ? i.imageUrl : undefined,
    caption: i.caption,
    color: i.color,
  }));

  const threads = [
    ...SESSION_RECAPS.flatMap(r => (r.links ?? []).map(to => ({ from: r.id, to, color: '#b3261e' }))),
    ...board.connections.map(c => ({ from: c.fromId, to: c.toId, color: c.color })),
  ];
  return { notes: [...recaps, ...live], threads };
}

// ── The case room's typewriter ─────────────────────────────────────────────

/**
 * A typed note, pinned to the case board in a grid of typed notes below the
 * players' own arrangement, so it never lands on top of anything they placed.
 */
async function pinTypedNote(text: string, author: string): Promise<void> {
  const board = await fetchBoard();
  const { w, h } = NOTE_SIZE.note;
  const theirs = board.items.filter(i => !i.id.startsWith('tw'));
  const typed = board.items.length - theirs.length;
  const bottom = theirs.length ? Math.max(...theirs.map(i => i.y + NOTE_SIZE[i.type].h)) : 0;
  const left = theirs.length ? Math.min(...theirs.map(i => i.x)) : 40;
  const item: BoardItem = {
    id: 'tw' + Date.now(),
    type: 'note',
    x: left + (typed % 5) * (w + 20),
    y: bottom + 40 + Math.floor(typed / 5) * (h + 30),
    rotation: (Math.random() - 0.5) * 4,
    // Typing paper, not a sticky note.
    color: '#f5f0e0',
    text,
    author,
  };
  const res = await fetch('/api/board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'add-item', item }),
  });
  if (!res.ok) throw new Error(`board ${res.status}`);
}

const TYPEWRITERS: Record<string, Typewriter> = {
  typewriter_desk: { maxLength: 400, pin: pinTypedNote, pinLabel: 'Pin to case board' },
};

// ── The map room's wall chart ──────────────────────────────────────────────

/**
 * What the party knows about each place pinned on the Innsmouth chart, keyed by
 * scene id (innsmouth-scenes.ts). Drawn from the chart's own annotations and
 * what the investigators have learned in play — nothing from the GM's notes.
 */
const LOCATION_SUMMARIES: Record<string, string> = {
  i1: 'Water tanks and a sub-basement on the northern edge of town, where the Marsh family\u2019s wealth was refined. The chart is annotated: "Report of hybrid activity, confirm status."',
  i2: 'Several sites across the old town, used to hide hybrids. Order of Dagon sea-charts confiscated in the raids correlate here. Zadok Allen says the thing in Bellevue\u2019s Cell 66 was pulled out of an Innsmouth cellar.',
  i9: 'A house near the old Custom House, abandoned by its family with the furniture and belongings still inside. Archival Artifact #1928-IN-44 was recovered from the Custom House basement. The house can be explored on foot.',
  i4: 'Where federal agents rounded up Deep One hybrids during the 1928 raids. Getting in takes federal clearance or creative infiltration.',
  i6: 'The rotting breakwater at the harbour mouth, lined with abandoned fish-processing sheds and staging areas.',
  i10: 'The trawler Esther Gilman, aground on the breakwater and listing to port. The last entry in her log is more than a year old. She can be boarded.',
  i7: 'A submerged basalt pylon, reachable only at the extreme low tides of a spring new moon. The chart marks it as the sunken pylon and the Yithian keystave location.',
  i8: 'A district blacked out on every copy of this chart. No explanation has been given.',
};

/** Pinned on the chart but not a board location: the vault the government went after. */
const EXTRA_PINS: MapPin[] = [{
  id: 'vault', u: 0.621, v: 0.54, title: 'Black Archive Vault',
  text: 'Its name is redacted on the chart. It was targeted by government torpedoes, and unmapped submerged tunnels run out from it under the harbour.',
}];

const MAP_PINS: MapPin[] = [
  ...INNSMOUTH_SCENES.filter(s => LOCATION_SUMMARIES[s.id]).map(s => ({
    id: s.id, u: s.mapX / 100, v: s.mapY / 100, title: s.name, text: LOCATION_SUMMARIES[s.id],
  })),
  ...EXTRA_PINS,
];

/** The wireless carries Sgt. Miles's message. */
const RADIOS: Record<string, RadioSet> = {
  wireless: { src: '/sgt-miles-1.mp3', volume: 0.9, refDistance: 1.6, loop: false },
};

export const ARCHIVE_LEVEL: WalkthroughLevel = {
  model: '/black-archive.glb',
  title: 'The Black Archive · Boston Harbour',
  loadingText: 'Unlocking the cold store…',
  errorText: 'The archive could not be loaded.',
  enterText: 'Click to step inside',
  leaveLabel: 'Leave the archive',
  examinables: EXAMINABLES,
  collections: COLLECTIONS,
  radios: RADIOS,
  typewriters: TYPEWRITERS,
  pinboard: { size: [5.1, 1.95], load: boardPins, refreshSec: 8 },
  // The wall chart is 5 m wide at the image's 1024 × 559 aspect (build_archive_cli.gd).
  mapPins: { size: [5.0, 5.0 * 559 / 1024], pins: MAP_PINS },
  lamps: { color: 0xffbf73, intensity: 16, distance: 11 },
  atmosphere: {
    background: 0x080706,
    fogColor: 0x0b0907,
    fogDensity: 0.03,
    sky: 0x6b5d4c,
    ground: 0x0d0b09,
    fill: 0.8,
    // Harbour light slanting in through the high east windows.
    moon: { color: 0x8ea2c2, intensity: 1.2, position: [30, 9, 6] },
  },
};
