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
 *   * a "Furniture" child named by `photoFrames.node` (optional) holds the
 *     empty frames `photoFrames` mounts photographs in
 * Anything else in the model renders but never collides.
 */

export type Examinable = {
  title: string;
  text: string;
  /** A picture under public/ shown on the reading card, above the text. */
  image?: string;
  /**
   * Something lying flat on top of the object — a letter on a table — so it
   * can be spotted before it is examined. Drawn at the centre of the object's
   * top surface from a crop of `src`.
   */
  lying?: {
    src: string;
    /** The part of `src` to draw, in its pixels: [x, y, width, height]. */
    crop: [number, number, number, number];
    /** Width in metres; the height follows the crop's proportions. */
    width: number;
    /** Turn about the vertical, in degrees. */
    turnDeg?: number;
  };
  /** Skill attempts the object rewards — offered first when the investigator uses a skill on it. */
  checks?: ObjectCheck[];
};

/**
 * What a skill roll turns up at an examinable. The investigator can try any
 * skill on any object; these are the ones written for it, and the roll's
 * degree of success picks which text appears. A skill with no entry here
 * gets a generic "nothing more to find".
 */
export type ObjectCheck = {
  /** As the CoC catalogue names it ('Spot Hidden', 'Science (Biology)'), a characteristic ('STR'), or 'Luck'. */
  skill: string;
  /** What the attempt is, shown beside the skill: "Search the blotter". */
  action: string;
  /** Degree of success needed to pass. Default 'Regular'. */
  difficulty?: 'Regular' | 'Hard' | 'Extreme';
  success: string;
  failure: string;
  /** A hard success — more than a plain pass reveals. Falls back to `success`. */
  hard?: string;
  /** An extreme or critical result — the most there is to find. Falls back to `hard`, then `success`. */
  extreme?: string;
  /** A fumble, or failing a pushed roll. Falls back to `failure`. */
  fumble?: string;
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

/**
 * An examinable the investigator can type at — the Archive's typewriter. E
 * opens a sheet of paper; what is typed on it is handed to `pin` along with
 * who typed it. Keyed like `examinables`.
 */
export type Typewriter = {
  /** Longest note it takes, in characters. */
  maxLength: number;
  /** Files the typed note; rejects if it could not be saved. */
  pin: (text: string, author: string) => Promise<void>;
  /** Button label, e.g. "Pin to case board". */
  pinLabel: string;
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

/**
 * A photograph mounted in one of the frames, on a mat. Examining it opens the
 * photograph. The opening is measured in the frame mesh's local space.
 */
export type FramedPhoto = Examinable & {
  id: string;
  image: string;
  /** Centre of the opening inside the moulding, just proud of the backing. */
  center: Vec3;
  /** Width and height of that opening, in local units. */
  size: [number, number];
};

/**
 * Photographs set into frames that were modelled empty — the frames are one
 * mesh, so the openings are measured rather than marked. Each photograph is
 * examinable on its own; the frames' node stops being examinable as a whole.
 */
export type PhotoFrames = {
  /** The "Furniture" child holding the frames' mesh. */
  node: string;
  /** The mesh's local axes pointing to the viewer's right, up, and out of the wall. */
  axes: { right: Vec3; up: Vec3; out: Vec3 };
  photos: FramedPhoto[];
};

/**
 * A stain that only shows under the Wood's lamp — the investigator's portable
 * ultraviolet lamp (Q). Blood absorbs ultraviolet, so it shows as a dark mark
 * on the violet-lit wall; brine's salts and slime fluoresce a pale green;
 * invisible ink (milk, lemon juice, laundry bluing) glows a cold blue-white.
 * None of them can be seen by torchlight. Once lit, a stain can be examined like
 * any other object.
 */
/**
 * A small object that can be picked up and turned over in the inspect viewer:
 * E on it opens the viewer instead of the reading card (its examinable gives
 * the viewer's title and intro). The model stands on top of another
 * examinable's furniture in the walkthrough.
 */
export type Inspectable = {
  /** The .glb under public/. Empty nodes named "Clue_<id>" mark where each clue sits, local +Z out of the surface. */
  model: string;
  /** The examinable whose top it stands on. */
  on: string;
  /** Metres from the centre of that top, along world X and Z. */
  offset?: [number, number];
  turnDeg?: number;
  /** Keyed by the marker's id: "stamp" for "Clue_stamp". */
  clues: Record<string, InspectClue>;
};

export type InspectClue = {
  title: string;
  /** Shown once found, and filed to the case board from there. */
  text: string;
  /** Shows only where the Wood's lamp shines. */
  uv?: boolean;
  /**
   * What is on the surface: `stamp` is lettering pressed into metal, with a
   * ringed sigil above it; `print` is a smeared thumbprint, with any lines
   * scrawled beneath it.
   */
  mark: { kind: 'stamp' | 'print'; lines?: string[] };
  /** The decal's width and height in metres. */
  size: [number, number];
};

export type UvStain = Examinable & {
  id: string;
  kind: 'blood' | 'brine' | 'ink';
  /**
   * The shape of the mark:
   *   * `handprint` — a hand pressed to the wall and slid down it
   *   * `spatter` — drops flung from a blow, with runs beneath the larger ones
   *   * `glyph` — a sign drawn with a wet finger
   *   * `writing` — `words` written on the wall, scrubbed at if `scrubbed`
   *   * `note` — `words` in a small, hurried hand: a message meant to be found
   *   * `prints` — a trail of bare footprints along `floor`, lengthening and
   *     webbing as they go
   *   * `drag` — something wet or bleeding dragged along `floor`
   */
  mark: 'handprint' | 'spatter' | 'glyph' | 'writing' | 'note' | 'prints' | 'drag';
  /** For `writing` and `note`: one string per line. */
  words?: string[];
  /** For `writing`: someone has tried to wipe it off, so only fragments stay legible. */
  scrubbed?: boolean;
  /** Wall marks: cast from `from` along `toward`; the mark is centred where it meets a wall. */
  wall?: { from: Vec3; toward: Vec3; size: [number, number]; turnDeg?: number };
  /** Floor marks: the trail's path, as [x, z] points in walking order. */
  floor?: [number, number][];
  /** Height of the floor a floor mark lies on, for an upper storey. Default 0. */
  floorY?: number;
};

/**
 * Someone in the level the investigator can talk to (E). They stand at the
 * model's `node` marker, facing its -Z, and turn to watch whoever comes near.
 * What they know and how they behave lives on the server (src/lib/npc-personas.ts),
 * keyed by `id`; so does what they remember about each investigator.
 */
export type NpcSpot = {
  id: string;
  /** The "Npc_<…>" marker they stand at. */
  node: string;
  name: string;
  /** Their look: a model or outfit key in src/app/components/avatars.ts. */
  outfit: string;
};

/**
 * A figure that walks a loop through the level and does nothing else: no
 * collision, nothing to examine, no reaction to players. Its model plays one
 * walk-in-place clip while the level moves it along a smooth closed curve
 * through `path`, facing the way it goes.
 */
export type Wanderer = {
  /** A .glb under public/ whose figure faces +Z. */
  model: string;
  /** The clip to loop. Default: the model's first. */
  clip?: string;
  /** [x, z] points of the loop, in walking order; it closes back to the first. */
  path: [number, number][];
  /** Metres per second — match the clip's stride, or the feet slide. */
  speed: number;
  /** Height of the floor it walks on. Default 0. */
  y?: number;
};

export type WalkthroughLevel = {
  /** Stable name for the level's live-presence room — investigators in the same level see each other. */
  id: string;
  model: string;
  /**
   * The level's Godot web build (my-summer-game, `web/walkthrough.tscn`), used
   * in place of the three.js viewer when the engine flag is on — see
   * `pickGodot` in WalkthroughModal.tsx. Only the walk, light and focus run in
   * Godot; every card and pane stays on the page.
   */
  godot?: string;
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
  typewriters?: Record<string, Typewriter>;
  /** Pins stuck into the map at the "MapFace" node; `size` is the map's width and height in metres. */
  mapPins?: { size: [number, number]; pins: MapPin[] };
  photoFrames?: PhotoFrames;
  /** People to talk to. */
  npcs?: NpcSpot[];
  /** Figures that walk loops and ignore the investigators. */
  wanderers?: Wanderer[];
  /** Stains for the Wood's lamp to find. A level without them has no lamp to draw. */
  uvStains?: UvStain[];
  /** Objects to pick up and turn over, keyed by examinable id. */
  inspectables?: Record<string, Inspectable>;
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
