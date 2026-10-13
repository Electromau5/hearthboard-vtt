import type { RadioStation } from './walkthrough';

/**
 * What a wireless in New England picks up across the AM band in 1928, at the
 * frequencies those stations really held. A tunable set (`RadioSet.dial`)
 * hears these besides its own station; everywhere else on the dial is static.
 * Each plays round the clock, so turning back to one finds it further on.
 */
export const BOSTON_BAND: RadioStation[] = [
  { kc: 590, name: 'WEEI Boston · news', src: '/news-bulletin-1.mp3' },
  { kc: 990, name: 'WBZA Boston · the symphony hour', src: '/soundtrack-1.mp3' },
  { kc: 1230, name: 'WNAC Boston · dance orchestra', src: '/speakeasy-1.mp3' },
];
