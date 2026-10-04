/**
 * Downtown — a street of brick shopfronts under apartment blocks, a first-person
 * walkthrough level (see walkthrough.ts) for the default map's Downtown pin.
 * Built in ~/dev/my-summer-game (tools/build_downtown_cli.gd) from the
 * "street city (7) for games FREE" asset by dasy444 on Sketchfab (Sketchfab
 * Standard licence), and exported to /downtown.glb by tools/export_downtown.sh.
 *
 * Ids below match the model's `Examine_<id>` nodes. The text is PLACEHOLDER
 * description for the GM to replace with the campaign's clues.
 */

import type { Examinable, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  newsstand: {
    title: 'Newsstand',
    text: "A green kiosk on the corner, shuttered for the night but for a stack of the evening edition under a brick. The headline board reads: HARBOUR MEN MISSING — THIRD IN A FORTNIGHT. Someone has pencilled 'ASK AT THE DOCKS' in the margin.",
  },
  callbox: {
    title: 'Police Call Box',
    text: 'A blue call box on a post, its little lamp burning. The door is locked; a patrolman\'s key would open it. Scratched into the paint below the lamp, fresh: a ring with a fish-tailed cross inside it.',
  },
};

export const DOWNTOWN_LEVEL: WalkthroughLevel = {
  id: 'downtown',
  model: '/downtown.glb',
  title: 'Downtown · Boston',
  loadingText: 'Walking into town…',
  errorText: 'The street could not be loaded.',
  enterText: 'Click to walk the street',
  leaveLabel: 'Leave downtown',
  examinables: EXAMINABLES,
  // Outdoors: the GM sets the time of day and the rain (`/admin/experience`); night is the atmosphere below.
  weather: true,
  // Gulls up from the harbour by day, fewer than over the wreck.
  birds: {
    model: '/props/seagull.glb', times: ['dawn', 'day'], everySec: 150, count: [2, 4], wingspan: 1.4, over: [-4, 6], height: [14, 22],
    cries: ['/sounds/gull-1.mp3', '/sounds/gull-2.mp3', '/sounds/gull-3.mp3', '/sounds/gull-4.mp3', '/sounds/gull-5.mp3'],
  },
  // The street lamps, warm against a cold night.
  lamps: { color: 0xffc27a, intensity: 9, distance: 13 },
  atmosphere: {
    background: 0x05070c,
    fogColor: 0x080b12,
    fogDensity: 0.03,
    sky: 0x3d4a66,
    ground: 0x0c0a08,
    fill: 0.45,
    moon: { color: 0x9fb2d4, intensity: 1.4, position: [-20, 30, 12] },
  },
};
