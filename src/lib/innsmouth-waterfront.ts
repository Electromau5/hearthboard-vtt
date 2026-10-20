/**
 * The Innsmouth waterfront: the Federal Quarantine Docks, the decrepit reef and
 * breakwater, and the Tide-Gate, as one first-person walkthrough level (see
 * walkthrough.ts) on the Innsmouth map's waterfront pin. They were three pins.
 * ~/dev/my-summer-game `tools/build_waterfront.py` (Blender) builds it from
 * scratch — no source assets — and `tools/export_waterfront.sh` exports it to
 * /innsmouth-waterfront.glb. `tools/render_waterfront.py` renders check pictures.
 *
 * Coordinates are metres; north is -Z, the sea is to the east (+X). The
 * investigator comes in on the harbour street (y 1.2, x -34..-14), which runs
 * the length of the level under a row of dead houses. North (z -34..-17) are
 * the docks: a plank wharf (y 1.25) behind a chain-link fence whose gate hangs
 * open at x -11, the guard tower, and the quarantine shed (x -7..5, z -33..-26.5)
 * with its door in the south wall and the holding cage across its east end.
 * Mid-level is the reef: fish sheds on the street, the net loft (x -24..-17,
 * z -6.5..-1.5) open to the street, a shingle beach, the gutting shed, and the
 * breakwater (z -3.8..-0.2) running east from the street to its light at
 * x 26.8. South are the flats: a stair in the sea wall at z 29.5..31 goes down to
 * a plank walk across the mud to the pylon at (14, 32), the Tide-Gate carved in
 * its west face at x 11.2. Ten cultists kneel in the mud before it, praying.
 * gamelord can call Dagon up out of the sea beyond it (`summon`).
 *
 * The text is suggested description for the GM to adjust.
 */

import type { Examinable, GazeHazard, UvStain, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  // ── The Federal Quarantine Docks ────────────────────────────────
  quarantine_sign: {
    title: 'The Quarantine Notice',
    text: 'A board wired to the fence beside the gate, its paint gone chalky with salt: U.S. PUBLIC HEALTH SERVICE — QUARANTINE STATION — NO ADMITTANCE. BY ORDER · TREASURY DEPT. · 1928. The gate beside it hangs open. Its chain has been cut, and nobody has replaced it.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the cut chain',
        success: 'The chain was not cut with bolt-cutters. One link is pulled out long and thin before it parted, the way soft metal goes when it is stretched. Whatever opened this gate pulled, from the inside.',
        failure: 'A cut chain. Someone wanted in, or out.',
      },
      {
        skill: 'Law', action: 'Read the authority on the notice',
        success: 'Treasury, not Health: the order was signed under the customs power, which lets federal men hold a person without charge for as long as they call it quarantine. That is how the 1928 raids were done without a single trial.',
        failure: 'Federal paper. The sort nobody argues with.',
      },
    ],
  },
  guard_tower: {
    title: 'The Guard Tower',
    text: 'A timber tower on splayed legs at the corner of the wharf, a cabin on top with its windows dark. The ladder up its south side is missing every few rungs, and those that are left are soft with rot. A searchlight sits on the cabin sill, turned out over the water.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Follow where the searchlight points',
        success: 'Not at the harbour mouth, where a guard would watch for boats, but south-east, low, at the flats. Toward the pylon. Somebody up there spent their nights watching the mud.',
        failure: 'Out to sea, as searchlights are.',
      },
      {
        skill: 'Climb', action: 'Try the ladder',
        difficulty: 'Hard',
        success: 'You get a few rungs up before one goes to pulp under your boot. From there you can see the guard\'s tally cut into a leg: nights, in fives, and beside some of them a small carved circle, black. The black circles come about a month apart.',
        failure: 'The first rung you trust comes away in your hand.',
        fumble: 'Two rungs go at once and you come down hard on the planks. Anyone on the wharf heard that.',
      },
    ],
  },
  duty_desk: {
    title: 'The Duty Desk',
    text: 'A plain desk against the shed\'s north wall, a cold tin lamp, and the detention register lying open where the last man on duty left it. Loose forms are weighted down with a stone from the beach.',
    checks: [
      {
        skill: 'Library Use', action: 'Read back through the register',
        success: 'Forty-seven detainees, numbered, few named. "Male, approx. 40, gills (vestigial)." "Female, will not give name, eyes as noted." Most are marked TRANSFERRED, with a federal file number. Three are marked BELLEVUE, N.Y., BY ORDER, and initialled by someone who signs only with a C.',
        hard: 'No. 31 has a name, struck through so hard the nib tore the page. Held up to the lamp, the first letter is an M. The next column, where every other entry has a destination, reads RELEASED TO FAMILY, and that is the only release in the book.',
        failure: 'Numbers, dates in 1928, cramped official shorthand. It would take hours.',
      },
      {
        skill: 'Spot Hidden', action: 'Read the last entry',
        success: 'No. 47, the last line in the book, in a different hand from the rest: "Held overnight. CELL EMPTY AT 4 A.M. Bars as found. Did not pursue." Below it someone has written, and then tried to scratch out, "it went home."',
        failure: 'The last page has a few lines on it, and a water stain.',
      },
    ],
  },
  holding_cage: {
    title: 'The Holding Cage',
    text: 'Iron bars from floor to roof across the east end of the shed, a cage for people. In the middle of the front two bars are bowed outward and sprung apart, wide enough for a man to step through sideways. Inside, wet straw, a drain in the floor, and a shackle bolted down with its ring torn open.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the bent bars',
        success: 'They bow outward, and the bend is smooth and even. Not a blow: a long, steady push, from inside, by hands. There are scales caught in the flaking rust at chest height, small and grey-green.',
        failure: 'Bent bars. Something strong was in here.',
      },
      {
        skill: 'Science (Biology)', action: 'Examine the scales',
        success: 'Fish scales, ctenoid, but they come from no fish you can name, and the base of each one is set in a shred of skin that is plainly mammalian. Whatever shed them was partway between.',
        failure: 'Fish scales. This is a fishing town.',
      },
      {
        skill: 'STR', action: 'Try the bars yourself',
        difficulty: 'Extreme',
        success: 'You can just shift one, a finger\'s width, with everything you have. What did this did it to two bars at once.',
        failure: 'They do not move at all.',
      },
    ],
  },
  specimen_crates: {
    title: 'Crates Consigned and Never Shipped',
    text: 'Pine crates stacked on the wharf, iron-strapped and stencilled U.S.P.H.S. — SPECIMENS — FORMALIN — THIS SIDE UP. The shipping labels have gone grey with weather. They have been waiting for a boat for a long time.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the shipping labels',
        success: 'Consigned to MISKATONIC UNIVERSITY, DEPT. OF BIOLOGY, ARKHAM, attention of a professor whose name has run. Each label is countersigned with the same federal file numbers as the transfers in the register.',
        failure: 'The labels are past reading.',
      },
      {
        skill: 'Medicine', action: 'Prise up a lid and look at a jar',
        success: 'Jars in sawdust, sealed with wax. In the one you lift, a hand floats in yellowed formalin: human-shaped, but the webbing between the fingers runs to the first knuckle, and the nails are thick and dark and curved.',
        failure: 'The formalin has gone cloudy. Shapes, and you are glad not to see more.',
      },
    ],
  },
  // ── The reef ────────────────────────────────────────────────────
  gutting_bench: {
    title: 'The Gutting Bench',
    text: 'A long bench under the nets in Gilman & Sons\' loft, scarred by thirty years of knives, a gutting knife left lying where it was dropped. The fish on it have been there for days and should stink far worse than they do.',
    checks: [
      {
        skill: 'Science (Biology)', action: 'Look at the fish',
        success: 'Cod and pollock, but wrong: too many teeth, set in two rows, and in one the eyes have the beginnings of lids. The flesh has barely spoiled. Something in it keeps.',
        failure: 'Fish, going off.',
      },
      {
        skill: 'Spot Hidden', action: 'Go through the guts in the trough',
        success: 'In the offal, a ring. Pale gold, soft enough to dent with a thumbnail, worked with a pattern of scales and weed. Somebody gutting the catch was finding these, and went on finding them.',
        hard: 'Scratched under the bench top where only the man at the knife would see it, a tally of rings, with a date beside the last of them, and the words "paid in kind".',
        failure: 'Offal and scales and salt.',
      },
    ],
  },
  breakwater_light: {
    title: 'The Breakwater Light',
    text: 'A cast-iron post at the end of the breakwater with a lantern on top, painted red once. Beyond it the breakwater has fallen into the sea in a heap of blocks. The lantern is lit. The town has had no harbour-master in years.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the lantern',
        success: 'The oil is fresh and the wick is trimmed. The lantern has a shutter, oiled and silent, and pencilled inside its door is a sequence of long and short flashes and the word "TIDE". You have seen that sequence before, inside the lamp at the refinery.',
        failure: 'Someone keeps it lit. Someone with a reason.',
      },
      {
        skill: 'Navigate', action: 'Look out to sea from here',
        success: 'A mile and a half out, a long black back in the water with the swell breaking white along it: Devil Reef. From this exact spot, the reef, the light and the pylon on the flats to the south-west fall in one straight line.',
        failure: 'Fog and black water. Something breaks the swell far out.',
      },
    ],
  },
  // ── The Tide-Gate ───────────────────────────────────────────────
  tide_board: {
    title: 'The Tide Board',
    text: 'A white board on a piling out on the flats, marked in feet like any harbour gauge. Far below the lowest foot mark, where no tide should ever leave the mud bare, a line has been painted in red. The mud is bare to it now.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Read the chalk marks on the post',
        success: 'Chalk tallies on the piling behind the board, renewed again and again: dates, a month apart, each one beside a circle filled in black. New moons. Against three of the dates is written "RED", and against the last, "OPEN?"',
        failure: 'Chalk marks, half washed off.',
      },
      {
        skill: 'Science (Astronomy)', action: 'Work out the red-line dates',
        difficulty: 'Hard',
        success: 'The RED dates are spring tides at a new moon with the moon at perigee, the very lowest water of the year. They come round less often than they should, and the gap between them is shrinking. If it goes on, the next is within the year.',
        failure: 'Tides and moons. You would need almanacs.',
      },
    ],
  },
  beached_dory: {
    title: 'A Beached Dory',
    text: 'A dory keeled over on the mud, half full of silt, her oars gone. The name on her transom is nearly weathered off: E. GILMAN — 2. A tender from a trawler.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the boat',
        success: 'Under the silt in her bilge, a storm lantern, and in the lantern\'s base where the oil should be, a twist of oilcloth with a page in it: a tide table for this harbour, with the new moons ringed. Somebody from the Esther Gilman rowed out here to meet a low tide.',
        failure: 'Silt and weed and a broken lantern.',
      },
      {
        skill: 'Track', action: 'Read the mud around her',
        success: 'Boot prints come out of the dory and go toward the pylon, deep, a man carrying weight. None come back. Beside them, and over them, the long webbed prints of something walking out of the water.',
        failure: 'The mud has been walked over and over and the tide has smoothed it since.',
      },
    ],
  },
  tide_gate: {
    title: 'The Tide-Gate',
    text: 'In the landward face of the pylon, under the stacked basalt, a slab the height of a door stands flush between two jambs and a lintel of the same black stone. It is carved all over with rings and spokes and hooked signs, and where the cuts are deepest they shine a cold green, though nothing lights them. A seam, too fine to put a blade in, runs down its middle. The stone is warm, and wet, and it is not seawater.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Study the seam',
        success: 'Not a crack. Two leaves, meeting true along their whole height. It is a door, and it was made to open, from one side or the other.',
        failure: 'A seam in old stone.',
      },
      {
        skill: 'Science (Geology)', action: 'Examine the stone',
        success: 'Basalt, but not New England\'s: glassy, too dense, with an inclusion of green crystal through it that gives off the glow. It was quarried somewhere very far away, and very long ago, and set here by someone who could lift it.',
        failure: 'Black stone, sea-worn.',
      },
      {
        skill: 'Occult', action: 'Read the carvings',
        success: 'The seven-spoked ring is a seal, the same kind that holds the Necronomicon shut at Miskatonic: it presses on what is behind it. The hooked signs round the edge are a count, and it is counting down.',
        failure: 'Signs. Old ones. None you can name.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Understand what it is',
        difficulty: 'Hard',
        success: 'This was not made by whatever lives off the reef; they worship it. The hand that cut it thought in cones and spirals and in time laid end to end. It is a door that is meant to be opened at one moment, from inside, and the tide is that moment\'s clock.',
        extreme: 'The carvings are a key\'s shape, cut in reverse. Whatever fits them is long and slender and was made to be held, a stave or a rod, and someone took it away from here a very long time ago.',
        failure: 'Your eyes slide off the carving. When you look away the green stays on them.',
      },
    ],
  },
};

/** The gate's carvings are hard to hold in the eye. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  tide_gate: { angleDeg: 5, range: 4, maxBlurPx: 2.5, onsetSec: 8, recoverSec: 2.5 },
};

/**
 * Stains for the Wood's lamp: whatever broke out of the holding cage went out by
 * the shed door and the fence gate, and the same feet come up out of the sea to
 * the Tide-Gate and back.
 */
const UV_STAINS: UvStain[] = [
  {
    id: 'uv_cage_prints', kind: 'brine', mark: 'prints', feet: [0.55, 0.9],
    // Out between the bent bars, across the shed, out of the door, through the fence gate.
    floor: [[2.4, -29.75], [0.4, -29.4], [-2.4, -27.4], [-2.4, -25.6], [-6.5, -25.2], [-10.0, -25.5], [-12.5, -25.4], [-15.5, -24.0]],
    floorY: [1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1.2],
    title: 'Wet Prints from the Cage',
    text: 'Bare feet in dried brine, glowing under the lamp, step out between the bent bars and cross the shed to the door. They are long, and the toes are joined by webbing most of their length. Out on the wharf they stride out, longer and longer, through the open gate and away down the street toward the south.',
    checks: [
      {
        skill: 'Track', action: 'Read the stride',
        success: 'It was not running. An even, unhurried walk, the walk of something that knew where it was going and did not think anyone would stop it.',
        failure: 'Prints, going out. That much is plain.',
      },
    ],
  },
  {
    id: 'uv_gate_prints', kind: 'brine', mark: 'prints', feet: [1, 1],
    // From the stair's foot, along the plank walk and over the mud, to stand at the gate.
    floor: [[-12.2, 30.25], [-4.0, 30.6], [2.0, 31.6], [6.5, 32.0], [9.0, 32.0], [10.6, 32.0]],
    floorY: [0.42, 0.42, 0.42, 0.42, 0.18, 0.12],
    title: 'Webbed Prints to the Gate',
    text: 'Down the sea-wall stair and along the plank walk, fully webbed now and clawed, the prints go out across the mud and stop at the foot of the gate, together, as if whatever made them stood there a long while facing the stone. None go round the pylon, and none come back.',
  },
  {
    id: 'uv_gate_hand', kind: 'brine', mark: 'handprint', webbed: true,
    wall: { from: [10.3, 1.4, 31.6], toward: [1, 0, 0], size: [0.4, 0.5] },
    title: 'A Hand on the Gate',
    text: 'A webbed hand, pressed flat to the carved stone at the height of a man\'s shoulder, fingers spread across the seam. It did not slide. It was held there.',
  },
  {
    id: 'uv_cage_glyph', kind: 'brine', mark: 'glyph',
    wall: { from: [3.8, 1.6, -27.0], toward: [0, 0, 1], size: [0.7, 0.7] },
    title: 'A Sign Inside the Cage',
    text: 'On the shed wall inside the cage, drawn with a wet finger: the seven-spoked ring from the Tide-Gate, small and careful, and under it the hooked count, one mark short of the gate\'s.',
  },
];

export const WATERFRONT_LEVEL: WalkthroughLevel = {
  id: 'innsmouth-waterfront',
  model: '/innsmouth-waterfront.glb',
  title: 'The Waterfront · Innsmouth',
  loadingText: 'Walking down to the harbour…',
  errorText: 'The waterfront could not be loaded.',
  enterText: 'Click to walk down to the water',
  leaveLabel: 'Leave the waterfront',
  credit: '"Dagon - Lovecraft lore" by CMBC — CC BY 4.0',
  examinables: EXAMINABLES,
  gazeHazards: GAZE_HAZARDS,
  uvStains: UV_STAINS,
  // The gate is carved into the pylon (Architecture, so a hand can be found on
  // it), not furniture: this box is what E examines.
  spots: {
    tide_gate: { min: [10.75, 0, 31.0], max: [11.25, 3.0, 33.0] },
  },
  // Ten cultists kneeling in prayer before the Tide-Gate (the prop library's
  // cultist, Mixamo "Praying": my-summer-game tools/export_cultist_praying.sh),
  // in two arcs facing it, an aisle left down the middle from the plank walk.
  // Heights are the mud's under each; phases and sizes keep them out of step.
  performers: ([
    [9.29, 30.52, 0.177], [8.84, 31.37, 0.168], [8.84, 32.63, 0.165], [9.29, 33.48, 0.161],
    [8.99, 29.17, 0.17], [8.11, 30.09, 0.155], [7.64, 31.21, 0.142], [7.64, 32.79, 0.157], [8.11, 33.91, 0.166], [8.99, 34.83, 0.16],
  ] as const).map(([x, z, y], i) => ({
    model: '/avatars/cultist-praying.glb', clip: 'Pray', at: [x, z] as [number, number], y,
    turnDeg: Math.round(Math.atan2(11.05 - x, 32 - z) * 180 / Math.PI),
    scale: [1, 0.96, 1.03, 0.98, 1.04, 0.97, 1.01, 0.95, 1.02, 0.99][i],
    phase: (i * 0.73) % 2,
  })),
  // Dagon, called up out of the sea by gamelord at the Tide-Gate (E) and sent
  // back down the same way: he roars, then comes up behind the pylon, already
  // climbing (the Mixamo climb, to frame 52): the first half of it under the
  // water, the second half as he breaks the surface and hauls himself half out.
  // Then he turns his head down to look at the kneeling congregation. Nothing
  // more. Below the water nothing of him is drawn. (`deep` puts the top of him
  // at the waterline halfway up.)
  // ("Dagon - Lovecraft lore", CMBC, CC BY: my-summer-game tools/export_dagon_giant.sh,
  // whose PLACE must match at/y/turnDeg/scale/holdAt here.)
  summon: {
    id: 'dagon', spot: 'tide_gate', name: 'Dagon',
    model: '/props/dagon-giant.glb', clip: 'Climb', holdAt: 52 / 30,
    at: [35.7, 21.6], y: -33.3, turnDeg: -90, scale: 30,
    lookAt: [8.5, 0.4, 32],
    deep: 57.5, back: 7, riseSec: 14, sinkSec: 12, waterline: -0.6, fog: 0.45,
    // He roars from the deep first ("Colossal Ocean God Emergence"), breaks the
    // water about eight seconds in and holds as it ends; the ground and the sea shake.
    delaySec: 1,
    roar: { src: '/sounds/dagon-roar.mp3', duration: 14, volume: 1 },
    quake: { strength: 0.07, near: 30, far: 110 },
  },

  // Everyone comes in on the flats in front of the pylon, at the back of the
  // kneeling congregation, at the end of the plank walk, facing the Tide-Gate.
  start: { at: [5.6, 0.42, 32], yawDeg: -90 },
  // The GM sets the time of day and the rain; all of it is out in the weather.
  weather: true,
  // Gulls over the harbour by day.
  birds: {
    model: '/props/seagull.glb', times: ['dawn', 'day'], everySec: 90, count: [3, 6], wingspan: 1.4, over: [6, 0], height: [10, 22],
    cries: ['/sounds/gull-1.mp3', '/sounds/gull-2.mp3', '/sounds/gull-3.mp3', '/sounds/gull-4.mp3', '/sounds/gull-5.mp3'],
  },
  // The shed's bare bulb (1), the wharf lamps (2, 3), the street lamp by the net
  // loft (4), the breakwater light (5), the Tide-Gate's glow (6) and the pylon's
  // seams (7), the net loft's storm lantern (8).
  lamps: {
    color: 0xffb46a, intensity: 7, distance: 12,
    only: {
      Lamp_1: { color: 0xffc98a, intensity: 4, distance: 8 },
      Lamp_5: { color: 0xff8a3a, intensity: 6, distance: 10 },
      Lamp_6: { color: 0x40ff9a, intensity: 6, distance: 9 },
      Lamp_7: { color: 0x2fe08a, intensity: 10, distance: 18 },
      Lamp_8: { color: 0xffa860, intensity: 2.5, distance: 6 },
    },
  },
  atmosphere: {
    background: 0x0b0e12,
    fogColor: 0x10151a,
    fogDensity: 0.028,
    sky: 0x46536a,
    ground: 0x0a0b0a,
    fill: 0.5,
    // A low moon out over the sea.
    moon: { color: 0x9fb2d4, intensity: 0.8, position: [60, 30, 20] },
  },
};
