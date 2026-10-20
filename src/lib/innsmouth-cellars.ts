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
 * the roof, a shackle in the south wall. Only she is interactive there: her Boon.
 *
 * The text is suggested description for the GM to adjust.
 */

import type { Examinable, SafeLock, WalkthroughLevel } from './walkthrough';

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
  // Her one interaction is her Boon (placeholder text for the GM to replace).
  shub_idol: {
    title: 'Boon',
    text: 'The Black Goat\'s boon. (Placeholder — what she grants is still to be written.)',
    boon: true,
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
  // Examinables that are part of the architecture, not furniture: an invisible box each.
  spots: {
    // At the free edge of the shelf door, behind the salt crock.
    shelf_padlock: { min: [-3.32, 0.85, 1.64], max: [-3.1, 1.2, 1.84] },
    trapdoor: { min: [2.4, 2.6, -0.72], max: [2.52, 3.6, 2.14] },
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
