/**
 * Time of day and rain in the walkthrough levels, set by the GM
 * (`/admin/experience`, or the bar the GM sees inside a level) and shared with
 * every player through `/api/weather`. A level opts in with `weather: true`.
 *
 * Night is the level as it was built — its own `atmosphere` — so turning the
 * system on changes nothing until the GM picks another time. Dawn, day and
 * evening are New England coastal light: overcast, salt-hazed, never bright.
 */

import type { WalkthroughLevel } from './walkthrough';

export const TIMES = ['dawn', 'day', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const TIME_LABELS: Record<TimeOfDay, string> = { dawn: 'Dawn', day: 'Day', evening: 'Evening', night: 'Night' };

export const RAINS = ['none', 'light', 'heavy', 'storm'] as const;
export type Rain = (typeof RAINS)[number];
export const RAIN_LABELS: Record<Rain, string> = { none: 'Dry', light: 'Light rain', heavy: 'Heavy rain', storm: 'Storm' };

/** What `/api/weather` stores per level. `rain` is absent on states saved before rain existed. */
export type WeatherState = { time: TimeOfDay; rain?: Rain; setAt: number; setBy: string };

export function isRain(v: unknown): v is Rain {
  return typeof v === 'string' && (RAINS as readonly string[]).includes(v);
}

/** What each strength of rain does. */
export type RainSpec = {
  /** Streaks in the air round the investigator. */
  drops: number;
  /** Metres a second the wind drives them sideways. */
  wind: number;
  /** 0..1 — how far the cloud dims the sun, the sky and the fill. */
  overcast: number;
  /** Added to the fog's density. */
  haze: number;
  /** 0..1 — the rain's loudness. */
  loudness: number;
  /** Lightning and thunder. */
  lightning: boolean;
  /** Birds stay down. */
  grounded: boolean;
};

export const RAIN_SPECS: Record<Rain, RainSpec> = {
  none: { drops: 0, wind: 0, overcast: 0, haze: 0, loudness: 0, lightning: false, grounded: false },
  light: { drops: 1400, wind: 0.6, overcast: 0.3, haze: 0.008, loudness: 0.3, lightning: false, grounded: false },
  heavy: { drops: 5000, wind: 1.8, overcast: 0.55, haze: 0.02, loudness: 0.65, lightning: false, grounded: true },
  storm: { drops: 9000, wind: 4.5, overcast: 0.72, haze: 0.032, loudness: 1, lightning: true, grounded: true },
};

/** Levels whose time of day the GM can set, for the admin panel (ids match `WalkthroughLevel.id`). */
export const WEATHER_LEVELS: { id: string; title: string }[] = [
  { id: 'vessel', title: 'The Esther Gilman · Innsmouth Reef' },
];

/**
 * A sky under cloud: colours drained toward their own grey and darkened, the
 * sun and the fill dimmed, the haze thickened, the stars gone behind it.
 */
export function withRain(sky: Sky, rain: Rain): Sky {
  const k = RAIN_SPECS[rain].overcast;
  if (k === 0) return sky;
  const grey = (hex: number, dim: number) => {
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const mix = (c: number) => Math.round((c + (lum * 0.92 - c) * k) * (1 - dim * k));
    return (mix(r) << 16) | (mix(g) << 8) | mix(b);
  };
  return {
    ...sky,
    zenith: grey(sky.zenith, 0.45),
    horizon: grey(sky.horizon, 0.35),
    sunColor: grey(sky.sunColor, 0.2),
    sunIntensity: sky.sunIntensity * (1 - k),
    fogColor: grey(sky.fogColor, 0.3),
    fogDensity: sky.fogDensity + RAIN_SPECS[rain].haze,
    hemiSky: grey(sky.hemiSky, 0.25),
    fill: sky.fill * (1 - k * 0.45),
    stars: sky.stars * Math.max(0, 1 - k * 1.6),
  };
}

export function isTimeOfDay(v: unknown): v is TimeOfDay {
  return typeof v === 'string' && (TIMES as readonly string[]).includes(v);
}

/** Everything a time of day sets in a level. Colours are hex numbers, as in `atmosphere`. */
export type Sky = {
  /** Sky dome: overhead and at the horizon. */
  zenith: number;
  horizon: number;
  /** The sun (or moon): colour, strength, and the direction it lies in from the level (need not be unit length). */
  sunColor: number;
  sunIntensity: number;
  sunDir: [number, number, number];
  fogColor: number;
  fogDensity: number;
  /** Hemisphere fill. */
  hemiSky: number;
  hemiGround: number;
  fill: number;
  /** 0..1 — how many stars show. */
  stars: number;
};

const PRESETS: Record<Exclude<TimeOfDay, 'night'>, Sky> = {
  // Sun just up out of the sea to the east, through haze.
  dawn: {
    zenith: 0x2e3d62, horizon: 0xd9926a,
    sunColor: 0xffb47e, sunIntensity: 1.6, sunDir: [1, 0.18, 0.3],
    fogColor: 0x8d7c7c, fogDensity: 0.034,
    hemiSky: 0x8c94b4, hemiGround: 0x2c241e, fill: 0.65,
    stars: 0.04,
  },
  // A grey Massachusetts day: high sun behind thin cloud, flat light.
  day: {
    zenith: 0x6f88a6, horizon: 0xbcc6cc,
    sunColor: 0xfff2df, sunIntensity: 2.6, sunDir: [0.4, 0.85, 0.35],
    fogColor: 0xa9b3b9, fogDensity: 0.026,
    hemiSky: 0xc3cfdb, hemiGround: 0x4f473e, fill: 1.15,
    stars: 0,
  },
  // Sun low in the west, the sky going to rust.
  evening: {
    zenith: 0x232848, horizon: 0xc4643a,
    sunColor: 0xff8a4e, sunIntensity: 1.3, sunDir: [-1, 0.14, -0.25],
    fogColor: 0x5e4442, fogDensity: 0.036,
    hemiSky: 0x6b6890, hemiGround: 0x261c18, fill: 0.55,
    stars: 0.03,
  },
};

/** The sky for a time of day in a level; night is the level's own atmosphere. */
export function skyFor(time: TimeOfDay, level: WalkthroughLevel): Sky {
  if (time !== 'night') return PRESETS[time];
  const a = level.atmosphere;
  return {
    zenith: a.background,
    horizon: a.fogColor,
    sunColor: a.moon?.color ?? 0x8899bb,
    sunIntensity: a.moon?.intensity ?? 0,
    sunDir: a.moon?.position ?? [-18, 22, -10],
    fogColor: a.fogColor,
    fogDensity: a.fogDensity,
    hemiSky: a.sky,
    hemiGround: a.ground,
    fill: a.fill,
    stars: 1,
  };
}
