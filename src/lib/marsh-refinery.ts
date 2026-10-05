/**
 * The Marsh Refinery, Innsmouth — a first-person walkthrough level (see
 * walkthrough.ts) for the Innsmouth map's Marsh Refinery pin. The hall is the
 * "Old Industrial Building" model by Hrvoje Wächter (Sketchfab, CC-BY-4.0),
 * furnished in ~/dev/my-summer-game by `tools/build_refinery_cli.gd` and
 * exported to /marsh-refinery.glb by `tools/export_refinery.sh`.
 *
 * One long brick hall, the freight doors at the south end where the
 * investigator comes in. The refinery is supposed to have been shut since the
 * Marshes left Innsmouth, but the furnace is banked, not cold, and the sump is
 * wet. It picks up the threads of the derelict house: the ledger page headed
 * "Refinery, Marsh &", J.M.'s four ounces "collect at the reef", and the
 * receipt "paid in kind, 2 oz." The text is physical description and
 * suggested findings for the GM to adjust.
 *
 * Coordinates are metres: the hall spans x ±4, z ±12.6, the furnace against
 * the north wall (-Z).
 */

import type { Examinable, UvStain, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  furnace: {
    title: 'Reverberatory Furnace',
    text: 'A squat hearth of yellow firebrick bound in iron, its flue running up through the ceiling. The firebox door is shut, and a dull red glow comes from the ash pit beneath it. Somebody banked this fire and meant to come back to it. The brick is warm to the hand.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Rake through the ash pit',
        success: 'Under the fresh ash is an older layer, grey and fine, and in it a curl of fused metal no bigger than a fingernail. It is gold, but greenish, like no gold a jeweller would sell.',
        hard: 'Under the fresh ash, beside a curl of greenish gold, are small bones too fine to be a dog\'s. They are fish bones: whole spines, burned clean and laid in a row, as though they had been put in on purpose.',
        failure: 'Ash and clinker. The heat comes up into your face and you have to stand back.',
      },
      {
        skill: 'Science (Chemistry)', action: 'Judge the last firing',
        success: 'Banked with coal and closed down, a fire like this keeps for two or three days. It was last fired in earnest this week, hot enough to run gold.',
        failure: 'Coal fire, banked. You cannot say how long ago.',
      },
    ],
  },
  crucibles: {
    title: 'Crucible Rack',
    text: 'An iron rack of graphite crucibles, each the size of a flowerpot, and the long tongs that lift them, leaning against the end. Most of the crucibles are furred with old dust. Two on the bottom shelf are not.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look inside the clean crucibles',
        success: 'A gold skin lines the inside of one, with a scum of grey-green slag on top. The slag has a pattern pressed into it, as if the metal went in still shaped: the edge of a band or a crown, worked with scales.',
        failure: 'Graphite and soot. Nothing you can make out.',
      },
    ],
  },
  moulds: {
    title: 'Pouring Bench',
    text: 'An iron table of ingot moulds by the furnace\'s tap-hole, with a sand bed underneath to catch spills. Three moulds still hold their bars: small, heavy and pale, more like brass than gold. Each is stamped on top.',
    checks: [
      {
        skill: 'Appraise', action: 'Weigh up the bars',
        success: 'Each bar is about two ounces, and too heavy for brass. It is gold alloyed with something you cannot name, a paler metal that will not take a polish. No assay office in New England would stamp it, and no fence would turn it down.',
        extreme: 'Two ounces apiece, the same weight as the receipt in the radio at the house, "paid in kind, 2 oz." This is the refinery\'s currency. At these prices it would buy a man, or his silence.',
        failure: 'Brass or gold or something between. You cannot tell without a balance.',
      },
      {
        skill: 'Occult', action: 'Read the stamp',
        success: 'The stamp is not a maker\'s mark. It is a ring with a fish-tailed cross inside it, the same sign someone scratched under the lamp of the police call box downtown.',
        failure: 'A ring with something inside it. It could be a foundry mark.',
      },
    ],
  },
  vats: {
    title: 'Parting Vats',
    text: 'Three lead-lined vats where acid once took the silver out of the gold. Two hold a few inches of yellowed acid that stings the eyes from a yard off. The middle one is full nearly to the brim with grey-green sludge, and it smells of low tide.',
    checks: [
      {
        skill: 'Science (Chemistry)', action: 'Test the middle vat',
        success: 'There is no acid in the middle vat, only seawater, gone thick. Whatever is dissolved in it has been dissolving a long time.',
        hard: 'It is seawater, thick with something organic. Fished out on a stick, the sludge stretches like egg white and clings, and the surface where it lay keeps the pale gold sheen of the bars on the bench.',
        failure: 'Acid of some kind, or worse. You would rather not put a hand near it.',
        fumble: 'The stick slips. A splash catches your wrist, and the skin there goes cold and grey and stays that way for an hour.',
      },
    ],
  },
  sump: {
    title: 'Drain Sump',
    text: 'An iron-curbed well in the floor where the hall\'s drain channels meet, its grating set over black water. The water is level with the harbour outside and rises and falls with it. The floor around the curb is wet, and so are the channels, though it has not rained.',
    checks: [
      {
        skill: 'Listen', action: 'Kneel at the grating',
        success: 'Water slaps in a pipe under the floor, running away toward the harbour. Under it, once, a sound like a palm laid flat against the inside of the pipe.',
        failure: 'Water dripping. The tide is coming in.',
      },
      {
        skill: 'Architecture & Engineering', action: 'Work out where it drains',
        success: 'The sump is far too big for a floor drain. It is the head of an outfall large enough for a man to crawl along, and it runs straight toward the reef.',
        failure: 'An old drain, oversized, as everything in this hall is.',
      },
    ],
  },
  ledger: {
    title: 'Clerk\'s Desk',
    text: 'A standing clerk\'s desk by the doors, with an inkstand and a day ledger left open. The page is ruled into columns of dates, names and weights in ounces. The newest entries are in pencil, in a different hand from the old ones.',
    checks: [
      {
        skill: 'Accounting', action: 'Read the columns',
        success: 'Gold comes in by weight, "from the reef", and goes out as two-ounce bars, by name. The same dozen names recur for years. The pencilled entries begin when the ink ones stop, and the last is dated this month.',
        hard: 'Gold in "from the reef", bars out by name. One account is ruled off in red: "J.M. — 4 oz. owing. Collect at the reef." It is the same line as the burned ledger page in the house\'s hearth. Here someone has added one word beside it: "Collected."',
        failure: 'Names and weights. The pencil is smudged, and the hand is hard to read.',
      },
      {
        skill: 'Library Use', action: 'Search the older pages',
        success: 'The ink pages go back to the 1840s, headed "Refinery, Marsh & Co." Shipments go out under consignments to Boston houses. One consignee recurs: "W. Maritime, Long Wharf."',
        failure: 'Decades of figures. You would need days with it.',
      },
    ],
  },
  balance: {
    title: 'Assay Balance',
    text: 'A brass balance in a glass case on a cabinet of weights, the pans still and level. The cabinet\'s drawers hold the weights in velvet, in grains and troy ounces. The two-ounce weight is missing.',
  },
  crates: {
    title: 'Crated Consignment',
    text: 'Four pine crates, iron-strapped, stencilled MARSH REFINING CO. — INNSMOUTH, MASS., and addressed in grease pencil for Boston. They are nailed shut and very heavy for their size. Nobody has shipped them.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the old stencils',
        success: 'Under the Marsh stencil, painted over, is an older one: a shipping line\'s house flag and the letters W.M.S. Co.',
        failure: 'Paint, grease pencil and splinters.',
      },
      {
        skill: 'STR', action: 'Prise a lid',
        success: 'The lid squeals up an inch. Straw, and in the straw, wrapped in oiled cloth, a tiara of the pale gold, tall and strangely made, its band worked with scales and weed. There are more cloth bundles beneath it.',
        failure: 'The nails hold. The sound carries down the hall.',
      },
    ],
  },
};

/** Stains for the Wood's lamp: something came up out of the sump and went to the furnace. */
const UV_STAINS: UvStain[] = [
  {
    id: 'uv_sump_prints', kind: 'brine', mark: 'prints',
    // From the sump, up the hall, to stand before the firebox.
    floor: [[0.6, -4.8], [0.45, -5.9], [0.2, -7.0], [0.05, -8.1], [-0.05, -9.2], [0.0, -9.9]],
    title: 'Wet Tracks from the Sump',
    text: 'Footprints in dried salt water, glowing green, come up out of the sump and go straight to the furnace. They are bare, long, three-toed and webbed. At the firebox they stop and stand together, as though whatever made them waited there to be warm.',
    checks: [
      {
        skill: 'Track', action: 'Follow the tracks',
        success: 'There and back, more than once: an old trail under a newer one. Whatever comes up from the sump visits the furnace often.',
        failure: 'Salt marks on the concrete. You cannot make out a trail.',
      },
    ],
  },
  {
    id: 'uv_bench_glyph', kind: 'brine', mark: 'glyph',
    wall: { from: [2.6, 1.7, -8.2], toward: [1, 0, 0], size: [0.9, 0.9] },
    title: 'A Sign over the Bench',
    text: 'Above the pouring bench, drawn on the brick with a wet finger: the ring and fish-tailed cross from the bars\' stamp, large, and under it a row of marks like tally strokes, all in brine.',
  },
];

export const REFINERY_LEVEL: WalkthroughLevel = {
  id: 'marsh-refinery',
  model: '/marsh-refinery.glb',
  title: 'The Marsh Refinery · Innsmouth',
  loadingText: 'Forcing the freight doors…',
  errorText: 'The refinery could not be loaded.',
  enterText: 'Click to step into the hall',
  leaveLabel: 'Leave the refinery',
  credit: '"Old Industrial Building" by Hrvoje Wächter, CC BY 4.0',
  examinables: EXAMINABLES,
  uvStains: UV_STAINS,
  // Four enamel shades down the hall.
  lamps: { color: 0xffb46a, intensity: 9, distance: 11 },
  atmosphere: {
    background: 0x030405,
    fogColor: 0x05070a,
    fogDensity: 0.03,
    sky: 0x3a4660,
    ground: 0x0b0907,
    fill: 0.3,
    // Moonlight through the high windows on the west side.
    moon: { color: 0x9fb2d4, intensity: 0.9, position: [-18, 14, 4] },
  },
  // The banked fire glows under the firebox door.
  fires: [{ examineId: 'furnace', at: b => [0, 0.35, b.max.z + 0.35] }],
};
