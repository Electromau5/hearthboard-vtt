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

import type { Examinable, RadioSet, WalkthroughLevel } from './walkthrough';

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
  // He keeps the admissions cage at the ward's entrance. What he knows, hides and remembers: src/lib/npc-personas.ts.
  npcs: [{ id: 'chief-attendant', node: 'Npc_attendant', name: 'The Chief Attendant', outfit: 'chief-attendant' }],
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
