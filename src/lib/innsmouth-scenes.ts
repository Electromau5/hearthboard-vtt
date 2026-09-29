/**
 * Pins on the Innsmouth map — positions follow the red pins and arrows on
 * /innsmouth-map.jpeg (mapX/mapY are percentages of the image). Shared by the
 * board's Innsmouth map (page.tsx) and the pins on the Black Archive's wall
 * chart (black-archive.ts), so moving a pin here moves both.
 */
export const INNSMOUTH_SCENES = [
  { id: 'i1', locationId: 'loc-inn-refinery',    name: 'The Marsh Refinery',                  short: 'Marsh Refinery', mapX: 28, mapY: 13 },
  { id: 'i2', locationId: 'loc-inn-cellars',     name: 'The Cellars',                         short: 'Cellars',        mapX: 48, mapY: 35 },
  { id: 'i9', locationId: 'loc-inn-house',       name: 'The Derelict House',                  short: 'Derelict House', mapX: 47, mapY: 45 },
  { id: 'i4', locationId: 'loc-inn-docks',       name: 'Federal Quarantine Docks',            short: 'Fed. Docks',     mapX: 70, mapY: 31 },
  { id: 'i6', locationId: 'loc-inn-reef',        name: 'Decrepit Coastal Reef & Breakwater',  short: 'Reef',           mapX: 46, mapY: 83 },
  { id: 'i10', locationId: 'loc-inn-vessel',     name: 'Fishing Vessel',                      short: 'Fishing Vessel', mapX: 50, mapY: 79 },
  { id: 'i7', locationId: 'loc-inn-pylon',       name: 'Submerged Basalt Pylon / Tide-Gate',  short: 'Tide-Gate',      mapX: 72, mapY: 72 },
  { id: 'i8', locationId: 'loc-inn-redacted',    name: 'Redacted Operational Area',           short: 'Redacted',       mapX: 29, mapY: 62 },
];
