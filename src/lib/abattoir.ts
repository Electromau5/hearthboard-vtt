/**
 * The Underworld Abattoir & Speakeasy, Federal Hill, Providence, October 1932 —
 * a first-person walkthrough level (see walkthrough.ts), built procedurally in
 * Summer Engine by `tools/build_abattoir_cli.gd` (~/dev/my-summer-game) and
 * exported to /abattoir.glb by `tools/export_abattoir.sh`.
 *
 * From the street it is a butcher's, Federal Hill Provisions. The way in to
 * the speakeasy is through the walk-in icebox, whose back shelf swings open on
 * the bar. Behind the bar are the back stairs, Tyler Banks's office and the
 * gents; off the street, a members' card room. Down the back stairs is the
 * slaughterhouse the Donato syndicate really runs the place for: the killing
 * floor and its pens, an interrogation room, rendering and the furnace, a
 * liquor cellar on the old rum tunnel, a counting room and the cold locker.
 *
 * Set after session 2: the party has drunk at this bar and delivered Miles's
 * envelope to Banks in his office. Nobody is here yet — the model marks where
 * people will stand (`Npc_*`: Banks at his desk, the barman, the butcher, the
 * dealer, a slaughterman) for when they are added. As in the other levels the
 * text is physical description for the GM to build clues on; the stains, the
 * Newburyport crate and the body in the locker go beyond what play has
 * established, and are the GM's to keep or cut.
 */

import type { Examinable, RadioSet, UvStain, WalkthroughLevel } from './walkthrough';

/** The slaughterhouse floor, below the street. */
const BY = -3.4;

const EXAMINABLES: Record<string, Examinable> = {
  // ── The shop ─────────────────────────────────────────────────────
  counter: {
    title: 'Butcher\'s Counter',
    text: 'A marble-topped counter over a glass case of cuts on a bed of parsley: chops, a rolled loin, a tray of liver going dark at the edges. Everything in the case is two days old. A heavy iron till at one end, its drawer locked; the paper roll has not been changed in a long time.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look over the counter',
        success: 'A bell push under the lip of the marble at the till end, worn shiny. A wire runs from it down through the floorboards, toward the icebox.',
        failure: 'A butcher\'s counter. The meat could be fresher.',
      },
    ],
  },
  scale: {
    title: 'Hanging Scale',
    text: 'A white enamel counter scale with a brass pillar and a dial marked to twenty pounds. The needle sits at a quarter pound with nothing on the pan.',
  },
  chopping_block: {
    title: 'Chopping Block',
    text: 'A round of maple worn into a dish by years of cleaver work, a cleaver left standing in it. The grain is black where blood has soaked in and never come out.',
  },
  price_board: {
    title: 'Price Board',
    text: 'TODAY, in chalk: chuck roast 14¢, pork loin 18¢, calves\' liver 11¢, Italian sausage 16¢, soup bones 3¢, tripe 8¢, dressed fowl 22¢ — per lb, NO CREDIT. The prices are a good deal cheaper than anywhere else on the Hill.',
  },
  false_shelf: {
    title: 'Shelf of Tins',
    text: 'At the back of the icebox, a tall shelf of tinned tomatoes and jars of pickled tongue — on iron hinges. It stands swung out from the wall, and behind it is a plain doorway, and beyond that, warm air, cigarette smoke and the sound of a piano.',
    checks: [
      {
        skill: 'Mechanical Repair', action: 'Look at the hinges',
        success: 'Heavy strap hinges, freshly greased, and a spring catch that drops into a slot in the floor when the shelf is shut. From the icebox side it would look like nothing at all. It latches from the bar side.',
        failure: 'Hinges. It swings.',
      },
    ],
  },
  tomato_crates: {
    title: 'Crates of Tomatoes',
    text: 'Crates stencilled PRODUCT OF ITALY — PEELED TOMATOES, stacked eight high. The top crate has been opened: under one layer of tins, straw, and in the straw, bottles of Canadian whisky with the labels soaked off.',
  },
  back_door: {
    title: 'Back Door',
    text: 'The stockroom\'s door to the alley, barred on the inside with an iron bar in two brackets. Deliveries come in here. The floor in front of it is scraped pale by crates dragged in, and by something heavier that went out on a hand truck.',
  },
  card_table: {
    title: 'Card Table',
    text: 'An octagonal table in green baize under a green-shaded lamp, five chairs round it. A hand of stud left dealt, chips in front of every seat, the biggest stack in front of the empty chair facing the door. Cigar ash in every saucer.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the cards',
        success: 'The deck is marked — a pinprick in the corner of every ace and face card, felt with a thumb. Whoever deals here does not lose.',
        failure: 'Cards, chips, ash.',
      },
    ],
  },

  // ── The speakeasy ────────────────────────────────────────────────
  bar: {
    title: 'The Bar',
    text: 'A long walnut bar with a brass foot rail, ringed white by a thousand glasses. Three beer taps that draw nothing — the beer comes in bottles from the cellar. Over the mirror behind it, in gold on black: NO CREDIT · NO NAMES · NO COPS. Here the investigators traded stories over drinks the night they delivered Miles\'s envelope.',
  },
  backbar: {
    title: 'Back Bar',
    text: 'Shelves of bottles either side of a smoked mirror: gin, rye, Canadian, a row of unlabelled bottles of something clear that is the house\'s own. A cash box under the counter, a sap beside it, and a sawn-off shotgun on two nails where the barman can reach it without looking.',
  },
  gramophone: {
    title: 'Gramophone',
    text: 'A cabinet gramophone at the end of the back bar with a stack of records beside it — Ellington, Armstrong, a scratched Bessie Smith. For when the band has gone home.',
  },
  corner_booth: {
    title: 'Corner Booth',
    text: 'The booth nearest the stage, high-backed, its leather split and mended with tape. It has the best view of both the bar and the way in, and nobody sits here unless asked. Tyler Banks sat across this table from the investigators when he leaned in and said he would tell them this just once.',
  },
  amazo_poster: {
    title: 'A Bill by the Stage',
    text: 'ONE NIGHT ONLY — AMAZO THE AMAZING. Escapes, illusions, mesmerism. "He Will See Into Your Very Soul!" A top hat over a pair of staring eyes, a fan of cards. Saturday, ten o\'clock, members only. The date has been torn off.',
    checks: [
      {
        skill: 'Occult', action: 'Look at the eyes',
        success: 'The printer has set the staring eyes inside a lattice of fine lines — angles within angles, drawn more carefully than anything else on the bill. Not a printer\'s flourish. A geometry you have seen in a book you would rather not have read.',
        failure: 'A cheap vaudeville bill.',
      },
    ],
  },
  piano: {
    title: 'Upright Piano',
    text: 'A battered upright, its lid scarred by cigarettes, three keys gone dull and dead. Sheet music on the stand: "Dinah", "Ain\'t Misbehavin\'", and a page of handwritten notes in a hand that is not a musician\'s.',
  },

  // ── The back ─────────────────────────────────────────────────────
  banks_desk: {
    title: 'Banks\'s Desk',
    text: 'A heavy desk under a green-shaded lamp, the lamp Banks read Miles\'s letter by. A telephone, a ledger bound in red, an ashtray full of the same brand. The blotter is clean; the waste basket is empty. The top drawer is locked.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the desk',
        success: 'Pressed into the blotter from a sheet written on top of it, in reverse: a time, "Thurs 2 a.m.", and "Fox Pt. — the Sisters will row out".',
        failure: 'The desk of a careful man.',
      },
      {
        skill: 'Accounting', action: 'Read the ledger',
        success: 'Two sets of books in one: the speakeasy\'s takings, honest enough, and a column of initials and amounts that only ever goes up. One set of initials, S.V., pays forty per cent of something every week.',
        failure: 'Columns of figures, mostly in a private shorthand.',
      },
    ],
  },
  office_photo: {
    title: 'Photograph',
    text: 'A framed photograph on the wall: a christening on the steps of Holy Ghost Church, a big family in their best, and in the middle an old man in a homburg with a hand on the shoulder of a younger one. The young man has been scratched out of it with something sharp.',
  },

  // ── The slaughterhouse ───────────────────────────────────────────
  empty_hook: {
    title: 'The Empty Hook',
    text: 'One hook on the rail with no carcass on it. Its chain has been let down to the height of a man, and a leather harness hangs from it — straps for the wrists, buckled, cut through rather than undone.',
    checks: [
      {
        skill: 'Medicine', action: 'Look at the straps',
        success: 'The leather is stretched and stained where wrists pulled against it, for a long time. Whoever hung here was alive, and was cut down rather than let down.',
        failure: 'Old leather, dark with something.',
      },
    ],
  },
  scalding_vat: {
    title: 'Scalding Vat',
    text: 'A steel tank on a gas burner for scalding hogs before they are scraped, the water grey under a skin of scum. The burner is still warm. A long paddle leans against it.',
  },
  knocking_pen: {
    title: 'Knocking Pen',
    text: 'A narrow steel pen where the animals are stunned before the hook, a captive-bolt gun hanging on its post. The pen is the width of a cow, and of a man.',
  },
  dressing_table: {
    title: 'Dressing Table',
    text: 'A steel table with a lip and a drain hole, saws and a cleaver laid out on it, a square of canvas folded over something at one end. It has been hosed down, not cleaned.',
  },
  pen_shackle: {
    title: 'The Third Pen',
    text: 'The last pen along the wall has an iron staple driven into the brick at waist height and a chain run from it to a cuff — a cuff sized for a wrist, not a fetlock. A horse blanket on the straw, an enamel cup. Someone was kept here, and fed.',
  },
  bolted_chair: {
    title: 'The Chair',
    text: 'A heavy oak chair bolted to the floor through iron plates, leather straps at the wrists and ankles. A drain in the concrete in front of it. The bare bulb above hangs low enough to feel its heat on your face if you sit.',
    checks: [
      {
        skill: 'Science (Forensics)', action: 'Read the floor',
        success: 'The concrete round the chair has been scrubbed with lye so often it has gone white and rough — and still the drain smells. Teeth have been knocked out here; there is one in the drain grating, a gold crown on it.',
        failure: 'Scrubbed concrete and a drain.',
      },
    ],
  },
  tool_tray: {
    title: 'Tool Tray',
    text: 'A steel trolley of tools that have nothing to do with butchery: pliers, a ball-peen hammer, a length of rubber hose, a dentist\'s probe, a car battery\'s cables coiled neatly at one end.',
  },
  debts_slate: {
    title: 'Slate on the Wall',
    text: 'A school slate screwed to the wall, OWING chalked at the top. DeLuca $140. Fat Sal $60 — crossed out. O\'Rourke $1,100. The Greek $75 — crossed out. Vance 40%. Pacheco $320 — crossed out. Kowalski $90. Nobody here was crossed out because they paid.',
  },
  furnace: {
    title: 'Furnace',
    text: 'A brick incinerator built against the cellar wall, its iron door glowing at the seams. The heat is enormous. The ash pan has been raked out recently; what is left in it is grey and fine and, here and there, not ash.',
    checks: [
      {
        skill: 'Science (Biology)', action: 'Sift the ash',
        success: 'Among the cinders, the small bones of a hand, calcined white and crumbling, and a button with four holes. Not a pig.',
        failure: 'Ash and clinker.',
      },
    ],
  },
  rendering_kettle: {
    title: 'Rendering Kettle',
    text: 'A steel kettle the size of a bathtub stood on end, a scum of fat set hard on top. Rendering for lard and tallow, the sign says. A paddle stands in it, set fast.',
  },
  bone_bin: {
    title: 'Bone Bin',
    text: 'A crate of bones for the glue man, sawn and boiled clean. Shin bones, ribs, a pig\'s skull. Most of them are what they should be.',
  },
  liquor_crates: {
    title: 'Liquor Crates',
    text: 'Crates of bottles stacked to the joists — gin, rye, champagne with Montreal labels — and barrels on their sides in racks. Enough to run the bar above for a month, and to put everyone here in the Atlanta penitentiary.',
  },
  tunnel_grate: {
    title: 'The Old Tunnel',
    text: 'An arch in the cellar\'s south wall, older than the building, closed by an iron grate with a new padlock and chain. Beyond it a brick tunnel runs off under the street, black water standing on its floor. The air coming through is cold and smells of the river and, under that, of fish.',
    checks: [
      {
        skill: 'History', action: 'Think about the tunnel',
        success: 'Providence was a smuggling town before it was anything else. Tunnels like this ran from the merchants\' cellars down to the river at Fox Point — slaves, molasses, rum. A boat could come up it, at high water.',
        failure: 'An old drain, or a cellar passage.',
      },
      {
        skill: 'Locksmith', action: 'Look at the padlock',
        success: 'New, good, and opened often — the shackle is bright where it slides. But the chain is fastened through the grate from the tunnel side as well. Someone wants it shut against whatever comes the other way.',
        failure: 'A good padlock.',
      },
    ],
  },
  assay_table: {
    title: 'The Counting Room',
    text: 'A table with a jeweller\'s balance under a glass case, a set of brass weights, a loupe and a ledger. A single small coin of pale gold beside the balance, unstamped. Whatever is weighed here is not money.',
    checks: [
      {
        skill: 'Appraise', action: 'Weigh the gold',
        success: 'Too pale for good gold and too heavy for bad: an alloy you do not know, with a greenish sheen in the cuts. The ledger lists weights in ounces against dates, and against each, "N\'port".',
        failure: 'Gold, of a sort.',
      },
    ],
  },
  newburyport_crate: {
    title: 'Crate from Newburyport',
    text: 'A crate stencilled NEWBURYPORT — FISH MEAL, its lid prised off and leant against it. Packed in straw is a tall, pale-gold crown, too tall and too narrow for a human head, worked all over with fishes and waves in a style nobody here could put a name to.',
  },
  order_mark: {
    title: 'Mark over the Door',
    text: 'Scratched into the plaster above the counting room door: a fish, crudely drawn, over three wavy lines. Beside it, a tally of fifteen strokes and the word "N\'port" in pencil.',
    checks: [
      {
        skill: 'Occult', action: 'Recognise the mark',
        success: 'You have seen it before, or something like it, in the notes the last team left: a sign of the Esoteric Order of Dagon. Whoever scratched it here wanted the people who come to this room to know whose goods they are.',
        failure: 'A fish. Somebody\'s idea of a joke, in a slaughterhouse.',
      },
    ],
  },
  sheeted_body: {
    title: 'Under a Sheet',
    text: 'Three concrete slabs in the cold locker. On two of them, something long under a sheet stiff with frost. A grey hand has slipped from under the nearer one; the skin between two of its fingers runs further toward the tips than it should.',
  },

  // ── Banks's safe (a prop, below) ────────────────────────────────
  iron_safe: {
    title: 'Banks\'s Safe',
    text: 'An old iron safe in the corner of the office, its paint worn through at the dial. The kind of safe a man keeps where he can watch it from his desk.',
  },
};

/**
 * Glimpsed only by the Wood's lamp: what has been scrubbed away down here, and
 * what has come in by the tunnel.
 */
const UV_STAINS: UvStain[] = [
  {
    id: 'uv_drag_to_furnace', kind: 'blood', mark: 'drag',
    // From the chair, through the door, to the furnace.
    floor: [[-9.0, 4.7], [-8.0, 4.9], [-6.8, 5.0], [-5.6, 5.1], [-4.5, 5.8], [-3.4, 6.4], [-3.0, 6.6]],
    floorY: BY,
    title: 'A Drag Mark',
    text: 'Scrubbed out of sight but not out of the concrete: a broad smear, glowing under the lamp, from the bolted chair, through the doorway, to the furnace door. It has been laid down more than once, the trails on top of one another.',
  },
  {
    id: 'uv_tunnel_hands', kind: 'brine', mark: 'handprint', webbed: true,
    wall: { from: [4.4, BY + 1.3, 7.0], toward: [0, 0, 1], size: [0.4, 0.6] },
    title: 'Hands by the Grate',
    text: 'Beside the tunnel grate, salt-water handprints glow on the brick: long-fingered, webbed to the last knuckle, pressed flat as though something stood here and leant its weight on the wall while it waited for the grate to be opened.',
  },
];

const RADIOS: Record<string, RadioSet> = {
  gramophone: { src: '/speakeasy-1.mp3', volume: 0.7, refDistance: 2.5 },
};

export const ABATTOIR_LEVEL: WalkthroughLevel = {
  id: 'abattoir',
  model: '/abattoir.glb',
  title: 'The Underworld Abattoir & Speakeasy · Providence',
  loadingText: 'Ringing the shop bell…',
  errorText: 'The abattoir could not be loaded.',
  enterText: 'Click to step inside',
  leaveLabel: 'Leave by the shop',
  credit: '"Antique Iron Safe" by pixelgrapher — CC BY 4.0',
  examinables: EXAMINABLES,
  radios: RADIOS,
  uvStains: UV_STAINS,
  // In the corner of Banks's office, where he can watch it from his desk.
  placements: [{ asset: 'iron-safe', id: 'iron_safe', at: [11.55, -3.2], turnDeg: -90 }],
  // Cracked by the dial game (SafeCracker). What is inside is a placeholder for the GM.
  locks: {
    iron_safe: {
      opened: {
        title: 'Banks\'s Safe — Open',
        text: 'Bundles of banknotes in paper bands, a snub revolver, and a long envelope of photographs — men in hotel rooms who would pay a great deal not to be seen there. Under them, a list of addresses in Banks\'s hand. One has been underlined twice.',
      },
    },
  },
  // Shaded pendants over the bar, the floor and the shop; a red one on the stage; green
  // shades over the cards, Banks's desk and the counting table; bare bulbs downstairs.
  lamps: {
    color: 0xffcf8a, intensity: 5.5, distance: 10,
    only: {
      Lamp_stage: { color: 0xff6040, intensity: 3.0, distance: 6 },
      Lamp_cards: { color: 0xf2ffd0, intensity: 2.6, distance: 5 },
      Lamp_banks: { color: 0xf2ffd0, intensity: 1.6, distance: 4 },
      Lamp_counting: { color: 0xf2ffd0, intensity: 2.4, distance: 5 },
      Lamp_kill_w: { color: 0xe6eeff, intensity: 3.6, distance: 8 },
      Lamp_kill_e: { color: 0xe6eeff, intensity: 3.6, distance: 8 },
      Lamp_interrogation: { color: 0xffffff, intensity: 4.0, distance: 5 },
      Lamp_stairfoot: { color: 0xffe0b0, intensity: 1.4, distance: 5 },
      Lamp_stairs: { color: 0xffe0b0, intensity: 1.6, distance: 5 },
    },
  },
  // The rendering furnace, glowing through its door.
  fires: [{ examineId: 'furnace', at: b => [(b.min.x + b.max.x) / 2, b.min.y + 0.9, b.min.z - 0.4] }],
  atmosphere: {
    background: 0x030303,
    fogColor: 0x0a0806,
    fogDensity: 0.05,
    sky: 0x5a5048,
    ground: 0x0d0907,
    fill: 0.34,
    // Moonlight through the shop windows from the street.
    moon: { color: 0x9fb4d8, intensity: 0.7, position: [-6, 14, 40] },
  },
};
