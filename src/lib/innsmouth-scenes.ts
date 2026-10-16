/**
 * Pins on the Innsmouth map — positions follow the red pins and arrows on
 * /innsmouth-map.jpeg (mapX/mapY are percentages of the image). Shared by the
 * board's Innsmouth map (page.tsx) and the pins on the Black Archive's wall
 * chart (black-archive.ts), so moving a pin here moves both.
 *
 * `image` is the picture the board's info panel shows for the pin. An image
 * set in Admin → Locations takes its place.
 *
 * The waterfront pin (i4) is one walkthrough level for what were three pins:
 * the Federal Quarantine Docks (i4), the reef and breakwater (i6) and the
 * Tide-Gate (i7). It keeps the docks' place and id, which is where the 3D
 * town's Pin_i4 marker stands; the Black Archive's wall chart still pins all
 * three (black-archive.ts).
 */
export const INNSMOUTH_SCENES = [
  { id: 'i1', locationId: 'loc-inn-refinery',    name: 'The Marsh Refinery',                  short: 'Marsh Refinery', mapX: 28, mapY: 13, image: '/innsmouth/refinery.webp' },
  { id: 'i2', locationId: 'loc-inn-cellars',     name: 'The Cellars',                         short: 'Cellars',        mapX: 48, mapY: 35, image: '/innsmouth/cellars.webp' },
  { id: 'i9', locationId: 'loc-inn-house',       name: 'The Derelict House',                  short: 'Derelict House', mapX: 47, mapY: 45, image: '/innsmouth/house.webp' },
  { id: 'i4', locationId: 'loc-inn-waterfront',  name: 'The Waterfront: Quarantine Docks, Reef & Tide-Gate', short: 'Waterfront', mapX: 70, mapY: 31, image: '/innsmouth/docks.webp' },
  { id: 'i10', locationId: 'loc-inn-vessel',     name: 'Fishing Vessel',                      short: 'Fishing Vessel', mapX: 50, mapY: 79, image: '/innsmouth/vessel.webp' },
  { id: 'i8', locationId: 'loc-inn-redacted',    name: 'Redacted Operational Area',           short: 'Redacted',       mapX: 29, mapY: 62, image: '/innsmouth/redacted.webp' },
];
