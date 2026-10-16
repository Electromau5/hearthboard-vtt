/**
 * The Cellars, Innsmouth: a bootlegger's cellar under a shuttered Marsh fish
 * shop, and the older chamber hidden behind its preserve shelves, as a
 * first-person walkthrough level (see walkthrough.ts) on the Innsmouth map's
 * Cellars pin. ~/dev/my-summer-game `tools/build_cellars.py` (Blender) builds it
 * from scratch and `tools/export_cellars.sh` exports it to /innsmouth-cellars.glb;
 * `tools/render_cellars.py` renders check pictures and `tools/walk_cellars.py`
 * walks its routes on the walkthrough's collision rules.
 *
 * Coordinates are metres; north is -Z. The investigator comes in in the shop's
 * back room (floor y 2.6, x 0.4..3.5, z -1.4..4.2), where the cellar trapdoor
 * stands open over a steep stair down the east wall (x 2.5..3.5). The cellar
 * (x -3.5..3.5, z -2.5..2.5, ceiling 2.3) holds a pot still on its firebox in
 * the north-west corner, a rack of barrels on the north wall, a bottling table
 * in the middle and crates of "sardines" on the south wall. Preserve shelves
 * stand on the west wall; the bay at z 0.7..1.7 is a door, padlocked at its
 * free edge (`locks.shelf_padlock`), that swings out into the cellar once the
 * padlock is cracked (`doors.shelf_door`). Behind it a passage through the old
 * foundation steps down to the chamber (x -8.6..-5.0, z -0.6..3.0, floor
 * y -0.36): Shub-Niggurath on her plinth at the west end, moved here from the
 * sewer's sanctum, the altar before her, a ring of black candles, roots through
 * the roof, a shackle in the south wall.
 *
 * The text is suggested description for the GM to adjust.
 */

import type { Examinable, SafeLock, UvStain, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  // ── The shop's back room ────────────────────────────────────────
  shop_ledger: {
    title: 'The Shop Ledger',
    text: 'A day book lying open on the back-room desk under a cold oil lamp. The cover is stamped R. MARSH & CO. — FRESH & SALT FISH — WATER ST. The shop out front has been shuttered for years, but the book was written in last month.',
    checks: [
      {
        skill: 'Accounting', action: 'Read the columns',
        success: 'Barrels of "salt cod" go out twice a week, to Boston and to Providence, at eleven dollars a barrel. Cod does not fetch eleven dollars a barrel. On the facing page, under PURCHASES, sugar comes in by the hundredweight, and not one fish.',
        failure: 'Fish, barrels, dates, prices. A failing shop keeping its books.',
      },
      {
        skill: 'Spot Hidden', action: 'Look at who the barrels go to',
        success: 'The Providence barrels are all consigned to "D., Federal Hill, c/o the butcher\'s". Every one of them is ticked off as paid in full. Pencilled in the margin beside the last: "cellar — keep the lower door SHUT."',
        failure: 'Initials and street names, most of them in Boston.',
      },
    ],
  },
  trapdoor: {
    title: 'The Cellar Trapdoor',
    text: 'Two leaves of plank, iron-strapped, thrown back to stand along the edge of a hole in the floor. A rug was rolled off them and left. Under them a steep stair runs down into a cold that smells of yeast, scorched sugar and, under that, wet earth.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the hinges',
        success: 'Fresh grease on hinges that should be rusted solid. Somebody comes and goes here quietly, and often.',
        failure: 'Old iron. It opened easily enough.',
      },
    ],
  },
  // ── The cellar ──────────────────────────────────────────────────
  still: {
    title: 'The Pot Still',
    text: 'A copper pot the size of a washtub, sitting on a brick firebox, its domed cap pinned down and its swan neck running over to a thump keg and on to a barrel of water where the copper worm coils. Coals still glow behind the firebox door. Under the spout a crock is a third full of something clear that smells like paint stripper and burns your eyes from a yard away.',
    checks: [
      {
        skill: 'Science (Chemistry)', action: 'Smell the run',
        success: 'Sugar shine, cut with something worse. The first of the run should have been thrown away, and has not been. Whoever drinks this will be lucky to go only blind.',
        failure: 'Raw spirit. Very raw.',
      },
      {
        skill: 'Spot Hidden', action: 'Check the firebox',
        success: 'The coals were banked no more than a few hours ago. Whoever runs this still was here today, and expects to come back.',
        failure: 'Warm brick and ash.',
      },
    ],
  },
  barrels: {
    title: 'The Barrel Rack',
    text: 'Three oak barrels on their sides on a timber rack, brass spigots in their heads. Each head is chalked SALT COD and a date. Tap the first one and it sounds full.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the chalk',
        success: 'Under SALT COD on the third barrel, rubbed out and still legible, someone first wrote NOT THIS ONE. The spigot on that barrel has been wired shut.',
        hard: 'Its stave ends are dark and swollen, as if it was filled with brine and not spirit. It is heavier than the others. Something in it shifts when the rack is bumped, slowly, and settles.',
        failure: 'SALT COD, SALT COD, SALT COD.',
      },
    ],
  },
  bottling_table: {
    title: 'The Bottling Table',
    text: 'A trestle of rough planks covered in the gear of the trade: two rows of green bottles, most of them corked, a tin funnel, a hand corker, a bowl of corks and a stack of printed labels: DR. WAITE\'S TONIC — FOR MEDICINAL USE ONLY — A TABLESPOON AT NEED.',
    checks: [
      {
        skill: 'Law', action: 'Consider the labels',
        success: 'A "medicinal" label is the oldest dodge under the Volstead Act, and the flimsiest. If the federal men who raided this town in \'28 ever come back, this table alone is five years in Atlanta.',
        failure: 'Tonic. Of course it is.',
      },
      {
        skill: 'Spot Hidden', action: 'Look under the table',
        success: 'A ring of keys on a nail under the top: the shop door, the trapdoor, something too small for either. None of them fits a padlock with a dial.',
        failure: 'Corks, straw, a dead mouse.',
      },
    ],
  },
  crates: {
    title: 'Crates of Sardines',
    text: 'Pine crates stencilled PORTLAND SARDINE CO. — PACKED IN OIL. One has had its lid prised off and leaned against the stack: inside, in straw, are the necks of a dozen bottles of Dr. Waite\'s Tonic.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the waybills',
        success: 'Tacked to the end of each crate: Innsmouth to Providence, by the coast road, the driver\'s initials always the same. The Providence end is the butcher\'s on Federal Hill.',
        failure: 'Waybills, sodden and illegible.',
      },
    ],
  },
  preserves: {
    title: 'Preserve Shelves',
    text: 'Shelving against the west wall, crowded with jars: pickled herring, beets, something yellow in brine. The dust lies thick on the jars of the left-hand bay. The bay beside it is cleaner.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the next bay',
        success: 'It is not fixed to the wall. There is a gap behind it you can slide a blade into, and on the bricks in front of it a long pale arc has been scraped in the dirt by its foot, again and again. The bay is a door. In the shadow at its free edge, behind the salt crock, a hasp folds over a staple, and a padlock hangs through it.',
        failure: 'Jars, and more jars. Somebody here was very fond of beets.',
      },
      {
        skill: 'Listen', action: 'Put your ear to the shelving',
        success: 'A draught, very faint, cold, and with it the smell of turned earth and something animal: musk, like a goat pen. Somewhere beyond the wall a candle flame is guttering.',
        failure: 'Your own heartbeat, and the tick of the cooling still.',
      },
    ],
  },
  shelf_padlock: {
    title: 'The Padlock',
    text: 'Hidden at the free edge of the shelving, behind the salt crock: a hasp over a staple, and through it a brass combination padlock, small and new, its dial bright with handling. Everything else in this cellar is damp and old.',
    checks: [
      {
        skill: 'Locksmith', action: 'Size up the lock',
        success: 'A dial padlock of the kind sold for gun cabinets and payroll boxes. The dial turns smoothly; someone oils it. Feel for the tumblers and it can be had without the combination.',
        failure: 'A good lock, and newer than you would like.',
      },
    ],
  },
  // ── The chamber ─────────────────────────────────────────────────
  shub_idol: {
    title: 'The Black Goat',
    text: 'At the far end of the chamber, on a plinth of black stone, a figure taller than a man: a mass of thick, coiling limbs heaving up out of itself, mouths and hooves half-formed in the tangle, all of it carved from one dark stone that seems to swallow the candlelight. The roots that come through the roof droop toward it as if they were growing there on purpose.',
    checks: [
      {
        skill: 'Occult', action: 'Name what it is',
        success: 'Shub-Niggurath, the Black Goat of the Woods with a Thousand Young. She is a fertility, and not a kind one. Her cults are country cults, of groves and standing stones. One under an Innsmouth fish shop is a long way from any wood.',
        failure: 'A god of some kind. Not one with a church.',
      },
      {
        skill: 'Spot Hidden', action: 'Look at the plinth',
        success: 'Fresh chisel marks where the statue\'s base was dressed to fit it, and grit in the joint. She has not stood here long. Someone brought her down here, and that took a block and tackle and a dozen men.',
        failure: 'Old stone, and newer blood dried on its front.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Understand her',
        difficulty: 'Hard',
        success: 'The young she bears are not born in any way a doctor would know. They are taken in: offered, and kept, and changed. The shackle in the wall is part of the rite.',
        failure: 'You look too long. For a moment one of the limbs is not where it was.',
      },
    ],
  },
  chamber_altar: {
    title: 'The Altar',
    text: 'A block of rough stone before the plinth. On it a goat\'s skull, horns swept back, its sockets painted red; four black candles burning down; a clay bowl with a dark crust in the bottom; a knife with a bone handle. Old blood has run down the front of the block and dried.',
    checks: [
      {
        skill: 'Medicine', action: 'Look at the bowl',
        success: 'Blood, and human: it has clotted the way a man\'s does, not a goat\'s. A cupful, no more. Given, not taken: there is a clean cut in the bottom of the bowl\'s crust where a palm was pressed into it.',
        failure: 'Something dark and dried.',
      },
      {
        skill: 'Spot Hidden', action: 'Look round the candles',
        success: 'The black candles are the only new things here apart from the padlock. They have been lit and relit many times; the wax round them is layered like rings in a tree. Someone tends this altar every few days.',
        failure: 'Candle grease, and plenty of it.',
      },
    ],
  },
  chamber_shackle: {
    title: 'The Shackle',
    text: 'An iron ring-bolt leaded into the south wall at knee height, a chain from it lying across the floor, and at the end of the chain a shackle hanging open. The earth round it is worn smooth in an arc, the reach of the chain, by something that paced it for a long time.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the shackle',
        success: 'Its pin has not been drawn. It has been bent open, the iron stretched. Caught in the hinge are a few scales, grey-green, set in a shred of skin.',
        failure: 'Old iron, opened.',
      },
      {
        skill: 'Track', action: 'Read the worn earth',
        success: 'Bare feet, a man\'s at first, then longer, the toes spreading. Whoever was kept here was kept for months. The newest prints are not a man\'s at all.',
        failure: 'Trodden earth.',
      },
    ],
  },
};

/** The padlock on the shelf door: cracked, the door swings out for everyone (doors.shelf_door). */
const LOCKS: Record<string, SafeLock> = {
  shelf_padlock: {
    points: [4, 5],
    seconds: 15,
    prompt: { locked: 'Work the padlock\'s dial', open: 'Look at the open padlock' },
    opened: {
      title: 'The Open Padlock',
      text: 'The shackle has dropped out of the body and the hasp hangs free. The shelving swings out on hinges hidden in its back, jars rattling, and behind it is not wall but a black doorway in older stone, and a smell like a goat pen in a cave. Candlelight moves down there.',
    },
  },
};

/**
 * Stains for the Wood's lamp: something heavy was dragged out of the chamber to
 * the shelf door, and a hand pressed to the chamber wall beside the way out.
 */
const UV_STAINS: UvStain[] = [
  {
    id: 'uv_drag', kind: 'blood', mark: 'drag',
    floor: [[-5.8, 1.2], [-5.2, 1.2], [-4.8, 1.2], [-4.3, 1.2], [-3.6, 1.2], [-2.9, 1.35]],
    floorY: [-0.36, -0.36, -0.18, 0, 0, 0],
    title: 'A Drag Mark',
    text: 'A broad smear glowing on the floor, from the foot of the altar up the steps and through the doorway into the cellar, where it is lost under the scrape of the shelf door. Something was carried out of the chamber, bleeding, and at the end it could not be carried and was dragged.',
    checks: [
      {
        skill: 'Medicine', action: 'Judge the bleeding',
        success: 'Steady, and heavy, all the way. Whatever was dragged was alive at the start, and probably at the end.',
        failure: 'A lot of blood, once.',
      },
    ],
  },
  {
    id: 'uv_chamber_hand', kind: 'blood', mark: 'handprint',
    wall: { from: [-5.35, 1.2, 0.4], toward: [1, 0, 0], size: [0.35, 0.45] },
    title: 'A Hand by the Way Out',
    text: 'A hand pressed flat to the rock beside the passage, at shoulder height, and dragged down it. The fingers are too long, and there is too much space between them.',
  },
];

export const CELLARS_LEVEL: WalkthroughLevel = {
  id: 'innsmouth-cellars',
  model: '/innsmouth-cellars.glb',
  title: 'The Cellars · Innsmouth',
  loadingText: 'Lifting the trapdoor…',
  errorText: 'The cellars could not be loaded.',
  enterText: 'Click to go down into the cellar',
  leaveLabel: 'Leave the cellars',
  credit: '"Shub-Niggurath - Lovecraft lore" by CMBC — CC BY 4.0',
  examinables: EXAMINABLES,
  locks: LOCKS,
  uvStains: UV_STAINS,
  // Examinables that are part of the architecture, not furniture: an invisible box each.
  spots: {
    // At the free edge of the shelf door, behind the salt crock.
    shelf_padlock: { min: [-3.32, 0.85, 1.64], max: [-3.1, 1.2, 1.84] },
    trapdoor: { min: [2.4, 2.6, -0.72], max: [2.52, 3.6, 2.14] },
    chamber_shackle: { min: [-6.35, -0.36, 2.45], max: [-5.5, 0.55, 3.0] },
  },
  doors: {
    // The bay of preserve shelving that is a door: cut out of the level by its
    // meshes (one per material, build_cellars.py) and swung out into the cellar
    // on its back north corner once the padlock is cracked.
    shelf_door: {
      label: 'Shelf door',
      leaf: (['wood', 'jar', 'iron', 'brass'] as const).map(m => ({
        mesh: `Shelf_Door_${m}`, min: [-3.53, -0.05, 0.68] as [number, number, number], max: [-3.17, 2.0, 1.8] as [number, number, number],
      })),
      hinge: [-3.5, 0, 0.7],
      openDeg: 90,
      lock: 'shelf_padlock',
    },
  },
  // The oil lamp on the shop desk (1), the cellar's hanging lantern (2), the
  // still's firebox (3), the altar's candles (4), and a low red glow at the foot
  // of the plinth that lights her from below (5).
  lamps: {
    color: 0xffb46a, intensity: 3, distance: 7,
    only: {
      Lamp_1: { color: 0xffc98a, intensity: 2, distance: 5 },
      Lamp_2: { color: 0xffb060, intensity: 4, distance: 8 },
      Lamp_3: { color: 0xff6a20, intensity: 2.5, distance: 4 },
      Lamp_4: { color: 0xff9a50, intensity: 2, distance: 5 },
      Lamp_5: { color: 0xc8402a, intensity: 3, distance: 4 },
    },
  },
  atmosphere: {
    background: 0x050404,
    fogColor: 0x0b0908,
    fogDensity: 0.06,
    sky: 0x2a2620,
    ground: 0x0a0807,
    fill: 0.35,
  },
};
