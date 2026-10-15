import { SEASON, TICK_HZ } from '../sim/data';
import { seasonUniform } from './materials';

/**
 * The land shows the season (#185): spring meadows come in fresh, broadleaf woods turn gold and rust in
 * autumn, and winter frosts the grass, lays snow on whatever faces the sky and leaves the berry bushes
 * bare. Render only, from the tick alone, like the seasons themselves (`src/sim/seasons.ts`).
 *
 * Each season's look holds through the middle of the season and eases into the next over its last
 * `TURN_FROM` of it and the first `TURN_TO` of the next, so the woods start to colour in late summer:
 * the player sees winter coming a season before it bites.
 */

/** How strongly each look shows: spring's fresh green, autumn's leaves, winter's frost and snow. */
export interface SeasonLook {
  fresh: number;
  autumn: number;
  winter: number;
}

/** Spring, summer, autumn, winter. Winter keeps a little of autumn's brown in what leaves are left. */
const LOOKS: SeasonLook[] = [
  { fresh: 1, autumn: 0, winter: 0 },
  { fresh: 0, autumn: 0, winter: 0 },
  { fresh: 0, autumn: 1, winter: 0 },
  { fresh: 0, autumn: 0.35, winter: 1 },
];

/** Fractions of a season: the turn starts this far into the old one and ends this far into the new. */
export const TURN_FROM = 0.7;
export const TURN_TO = 0.2;

/** The look at a tick. `forced` (0–3) pins one season's look, for `?season=`. */
export function seasonLookAt(tick: number, forced: number | null = null): SeasonLook {
  if (forced !== null) return { ...LOOKS[forced] };
  const pos = tick / (SEASON.len * TICK_HZ);
  const i = Math.floor(pos);
  const f = pos - i;
  // Before the turn begins this season looks like itself; after it, it eases toward the next.
  let from: number;
  let k: number;
  if (f >= TURN_FROM) {
    from = i;
    k = (f - TURN_FROM) / (1 - TURN_FROM + TURN_TO);
  } else if (f < TURN_TO && i > 0) {
    from = i - 1;
    k = (1 - TURN_FROM + f) / (1 - TURN_FROM + TURN_TO);
  } else {
    return { ...LOOKS[i % 4] };
  }
  const a = LOOKS[from % 4];
  const b = LOOKS[(from + 1) % 4];
  const e = k * k * (3 - 2 * k);
  return {
    fresh: a.fresh + (b.fresh - a.fresh) * e,
    autumn: a.autumn + (b.autumn - a.autumn) * e,
    winter: a.winter + (b.winter - a.winter) * e,
  };
}

const NAMES = ['spring', 'summer', 'autumn', 'winter'];

/** `?season=autumn` (or 0–3) pins the land's look, to see a season without waiting for it. */
export function forcedSeason(): number | null {
  if (typeof location === 'undefined') return null;
  const v = (new URLSearchParams(location.search).get('season') ?? '').toLowerCase();
  if (!v) return null;
  const n = NAMES.indexOf(v);
  if (n >= 0) return n;
  const d = parseInt(v, 10);
  return d >= 0 && d < 4 ? d : null;
}

/** Paint the season on every material that wears it. */
export function paintSeason(tick: number): void {
  const l = seasonLookAt(tick, forcedSeason());
  seasonUniform.value.set(l.fresh, l.autumn, l.winter);
}
