/**
 * The derelict Innsmouth house — a first-person walkthrough level (see
 * walkthrough.ts) built in Summer Engine (~/dev/my-summer-game) and exported
 * to /innsmouth-house.glb by `tools/export_house.sh` in that project.
 *
 * The model marks every examinable object with a node named `Examine_<id>`;
 * the viewer looks the id up here. An `Examine_*` node with no entry below is
 * still walkable, just not examinable, and an entry with no node is ignored —
 * so adding a clue is a two-step change: name the node in Summer, add it here.
 *
 * The text is deliberately physical description only. It is the GM's to
 * replace with the campaign's actual clues — and so are the `checks`: what a
 * skill roll turns up at each object, written as a first pass to try the
 * mechanic out, not as settled campaign fact.
 */

import type { Examinable, GazeHazard, Peeper, PhotoFrames, RadioSet, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  console_table: {
    title: 'Hall Table',
    text: 'A narrow console table under a skin of dust. A brass oil lamp stands on it, the reservoir dry, the wick burned down to nothing.',
  },
  mirror: {
    title: 'Gilt Mirror',
    text: 'A tall mirror in a gilded frame, leaning against the wall. The silvering has clouded at the edges; your reflection is a shape in fog.',
    checks: [
      {
        skill: 'POW', action: 'Hold your own gaze in the glass',
        success: 'Your reflection steadies and is only you. But for a moment, behind your shoulder, the hall in the mirror was wet — water standing on the boards.',
        failure: 'You look away first. You are not sure your reflection did.',
      },
    ],
  },
  grandfather_clock: {
    title: 'Grandfather Clock',
    text: 'A longcase clock at the end of the hall. The pendulum hangs still. The case door is shut.',
    checks: [
      {
        skill: 'Mechanical Repair', action: 'Open the case and look at the works',
        success: 'The movement is sound — someone stopped the pendulum by hand and wedged it with a folded card. The hands read 3:12. Written on the card in pencil: "Tide turns at 3. Do not let it strike."',
        extreme: 'The movement is sound — someone stopped the pendulum by hand and wedged it with a folded card. The hands read 3:12. Written on the card: "Tide turns at 3. Do not let it strike." Behind the weights, a brass key on a loop of fishing line hangs against the back board.',
        failure: 'The case door sticks and the works are a mystery of brass and grime. Whatever stopped this clock, you cannot tell.',
        fumble: 'Your hand knocks the pendulum free. The clock lurches into motion and strikes once — a single deep note that rolls through the empty house. Somewhere below the floor, something knocks back.',
      },
      {
        skill: 'Listen', action: 'Put an ear to the case',
        success: 'Under the silence there is a faint, wet rhythm, not from the clock but from behind the wall it stands against — like water lapping in a space that should be dry.',
        failure: 'Only the creak of the house settling.',
      },
    ],
  },
  fireplace: {
    title: 'Parlor Fireplace',
    text: 'A brick hearth under a heavy timber mantel. There is a fire in it — burning low and steady in a house no one has lived in for years.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the ashes at the edge of the grate',
        success: 'Half-burned paper among the cinders: the corner of a ledger page, columns of dates and weights in ounces. The heading survives — "Refinery, Marsh &".',
        extreme: 'Half-burned paper among the cinders: the corner of a ledger page, columns of dates and weights in ounces. The heading survives — "Refinery, Marsh &" — and in the margin, in a different hand, "J.M. owes 4 oz. Collect at the reef."',
        failure: 'Ash, cinders and the stink of old smoke. Nothing you can make out.',
        fumble: 'You lean in too close. The fire flares green for an instant, and you feel it on your face like a breath from the sea.',
      },
      {
        skill: 'Natural World', action: 'Work out what is burning',
        success: 'It is not wood. The fuel is a dark, waxy mass — rendered fish oil and kelp, packed into the grate in a heap that could burn for weeks. Someone banked this fire to keep it alight.',
        failure: 'Some kind of slow-burning fuel. You cannot place it.',
      },
    ],
  },
  radio: {
    title: 'Tube Radio',
    text: 'A wooden cabinet radio on a side table. The dial is turned to a station near the bottom of the band.',
  },
  dining_table: {
    title: 'Dining Table',
    text: 'A long mahogany table set for no one. One of the chairs lies on its back beside it, as if someone rose too quickly. A torn envelope lies on the boards, the letter half drawn out of it, addressed to Jamies Martnee, Water Street, Innsmouth, Mass.',
    image: '/innsmouth/letter.webp',
    lying: { src: '/innsmouth/letter.webp', crop: [215, 455, 1440, 610], width: 0.34, turnDeg: 12 },
  },
  sideboard: {
    title: 'Sideboard',
    text: 'A heavy carved sideboard. The doors are closed, the wood swollen with damp.',
    checks: [
      {
        skill: 'STR', action: 'Force the swollen doors',
        success: 'The doors give with a crack. Inside: good china, all of it, every plate turned face down. Beneath the stack is a church bulletin for the Esoteric Order of Dagon, the family name inked in a list of "the Called".',
        failure: 'The wood has swelled tight. The doors do not move.',
        fumble: 'The door tears free of its hinge and the china crashes to the boards. The noise is enormous. At the end of the hall, the boards over the back door creak as if something has pressed against them.',
      },
      {
        skill: 'Locksmith', action: 'Work the little drawer lock',
        success: 'The drawer slides out: a roll of gold coins of no mint you know, stamped with a wave-crest, and a cheap rosary with the cross snapped off.',
        failure: 'The lock is rusted solid.',
      },
    ],
  },
  writing_desk: {
    title: 'Writing Desk',
    text: 'A pedestal desk beneath the boarded window. A sheet of paper lies on the blotter, curled at the corners.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Study the blotter',
        success: 'The page is blank, but the blotter beneath holds the ghost of a letter pressed through in reverse. You make out "…cannot stay. The children hear it in their sleep now…" and a signature: "J. Martnee".',
        extreme: 'Held to the torch at an angle, the blotter gives up a full line pressed through in reverse: "…cannot stay. The children hear it in their sleep now. If the Marsh man comes again, tell him we are gone to Arkham." Signed "J. Martnee".',
        failure: 'A blank sheet, stained with damp. Nothing you can read.',
      },
      {
        skill: 'Library Use', action: 'Go through the pigeonholes',
        success: 'Bills, mostly, from Water Street merchants, all marked paid in gold. The last is a receipt from the Innsmouth town hall for "removal of name from the register".',
        failure: 'Paper, mildew and silverfish. Nothing stands out.',
      },
    ],
  },
  bookshelf: {
    title: 'Bookshelves',
    text: 'Two cases of books, several shelves half-emptied. The spines that remain are cracked and water-stained.',
    checks: [
      {
        skill: 'Library Use', action: 'Look at what was taken',
        success: 'The gaps are not random. Every book on sailing, tides and the sea has been pulled out. What remains is scripture and almanacs — and in the almanacs, every new moon has been circled.',
        failure: 'Mildewed spines and missing volumes. You cannot see any pattern.',
      },
      {
        skill: 'Occult', action: 'Check the remaining titles',
        difficulty: 'Hard',
        success: 'Shoved behind the almanacs is a pamphlet with no title, only a crest of waves. You recognise the invocation printed inside: a prayer to Father Dagon, phrased as a marriage vow.',
        failure: 'Hymnals and almanacs. Nothing here strikes you as unusual.',
      },
    ],
  },
  dresser: {
    title: 'Bedroom Dresser',
    text: 'A chest of drawers with a small lamp on top. One drawer sits slightly open.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the open drawer',
        success: "Children's clothes, folded. In the corner, a drawing in wax crayon: a house, four stick figures, and in the sea behind it, a fifth figure, much larger, with its arms raised.",
        failure: "Children's clothes, folded and mildewed.",
      },
    ],
  },
  wardrobe: {
    title: 'Wardrobe',
    text: 'A tall carved wardrobe with one door standing open. Something still hangs inside.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search behind the hanging coat',
        success: "The coat is a man's oilskin, still damp. The back panel of the wardrobe has been prised loose and nailed back; through the gap you can see a cavity in the wall with a coil of rope and a lantern.",
        failure: "An old oilskin coat, damp to the touch. Nothing else.",
      },
      {
        skill: 'Psychology', action: 'Consider why the door was left open',
        success: 'Everything else in the house was closed and left. This was opened in a hurry and abandoned mid-reach — whoever packed last took something from in here and ran.',
        failure: 'People leave doors open. You can read nothing into it.',
      },
    ],
  },
  bed: {
    title: 'Bed',
    text: 'A bare bedstead and a stained mattress. The blanket has been dragged half onto the floor.',
    checks: [
      {
        skill: 'Medicine', action: 'Examine the stains',
        success: 'Not blood. A dried, faintly iridescent residue with a smell of low tide — and caught in it, a few translucent scales the size of a fingernail. Human skin does not shed like this.',
        failure: 'Old stains of some kind. You cannot tell what.',
        fumble: 'You touch the residue. It is not as dry as it looked, and for the rest of the visit your fingertips tingle and smell of the sea.',
      },
    ],
  },
  dagon_idol: {
    title: 'Fish-Headed Idol',
    text: 'A squat figure of green-black stone, no taller than a hand-span, hunched on its haunches with webbed hands on its knees. Its head is a fish\'s, wide-mouthed and crested. Half of it has sheared away; the pieces lie beside it on the table.',
    checks: [
      {
        skill: 'Occult', action: 'Identify the figure',
        success: 'A votive of Dagon, the kind the Esoteric Order handed to new families on their first Hallowmass. It was not dropped — it was split deliberately, with a chisel, along the line of the spine.',
        failure: 'Some coastal folk carving. It means nothing to you, and you would rather stop looking at it.',
        fumble: 'The longer you try to place it, the more certain you are that it is looking back. Lose your nerve: the blur closes in.',
      },
      {
        skill: 'Appraise', action: 'Judge the stone',
        success: "Not a stone you know. Too heavy for its size, cold even in the fire's warmth, with a faint greasy sheen. No quarry in New England produced this.",
        failure: 'Dark stone, poorly carved. Worthless, probably.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Remember where you have seen it',
        success: 'The crest, the haunches, the webbed hands: this is a likeness of something that is still alive, and the break across it is a ward — a family trying to divorce itself from a bargain.',
        failure: 'You have the sense you ought to know it. The thought slides away.',
      },
    ],
  },
};

/**
 * The four frames above the parlor sofa hold the family's yearly studio
 * portraits (the same plates as "Family Portraits, 1911–1914" in All
 * Resources), read left to right then top to bottom: 1911 left, 1912 top,
 * 1913 bottom, 1914 right. The openings were measured off a render of the
 * frames' mesh, whose +Y faces into the parlor.
 */
const PHOTO_FRAMES: PhotoFrames = {
  node: 'Examine_family_portraits',
  axes: { right: [1, 0, 0], up: [0, 0, -1], out: [0, 1, 0] },
  photos: [
    {
      id: 'portrait_1911', title: 'Portrait, 1911', image: '/family-portraits/1911.webp',
      center: [-0.7285, 0.05, -0.102], size: [0.413, 0.578],
      text: 'A studio portrait before a painted woodland. A moustached man and his wife sit side by side; a boy in a sailor suit and a girl with a bow in her hair stand behind them. All four look straight at the lens.',
    },
    {
      id: 'portrait_1912', title: 'Portrait, 1912', image: '/family-portraits/1912.webp',
      center: [-0.0045, 0.05, -0.454], size: [0.495, 0.674],
      text: 'The same family, a year on: the father seated, his wife behind him, the children in front. Every face is turned to the camera.',
    },
    {
      id: 'portrait_1913', title: 'Portrait, 1913', image: '/family-portraits/1913.webp',
      center: [-0.0045, 0.05, 0.463], size: [0.495, 0.682],
      text: 'The father sits in profile, turned away from the lens, his face gone to shadow. The plate is clouded and blistered around him and nowhere else. His wife and children look straight out. There is a small anchor stitched on the boy\'s breast.',
    },
    {
      id: 'portrait_1914', title: 'Portrait, 1914', image: '/family-portraits/1914.webp',
      center: [0.739, 0.05, -0.2], size: [0.47, 0.592],
      text: 'The father has his back to the camera. Black blooms of decay have eaten through the emulsion over him; the rest of the plate is clean. The mother sits beside him, the children stand, and all three stare at the lens.',
    },
  ],
};

/** Staring at the idol blurs the view — see GazeHazard. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  dagon_idol: { angleDeg: 3, range: 5, maxBlurPx: 8, onsetSec: 2.5, recoverSec: 0.8 },
};

/** The parlor radio still works — it plays the campaign's second theme. */
const RADIOS: Record<string, RadioSet> = {
  radio: { src: '/soundtrack-2.mp3', volume: 0.8, refDistance: 1.5 },
};

/** A Deep One at the hole in the boarded back door, at the end of the hall. */
const PEEPER: Peeper = { gapSec: [3, 7], holdSec: [1.2, 2.4], shyWithin: 0.8 };

export const HOUSE_LEVEL: WalkthroughLevel = {
  id: 'house',
  model: '/innsmouth-house.glb',
  title: 'The Derelict House · Innsmouth',
  loadingText: 'Approaching the house…',
  errorText: 'The house could not be loaded.',
  enterText: 'Click to step inside',
  leaveLabel: 'Leave the house',
  examinables: EXAMINABLES,
  gazeHazards: GAZE_HAZARDS,
  radios: RADIOS,
  peeper: PEEPER,
  photoFrames: PHOTO_FRAMES,
  atmosphere: {
    background: 0x020202,
    fogColor: 0x030303,
    fogDensity: 0.07,
    // Moonlight leaking through the boards — just enough to find the walls.
    sky: 0x4a5670,
    ground: 0x0c0906,
    fill: 0.35,
  },
  // The hearth is lit. Give it light of its own.
  fires: [{ examineId: 'fireplace', at: b => [b.max.x + 0.2, 0.5, (b.min.z + b.max.z) / 2] }],
};
