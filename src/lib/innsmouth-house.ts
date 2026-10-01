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
 * replace with the campaign's actual clues.
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
  },
  grandfather_clock: {
    title: 'Grandfather Clock',
    text: 'A longcase clock at the end of the hall. The pendulum hangs still. The case door is shut.',
  },
  fireplace: {
    title: 'Parlor Fireplace',
    text: 'A brick hearth under a heavy timber mantel. There is a fire in it — burning low and steady in a house no one has lived in for years.',
  },
  radio: {
    title: 'Tube Radio',
    text: 'A wooden cabinet radio on a side table. The dial is turned to a station near the bottom of the band.',
  },
  dining_table: {
    title: 'Dining Table',
    text: 'A long mahogany table set for no one. One of the chairs lies on its back beside it, as if someone rose too quickly.',
  },
  sideboard: {
    title: 'Sideboard',
    text: 'A heavy carved sideboard. The doors are closed, the wood swollen with damp.',
  },
  writing_desk: {
    title: 'Writing Desk',
    text: 'A pedestal desk beneath the boarded window. A sheet of paper lies on the blotter, curled at the corners.',
  },
  bookshelf: {
    title: 'Bookshelves',
    text: 'Two cases of books, several shelves half-emptied. The spines that remain are cracked and water-stained.',
  },
  dresser: {
    title: 'Bedroom Dresser',
    text: 'A chest of drawers with a small lamp on top. One drawer sits slightly open.',
  },
  wardrobe: {
    title: 'Wardrobe',
    text: 'A tall carved wardrobe with one door standing open. Something still hangs inside.',
  },
  bed: {
    title: 'Bed',
    text: 'A bare bedstead and a stained mattress. The blanket has been dragged half onto the floor.',
  },
  dagon_idol: {
    title: 'Fish-Headed Idol',
    text: 'A squat figure of green-black stone, no taller than a hand-span, hunched on its haunches with webbed hands on its knees. Its head is a fish\'s, wide-mouthed and crested. Half of it has sheared away; the pieces lie beside it on the table.',
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
