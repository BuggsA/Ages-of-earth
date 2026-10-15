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

/** The look at a tick, or the held season's when one is forced. */
export function lookFor(tick: number, forced: number | null = forcedSeason()): SeasonLook {
  if (forced === null) return seasonLook(tick);
  return { w: [0, 1, 2, 3].map((k) => (k === forced ? 1 : 0)) as SeasonLook['w'], snow: forced === 3 ? 1 : 0 };
}

type RGB = [number, number, number];
/** Overview-map colours per season (spring, summer, autumn, winter): meadow and woods. */
const MAP_GRASS: RGB[] = [[111, 165, 72], [158, 168, 78], [176, 138, 70], [150, 168, 150]];
const MAP_WOODS: RGB[] = [[47, 106, 50], [47, 100, 44], [190, 96, 40], [36, 70, 52]];
const MAP_SNOW: RGB = [236, 242, 248];

/** A meadow or wood colour on the minimap for a look: the seasons blended, then snow laid over by its cover. */
export function mapTint(look: SeasonLook, woods: boolean): RGB {
  const set = woods ? MAP_WOODS : MAP_GRASS;
  const out: RGB = [0, 0, 0];
  for (let k = 0; k < 4; k++) for (let c = 0; c < 3; c++) out[c] += set[k][c] * look.w[k];
  const cover = look.snow * (woods ? 0.35 : 0.85);
  for (let c = 0; c < 3; c++) out[c] = Math.round(out[c] + (MAP_SNOW[c] - out[c]) * cover);
  return out;
}

/** Set the shader's season for this frame. */
export function setSeasonLook(tick: number, forced: number | null = forcedSeason()): void {
  const look = lookFor(tick, forced);
  seasonUniforms.uSeason.value.set(look.w[0], look.w[1], look.w[2], look.w[3]);
  seasonUniforms.uSnow.value = look.snow;
}

/** How far from the shore, in lake depth, winter ice reaches at a snow cover (the water shader's `reach`). */
export function iceReach(snow: number): number {
  return snow * 0.62;
}

/** How frozen (0..1) water of a depth is at a snow cover: shallows first, the deep middle stays open. */
export function iceCover(snow: number, depth: number): number {
  if (snow <= 0) return 0;
  const t = (iceReach(snow) - depth) / 0.1;
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}
