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
 *
 * The Pathology Lab, a wing off Records through the east wall, is Dr. Finch's
 * mortuary and operating theatre: a Deep One (DO-3) opened on the table, an
 * Elder Thing (ET-1) on the slab, a cold chamber, a viewing gallery, and the
 * previous pathologist's notes in the desk.
 *
 * The Drafting Room, a wing off Cartography through the west wall, is the
 * architect's room of non-Euclidean work: a model of R'lyeh, drafting tables,
 * six blueprints (public/blueprints/, painted by fabricate_archive_textures.py),
 * a tesseract, a Möbius band, and an impossible triangle that closes only from
 * the brass plate in the floor.
 */

import { allResources, type Resource, type ResourceSection } from './resources';
import { RECAP_ACT, SESSION_RECAPS } from './session-recaps';
import { INNSMOUTH_SCENES } from './innsmouth-scenes';
import { fetchBoard, fileNote, NOTE_SIZE, type BoardItem, type BoardState } from './case-board';
import type { ArchiveDoc, Bed, Collection, Examinable, GazeHazard, LightSwitch, MapPin, PickupTable, PinNote, RadioSet, Typewriter, UvStain, WalkthroughLevel } from './walkthrough';
import { HELD_MODELS } from './held-items';
import { RLYEH_MODEL } from './rlyeh-model';

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
  // Quarters (the lean-to off the Case Room)
  bunk_1: {
    title: 'Bunk',
    text: 'A two-tier steel bunk against the north wall, army blankets folded at the foot. The lower berth is made up; someone has scratched a row of tally marks into the frame beside the pillow.',
  },
  bunk_2: {
    title: 'Bunk',
    text: 'A two-tier steel bunk by the stove. The mattress on the lower berth still holds the shape of whoever slept in it last.',
  },
  bunk_3: {
    title: 'Bunk',
    text: 'A two-tier steel bunk against the south wall. A tin of boot polish and a paperback with its cover torn off are tucked under the pillow.',
  },
  bunk_4: {
    title: 'Bunk',
    text: 'A two-tier steel bunk nearest the door, the blanket pulled tight enough to bounce a coin on. Sgt. Miles keeps her quarters the way she keeps her armory.',
  },
  ...LAB_EXAMINABLES(),
  ...DRAFTING_EXAMINABLES(),
};

// ── The Pathology Lab (the wing off Records) ───────────────────────────────
// Dr. Finch's mortuary and operating theatre. Everything written here about
// the specimens, the previous pathologist "H." and the cold chamber is a first
// pass for the GM, like the house's checks: change it freely.

function LAB_EXAMINABLES(): Record<string, Examinable> {
  return {
    dissection_table: {
      title: 'Dissection Table · DO-3',
      text: 'A porcelain table on a single pedestal, its drain running down into a zinc pail. On it, on its back, lies something like a man drawn by someone who had only heard men described: a wide skull fringed with needle teeth, yellow eyes with no lids to close them, ribbed fins splayed from the sides of the head, and a crest of spines crushed flat beneath it. One long arm has slid off the table and hangs, its claws almost touching the tiles. The chest has been opened and the skin clamped back. The long webbed feet hang past the end of the table, where a tag tied to the rail reads DO-3 · QUARANTINE DOCKS.',
      checks: [
        {
          skill: 'Science (Forensics)', action: 'Examine the opened chest',
          success: 'Two sets of breathing apparatus: a pair of shrunken, human-shaped lungs, and behind the gill slits a red fan of filaments that was plainly the one in use. It could breathe air. It had stopped needing to.',
          hard: 'Two sets of breathing apparatus, and the lungs are scarred like an old miner’s, from long disuse rather than damage. It was born breathing air, lived on land for years, and then went over to the gills.',
          extreme: 'The lungs were abandoned years ago. And in the stomach, swallowed, a brass identity disc stamped U.S. QUARANTINE · 1928 and a number. Whoever this was, they were processed in the Innsmouth raids, years before they reached this table.',
          failure: 'Too much of it is wrong in ways you have no names for. You note what anyone could see and step back from the table.',
        },
        {
          skill: 'Science (Biology)', action: 'Classify it',
          success: 'Neither fish nor man, nor a crossing of the two: the scales grow out of human hair follicles. It started as one thing and became the other.',
          hard: 'The change took decades. Three rows of teeth, the back two still unerupted: it was still changing when it died.',
          extreme: 'The bones say it was well over a hundred years old. The face says forty.',
          failure: 'Nothing in any taxonomy you know will hold it.',
        },
        {
          skill: 'Spot Hidden', action: 'Look at the hands',
          success: 'Under the claws of the hand hanging off the table: flakes of white enamel, the same as the cold-chamber doors behind you.',
          hard: 'Flakes of the chamber doors’ white enamel under the claws, and the claws are worn down on one side. It scratched at a door for a long time, from the inside.',
          failure: 'Long fingers, webbed to the second joint. You would rather not look closer.',
        },
      ],
    },
    elder_thing: {
      title: 'Zinc Slab · ET-1',
      text: 'A zinc slab carries something the size of a man, laid on its side: a ridged barrel of grey hide, a starfish of a head on a short neck with an eye at every point, and at the other end a five-lobed foot. One membranous wing has been unfolded from its furrow and wired open like a moth in a collector’s case. A panel has been cut out of the flank facing you. The tag round its neck reads ET-1.',
      checks: [
        {
          skill: 'Science (Biology)', action: 'Study the anatomy',
          success: 'Five of everything, never four or six. No bone: a cartilage like wet horn that flexes when it is cold.',
          hard: 'Each of the five ridges carries its own cluster of ganglia. Five brains, or one brain in five parts that can each carry on alone.',
          extreme: 'The tissue has not decayed, and it is not preserved. It is dormant. The cold is not keeping this thing fresh; it is keeping it asleep.',
          failure: 'The longer you look, the less sure you are which end is the head.',
        },
        {
          skill: 'Science (Forensics)', action: 'Examine the old incisions',
          success: 'Two sets of cuts: the fresh panel here, and older incisions sewn shut with surgical gut. Someone has dissected this before, and closed it up again.',
          hard: 'The old sutures are Miskatonic University medical-school stock. The university’s 1930–31 expedition to the Antarctic came home with fewer crates than it reported.',
          extreme: 'Folded small inside the oldest incision, a waxed slip of paper with one pencilled line: “Dyer is wrong. They are not all dead.”',
          failure: 'Cuts, old and new. Who made them, you cannot say.',
        },
        {
          skill: 'Cthulhu Mythos', action: 'Recognise it',
          success: 'One of the Elder Things of the Pnakotic fragments: the builders who came before men, who made life on this world, or say they did. Their cities were cyclopean, and their angles were wrong.',
          failure: 'Something from before anything you know the name of.',
        },
        {
          skill: 'Spot Hidden', action: 'Look at the eyes',
          success: 'Five red eyes on five stalks. Four are filmed and dry. The one on the uppermost stalk is wet.',
          failure: 'Five red eyes, filmed over.',
        },
      ],
    },
    cold_chamber: {
      title: 'Cold Chamber',
      text: 'A bank of twelve refrigerated drawers across the north wall: white enamel, zinc doors, brass latches, a compressor ticking somewhere behind the wall. Each door has a card in a brass holder. One stands open, its tray run out onto a lift trolley.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Read the cards',
          success: 'Seven cards are filled in: DO-1, DO-2, DO-4, ET-2 (PARTIAL), “Marsh?”, “Bellevue · No. 66”, and one that says only H. The rest are blank.',
          hard: 'The card on the H. drawer is newer than the others, and typed on the same machine as the case room’s reports.',
          extreme: 'The H. drawer’s latch has been wired shut with surgical wire, recently, from the outside.',
          failure: 'Typed cards, most of them initials and numbers.',
        },
        {
          skill: 'Listen', action: 'Listen at the doors',
          success: 'The compressor’s tick, the hum of the cold. And now and then, from somewhere low, a sound like a knuckle on metal: once, twice, then nothing for a long while.',
          hard: 'A knuckle on metal, once, twice. It comes from the bottom drawer marked H.',
          failure: 'The compressor ticks. The cold hums.',
        },
      ],
    },
    cold_tray: {
      title: 'Open Drawer',
      text: 'The open drawer’s tray, run out onto a lift trolley. Under a sheet lies something too short to be a man, and too wide. One webbed hand has slipped out from under it. The tray is wet, and so is the floor beneath it.',
      checks: [
        {
          skill: 'Science (Forensics)', action: 'Lift the sheet',
          success: 'A hybrid, younger than DO-3: the face is still mostly human, a woman’s. The tag reads DO-4. Nobody has started on her yet.',
          hard: 'DO-4, untouched by any knife. The tray’s rails are scraped bright, as if it was pushed out from the inside.',
          extreme: 'There is no rigor, and none of the clouding a week in the cold puts in the eyes. The water on the tray is salt, and fresh.',
          failure: 'You lift the corner of the sheet, and put it back.',
        },
        {
          skill: 'Medicine', action: 'Feel for a pulse',
          success: 'Nothing. She is as cold as the drawer.',
          hard: 'Nothing. But the skin of the wrist dimples when you press it, and slowly fills again, the way living tissue does.',
          failure: 'Cold skin, and no pulse you can find.',
        },
      ],
    },
    instruments: {
      title: 'Instrument Trolley',
      text: 'A steel trolley at the head of the table: scalpels laid out in a row, a bone saw, rib spreaders, forceps, a skull chisel and a mallet, an enamel kidney dish. On the shelf underneath, folded towels, a basin and a brown bottle of carbolic.',
      checks: [
        {
          skill: 'Science (Forensics)', action: 'Inspect the instruments',
          success: 'Two kits: a new one, still oiled from the maker, and an older one with H. engraved on every handle.',
          hard: 'The old bone saw’s teeth are chipped in a way bone doesn’t chip them. It has been used on something harder: the horn-like cartilage of ET-1, by the look of it.',
          failure: 'Good instruments, well kept.',
        },
      ],
    },
    organ_scale: {
      title: 'Organ Scale',
      text: 'A hanging scale on an iron stand. Its pan holds a dark, glistening organ that is not a liver, whatever it was weighed as. The dial reads 4 lb 11 oz.',
      checks: [
        {
          skill: 'Science (Biology)', action: 'Identify the organ',
          success: 'A swim bladder: a fish’s float, from something that walked.',
          hard: 'A swim bladder, with a second organ wrapped round it that has no counterpart in fish or man: ridged, chambered, threaded with nerve. If you had to call it something, you would call it a gland.',
          failure: 'An organ. Large, and not one you can name.',
        },
      ],
    },
    scrub_sink: {
      title: 'Scrub Sink',
      text: 'A long porcelain scrub trough with gooseneck taps worked by the elbow, a cake of carbolic soap, and a towel on the hook. A wash-down hose hangs coiled beside it.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Look in the trough',
          success: 'The drain is clogged with scales, grey-green, some as big as a thumbnail.',
          hard: 'Scales in the drain, and caught among them a few long black hairs, a woman’s.',
          failure: 'Clean enough. The soap is cracked with disuse.',
        },
      ],
    },
    finch_desk: {
      title: 'Pathologist’s Desk',
      text: 'A desk made ready for the laboratory’s new pathologist: a brass microscope, an open ledger, petri dishes, an eye in a jar of spirit. The brass plate on its front edge reads DR. A. FINCH. The notebooks beneath belong to whoever worked here before, and are signed only H.',
    },
    anatomy_chart: {
      title: 'Anatomical Plate',
      text: 'A hand-drawn plate pinned above the desk: SPECIMEN ET-1, RADIATE, DORSAL & TRANSVERSE. The barrel, the five ridges, the unfolded wing, the five-chambered section, and notes in a cramped hand: “five of everything — never four, never six”; “no bone: a cartilage like wet horn, flexes when cold”; “ganglia in each ridge. which one thinks?”; “tissue took dye from a 1931 Miskatonic stain — someone was here first.”',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Look closer',
          success: 'In a different hand, someone has pencilled a sixth eye onto the head-star, then rubbed it out.',
          failure: 'A careful drawing by someone who did not sleep much.',
        },
      ],
    },
    specimen_jars: {
      title: 'Specimen Jars',
      text: 'Four shelves of specimen jars in yellowed spirit: organs, eyes, scraps of grey and green hide, a webbed hand, each with a typed label. On the floor beside them, a glass carboy holds a whole head, its eyes open.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Read the labels',
          success: 'Most are DO-1 to DO-4. Three say Bellevue. One says only “Marsh, ?1846”.',
          hard: 'The carboy’s label reads: “DO-2 — the face was known to the Federal man. Do not show him.”',
          failure: 'Typed labels, faded by the spirit.',
        },
        {
          skill: 'Science (Chemistry)', action: 'Test the spirit',
          success: 'Not formalin: ethanol with sea salt dissolved in it, close to the salinity of the harbour outside.',
          hard: 'Alcohol and harbour salt, made up carefully to the salinity of the open sea. Someone wanted them to feel at home.',
          failure: 'It smells of spirit and brine.',
        },
      ],
    },
    xray_viewer: {
      title: 'X-Ray Light Box',
      text: 'A light box on the south wall with three films clipped to it: a left hand with too many joints in its fingers and webbing between them; a skull with no chin and three rows of teeth; and a five-pointed head of cartilage with an eye socket at every tip. DO-3, DO-3, and ET-1.',
      checks: [
        {
          skill: 'Medicine', action: 'Read the films',
          success: 'In the hand, the fingers have five joints, and a sixth bone is growing alongside the fourth finger, still soft.',
          hard: 'The skull film is a double exposure. Under DO-3’s skull is a fainter one: an ordinary human skull in exactly the same position. The same head, taken years apart on the same plate.',
          failure: 'Shadows on film. You can tell which way up they go.',
        },
      ],
    },
    gallery: {
      title: 'Viewing Gallery',
      text: 'Two tiers behind brass rails, a few chairs on the upper step. Someone expects an audience. A small brass plate on the rail reads: OBSERVERS WILL NOT ADDRESS THE OPERATOR.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Look under the chairs',
          success: 'Cigar ash under the middle chair, and a matchbook from the Parker House hotel. Someone has watched from here, recently and comfortably.',
          failure: 'Dust, and a few scuffs on the boards.',
        },
      ],
    },
  };
}

/** The previous pathologist's notes and the benefactor's memorandum, in the desk's drawers. */
const LAB_FILES: ArchiveDoc[] = [
  {
    id: 'lab-memo',
    title: 'Memorandum to Dr. Finch',
    meta: 'Typed, on Project Deep Bedrock paper · signed A.B.',
    text: 'Dr. Finch — The laboratory is yours for the duration. Your predecessor’s notes are left as they were found. Requisitions go through Sgt. Miles. The cold chamber is to stay at its present temperature, and the drawer marked H. is not to be opened without my written authority. Observers may attend from the gallery; you will not be asked to address them. — A.B.',
  },
  {
    id: 'lab-do3',
    title: 'Protocol DO-3',
    meta: 'Post-mortem notes · signed H.',
    text: 'Received from the Federal Quarantine Docks in a fish crate packed with ice. Male, or was. Length 5 ft 9 in. Gill slits 3 + 3, functional. Lungs vestigial and scarred. Dentition three rows, the posterior two unerupted. Scales arise from the hair follicles. Ossification of the skull consistent with great age; the face does not agree. Cause of death undetermined. No decomposition in nine days at 38°F. Recommend he not be left on the table overnight.',
  },
  {
    id: 'lab-et1',
    title: 'Protocol ET-1 (interim)',
    meta: 'Dissection notes · signed H.',
    text: 'Radiate, pentamerous throughout. Barrel 6 ft, five ridges, five furrows housing membranous wings of about 7 ft span when unfolded. No skeleton; a cartilage of horn-like character, flexible below 40°F. Nervous system distributed: a ganglion in each ridge, each apparently competent. Previous incisions present, closed with Miskatonic gut, c. 1931. Tissue not decayed. Tissue not, in any sense I can defend, dead. Temperature of chamber to be maintained.',
  },
  {
    id: 'lab-log',
    title: 'Cold Chamber Log',
    meta: 'Ledger, kept by the door',
    text: 'DO-1 · DO-2 · DO-3 (on table) · DO-4 (received, not started) · ET-1 (on slab) · ET-2 (partial) · Marsh? · Bellevue No. 66. The last line is in a different hand from all the rest: “H. — bottom row. Wired shut. Do not answer it.”',
  },
];

// ── The Drafting Room (the wing off Cartography) ───────────────────────────
// The architect's room of non-Euclidean work. Like the lab, its text is a first
// pass for the GM.

/** The six blueprint sheets, shown full size from the plan chest and the wall. */
const BLUEPRINTS: ArchiveDoc[] = [
  {
    id: 'bp-rlyeh', title: 'R’lyeh · Section through the Great Door', meta: 'Sheet 1 of 6 · after the Johansen sketches',
    image: '/blueprints/rlyeh-door.webp',
    text: 'A monolith of a door leaning out of true, its jambs not parallel, every angle dimensioned 90° and none of them square. Beside it, a stair that rises nine risers and arrives 108 ft below where it began. Margin note: the door opens outward, along an axis not drawn here.',
  },
  {
    id: 'bp-sevenfold', title: 'Plan · House of Sevenfold Rooms', meta: 'Sheet 2 of 6',
    image: '/blueprints/sevenfold-house.webp',
    text: 'A floor plan drawn on a circle: rooms of seven walls, each adjoining seven others, growing no smaller toward the rim though they are drawn smaller. “There is no outer wall.”',
  },
  {
    id: 'bp-tesseract', title: 'Tesseract · Elevation in Four Directions', meta: 'Sheet 3 of 6',
    image: '/blueprints/tesseract.webp',
    text: 'A cube within a cube, corner joined to corner, and four elevations labelled NORTH, EAST, ANA and KATA. “The inner cube is not smaller. It is farther away, in a direction you cannot point.”',
  },
  {
    id: 'bp-sarnath', title: 'Sarnath · Basalt Spire, Elevation', meta: 'Sheet 4 of 6 · after the bas-relief, cat. 1928-IN-44',
    image: '/blueprints/sarnath-spire.webp',
    text: 'A 212 ft spire with a stair inside it. The shaft allows three and a half turns; the stair climbs seven. The draughtsman has written: “Both are right.”',
  },
  {
    id: 'bp-stair', title: 'Stair · Ascending Both Ways', meta: 'Sheet 5 of 6 · from the excavation logs, 1919',
    image: '/blueprints/endless-stair.webp',
    text: 'A square stair of forty risers, every one marked UP. Walked either way round, it climbs, and arrives where it started 25 ft higher. Drawn by the site foreman the week before he walked off the dig.',
  },
  {
    id: 'bp-vault', title: 'The Vault · Conjectured Plan', meta: 'Sheet 6 of 6 · from 17 years of borings',
    image: '/blueprints/vault-plan.webp',
    text: 'The sealed chamber as the borings suggest it: five chambers, A to E, spiralling on a central well. A triangle surveyed by theodolite on site is drawn at upper right; its angles sum to 540°. “We are not digging in the space we think we are digging in.”',
  },
];

function DRAFTING_EXAMINABLES(): Record<string, Examinable> {
  return {
    rlyeh_model: {
      title: 'Model of R’lyeh',
      text: 'A table-sized model in green-black basalt, half built: a shelf of broken stone in a shallow tray of painted sea, faint outlines pencilled on it where the city should stand, and its pieces laid out along the table’s edge: monoliths that lean against nothing, a Great Door that sits out of true, a stair that turns more than it climbs. Some outlines have no piece to fill them. A man, to scale, stands by the foot of the stair. He is very small.',
      checks: [
        {
          skill: 'Architecture & Engineering', action: 'Assess the structure',
          success: 'None of it should stand. The monoliths lean on nothing, and the loads run off somewhere you cannot follow.',
          hard: 'It is accurate to drawings, not to a site: every leaning slab is measured from the Johansen sketches. Whoever built this trusted them completely.',
          extreme: 'Scaled up, the depth of the Great Door’s lintel is exactly the depth of the Deep Bedrock borings. Seventeen years of digging line up with this door, if you turn it on its side.',
          failure: 'A clever model. It makes your eyes tired.',
        },
        {
          skill: 'History', action: 'Identify the source',
          success: 'The Johansen account: a Norwegian second mate whose ship found a city rising out of the Pacific in 1925. He died soon after reaching home.',
          failure: 'A sunken city. You cannot place it.',
        },
        {
          skill: 'Cthulhu Mythos', action: 'Recognise the city',
          success: 'R’lyeh, where dead Cthulhu waits dreaming. The door is the one that must never be opened outward.',
          failure: 'Something about the door troubles you, and you cannot say what.',
        },
      ],
    },
    drafting_table_1: {
      title: 'Drafting Table',
      image: '/blueprints/vault-plan.webp',
      text: 'A drafting board tilted to the window, the conjectured plan of the vault pinned to it: five chambers spiralling on a central well. A T-square lies along the bottom edge. The pencil lines have been rubbed out and redrawn so often the paper has gone thin.',
      checks: [
        {
          skill: 'Science (Mathematics)', action: 'Check the survey triangle',
          success: 'The surveyed angles are 180°, 180° and 180°. They have been checked three times in three different pencils.',
          hard: 'For the angles of a triangle to sum to 540°, the ground it was drawn on must curve back on itself very sharply: a space that closes up like the inside of a sphere, a few hundred feet across. The vault is inside it.',
          failure: 'Numbers that do not add up, checked by someone who thought they should.',
        },
      ],
    },
    drafting_table_2: {
      title: 'Drafting Table',
      image: '/blueprints/sevenfold-house.webp',
      text: 'The second board carries the plan of the house of sevenfold rooms: a circle of seven-walled rooms that the drawing makes smaller toward the rim. A set square sits on it, at an angle that matches nothing on the sheet.',
      checks: [
        {
          skill: 'Architecture & Engineering', action: 'Read the plan',
          success: 'A plan in hyperbolic space. Walk outward and the rooms never shrink; the drawing only looks that way because flat paper can’t hold them.',
          hard: 'There is no outer wall, but there is a door marked on the far side of the central hall, and a note beside it: “In the Marsh refinery the boiler room had seven walls. Count them again.”',
          failure: 'A circle full of arcs. It looks like a window in a church.',
        },
      ],
    },
    architect_desk: {
      title: 'The Architect’s Desk',
      text: 'A desk under the blueprint wall: a slide rule, a pair of brass compasses, an open notebook in which the same angle has been worked out seven times to seven answers, three rolled drawings, and a spirit level whose bubble will not sit in the middle.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Watch the spirit level',
          success: 'The bubble sits toward the east end. Turn the level end for end and it still sits toward the east.',
          hard: 'It sits toward the east, wherever you point the level, and a little further toward it each time you look.',
          failure: 'A spirit level that needs adjusting.',
        },
        {
          skill: 'Science (Mathematics)', action: 'Read the notebook',
          success: 'Seven workings of one angle, each correct, each different. Under the last: “It is not the arithmetic.”',
          failure: 'Pages of figures.',
        },
      ],
    },
    blueprint_wall: {
      title: 'Blueprint Wall',
      text: 'Six blueprint sheets pinned to a wall of cork above the desk, red string running from the vault plan to the Great Door of R’lyeh and to the Sarnath spire.',
    },
    plan_chest: {
      title: 'Plan Chest',
      text: 'A wide oak chest of shallow drawers by the door, rolled drawings on top under a brass weight. The fourth drawer stands open, a sheet lying in it.',
    },
    chalkboard: {
      title: 'Chalkboard',
      text: 'Chalk on a board across the south wall: “α + β + γ < π (K = −1)”; the Gauss–Bonnet theorem; and in red, “on the tomb site: α + β + γ = 540° ?!” Below, two triangles, one with its sides bowed in and one with them bowed out, and an arrow: “which space are we in?”',
      checks: [
        {
          skill: 'Science (Mathematics)', action: 'Check the working',
          success: 'The first two lines are textbook Lobachevsky and Gauss. The third is not mathematics; it is a field measurement, and nothing in the first two lines allows it.',
          hard: 'It isn’t impossible, only very small: a closed, curved space no bigger than a city block, with the vault at its centre, folded into the bedrock under Boston.',
          failure: 'Equations. Somebody was upset when they wrote the last one.',
        },
      ],
    },
    theodolite: {
      title: 'Theodolite',
      text: 'A surveyor’s theodolite on its tripod, its telescope trained across the room on the model’s Great Door.',
      checks: [
        {
          skill: 'Navigate', action: 'Sight through it',
          success: 'Through the eyepiece the door leans at 18°. Step away, look back, and it leans at 23°. The model hasn’t moved.',
          hard: 'Each time you look, the lean has grown by about five degrees. At this rate, after another dozen sightings it will be lying flat, wide open.',
          failure: 'Crosshairs on a stone door.',
        },
      ],
    },
    tesseract: {
      title: 'Tesseract',
      text: 'A brass wire model on a plinth: a cube inside a cube, every corner joined to its twin. The shadow, in three dimensions, of something with four.',
      checks: [
        {
          skill: 'Science (Mathematics)', action: 'Count its cells',
          success: 'Eight cubes: the outer one, the inner one, and six lopsided ones between them that are cubes too, seen from a direction you cannot point in.',
          hard: 'One joint has been unsoldered and soldered back. Someone tried to fold it.',
          failure: 'A wire puzzle.',
        },
      ],
    },
    mobius: {
      title: 'Möbius Band',
      text: 'A strip of polished brass given a half twist and joined at the ends. It has one side and one edge.',
      checks: [
        {
          skill: 'Spot Hidden', action: 'Look closer',
          success: 'Tiny lettering is engraved along it in one continuous line. It is the R’lyehian chant, “Ph’nglui mglw’nafh…”, and it reads right way up all the way round, because there is only one side.',
          failure: 'Polished brass, warm from the lamp.',
        },
      ],
    },
    impossible_triangle: {
      title: 'Impossible Triangle',
      text: 'Three bars of painted wood held up on a brass rod. From most of the room they are three bars that don’t meet. From the brass plate in the floor marked STAND HERE, they close into a triangle each of whose corners is a right angle.',
      checks: [
        {
          skill: 'Architecture & Engineering', action: 'Work out the trick',
          success: 'Three edges of a cube, seen straight down its diagonal: the two loose ends line up from that one spot. A draughtsman’s joke.',
          hard: 'A joke, and a lesson: a structure that is impossible from everywhere but one place. The vault’s builders would only need to know where to stand.',
          failure: 'It shouldn’t work, and it does.',
        },
      ],
    },
  };
}

/** Between the drafting room's windows, in invisible ink. */
const DRAFTING_STAINS: UvStain[] = [
  {
    id: 'drafting_note', kind: 'ink', mark: 'note',
    words: ['MEASURED THIS ROOM AT NIGHT', '31 FT. BY DAY IT IS 27.', 'THE WALLS DID NOT MOVE.'],
    wall: { from: [-16.5, 1.65, 6.6], toward: [-1, 0, 0], size: [0.6, 0.3] },
    title: 'Writing between the Windows',
    text: 'In invisible ink between the two windows, glowing a cold blue-white: “Measured this room at night. 31 ft. By day it is 27. The walls did not move.”',
  },
];

/** Under the Wood's lamp: what left the open drawer, a warning over the sink, a print by the door. */
const LAB_STAINS: UvStain[] = [
  {
    id: 'lab_prints', kind: 'brine', mark: 'prints',
    floor: [[11.7, -6.3], [11.6, -5.2], [11.3, -3.8], [10.9, -2.6], [10.2, -2.3], [9.0, -2.0], [7.6, -1.9]],
    title: 'Wet Footprints',
    text: 'Bare footprints in salt water, glowing green under the lamp. They start at the open drawer and go past the sink, out of the door and into Records. The first are small and human. By the door the toes have lengthened, and there is webbing between them.',
    checks: [
      {
        skill: 'Track', action: 'Follow the prints',
        success: 'Into Records, along the filing cabinets, toward the nave, where they fade on the dry concrete.',
        hard: 'They go into the nave and turn for the loading doors, and the stride lengthens as they go. Whoever made them was not lost. They knew the way out.',
        failure: 'They fade on the warehouse floor.',
      },
    ],
  },
  {
    id: 'lab_note', kind: 'ink', mark: 'note',
    words: ['IF YOU READ THIS I AM IN', 'THE BOTTOM DRAWER. DO NOT', 'LET THEM OPEN IT. — H.'],
    wall: { from: [11.6, 1.55, -5.6], toward: [-1, 0, 0], size: [0.55, 0.28] },
    title: 'Writing over the Sink',
    text: 'Above the scrub sink, where a surgeon would look every day while washing up, a few lines in invisible ink, glowing a cold blue-white: “If you read this I am in the bottom drawer. Do not let them open it. — H.”',
  },
  {
    id: 'lab_handprint', kind: 'blood', mark: 'handprint',
    wall: { from: [11.2, 1.05, -3.65], toward: [-1, 0, 0], size: [0.22, 0.32] },
    title: 'Handprint by the Door',
    text: 'A handprint in old blood on the tiles beside the door, at waist height and smeared toward the doorway: someone steadying themselves on the way out. The fingers are too long.',
  },
  {
    id: 'lab_spatter', kind: 'brine', mark: 'spatter',
    wall: { from: [16.2, 0.9, 0.9], toward: [0, 0, 1], size: [0.7, 0.5] },
    title: 'Spatter on the Tiles',
    text: 'A fan of drops up the tiles behind the slab, glowing the green of brine. But it is thicker than brine, and the runs beneath the larger drops go up the wall, not down.',
  },
];

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
  finch_desk: { load: async () => LAB_FILES, emptyText: 'The drawers are empty.' },
  plan_chest: { load: async () => BLUEPRINTS, emptyText: 'The drawers are empty.' },
  blueprint_wall: { load: async () => BLUEPRINTS, emptyText: 'Nothing is pinned up.' },
};

// Corkboard layout, in case-board pixels (the pinboard scales it to the cork):
// recap cards in a grid on the left, the live board fitted into the space to their right.
const RECAP_COLS = 4;
const CARD = { w: 280, h: 200 };
const PITCH = { x: 300, y: 220 };

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

/** A typed note, filed on the case board on typing paper rather than a sticky note. */
const pinTypedNote = (text: string, author: string) => fileNote(text, author, { prefix: 'tw', color: '#f5f0e0' });

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

/** ET-1's eyes: look too long and the view swims. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  elder_thing: { angleDeg: 4, range: 3, maxBlurPx: 3, onsetSec: 6, recoverSec: 2 },
  // The model's angles are hard to hold in the eye for long.
  rlyeh_model: { angleDeg: 5, range: 2.5, maxBlurPx: 2.5, onsetSec: 8, recoverSec: 2 },
};

/** The wireless carries Sgt. Miles's message. */
const RADIOS: Record<string, RadioSet> = {
  wireless: { src: '/sgt-miles-1.mp3', volume: 0.9, refDistance: 1.6, loop: false },
};

/**
 * The four bunks in the Quarters, heads to the west wall. The north pair get up
 * southward into the room, the south pair northward.
 */
const BEDS: Record<string, Bed> = {
  bunk_1: { head: [-1, 0], out: [0, 1] },
  bunk_2: { head: [-1, 0], out: [0, 1] },
  bunk_3: { head: [-1, 0], out: [0, -1] },
  bunk_4: { head: [-1, 0], out: [0, -1] },
};

/**
 * The armory workbench: five guns to pick up and carry (E), and put back (E on
 * the empty place). They replace the stand-in rifle the level was built with.
 * The bench's top is 1.2 m (X) by 2.4 m (Z); the vice is at its north end and
 * the brass and ammunition box at its south end, so the long guns lie along it
 * either side and the handguns down the middle.
 */
const WORKBENCH: PickupTable = {
  on: 'Workbench',
  hide: ['Mesh_gunwood2', 'Mesh_gunmetal2'],
  items: [
    { id: 'rifle', title: 'rifle', view: HELD_MODELS.renaissanceRifle, at: [0.36, -0.22], turnDeg: 180 },
    { id: 'tommy', title: 'Tommy gun', view: HELD_MODELS.tommyGun, at: [-0.3, 0.15], turnDeg: 0 },
    { id: 'm1911', title: 'Colt .45', view: HELD_MODELS.coltM1911, at: [0.02, 0.05], turnDeg: 90 },
    { id: 'revolver', title: 'revolver', view: HELD_MODELS.detectiveSpecial, at: [0.02, 0.42], turnDeg: 80 },
    { id: 'ak74u', title: 'AK-74u', view: HELD_MODELS.ak74u, at: [-0.38, -0.8], turnDeg: 0 },
  ],
};

/**
 * Every room off the hall is dark until someone finds the switch outside its
 * door; the hall and the discussion table stay lit. The four rooms' doors are
 * in the hall's side walls (x = ±3.86, z = ±6), and each switch sits 1.4 m
 * toward the table. The Quarters, Pathology Lab and Drafting Room are reached
 * through those rooms, so their switches are inside them, beside their doors.
 */
const LIGHT_SWITCHES: LightSwitch[] = [
  { id: 'case', room: 'Case Room', lamps: ['Lamp_case'], from: [-2.9, -4.6], toward: [-1, 0] },
  { id: 'records', room: 'Records', lamps: ['Lamp_records'], from: [2.9, -4.6], toward: [1, 0] },
  { id: 'maps', room: 'Cartography', lamps: ['Lamp_maps'], from: [-2.9, 4.6], toward: [-1, 0] },
  { id: 'armory', room: 'Armory', lamps: ['Lamp_armory'], from: [2.9, 4.6], toward: [1, 0] },
  { id: 'quarters', room: 'Quarters', lamps: ['Lamp_quarters'], from: [-9.0, -0.6], toward: [-1, 0] },
  { id: 'lab', room: 'Pathology Lab', lamps: ['Lamp_lab_desk', 'Lamp_theatre_1', 'Lamp_theatre_2', 'Lamp_lab_cold'], from: [9.0, -1.3], toward: [1, 0] },
  { id: 'drafting', room: 'Drafting Room', lamps: ['Lamp_drafting_model', 'Lamp_drafting_1', 'Lamp_drafting_2', 'Lamp_drafting_models'], from: [-9.0, 1.5], toward: [-1, 0] },
];

export const ARCHIVE_LEVEL: WalkthroughLevel = {
  id: 'archive',
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
  builders: { rlyeh_model: RLYEH_MODEL },
  pinboard: { size: [5.1, 1.95], load: boardPins, refreshSec: 8 },
  // The wall chart is 5 m wide at the image's 1024 × 559 aspect (build_archive_cli.gd).
  mapPins: { size: [5.0, 5.0 * 559 / 1024], pins: MAP_PINS },
  credit: '"Deep One" by coremort — CC BY 4.0',
  lamps: {
    color: 0xffbf73, intensity: 16, distance: 11,
    // The lab's operating lamps burn cold and white; the bulb over the cold chamber, bluish.
    only: {
      Lamp_theatre_1: { color: 0xe6eeff, intensity: 22, distance: 8 },
      Lamp_theatre_2: { color: 0xe6eeff, intensity: 18, distance: 7 },
      Lamp_lab_cold: { color: 0xcfe0ff, intensity: 6, distance: 6 },
    },
  },
  lightSwitches: LIGHT_SWITCHES,
  pickups: [WORKBENCH],
  beds: BEDS,
  // Every bunk sinks the sleeper into the same deep water.
  dream: '/godot/dream.html?level=dream',
  uvStains: [...LAB_STAINS, ...DRAFTING_STAINS],
  gazeHazards: GAZE_HAZARDS,
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
