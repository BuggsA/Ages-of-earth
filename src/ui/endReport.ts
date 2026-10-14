import type { HistoryPoint } from '../sim/types';

/**
 * When a player reached each epoch, read from the history the rules already keep for the post-game
 * timeline (sampled every few seconds, so a time is good to a sample). Returns [epoch, tick] pairs for
 * every epoch after the first, in order; nothing here touches the rules or the save.
 */
export function epochArrivals(history: readonly HistoryPoint[]): [number, number][] {
  const out: [number, number][] = [];
  let seen = history.length ? history[0].epoch : 0;
  for (const pt of history) {
    while (seen < pt.epoch) {
      seen++;
      out.push([seen, pt.tick]);
    }
  }
  return out;
}

/** "Bronze 8m · Iron 17m": the arrivals as short text, minutes rounded down. */
export function arrivalText(arrivals: [number, number][], names: readonly string[], tickHz: number): string {
  return arrivals.map(([e, t]) => `${names[e]} ${Math.floor(t / tickHz / 60)}m`).join(' · ');
}
