/**
 * Miskatonic University, Arkham: the Orne Library, 1936. A first-person
 * walkthrough level (see walkthrough.ts) for the default map's Miskatonic pin.
 * ~/dev/my-summer-game `tools/build_library.py` (Blender) builds it from
 * scratch — no source assets — and `tools/export_library.sh` exports it to
 * /miskatonic-library.glb. `tools/render_library.py` renders check pictures.
 *
 * Coordinates are metres; north is -Z. The investigator comes in by the main
 * doors at the south end of the entry hall (x -4..4, z 0..6, 4 m ceiling),
 * past the loan desk and the card catalogue. North of the hall is the main
 * reading room (x -8..8, z -10..0, 6 m), four long tables under green lamps,
 * tall dark windows in its east wall. An enclosed stair on the hall's east
 * side climbs to the gallery, a walkway at y 3 along the reading room's south
 * side. West of the reading room are the stacks (x -20..-8, z -10..0): five
 * double rows of shelves, a maze, one aisle blocked by a fallen shelf. The
 * iron gate in the stacks' north wall (x -14.6..-13.4, z -10) shuts the
 * restricted room (x -16.5..-11.5, z -15..-10), where the Necronomicon lies
 * chained on a stone pedestal. gamelord opens the gate.
 *
 * The text is suggested description for the GM to adjust.
 */

import type { Examinable, GazeHazard, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  front_desk: {
    title: 'The Loan Desk',
    text: "A high oak counter facing the doors, its top worn pale where a generation of elbows has leant on it. A green-shaded lamp, an inkwell, and the request ledger lying open. The night attendant's chair is pushed back as though he left in a hurry, and has not come back.",
    checks: [
      {
        skill: 'Library Use', action: 'Read the request ledger',
        success: 'Requests for the Restricted Collection run back years, each with "Dr. A." initialled in the margin, granted or refused. The last three this month are refused. One requester has signed with a single letter, W., and given no department.',
        hard: 'Turning back a dozen pages: the summer of 1928, a long run of requests from one hand, all for the same volume and all refused, until the entries stop on a night in late summer. Somebody has drawn a neat line under the last one.',
        failure: 'Names, dates, call numbers. The night attendant writes a poor hand.',
      },
      {
        skill: 'Spot Hidden', action: 'Look behind the counter',
        success: 'A key hook under the counter-top, numbered 1 to 12. Number 12 is empty, and the brass around it is scratched bright, as if it were taken down and hung back many times in a hurry. Number 12, by the tag on the board, is "R. Gate".',
        failure: 'Pencils, a date stamp, a cold cup of tea.',
      },
    ],
  },
  card_catalog: {
    title: 'The Card Catalogue',
    text: 'A cabinet of seventy-two small drawers, each with a brass label frame and a typed card in it: Aa–Ab, Ab–Ac, on into the dark. Most of the drawers are stiff. A few slide easily, as though they are often used.',
    checks: [
      {
        skill: 'Library Use', action: 'Look up the Restricted Collection',
        success: 'The restricted titles have cards like any other book, but the call numbers are all an R and a number, and each card is stamped APPLY TO THE LIBRARIAN. R-1 is "Alhazred, Abdul. Al Azif (the Necronomicon). Latin trans. O. Wormius. Folio, 1623. One vol., chained."',
        hard: 'Behind R-1 there should be R-2 and R-3. Their cards are gone. Where they sat, the drawer has a pencilled note: withdrawn to the Librarian, 2.viii.28.',
        failure: 'The drawers are in no order you can follow quickly. The cards smell of mould.',
      },
      {
        skill: 'Spot Hidden', action: 'Find the drawers that slide easily',
        success: 'The easy drawers are the "D" drawers: Dag–Dal, and one marked Dee–Del. The cards in Dag–Dal have been thumbed soft, Dagon above all: a sermon, a Phoenician gazetteer, and a pamphlet printed in Innsmouth.',
        failure: 'The drawers stick and slide by turns. Damp, perhaps.',
      },
    ],
  },
  open_book: {
    title: 'An Open Book on a Reading Table',
    text: "Someone left a book open on the far table, under its lamp: a county history of Essex, its pages spotted brown. A sheaf of notes lies beside it, and an inkwell with the cap off. The ink in the pen has dried.",
    checks: [
      {
        skill: 'History', action: 'Read the open pages',
        success: 'The chapter is on Innsmouth: the Marsh refinery, the fever of 1846 that halved the town, and the family of Captain Obed Marsh, who "removed from the town in the years following." It does not say where they went.',
        failure: 'Fishing returns and a list of town selectmen. Dry going.',
      },
      {
        skill: 'Spot Hidden', action: 'Read the notes beside it',
        success: 'The notes are in pencil, a list of Marsh names, crossed out one by one. The last is not crossed out: "Eliza Marsh, m. 1891 — to Arkham? Ask at the Historical Society." Somebody in this town has been looking for the same family you are.',
        hard: 'Pressed into the sheet beneath, from a page that was torn off: a street address on French Hill, and the words "she does not answer the door."',
        failure: 'Scrawl, mostly names. None you know.',
      },
    ],
  },
  fallen_shelf: {
    title: 'A Fallen Shelf',
    text: 'One bay of the stacks has come away from its row and fallen across the aisle, wedged against the shelves opposite. Its books lie spilled on the floor and nobody has picked them up. Beyond it the aisle runs on into the dark toward the north wall.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at where it stood',
        success: 'It did not tip on its own. The feet were screwed to the floor, and the screws have been torn out of the boards, splintering them, as if something heavy had pulled the bay out from the row.',
        hard: 'Deep scratches run along the back of the bay, three and three, a hand-span apart. They are at shoulder height for a tall man, and they go through the varnish into the wood.',
        failure: 'An old bay come loose. The stacks need work.',
      },
      {
        skill: 'Track', action: 'Read the dust on the floor',
        success: 'There is a path worn in the dust of this aisle, but it stops at the fallen shelf. Somebody comes this way to the north wall by the long way round, through the west end of the stacks, often and recently.',
        failure: 'Dust and fallen pages. Too many feet have been through here to read.',
      },
      {
        skill: 'STR', action: 'Try to shift it',
        difficulty: 'Hard',
        success: 'It rocks, and books slide off it, loud in the quiet. It will not go back by one pair of hands, and the noise carries.',
        failure: 'It does not move. It is wedged fast against the far row.',
      },
    ],
  },
  gallery_desk: {
    title: "The Librarian's Desk in the Gallery",
    text: "A writing desk up on the gallery, where whoever sits there can see the whole reading room and the doors. The lamp is still warm. Papers in a fine, careful hand, and a stack of books with slips of card marking places.",
    checks: [
      {
        skill: 'Library Use', action: 'Look over the marked books',
        success: 'Every slip marks the same kind of passage: rites of binding and of sending back, in Latin, Greek and Arabic. The reader is comparing them, line by line. In the margins of one, in the careful hand: "the powder — 1928 — it was enough."',
        failure: 'Scholarship, in three languages. Somebody is working late.',
      },
      {
        skill: 'Psychology', action: 'Read the hand in the papers',
        success: 'The writing is fine and controlled down each page, and then at the foot of one it breaks. The same line is written over and over, smaller and smaller: Lock the gate. Lock the gate. Lock the gate.',
        failure: 'A scholar\'s notes. A careful man, by his hand.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Follow the comparison',
        difficulty: 'Hard',
        success: 'He is not studying how to call anything. He is studying how to send something back, and he believes he will have to, soon.',
        failure: 'The rites contradict each other, and the margins argue with them.',
      },
    ],
  },
  restricted_gate: {
    title: 'The Iron Gate',
    text: 'Black iron bars, floor to lintel, set in the north wall of the stacks. A heavy box lock, newer than the gate. Through the bars a small stone room, a pedestal in the middle of it, and on the pedestal a book under a chain. A card wired to the bars reads RESTRICTED COLLECTION — BY THE LIBRARIAN ONLY.',
    checks: [
      {
        skill: 'Locksmith', action: 'Judge the lock',
        success: 'A good lock, and a lever key, the kind that hangs on a board. You could pick it with time and quiet, which you will not get here. The key hook at the loan desk would be quicker.',
        failure: 'A heavy lock. Not one to rush.',
      },
      {
        skill: 'Spot Hidden', action: 'Look through the bars',
        success: 'Two candle stands either side of the pedestal, burnt low and lately lit. A chair in the corner, set to face the book, not the door.',
        failure: 'A dark room. A pedestal. A book.',
      },
    ],
  },
  necronomicon: {
    title: 'The Necronomicon',
    text: "A great folio in dark hide gone soft and cracked with age, its corners shod in tarnished brass, a strap and hasp across the fore-edge. On the front board a brass boss, a star of seven arms inside a ring of studs. An iron chain runs across it from one side of the pedestal to the other, padlocked. The room is cold, and colder near the book.",
    checks: [
      {
        skill: 'Library Use', action: 'Read the spine and the shelf-mark',
        success: 'A paper slip in the spine, in a librarian\'s hand: R-1. Al Azif, Latin, Olaus Wormius. Folio. Printed in Spain, 1623. Not to leave this room.',
        failure: 'The lettering on the spine has worn away.',
      },
      {
        skill: 'Locksmith', action: 'Work the padlock on the chain',
        difficulty: 'Hard',
        success: 'The padlock is old and simple next to the gate\'s lock. It opens. The chain is free, and so is the book.',
        fumble: 'The pick snaps in the padlock. It will not open now without the key, and the broken pick is plain to anyone who looks.',
        failure: 'The padlock does not give, and the chain rattles on the stone when you let go.',
      },
      {
        skill: 'Occult', action: 'Study the boss on the cover',
        success: 'The seven-armed star is not decoration. It is a seal, worked so that it presses on the book from outside. Somebody, long after it was bound, wanted it kept shut.',
        failure: 'An old binder\'s ornament, a star in a ring.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Open it',
        success: 'You read a page before you mean to. The Latin is plain enough. What it describes is not, and you will not forget it.',
        extreme: 'You find the page the gallery notes were circling: a rite of sending back, and a powder, and a list of what it needs. One ingredient has been underlined in pencil, recently.',
        failure: 'The words swim. You close it, and find your hand is shaking.',
      },
    ],
  },
};

/** The book is hard to look at for long. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  necronomicon: { angleDeg: 4, range: 3, maxBlurPx: 3, onsetSec: 7, recoverSec: 2.5 },
};

export const MISKATONIC_LEVEL: WalkthroughLevel = {
  id: 'miskatonic',
  model: '/miskatonic-library.glb',
  title: 'The Orne Library · Miskatonic University',
  loadingText: 'Signing the night register…',
  errorText: 'The library could not be loaded.',
  enterText: 'Click to enter the library',
  leaveLabel: 'Leave the library',
  examinables: EXAMINABLES,
  gazeHazards: GAZE_HAZARDS,
  // The gate is its own mesh (Gate_Iron), hinged on its west post. Its bars are
  // too far apart to stop the walkthrough's wall rays, so Gate_Collider, a clear
  // pane in the gate's plane, swings with it and does the stopping.
  spots: {
    restricted_gate: { min: [-14.6, 0, -10.15], max: [-13.4, 2.4, -9.85] },
  },
  doors: {
    restricted_gate: {
      label: 'Restricted gate',
      leaf: [
        { mesh: 'Gate_Iron', min: [-14.7, -0.05, -10.12], max: [-13.3, 2.6, -9.88] },
        { mesh: 'Gate_Collider', min: [-14.7, -0.05, -10.12], max: [-13.3, 2.6, -9.88] },
      ],
      // Swings north, into the restricted room.
      hinge: [-14.6, 0, -10],
      openDeg: 100,
    },
  },
  // Green banker's lamps over the four tables (1-4), the loan desk (5), bare
  // pendants in the stacks (6-7) and the hall (10), the one small lamp in the
  // restricted room (8), the gallery desk (9).
  lamps: {
    color: 0xffc98a, intensity: 5, distance: 7,
    only: {
      Lamp_6: { intensity: 4, distance: 8 },
      Lamp_7: { intensity: 3, distance: 7 },
      Lamp_8: { color: 0xffa860, intensity: 2.5, distance: 5 },
      Lamp_10: { intensity: 6, distance: 9 },
    },
  },
  atmosphere: {
    background: 0x050505,
    fogColor: 0x070605,
    fogDensity: 0.035,
    sky: 0x5c5446,
    ground: 0x0c0a08,
    fill: 0.55,
    // A little night through the tall east windows.
    moon: { color: 0x8a9cc0, intensity: 0.6, position: [30, 14, -6] },
  },
};
