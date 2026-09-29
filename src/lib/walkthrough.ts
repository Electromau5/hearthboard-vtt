/**
 * A first-person walkthrough level for <WalkthroughModal>: a Summer-built .glb
 * plus the text and atmosphere the viewer needs. Each level lives in its own
 * module (innsmouth-house.ts, fishing-vessel.ts).
 *
 * The model contract, shared by every level:
 *   * meshes under a node named "Architecture" are walked on and collided with
 *   * each child of "Furniture" is an obstacle; one named "Examine_<id>" is
 *     examinable, its text looked up in `examinables[id]`
 *   * "PlayerStart" marks where the investigator enters, facing its -Z
 *   * "Peephole" (optional) marks a hole something can look through, facing
 *     its -Z into the level — see `peeper`
 *   * "Lamp_<n>" (optional) empties are where `lamps` hangs a light
 *   * "Pinboard" (optional) marks the centre of a board, facing its -Z out of
 *     the wall, that `pinboard` covers with live notes
 *   * "MapFace" (optional) marks the centre of a wall map, facing its -Z out of
 *     the wall, that `mapPins` sticks pins into
 * Anything else in the model renders but never collides.
 */

export type Examinable = {
  title: string;
  text: string;
};

/**
 * An object that hurts to look at. While the investigator looks straight at
 * one, the view blurs, deepening the longer they stare; it clears once they
 * look away or walk off. Keyed like `examinables`.
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

/**
 * An examinable that plays music: E switches it on and off (clicking still
 * examines it). The sound comes from the object, fading with distance, and is
 * band-limited so it sounds like it is coming out of an old speaker. Keyed
 * like `examinables`.
 */
export type RadioSet = {
  /** Audio file under public/, looped while the set is on unless `loop` is false. */
  src: string;
  /** false for a one-off broadcast: it plays from the start each time the set
   *  is switched on, and the set switches itself off when it ends. Default true. */
  loop?: boolean;
  /** 0..1 at the reference distance. */
  volume: number;
  /** Metres at which the sound is at full volume; it falls off beyond. */
  refDistance: number;
};

/**
 * Something outside that keeps looking in through the model's "Peephole": it
 * slides into view behind the hole, its eye following the investigator, then
 * withdraws, and comes back a few seconds later.
 */
export type Peeper = {
  /** Seconds between looks, [min, max]. */
  gapSec: [number, number];
  /** Seconds each look lasts once it is in place, [min, max]. */
  holdSec: [number, number];
  /** It stays away while the investigator is closer to the hole than this, in metres. */
  shyWithin: number;
};

/** One entry in a collection: a document, file, photograph or piece of kit. */
export type ArchiveDoc = {
  id: string;
  title: string;
  /** Provenance, or who is carrying it. */
  meta?: string;
  text?: string;
  image?: string;
  video?: string;
  audio?: string;
};

/**
 * An examinable that holds many things — a filing cabinet, a shelf of boxes, a
 * gun rack. E opens a browser of its contents instead of the reading card; the
 * examinable's own text becomes the browser's introduction. Keyed like
 * `examinables`.
 */
export type Collection = {
  /** Called every time it is opened, so it shows the campaign as it is now. */
  load: () => Promise<ArchiveDoc[]>;
  /** Shown when `load` returns nothing. */
  emptyText: string;
};

/** A note pinned to the level's "Pinboard". `x`/`y` are in any units — the layout is scaled to fit. */
export type PinNote = {
  id: string;
  x: number;
  y: number;
  /** A typed heading: the note is drawn as an index card instead of a handwritten note. */
  title?: string;
  text?: string;
  image?: string;
  caption?: string;
  /** Paper colour, CSS. */
  color?: string;
  rotation?: number;
  /** Size in the same units as x/y; defaults to the case board's note or picture size. */
  w?: number;
  h?: number;
};

/**
 * A board in the level that shows notes kept elsewhere (the case board): they
 * are fetched when the level opens and refetched while it stays open, so a note
 * added on the board appears on the wall.
 */
export type Pinboard = {
  /** Width and height of the pinnable area, in metres. */
  size: [number, number];
  load: () => Promise<{ notes: PinNote[]; threads: { from: string; to: string; color: string }[] }>;
  refreshSec: number;
};

/** A pin in a wall map: examining it (E) reads out that place's summary. */
export type MapPin = {
  id: string;
  title: string;
  text: string;
  /** Position on the map, 0..1 from its left and top edges. */
  u: number;
  v: number;
};

type Vec3 = [number, number, number];

export type WalkthroughLevel = {
  model: string;
  /** Header, e.g. "The Derelict House · Innsmouth". */
  title: string;
  /** Progress line while the model streams in, before the percentage. */
  loadingText: string;
  errorText: string;
  /** Prompt before the first click takes pointer lock. */
  enterText: string;
  /** Accessible label for the close button. */
  leaveLabel: string;
  examinables: Record<string, Examinable>;
  gazeHazards?: Record<string, GazeHazard>;
  radios?: Record<string, RadioSet>;
  peeper?: Peeper;
  collections?: Record<string, Collection>;
  pinboard?: Pinboard;
  /** Pins stuck into the map at the "MapFace" node; `size` is the map's width and height in metres. */
  mapPins?: { size: [number, number]; pins: MapPin[] };
  /** A light at every "Lamp_<n>" node — bare bulbs and hanging shades. */
  lamps?: { color: number; intensity: number; distance: number };
  atmosphere: {
    background: number;
    fogColor: number;
    fogDensity: number;
    /** Hemisphere fill: sky colour, ground colour, intensity. */
    sky: number;
    ground: number;
    fill: number;
    /** Optional shadow-casting moonlight from `position` toward the origin. */
    moon?: { color: number; intensity: number; position: Vec3 };
  };
  /**
   * Flickering firelight anchored to an examinable's bounds — the house's
   * hearth. `at` gets the object's world bounds and returns the light position.
   */
  fires?: { examineId: string; at: (box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) => Vec3 }[];
};
