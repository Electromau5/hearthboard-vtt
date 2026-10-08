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

import type { HeldModel } from './held-items';
import type { TimeOfDay } from './weather';

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
  /** Skill attempts the object rewards. Hidden among all the others in the skill panel — the players must find them. */
  checks?: ObjectCheck[];
};

/**
 * What a skill roll turns up at an examinable. The investigator can try any
 * skill on any object, and the skill panel lists them all alike unless the
 * player switches it to "Suggested", which lists just these; the roll's
 * degree of success picks which text appears. A skill with no entry here
 * gets a generic "nothing more to find".
 */
export type ObjectCheck = {
  /** As the CoC catalogue names it ('Spot Hidden', 'Science (Biology)'), a characteristic ('STR'), or 'Luck'. */
  skill: string;
  /** What the attempt is ("Search the blotter") — a note for the GM; players never see it, even with suggested skills on. */
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

/**
 * One block of a model, built up out of boxes. Coordinates are metres from
 * the foot of the piece, which stands on the model's base: x east, y up, z
 * south. `rot` is in degrees, applied X, then Y, then Z.
 */
export type ModelBox = {
  size: Vec3;
  at: Vec3;
  rot?: Vec3;
  mat: 'basalt' | 'verdigris' | 'paper';
};

export type ModelPiece = {
  id: string;
  /** "the Great Door", for "set the Great Door into the model". */
  title: string;
  boxes: ModelBox[];
  /** Where it fits: metres from the centre of the base's top, and its turn about the vertical (a multiple of 15°). */
  slot: { x: number; z: number; yawDeg: number };
  /** A piece that looks the same turned this far (180 for a plain slab) fits either way round. */
  symmetryDeg?: number;
  /**
   * Lying loose on the model's table from the start, or somewhere else for
   * the investigators to find and bring back (`POST { action: 'find' }`).
   */
  source: 'table' | 'elsewhere';
  /** Where a loose piece lies on the table's margin, from the base's centre, before anyone moves it. */
  loose?: { x: number; z: number; yawDeg: number };
};

/**
 * A model to put together on a table (the architect's R'lyeh): E opens a
 * close-up of the tabletop where the pieces are dragged into their slots.
 * Progress is the party's, shared through `/api/models/<id>`; the level draws
 * the placed pieces on the real table.
 */
export type ModelBuild = {
  /** Shared-state key, `/api/models/<id>`. */
  id: string;
  /** The centre of the base's top in level coordinates, and the base's width (X) and depth (Z). */
  base: { at: Vec3; size: [number, number] };
  /** The tabletop round the base, whose margin holds the loose pieces: width, depth, and how far below the base's top it lies. */
  table: { size: [number, number]; drop: number };
  pieces: ModelPiece[];
  /** Fixed stones that came with the base, drawn but not moved. */
  rubble: ModelBox[];
  /** Shown in the builder's header when every piece is in place. */
  completeText: string;
};

/** What `/api/models/<id>` keeps: the ids of the pieces in place and of those found elsewhere. */
export type ModelState = { placed: string[]; found: string[] };

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
 * examinable's furniture in the walkthrough, on the floor, or out of sight
 * inside something else (`in`).
 */
export type Inspectable = {
  /** The .glb under public/. Empty nodes named "Clue_<id>" mark where each clue sits, local +Z out of the surface. */
  model: string;
  /** The examinable whose top it stands on. Without it, the model stands on the floor at `at`. */
  on?: string;
  /**
   * Hidden inside another examinable or inspectable, and not drawn in the
   * level: its card (or viewer) offers `action` as a button that brings this
   * one out. `after` holds the button back until that clue of the container is found.
   */
  in?: { from: string; action: string; after?: string };
  /** World X and Z on the floor, for a model with no `on`. Its y=0 is set on the floor there. */
  at?: [number, number];
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
   * Shows only at a glancing angle — writing pressed into paper, read by
   * tilting it until the light rakes across the dents.
   */
  raking?: boolean;
  /**
   * What is on the surface: `stamp` is lettering pressed into metal, with a
   * ringed sigil above it; `print` is a smeared thumbprint, with any lines
   * scrawled beneath it; `gouge` is a run of pry-bar bites in a wooden edge, or
   * with `lines`, letters cut in and then gouged out; `writing` is the lines in
   * `style`. With no mark, the clue is already in the model's own texture or
   * shape and the marker only says where to look.
   */
  mark?: { kind: 'stamp' | 'print' | 'gouge' | 'writing'; lines?: string[]; style?: 'ink' | 'pencil' | 'carved' | 'stencil' };
  /** The decal's width and height in metres. */
  size: [number, number];
};

/**
 * A piece of furniture from its own .glb, set down in a level that was built
 * without it: it stands on the floor, blocks like the level's own furniture,
 * and is examined (card, skill checks and all) through the examinable of the
 * same id. Inspectables can stand `on` it.
 */
export type Prop = {
  /** The .glb under public/: its origin at the foot of the piece, its front facing +Z. */
  model: string;
  /** World X and Z of its foot; it stands on the floor there. */
  at: [number, number];
  /** Turn about the vertical: 0 faces +Z, 90 faces +X. */
  turnDeg?: number;
  /** Height of the storey it stands on, for an upper floor. Default 0. */
  floorY?: number;
};

/**
 * A safe to crack: while it is locked, E turns its dial (SafeCracker) — marks
 * round the rim, a pip running round them, E to set each tumbler as the pip
 * crosses its mark, all of them before the clock runs out. Once it is open it
 * is open for the whole party (`/api/locks`), and E reads `opened` instead
 * of the examinable. Keyed like `examinables`.
 */
export type SafeLock = {
  /** Fewest and most marks on the dial, picked afresh each attempt. Default [3, 5]. */
  points?: [number, number];
  /** Seconds on the clock. Default 15. */
  seconds?: number;
  /** Width of each mark, in degrees of the dial. Default 26. */
  markDeg?: number;
  /** What E shows once it is open: what is inside. */
  opened: Examinable;
  /** What the prompt offers, locked and open, in place of "Crack the …" and "Look inside the …". */
  prompt?: { locked: string; open: string };
};

/** What `/api/locks` keeps for a level: the locks that are open, by examinable id. */
export type LocksState = Record<string, { by: string; at: number }>;

/**
 * A door gamelord opens and shuts for everyone in the level (`/api/doors`).
 * Its parts are cut out of the level's merged architecture when it loads
 * (src/app/components/level-door.ts): every triangle of `mesh` lying wholly
 * inside the box, in level coordinates.
 */
export type DoorCut = { mesh: string; min: Vec3; max: Vec3 };

export type LevelDoor = {
  /** What gamelord's button calls it: "Back door open" / "Back door shut". */
  label: string;
  /** The leaf, and anything fixed to it: swings open on `hinge`. */
  leaf: DoorCut[];
  /** A point on the upright line the leaf turns about. */
  hinge: Vec3;
  /** How far it opens, degrees; positive turns anticlockwise seen from above. */
  openDeg: number;
  /** Boards nailed across it: gone while it stands open… */
  boards?: DoorCut[];
  /** …and lying on the floor instead, [x, z, turnDeg] each, `size` metres (the thin side up). */
  fallen?: { size: Vec3; at: [number, number, number][] };
  /** The level's peeper looks through this door: while it stands open, there is nothing there. */
  hidesPeeper?: boolean;
};

/** What `/api/doors` keeps for a level: the doors standing open, by id. Unset means shut. */
export type DoorsState = Record<string, { open: boolean; setAt: number; setBy: string }>;

/**
 * Something lying on a piece of furniture that can be carried in the hand:
 * E picks it up (shown first-person, see held-items.ts), E on its empty place
 * puts it back, and picking up another sends the first back to its place.
 * Not inventory: it stays in the level.
 */
export type Pickup = {
  id: string;
  /** "the Tommy gun" reads as "Pick up the Tommy gun". */
  title: string;
  view: HeldModel;
  /** Where it lies: metres from the centre of the furniture's top along world X and Z, and its turn about the vertical. */
  at: [number, number];
  turnDeg?: number;
};

export type PickupTable = {
  /** The furniture's node name (any child of "Furniture", examinable or not). */
  on: string;
  /** Nodes inside it to hide — stand-ins the real models replace. */
  hide?: string[];
  items: Pickup[];
};

/**
 * A bed to sleep in: E lies down in it and the view fades out; E again wakes
 * and gets up beside it. Keyed by examinable id (the bed's "Examine_<id>").
 */
/**
 * A light switch on the wall outside a room: E switches the lamps it names
 * on or off, and with them the glow of their bulbs (emissive triangles near
 * those lamps). Its lamps start off. Per investigator: others' rooms stay as
 * they left them.
 */
export type LightSwitch = {
  id: string;
  /** The room it lights, as the prompt names it: "Records". */
  room: string;
  /** The "Lamp_<n>" nodes it works. */
  lamps: string[];
  /** Where it goes: a ray from `from` (level x, z) along `toward` (x, z) finds the wall. */
  from: [number, number];
  toward: [number, number];
  /** Height of its centre above the floor; 1.35 m if not given. */
  height?: number;
};

export type Bed = {
  /** The way the head lies from the middle of the bed — world X and Z, unit length. */
  head: [number, number];
  /** The side to get up on — world X and Z from the middle, unit length. */
  out: [number, number];
};

/** Birds that cross the level now and then (see birds.ts). */
export type Birds = {
  /** A rigged .glb facing +Z, with its flap as the first animation. */
  model: string;
  /** Times of day they fly. */
  times: TimeOfDay[];
  /** Seconds between flocks; each comes back the way the last one went. */
  everySec: number;
  /** How many in a flock, fewest and most. */
  count: [number, number];
  /** Metres from wingtip to wingtip. */
  wingspan: number;
  /** The point they cross over (world X and Z), and how high they fly, lowest and highest. */
  over: [number, number];
  height: [number, number];
  /** Short calls under public/, played from a bird now and then while a flock is overhead. */
  cries?: string[];
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
  /** Wall marks: a second liquid flung across the mark — brine sprayed over writing in blood, say. */
  splash?: 'blood' | 'brine';
  /** Wall marks: cast from `from` along `toward`; the mark is centred where it meets a wall. */
  wall?: { from: Vec3; toward: Vec3; size: [number, number]; turnDeg?: number };
  /** Floor marks: the trail's path, as [x, z] points in walking order. */
  floor?: [number, number][];
  /**
   * Height of the floor a floor mark lies on, for an upper storey. Default 0.
   * Or one height per point of `floor`, for a trail that goes down stairs.
   */
  floorY?: number | number[];
  /** For `prints`: how far the feet have changed at the trail's start and end, 0 a man's … 1 webbed and clawed. Default [0, 1]. */
  feet?: [number, number];
  /** For `handprint`: a webbed, clawed hand instead of a man's. */
  webbed?: boolean;
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

/**
 * A creature that roams the level on its own, finds its way between floors,
 * and hunts the investigator once it sees them (src/app/components/hunter.ts).
 * It sees you `sightLit` metres off when you stand in lamplight in front of it,
 * from any distance when your torch beam falls on it, `sightDark` metres off
 * in the dark — always with a clear line between you — and it may hear you
 * (`hear`). Its blows leave marks on the screen; they do no harm yet.
 * Everyone in the level sees the same one: one client leads it.
 */
export type Hunter = {
  /** A .glb under public/ whose figure faces +Z, with a walk-in-place clip and an attack clip. */
  model: string;
  walkClip: string;
  attackClip: string;
  /** Where it starts, in level metres; it learns the floors from here. */
  start: Vec3;
  /** Metres per second at the walk clip's natural pace, and when it closes in. */
  walkSpeed: number;
  chaseSpeed: number;
  sightLit: number;
  /** Its own noise, looped and heard from where it stands. */
  sound?: string;
  /** Played over everything while it chases you; it fades away after it gives up. */
  chaseMusic?: string;
  /**
   * Its map of the walkable floor, baked by the hunter's `bake()` (a JSON file
   * under public/). Without one it maps the level live, which takes a while.
   */
  nav?: string;
  /** It never climbs above this height: keeps it below ground, say. */
  ceiling?: number;
  /** Metres off it sees you in the dark, if you are in front of it — eyes made for the deep. */
  sightDark?: number;
  /** Metres off it hears you walk and run (crouched, or standing still, you make no sound); it comes to look. */
  hear?: { walk: number; run: number };
  /** Now and then it roams toward wherever someone is in its reach, as if it smelt them. 0..1, how often. */
  scent?: number;
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
  /** Attribution for a third-party model (CC-BY), shown in a corner whenever the walk is paused. */
  credit?: string;
  examinables: Record<string, Examinable>;
  gazeHazards?: Record<string, GazeHazard>;
  radios?: Record<string, RadioSet>;
  peeper?: Peeper;
  collections?: Record<string, Collection>;
  pinboard?: Pinboard;
  typewriters?: Record<string, Typewriter>;
  /** Models to put together, keyed by the examinable whose E opens the builder. */
  builders?: Record<string, ModelBuild>;
  /** Pins stuck into the map at the "MapFace" node; `size` is the map's width and height in metres. */
  mapPins?: { size: [number, number]; pins: MapPin[] };
  photoFrames?: PhotoFrames;
  /** People to talk to. */
  npcs?: NpcSpot[];
  /** Figures that walk loops and ignore the investigators. */
  wanderers?: Wanderer[];
  /** Something that hunts the investigators. */
  hunter?: Hunter;
  /** Stains for the Wood's lamp to find. A level without them has no lamp to draw. */
  uvStains?: UvStain[];
  /** Safes to crack, keyed by examinable id. */
  locks?: Record<string, SafeLock>;
  /** Doors gamelord opens and shuts for everyone, by id. */
  doors?: Record<string, LevelDoor>;
  /**
   * The sewer under the derelict house (src/app/components/sewer.ts), built
   * out from `at`: the doorway that leads down to it, at its outer face and
   * floor level, with the house behind it along +Z.
   */
  sewer?: {
    at: Vec3;
    /**
     * The id (in `examinables` and `locks`) of the padlock on the door walling
     * off the shrine of Dagon. The door opens once the padlock is cracked.
     */
    shrineLock?: string;
  };
  /** Furniture from outside the level's model, keyed by examinable id. */
  props?: Record<string, Prop>;
  /** Objects to pick up and turn over, keyed by examinable id. */
  inspectables?: Record<string, Inspectable>;
  /**
   * Examinables with no furniture of their own — a window frame, a patch of
   * wall: an invisible box, in level coordinates, that E examines.
   */
  spots?: Record<string, { min: Vec3; max: Vec3 }>;
  /** Things lying on furniture to carry in the hand. */
  pickups?: PickupTable[];
  /** The GM can set the time of day here (src/lib/weather.ts); night is `atmosphere` as built. List the id in WEATHER_LEVELS too. */
  weather?: boolean;
  birds?: Birds;
  /** Beds to sleep in, keyed by examinable id. */
  beds?: Record<string, Bed>;
  /**
   * A dream to have in those beds: a Godot web build (my-summer-game,
   * `web/dream_ocean.gd`) shown over the level once the investigator is
   * asleep. It ends by itself and wakes them; E wakes them sooner.
   */
  dream?: string;
  /**
   * A light at every "Lamp_<n>" node — bare bulbs and hanging shades. `only`
   * gives particular lamps, keyed by node name, their own colour, strength or
   * reach: the cold white of an operating lamp among warm bulbs.
   */
  lamps?: {
    color: number; intensity: number; distance: number;
    only?: Record<string, Partial<{ color: number; intensity: number; distance: number }>>;
  };
  /** Switches by room doors: the lamps each one names start dark, and E flips them. */
  lightSwitches?: LightSwitch[];
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
