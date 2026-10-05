/**
 * The Marsh Refinery, Innsmouth — a first-person walkthrough level (see
 * walkthrough.ts) for the Innsmouth map's Marsh Refinery pin. The hall is the
 * "Old Industrial Building" model by Hrvoje Wächter (Sketchfab, CC-BY-4.0),
 * furnished in ~/dev/my-summer-game by `tools/build_refinery_cli.gd` and
 * exported to /marsh-refinery.glb by `tools/export_refinery.sh`.
 *
 * Three levels. The ground floor is the furnace hall, the freight doors at
 * its south end where the investigator comes in; a timber stair up the east
 * wall climbs to the upper storey, the Marshes' counting loft; a steep stair
 * up the loft's west wall comes out through a hatch onto the flat roof. The refinery is supposed to have been shut since the
 * Marshes left Innsmouth, but the furnace is banked, not cold, and the sump is
 * wet. It picks up the threads of the derelict house: the ledger page headed
 * "Refinery, Marsh &", J.M.'s four ounces "collect at the reef", and the
 * receipt "paid in kind, 2 oz." The text is physical description and
 * suggested findings for the GM to adjust.
 *
 * Coordinates are metres: the hall spans x ±4, z ±12.6, the furnace against
 * the north wall (-Z). Floors at y 0 (hall), 4.94 (loft) and 11.19 (roof).
 *
 * The GM sets the time of day and the rain (`weather`); it shows through the
 * windows, and the roof is out in it.
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
  // ── The loft ────────────────────────────────────────────────────
  strongbox: {
    title: 'Strongbox',
    text: 'A green-painted iron safe by the flue, the warmest spot in the loft, as tall as a man\'s chest. The maker\'s plate reads HALL\'S SAFE & LOCK CO., CINCINNATI. The dial has been turned so often that the brass is worn bright at three numbers.',
    checks: [
      {
        skill: 'Locksmith', action: 'Work the dial', difficulty: 'Hard',
        success: 'The worn numbers give it away: three of them, in some order. On the fourth order the bolts draw. Inside are canvas bags of two-ounce bars, a bundle of deeds to Innsmouth waterfront lots, and a bound book of names with a sum beside each, every one ruled off but the last page.',
        failure: 'The tumblers will not speak to you. Every turn of the dial sounds loud in the empty loft.',
        fumble: 'The handle drops with a clang that rings down the stairwell, and below, something in the sump goes still.',
      },
      {
        skill: 'Spot Hidden', action: 'Look round the safe',
        success: 'Wet marks on the floorboards come up to the safe and stop, as if someone stood there a long time. Wedged in the gap between the safe and the wall is a calling card: "Mrs. A. Marsh — at home Thursdays."',
        failure: 'Dust, and a flue that ticks as it cools.',
      },
    ],
  },
  vestments: {
    title: 'Press of Robes',
    text: 'A tall open press against the wall, hung with five robes of heavy black wool that smell of the sea and of camphor. The middle one is cloth of gold, stiff with embroidery: waves, and in the waves things that are not fish. The hems are all stained to the knee with salt.',
    checks: [
      {
        skill: 'Occult', action: 'Read the embroidery',
        success: 'These are vestments of the Esoteric Order of Dagon, three degrees of them. The gold robe is a hierophant\'s. Somebody keeps them here rather than at the Order\'s hall, which means somebody wants them out of the hall\'s sight.',
        failure: 'Church robes of some coastal sect. The needlework is very fine.',
      },
    ],
  },
  chart_table: {
    title: 'Chart Table',
    text: 'A chart of Innsmouth harbour pinned flat under brass weights, with a tide table for this month beside it and a pair of dividers left open. Devil Reef is ringed in pencil, and so is one hour of one night, ruled in red on the tide table: the lowest water of the month, after midnight.',
    checks: [
      {
        skill: 'Navigate', action: 'Work the chart',
        success: 'The dividers are set to the distance from the refinery\'s outfall to the reef. At the ringed low water a man could walk out along the breakwater almost to the reef itself, and the outfall would be dry.',
        failure: 'Soundings and pencil marks. You cannot make out what was being measured.',
      },
      {
        skill: 'Spot Hidden', action: 'Look under the chart',
        success: 'Under the chart is an older one of the same water, drawn by hand in brown ink and dated 1838. Where the new chart shows open water off the reef, the old one shows steps.',
        failure: 'Only the table\'s scarred top.',
      },
    ],
  },
  cot: {
    title: 'Camp Cot',
    text: 'An army cot under the south windows with a grey blanket thrown back. The canvas is still damp where somebody lay on it, and the damp smells of the harbour. On the floor beside it are a tin cup, a candle end and a pair of men\'s boots stuffed with newspaper, as if their owner no longer needs them.',
    checks: [
      {
        skill: 'Medicine', action: 'Examine the stain on the canvas',
        success: 'It is not sweat. The canvas has taken a print of a sleeper\'s back, and the skin there was shedding in flakes, grey and fine as fish scale.',
        failure: 'Seawater, or sweat. A man slept here recently.',
      },
      {
        skill: 'Psychology', action: 'Think about who sleeps here',
        success: 'Whoever sleeps here keeps the refinery\'s fire and the safe\'s keys, and has been doing it alone for a long time. The boots say he stopped walking out of here like a man some while ago.',
        failure: 'A watchman, probably. Watchmen sleep where they work.',
      },
    ],
  },
  // ── The roof ────────────────────────────────────────────────────
  chimney: {
    title: 'Chimney Stack',
    text: 'The furnace flue comes up through the roof into a squat stack with a clay pot on top. Thin smoke leaks from it, and the brick is warm. Whatever the wind does, the smoke lies flat and drifts out toward the reef.',
  },
  signal_lamp: {
    title: 'Signal Lamp',
    text: 'A ship\'s signalling lamp on an iron post by the south parapet, its shutter slats aimed out to sea at Devil Reef. The lamp is cold, but the wick is trimmed and the reservoir is full. Matches in a tin are screwed to the post.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Watch the reef',
        success: 'For a long while there is nothing. Then, far out on the reef, a light opens and shuts three times, and waits. It is answering a signal nobody here has sent.',
        failure: 'Black water, the white line of the breakwater, and nothing on the reef.',
      },
      {
        skill: 'Mechanical Repair', action: 'Work the shutter',
        success: 'The shutter is oiled and moves silently. Pencilled inside the lamp\'s door is a short sequence of long and short flashes, and the word "TIDE".',
        failure: 'It is stiff with salt, and you leave it.',
      },
    ],
  },
  // ── The hall ────────────────────────────────────────────────────
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
  credit: '"Old Industrial Building" by Hrvoje Wächter; "Old and Worn Sofa" by Nurul_Athyrah — both CC BY 4.0',
  examinables: EXAMINABLES,
  uvStains: UV_STAINS,
  // The GM sets the time of day and the rain; they show through the windows, and the roof is out in it.
  weather: true,
  // Gulls over the roof by day.
  birds: {
    model: '/props/seagull.glb', times: ['dawn', 'day'], everySec: 140, count: [2, 4], wingspan: 1.4, over: [0, 0], height: [16, 26],
    cries: ['/sounds/gull-1.mp3', '/sounds/gull-2.mp3', '/sounds/gull-3.mp3', '/sounds/gull-4.mp3', '/sounds/gull-5.mp3'],
  },
  // Four enamel shades down the hall, two on long chains in the loft.
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
