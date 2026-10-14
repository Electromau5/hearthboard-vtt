/**
 * Miskatonic University, Arkham: the quadrangle. A first-person walkthrough
 * level (see walkthrough.ts) for the default map's Miskatonic pin. The model is
 * "University of Galway Quadrangle" by eileenMaKe (Sketchfab, CC BY 4.0), a
 * drone photogrammetry scan. ~/dev/my-summer-game `tools/build_miskatonic.py`
 * (Blender) stands it up, levels and crops it, and builds hidden collision from
 * it. `tools/export_miskatonic.sh` exports it to /miskatonic.glb.
 *
 * Coordinates are metres. The courtyard's centre is the origin, with the paving
 * at y ≈ 0. Lawns lie in four quarters about a cross of paths. The west range
 * (-X) has the gate under its tower, where the investigator comes in. The east
 * range (+X, x ≈ 17) has an ivy-covered gable whose red door is the Orne
 * Library's. The north range is at z ≈ -29 and the south at z ≈ +29. The
 * cloister arcades are solid in the scan, so they cannot be walked into.
 *
 * The examinables are invisible boxes over features the scan has (`spots`),
 * plus a bench from the prop library. Their text is suggested description for
 * the GM to adjust.
 */

import type { Examinable, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  library_door: {
    title: 'The Orne Library · East Door',
    text: "A red-painted oak door under a gable smothered in ivy. A brass plate reads ORNE LIBRARY — READERS BY THE WEST STAIR. Below it a typed card has been tacked up: The Restricted Collection is closed to all readers save by the written leave of the Librarian, and then only in his presence. — H. Armitage. The door has two new bolts and a lock far newer than the hinges.",
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look over the lower panels',
        success: 'The bottom of the door has been planed and repainted, but not well enough. Under the red there are deep gouges at knee height, many of them, all scored downward, as if something had been clawed from the inside.',
        hard: 'Under the gouged paint the planed wood has a dark stain that soaked in too deep to plane out. It is not blood. It smells faintly, when you put your face to it, of something rotting that is not meat.',
        failure: 'An old door, freshly painted. The ivy has been cut back from the frame.',
      },
      {
        skill: 'Locksmith', action: 'Judge the new lock',
        success: 'A good lever lock, fitted this year. From the play in the door there is a bar on the inside as well. Nobody is getting through here quietly by night.',
        failure: 'A lock, fairly new. You cannot tell more without your tools out in full view of the windows.',
      },
      {
        skill: 'Library Use', action: 'Read the hours card beside the door',
        success: 'Reading-room hours, and in a smaller hand at the foot: Requests for the Restricted Collection are entered in the Librarian\'s book and answered within the week. Four names have been written in pencil on the card and rubbed out again.',
        failure: 'Hours of opening, nine until six. Closed on the Sabbath.',
      },
    ],
  },
  notice_case: {
    title: 'The Notice Case in the Gate',
    text: "A glazed case on the wall of the gate passage, full of university notices: lecture lists, a rowing fixture, a room to let on College Street. The oldest have curled and gone yellow behind the glass.",
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read down the notices',
        success: "In a corner: DEPARTMENT OF BIOLOGY. Specimens of unusual marine or anatomical character, from any New England source, will be received and paid for at the Science Hall. Enquire of the Curator. Discretion assured. Somebody has written 'Innsmouth?' on the glass in grease pencil.",
        hard: "Pinned behind the Biology notice and half hidden by it: a lecture card for Prof. Rice, 'Pre-Human Inscriptions of the Atlantic Seaboard'. The date has been struck through and CANCELLED written across it, in the same hand that signs the Librarian's notices.",
        failure: 'Lectures, rooms, rowing. Nothing you need.',
      },
    ],
  },
  science_door: {
    title: 'The Science Hall · North Door',
    text: 'An arched door in the north range, the steps worn into hollows. Through the glass there is a corridor of specimen cases and a smell of spirits and formalin that reaches you even out here.',
    checks: [
      {
        skill: 'Science (Biology)', action: 'Study the specimens in the corridor',
        success: 'Most of the cases are ordinary: birds, a shark\'s jaw, a sunfish. The last one, nearest the door, is empty, and its label has been taken out. The dust on its shelf has the outline of a jar a foot and a half tall.',
        hard: 'The empty case has a curator\'s slip left in the corner: Accession 1927/14. Received from Mr. ——, Newburyport. Not to be catalogued. Transferred to basement store by order. The donor\'s name has been inked out.',
        failure: 'Glass cases and labels in Latin. The corridor is empty this late.',
      },
    ],
  },
  archaeology_door: {
    title: 'Archaeology & Ancient Languages · South Door',
    text: 'A red door in the south range, set in a tower thick with ivy. A board beside it lists the department\'s rooms. Leaning in the porch is a crate stencilled FRAGILE — PLASTER, its lid prised up.',
    checks: [
      {
        skill: 'History', action: 'Look into the crate',
        success: 'Plaster casts of carved stone: glyphs in tight rows, worn almost smooth. Nobody has labelled them yet. They are not Egyptian or Mayan, nor any script you could put a name to.',
        hard: 'One cast has a shipping tag: Boston Harbour, c/o Butler & Associates, for comparison. Somebody in this department is matching the Black Archive\'s pieces against the university\'s.',
        failure: 'Plaster and straw. Casts of something carved.',
      },
      {
        skill: 'Architecture & Engineering', action: 'Read the angles of the glyph rows',
        difficulty: 'Hard',
        success: 'The rows are not straight. Each leans by the same small amount, and set end to end they would close into a curve far larger than any wall these casts came from. Your head aches when you try to hold the curve in your mind.',
        failure: 'The carving is too worn to say how it was laid out.',
      },
    ],
  },
  bench: {
    title: 'A Bench by the Lawn',
    text: 'A long bench on the path between the lawns. Someone has left an evening paper on it, the Arkham Advertiser, folded open at the second page.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the folded page',
        success: 'A short column: LIBRARY HOUND PUT DOWN. The watchdog at the Orne Library, "a mastiff of uncertain temper," has been destroyed on the order of the University. The Librarian could not be reached. A student has written in the margin: he still walks it at night.',
        failure: 'Shipping news, a bank failure in Salem, a column of small advertisements.',
      },
    ],
  },
};

export const MISKATONIC_LEVEL: WalkthroughLevel = {
  id: 'miskatonic',
  model: '/miskatonic.glb',
  title: 'Miskatonic University · Arkham',
  loadingText: 'Passing under the gate tower…',
  errorText: 'The quadrangle could not be loaded.',
  enterText: 'Click to walk the quadrangle',
  leaveLabel: 'Leave the university',
  credit: '"University of Galway Quadrangle" by eileenMaKe — CC BY 4.0',
  examinables: EXAMINABLES,
  // Invisible boxes over doors and the notice case, which the scan has. x/z are
  // metres from the courtyard's centre (see above); y is up from the paving.
  spots: {
    library_door: { min: [16.5, 0, -0.9], max: [17.4, 2.7, 0.9] },
    notice_case: { min: [-16.3, 0.4, -1.4], max: [-15.6, 3.2, 1.2] },
    science_door: { min: [1.2, 0, -29.6], max: [3.0, 2.7, -28.8] },
    archaeology_door: { min: [0.3, 0, 28.4], max: [2.1, 2.7, 29.2] },
  },
  placements: [{ asset: 'long-bench', id: 'bench', at: [-7, 2.6] }],
  // Outdoors: the GM sets the time of day and the rain (`/admin/experience`); night is the atmosphere below.
  weather: true,
  // Four iron lamp posts about the cross of paths.
  lamps: { color: 0xffc27a, intensity: 14, distance: 16 },
  atmosphere: {
    background: 0x05070c,
    fogColor: 0x080b12,
    fogDensity: 0.022,
    sky: 0x3d4a66,
    ground: 0x0c0a08,
    fill: 0.5,
    moon: { color: 0x9fb2d4, intensity: 1.4, position: [-20, 34, 12] },
  },
};
