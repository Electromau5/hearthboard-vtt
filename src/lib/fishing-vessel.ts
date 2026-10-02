/**
 * The derelict trawler "Esther Gilman", aground on the Innsmouth breakwater — a
 * first-person walkthrough level (see walkthrough.ts) built in Summer Engine
 * (~/dev/my-summer-game, tools/build_vessel_cli.gd) and exported to
 * /fishing-vessel.glb by `tools/export_vessel.sh` in that project.
 *
 * Ids below match the model's `Examine_<id>` nodes. As with the house, the text
 * is physical description only — the GM's to replace with the campaign's clues.
 */

import type { Examinable, GazeHazard, RadioSet, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  // Deck
  windlass: {
    title: 'Anchor Windlass',
    text: 'A hand-cranked windlass rusted solid. The chain runs forward to the hawse pipe and ends there, the last link wrenched open. The anchor is gone.',
  },
  hatch: {
    title: 'Fish Hold Hatch',
    text: 'The hatch boards are split and thrown back, their nails bent upward. On the port side the coaming is broken outward. Every splinter points up and out.',
  },
  nets: {
    title: 'Trawl Nets',
    text: 'A heap of trawl net gone stiff and black with rot, cork floats still strung along it. Caught deep in the mesh are fish bones, picked perfectly clean.',
  },
  davits: {
    title: 'Lifeboat Davits',
    text: 'Two iron davits over empty chocks. The falls hang short from the blocks, their ends cut clean rather than frayed. The lifeboat is gone.',
  },
  // Wheelhouse
  helm: {
    title: "Ship's Wheel",
    text: 'The wheel stands a little off centre, stiff on its spindle. One spoke is split where it meets the rim.',
  },
  binnacle: {
    title: 'Binnacle',
    text: 'A brass compass binnacle gone green. Under the cracked glass the card has settled, pointing out past the breakwater toward open water.',
  },
  logbook: {
    title: "Ship's Log",
    text: 'A water-swollen log in an oilcloth cover. The entries run in a steady hand until the last pages, where the lines crowd together and the ink has run. The final entry is more than a year old.',
  },
  wireless: {
    title: 'Wireless Set',
    text: 'A cabinet wireless, its valves dark and its case swollen with damp. The dial is turned to a station near the bottom of the band.',
  },
  oilskin: {
    title: 'Oilskin Coat',
    text: 'A yellow oilskin hangs on a hook on the bulkhead, stiff with dried salt. Its pockets are full of wet sand.',
  },
  // Galley
  stove: {
    title: 'Galley Stove',
    text: 'A cast-iron cookstove eaten through with rust. A pot still stands on it; whatever was cooking has dried to a black crust.',
  },
  mess_table: {
    title: 'Mess Table',
    text: 'Four places laid with tin plates. Three mugs stand beside them; the fourth place has none. The bench has been pushed back from the table.',
  },
  // Fo'c'sle
  bunks: {
    title: 'Crew Bunks',
    text: 'Two tiers of narrow bunks, the straw mattresses gone to mould. A blanket hangs off the lower bunk, trailing toward the door.',
  },
  sea_chest: {
    title: 'Sea Chest',
    text: "A sailor's chest with its lid thrown back and the hasp rusted open. It is empty except for a lining of old newspaper.",
  },
  photograph: {
    title: 'Photograph',
    text: 'A photograph tacked to the bulkhead: a crew of five on a quay, squinting into the sun. The face of the man at the end has been scratched away.',
  },
  // Fish hold
  scales: {
    title: 'Scales',
    text: 'A drift of scales across the hold floor, grey-green and faintly iridescent. Each one is as broad as a palm.',
  },
  sigil: {
    title: 'Carved Mark',
    text: 'A ring cut deep into the after bulkhead, a three-pronged sign inside it and short strokes spaced around its edge. The cuts are paler and cleaner than the wood around them.',
  },
  // Engine room
  engine: {
    title: 'Engine',
    text: 'A four-cylinder paraffin engine seized with rust. The flywheel will not turn. The fuel cock is shut.',
  },
  fuel_drums: {
    title: 'Fuel Drums',
    text: 'Three paraffin drums, one on its side. Rapped with a knuckle, all three ring hollow.',
  },
};

/** The carved mark in the hold blurs the view the longer it is watched. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  sigil: { angleDeg: 3, range: 4, maxBlurPx: 7, onsetSec: 3, recoverSec: 1 },
};

/** The wheelhouse wireless still picks up a news bulletin (station cue, bulletin, cue). */
const RADIOS: Record<string, RadioSet> = {
  wireless: { src: '/news-bulletin-1.mp3', volume: 0.9, refDistance: 1.5, loop: false },
};

export const VESSEL_LEVEL: WalkthroughLevel = {
  id: 'vessel',
  model: '/fishing-vessel.glb',
  title: 'The Esther Gilman · Innsmouth Reef',
  loadingText: 'Wading out to the wreck…',
  errorText: 'The vessel could not be loaded.',
  enterText: 'Click to climb aboard',
  leaveLabel: 'Leave the vessel',
  examinables: EXAMINABLES,
  gazeHazards: GAZE_HAZARDS,
  radios: RADIOS,
  atmosphere: {
    background: 0x070b10,
    fogColor: 0x070b10,
    fogDensity: 0.035,
    sky: 0x51607a,
    ground: 0x0a0806,
    fill: 0.55,
    // A low moon over the breakwater; the hull shades everything below deck.
    moon: { color: 0xa9bbd8, intensity: 2.2, position: [-18, 22, -10] },
  },
};
