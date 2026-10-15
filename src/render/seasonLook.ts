import * as THREE from 'three';
import { SEASON, secs, TICK_HZ } from '../sim/data';

/**
 * The turning year on the land (render only): the seasons of `src/sim/seasons.ts`, seen. Spring greens
 * are fresh, summer grass goes gold, broadleaf trees turn orange, red and gold in autumn, and winter
 * frosts the meadows, strips the broadleaves and lays snow on whatever faces the sky. One season fades
 * into the next over its last `BLEND` seconds; snow settles over the first `SETTLE` seconds of winter and
 * melts over the first `MELT` seconds of spring. The shader side lives in `materials.ts` (`season`).
 */

/** Seconds at the end of a season over which it fades into the next. */
export const BLEND = 20;
/** Seconds into winter for the snow to lie full. */
export const SETTLE = 45;
/** Seconds into spring for the last snow to melt. */
export const MELT = 30;

/** How much of each season shows (spring, summer, autumn, winter), and how much snow lies (0..1). */
export const seasonUniforms = {
  uSeason: { value: new THREE.Vector4(1, 0, 0, 0) },
  uSnow: { value: 0 },
};

const ease = (t: number) => t * t * (3 - 2 * t);

export interface SeasonLook {
  w: [number, number, number, number];
  snow: number;
}

/** The look of the year at a tick: weights that sum to 1, and the snow cover. */
export function seasonLook(tick: number): SeasonLook {
  const len = secs(SEASON.len);
  const year = Math.floor(tick / len);
  const i = year % 4;
  const into = (tick - year * len) / TICK_HZ;
  const left = SEASON.len - into;
  const t = left < BLEND ? ease(1 - left / BLEND) : 0;
  const w: [number, number, number, number] = [0, 0, 0, 0];
  w[i] += 1 - t;
  w[(i + 1) % 4] += t;
  let snow = 0;
  if (i === 3) snow = ease(Math.min(1, into / SETTLE));
  else if (i === 0 && year > 0) snow = ease(Math.max(0, 1 - into / MELT));
  return { w, snow };
}

const NAMES = ['spring', 'summer', 'autumn', 'winter'];

/** `?season=winter` (or spring, summer, autumn) in the address holds the land in a season, for trying the looks out. */
export function forcedSeason(): number | null {
  if (typeof location === 'undefined') return null;
  const i = NAMES.indexOf(new URLSearchParams(location.search).get('season') ?? '');
  return i < 0 ? null : i;
}

/** Set the shader's season for this frame. */
export function setSeasonLook(tick: number, forced: number | null = forcedSeason()): void {
  const look = forced === null ? seasonLook(tick) : { w: [0, 1, 2, 3].map((k) => (k === forced ? 1 : 0)), snow: forced === 3 ? 1 : 0 };
  seasonUniforms.uSeason.value.set(look.w[0], look.w[1], look.w[2], look.w[3]);
  seasonUniforms.uSnow.value = look.snow;
}
