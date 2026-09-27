/**
 * The derelict Innsmouth house — a first-person walkthrough built in Summer
 * Engine (~/dev/my-summer-game) and exported to /innsmouth-house.glb by
 * `tools/export_house.sh` in that project.
 *
 * The model marks every examinable object with a node named `Examine_<id>`;
 * the viewer looks the id up here. An `Examine_*` node with no entry below is
 * still walkable, just not examinable, and an entry with no node is ignored —
 * so adding a clue is a two-step change: name the node in Summer, add it here.
 *
 * The text is deliberately physical description only. It is the GM's to
 * replace with the campaign's actual clues.
 */

export const HOUSE_MODEL = '/innsmouth-house.glb';

export type Examinable = {
  title: string;
  text: string;
};

export const EXAMINABLES: Record<string, Examinable> = {
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
  family_portraits: {
    title: 'Family Portraits',
    text: 'Four frames hung above the sofa, the glass fogged with grime. The faces behind it are hard to make out.',
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
 * Objects that hurt to look at. While the investigator looks straight at one,
 * the view blurs, deepening the longer they stare; it clears once they look
 * away or walk off. Keyed like EXAMINABLES, on the model's `Examine_<id>` nodes.
 */
export type GazeHazard = {
  /** How far off-centre (beyond the object's own outline) still counts as looking at it. */
  angleDeg: number;
  /** Beyond this distance, in metres, it has no hold. */
  range: number;
  /** Blur at full strength, in CSS pixels. */
  maxBlurPx: number;
  /** Seconds of staring to reach full strength. */
  onsetSec: number;
  /** Seconds for the view to clear after looking away. */
  recoverSec: number;
};

export const GAZE_HAZARDS: Record<string, GazeHazard> = {
  dagon_idol: { angleDeg: 3, range: 5, maxBlurPx: 8, onsetSec: 2.5, recoverSec: 0.8 },
};
