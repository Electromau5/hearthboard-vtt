/**
 * Bellevue Psychiatric Isolation Ward, Manhattan, October 1932 — a first-person
 * walkthrough level (see walkthrough.ts), built procedurally in Summer Engine
 * by `tools/build_bellevue_cli.gd` (~/dev/my-summer-game) and exported to
 * /bellevue-ward.glb by `tools/export_bellevue.sh`.
 *
 * Two storeys joined by a stairwell. The ground floor is Admissions and the
 * Lower Block (Cells 63–66, behind a barred gate); upstairs is the ward —
 * Rooms 4B, 7, 7B and 12B from the admission cards, the Ward 3B dormitory, the
 * day room, the nurses' station and a treatment room.
 *
 * It is set after session 1: Cell 66 stands open and empty, its flagstone
 * already lifted, and Robbie is gone from Cell 65. As with the house, the text
 * is physical description for the GM to build clues on. The model also marks
 * where people will stand (`Npc_*` nodes) — the attendant at the admissions
 * cage, a nurse, patients in the day room and Ward 3B, and whoever is behind
 * the closed doors of Cells 63 and 64. The Chief Attendant is the first to be
 * filled: he stands at his cage and talks, and remembers (see `npcs`).
 */

import type { Examinable, RadioSet, UvStain, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  // ── Ground floor: Admissions ──────────────────────────────────────
  admissions_desk: {
    title: 'Admissions Cage',
    text: 'An oak counter caged to the ceiling in iron grille, with a slot at counter height to pass papers through. The admissions register lies open under a hand bell, the last entries in a neat clerk\'s hand. A stool behind the counter, still warm.',
  },
  visitor_board: {
    title: 'Visiting Notices',
    text: 'A board of pinned notices beside the benches: visiting hours, Sundays two to four; no food, no matches, no letters not first read by staff; patients in the Lower Block receive no visitors. Someone has scratched out a name on the list of permitted callers.',
  },
  attendant_desk: {
    title: 'Chief Attendant\'s Desk',
    text: 'A tidy desk, everything squared to its edges. Duty rosters, a blotter, a fountain pen laid parallel to it. The top drawer is locked; the others hold forms in triplicate.',
  },
  keyboard: {
    title: 'Key Board',
    text: 'A board of brass hooks inside the office door, each with an iron key and a paper tag: LAUNDRY, HYDRO, STORES, GATE, 63, 64, 65. The hook for 66 is empty.',
  },
  records: {
    title: 'Records Room',
    text: 'Eight steel cabinets of patient records, indexed by admission number. One drawer has been pulled out and left, and a manila file lies face down on the floor beside it.',
  },
  continuous_bath: {
    title: 'Continuous Bath',
    text: 'An enamel tub laced over with heavy canvas, a hole cut at one end for a patient\'s head. The water beneath is cold and grey. Leather straps hang from the eyelets. A thermometer on the tiled wall reads ninety-four degrees, which it is not.',
  },
  laundry_cart: {
    title: 'Laundry Carts',
    text: 'Two canvas bins on castors, heaped with soiled sheets and gowns. The sheets in the nearer cart are stiff with something that dried white, and smell of the sea.',
  },

  // ── Ground floor: the Lower Block ────────────────────────────────
  lower_gate: {
    title: 'Lower Block Gate',
    text: 'A double gate of iron bars across the corridor under a red enamel sign: LOWER BLOCK — NO ADMITTANCE. Both leaves stand open and chained back against the wall. Past it the lino gives way to old wet flagstone.',
  },
  cell65_wall: {
    title: 'Pencil on the Wall of Cell 65',
    text: 'The wall Cell 65 shares with Cell 66 is covered in small, careful pencil, as if written by someone lying on the cot with his ear to the plaster: "it sings at the low tide", "Ia! Ia! the deep ones sing below", "Y\'ha-nthlei", "the sea keeps what is crossed", "Father Dagon, Mother Hydra", "it says the Marsh blood opens the stone" — and, last, lower than the rest: "day 66 it said my name".',
  },
  cell66_walls: {
    title: 'The Padding of Cell 66',
    text: 'The quilted padding is torn in long parallel rakes, four at a time, too wide apart for human fingers. Below them, tally marks in groups of five, sixty-six in all, and the number 66 dragged into the canvas.',
  },
  cell66_chains: {
    title: 'Wall Chains',
    text: 'Two lengths of chain bolted through the padding into the stone, ending in cuffs. The cuffs are closed and locked — and empty, as though whatever wore them slipped out of them without opening them.',
  },
  cell66_flagstone: {
    title: 'The Lifted Flagstone',
    text: 'The flag your party prised up leans against the padding where you left it. The hollow beneath is dry and empty now. The underside of the stone is pale and smooth, worn by hands that came back to it often.',
  },

  // ── Upstairs: the ward ───────────────────────────────────────────
  room_4b: {
    title: 'Room 4B',
    text: 'An iron bed made with hospital corners, a chamber pot, a barred window. The card on the door is held by one pin; the others have been worked loose.',
  },
  room_7: {
    title: 'Room 7',
    text: 'The bed is stripped to the ticking. Nothing on the walls, nothing under the bed. The window bars have been wrapped in rag where someone gripped them.',
  },
  room_7b: {
    title: 'Room 7B',
    text: 'The walls of 7B are scored with fine lines at every height a person could reach, scratched with a fingernail — the marks of someone who spent a long time with an ear to the plaster, following a sound.',
  },
  room_12b: {
    title: 'Room 12B',
    text: 'A neatly made bed and, under the pillow, a page torn from a book on heredity, folded small. The bed has not been slept in for days.',
  },
  ward_beds: {
    title: 'Ward 3B',
    text: 'Six iron beds in two rows under a single bulb. The blankets on the south row are turned back as if for patients coming in tonight. The air smells of carbolic and, faintly, of low tide.',
  },
  restraint_bed: {
    title: 'Restraint Bed',
    text: 'An iron bed with leather straps across the chest, waist and knees, buckled to the frame. The mattress is stained through. A basin of wet sheets stands beside it for the packs.',
  },
  census_ledger: {
    title: 'Ward Census',
    text: 'The night nurse\'s ledger lies open on the counter: the Inmate Census and Observation List, each subject logged against a note on "hereditary degeneracy".',
    image: '/inmate-log.jpeg',
  },
  medicine_cabinet: {
    title: 'Medicine Cabinet',
    text: 'A glass-fronted cabinet of brown bottles: chloral hydrate, paraldehyde, bromide, laudanum. The lock is good and the key is not in it.',
  },
  gramophone: {
    title: 'Day Room Gramophone',
    text: 'A cabinet gramophone on a side table in the day room, a record still on the platter. The patients are allowed it on Sundays.',
  },
};

/**
 * What the Wood's lamp finds in the ward (see UvStain): the night Cell 66 was
 * emptied, written in brine and washed-off blood from the cell to the laundry
 * carts; invisible-ink notes left by Robbie, the laundry crew and the last team
 * Butler sent; and the Innsmouth sign in Room 7B. Positions are in the ward's
 * metres — rooms as laid out in Summer's `build_bellevue_cli.gd`; the ward floor
 * is at y = 3.4. A first pass for the GM, like the examine text.
 */
const FH = 3.4;
const UV_STAINS: UvStain[] = [
  // ── Ground floor ─────────────────────────────────────────────────
  {
    id: 'uv_bv_drag', kind: 'brine', mark: 'drag',
    // Out of Cell 66, west down the corridor through the gate, into the laundry, to the carts.
    floor: [[10.5, -3.6], [10.5, -0.3], [-9.5, -0.3], [-9.5, -2.0], [-10.9, -2.9]],
    title: 'Drag Marks from Sixty-Six',
    text: 'Under the lamp the floor lights up green: a smear of dried brine as wide as a man\'s shoulders, dragged out of Cell 66, along the Lower Block, through the gate, past the stairs and into the laundry, where it ends at the canvas carts. In places long fingers clawed at the flagstones on the way.',
    checks: [
      {
        skill: 'Track', action: 'Read the drag',
        success: 'Two people pulled it, walking backwards. One pair of shoes is heavy and flat-footed, with a long sliding scuff on every left step. Whatever they dragged fought for the first few yards and then stopped fighting.',
        hard: 'Two people pulled it, walking backwards: one heavy and flat-footed, the other in hobnailed boots no orderly here wears. At the laundry the trail goes to the third cart, and beside it is the narrow wheel line of a hand truck, heading for the service door.',
        failure: 'A smear. Something wet came this way.',
      },
    ],
  },
  {
    id: 'uv_bv_corridor_blood', kind: 'blood', mark: 'spatter',
    wall: { from: [10.5, 1.3, 0.0], toward: [0, 0, 1], size: [1.2, 0.9] },
    title: 'Blood across from Sixty-Six',
    text: 'The wall opposite Cell 66 has been washed recently — the paint is cleaner here than anywhere else in the block. Under the lamp an arc of dark drops shows through: someone was struck hard, standing in the corridor just outside the cell door.',
    checks: [
      {
        skill: 'Science (Forensics)', action: 'Read the spatter',
        success: 'The drops were thrown toward the cell, not out of it. Whoever bled here was standing in the corridor — one of the men who came for the patient, not the patient.',
        failure: 'Old stains under fresh paint. You cannot tell who bled.',
      },
    ],
  },
  {
    id: 'uv_bv_laundry_ink', kind: 'ink', mark: 'note',
    words: ['Wed. 2 a.m. — cart 3', 'out the service door to the freight yard', 'consigned B.Q.D. — no questions', 'paid in full'],
    wall: { from: [-10.4, 1.65, -4.5], toward: [0, 0, -1], size: [1.1, 0.55] },
    title: 'Tally above the Wash Tubs',
    text: 'On the wall above the wash tubs, in something that dried invisible — milk, or laundry bluing — and glows cold blue under the lamp: "Wed. 2 a.m. — cart 3 — out the service door to the freight yard — consigned B.Q.D. — no questions — paid in full." B.Q.D.: the Boston Quarantine Docks, as on the freight receipt.',
  },
  {
    id: 'uv_bv_cell65_ink', kind: 'ink', mark: 'note',
    words: ['if they take me too —', 'the box is where the drowned sleep', 'it sings back now. 7B hears it', '— R.'],
    wall: { from: [6.7, 0.8, -4.5], toward: [0, 0, -1], size: [0.95, 0.5] },
    title: 'Robbie\'s Hidden Note',
    text: 'Low on the wall beside the cot, where only someone lying down would write, a note in invisible ink: "if they take me too — the box is where the drowned sleep — it sings back now. 7B hears it — R."',
    checks: [
      {
        skill: 'Psychology', action: 'Think about Robbie',
        success: 'Not the hand of a madman. Small, careful, written for someone he expected to come looking — and frightened, because he wrote it where the attendants would never think to look.',
        failure: 'The scrawl of a man who had stopped making sense.',
      },
    ],
  },
  {
    id: 'uv_bv_hydro_blood', kind: 'blood', mark: 'handprint',
    wall: { from: [8.2, 1.45, 6.3], toward: [0, 0, 1], size: [0.34, 0.95] },
    title: 'Handprint above the Second Bath',
    text: 'On the white tile above the middle bath, a bloody hand pressed flat and slid down to the rim of the tub: someone laced under the canvas who tried to climb out. The tiles were scrubbed afterwards. The lamp does not care.',
  },
  {
    id: 'uv_bv_office_ink', kind: 'ink', mark: 'note',
    words: ['Butler\'s last team stood here.', 'He signed 66 out to men with federal papers.', 'He was paid. Do not trust the cage.', '— the last team'],
    wall: { from: [-6.5, 1.6, 5.8], toward: [-1, 0, 0], size: [1.15, 0.55] },
    title: 'Message from the Last Team',
    text: 'On the office wall, in ink that only the lamp shows, a message from other investigators who came before you: "Butler\'s last team stood here. He signed 66 out to men with federal papers. He was paid. Do not trust the cage."',
  },

  // ── The ward ─────────────────────────────────────────────────────
  {
    id: 'uv_bv_7b_glyph', kind: 'brine', mark: 'glyph',
    // On the side wall over the bed: the north wall here is mostly window.
    wall: { from: [7.5, FH + 1.6, -4.7], toward: [-1, 0, 0], size: [0.75, 0.75] },
    title: 'Sign in Room 7B',
    text: 'Above the bed in 7B, drawn with a wet finger and glowing green under the lamp: a ring, a three-tined staff with wavering tines, and a wave beneath it. The same sign was drawn over the bed in the derelict house in Innsmouth.',
    checks: [
      {
        skill: 'Occult', action: 'Read the sign',
        success: 'A mark of the Esoteric Order of Dagon, set over a bed to say its sleeper is pledged. Here, on an asylum wall, it means someone inside the ward has taken the Oath — or has been claimed by those who have.',
        failure: 'Fisherman\'s superstition, or a madman\'s doodle.',
      },
    ],
  },
  {
    id: 'uv_bv_dayroom_hands', kind: 'brine', mark: 'handprint',
    wall: { from: [-9.1, FH + 1.4, 6.5], toward: [0, 0, 1], size: [0.34, 0.95] },
    title: 'Wet Handprints at the Window',
    text: 'Beside the day-room window that looks east over the river, a hand pressed to the wall in brine and dragged down it — and above and beside it, fainter, others: the same hand, again and again, night after night, as if someone stood here reaching for the water.',
  },
  {
    id: 'uv_bv_nurses_ink', kind: 'ink', mark: 'note',
    words: ['the census lies —', 'one name up here was changed', 'the night he came in.', 'the nurse knows which. — R.'],
    wall: { from: [-1.5, FH + 1.5, 4.4], toward: [-1, 0, 0], size: [0.95, 0.5] },
    title: 'Note behind the Nurses\' Station',
    text: 'On the wall behind the nurses\' counter, in Robbie\'s small hand and invisible ink: "the census lies — one name up here was changed the night he came in. the nurse knows which. — R."',
  },
  {
    id: 'uv_bv_treatment_blood', kind: 'blood', mark: 'spatter',
    // Beside the bed's head rather than behind it, where the headboard would hide it.
    wall: { from: [-10.5, FH + 1.35, -2.55], toward: [-1, 0, 0], size: [1.0, 0.75] },
    title: 'Spray by the Restraint Bed',
    text: 'Fine spray on the wall beside the head of the restraint bed, washed off again and again: the pattern a man makes coughing blood while strapped down.',
  },
];

/** The day room's gramophone plays the campaign's first theme. */
const RADIOS: Record<string, RadioSet> = {
  gramophone: { src: '/soundtrack-1.mp3', volume: 0.7, refDistance: 1.6 },
};

export const BELLEVUE_LEVEL: WalkthroughLevel = {
  id: 'bellevue',
  model: '/bellevue-ward.glb',
  title: 'Bellevue Psychiatric Isolation Ward · Manhattan',
  loadingText: 'Signing in at Admissions…',
  errorText: 'The ward could not be loaded.',
  enterText: 'Click to step inside',
  leaveLabel: 'Leave the ward',
  examinables: EXAMINABLES,
  radios: RADIOS,
  uvStains: UV_STAINS,
  // He keeps the admissions cage at the ward's entrance. What he knows, hides and remembers: src/lib/npc-personas.ts.
  npcs: [{ id: 'chief-attendant', node: 'Npc_attendant', name: 'The Chief Attendant', outfit: 'chief-attendant' }],
  // TEST: the Deep One model walking a loop round the admissions hall, clear of the cage
  // and the benches. It ignores everyone. Its walk covers about a metre a second.
  wanderers: [{ model: '/avatars/deep-one.glb', clip: 'Walk', speed: 1.0, path: [[1.4, 6.0], [1.5, 3.0], [0.4, 2.4], [-0.55, 3.0], [-0.55, 6.0], [0.4, 6.5]] }],
  // Caged ceiling bulbs: corridors and the rooms the night staff use. Cells, the stairwell,
  // the office and the patient rooms are left dark.
  lamps: { color: 0xffe2b0, intensity: 3.2, distance: 8 },
  atmosphere: {
    background: 0x030405,
    fogColor: 0x040506,
    fogDensity: 0.045,
    sky: 0x56607a,
    ground: 0x0d0c0a,
    fill: 0.3,
    // A cold moon through the barred south windows.
    moon: { color: 0x9fb4d8, intensity: 0.9, position: [6, 18, 30] },
  },
};
