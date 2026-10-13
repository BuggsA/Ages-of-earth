import { RELIC, secs } from './data';
import { nearestWalkable, relicOnTile } from './grid';
import type { Building, GameState, Relic, Unit } from './types';
import { exitSpot } from './world';

/**
 * Relics: priests carry them home to a Temple, where each brings in a little gold for as long as the
 * Temple stands. They can't be destroyed: a fallen carrier lets go of theirs where they fell, a fallen
 * Temple spills its relics round the rubble. A side that keeps every relic on the map wins once a
 * wonder's countdown runs out, unless someone takes one back first.
 */

export function relicAt(s: GameState, id: number): Relic | undefined {
  return s.relics.find((r) => r.id === id);
}

/** The relic a unit carries, if any. */
export function carriedBy(s: GameState, u: Unit): Relic | undefined {
  return s.relics.find((r) => r.carrier === u.id);
}

/** How many relics a Temple keeps. */
export function keptIn(s: GameState, b: Building): number {
  let n = 0;
  for (const r of s.relics) if (r.temple === b.id) n++;
  return n;
}

/** Set a relic down on open ground at (or near) a point. */
export function letGo(s: GameState, r: Relic, x: number, y: number, owner: number): void {
  // Never where nobody could walk (a fallen carrier may have been aboard a ship), nor on another relic
  // (this one is still held while the spot is found, so it doesn't count).
  let tile = nearestWalkable(s, x, y, 24);
  for (let k = 0; tile >= 0 && k < 8 && relicOnTile(s, tile % s.w, Math.floor(tile / s.w)); k++) tile = nearestWalkable(s, (tile % s.w) + 1.5, Math.floor(tile / s.w) + 0.5, 24);
  r.carrier = 0;
  r.temple = 0;
  if (tile >= 0) {
    r.x = (tile % s.w) + 0.5;
    r.y = Math.floor(tile / s.w) + 0.5;
  }
  s.events.push({ k: 'relic', id: r.id, owner, what: 'dropped', x: r.x, y: r.y });
}

/** The team that keeps every relic, or -1. */
function holder(s: GameState): number {
  if (!s.relics.length) return -1;
  let team = -1;
  for (const r of s.relics) {
    const b = r.temple ? s.byId.get(r.temple) : undefined;
    if (!b || b.hp <= 0) return -1;
    const t = s.players[b.owner].team;
    if (team >= 0 && t !== team) return -1;
    team = t;
  }
  return team;
}

/**
 * Each tick, before the fallen are taken away: relics follow their carriers, fallen carriers and
 * Temples let theirs go, kept relics bring in gold, and the countdown for keeping them all runs.
 */
export function updateRelics(s: GameState): void {
  const pay = s.tick % secs(RELIC.every) === 0;
  for (const r of s.relics) {
    if (r.carrier) {
      const u = s.byId.get(r.carrier);
      if (!u || u.kind !== 'unit') r.carrier = 0;
      else {
        r.x = u.x;
        r.y = u.y;
        if (u.hp <= 0) letGo(s, r, u.x, u.y, u.owner);
      }
    }
    if (r.temple) {
      const b = s.byId.get(r.temple);
      if (!b || b.kind !== 'building') r.temple = 0;
      else if (b.hp <= 0) {
        // Spilled out round the rubble, each on its own side.
        const k = s.relics.indexOf(r);
        const spot = exitSpot(s, b, b.x + (k % 3) - 1, b.y + (k % 2 ? -b.size : b.size), -1);
        letGo(s, r, spot.x, spot.y, b.owner);
      } else if (pay) {
        const p = s.players[b.owner];
        p.res.gold += RELIC.gold;
        p.stats.gathered += RELIC.gold;
      }
    }
  }
  // In a campaign chapter the goals decide the match, so keeping every relic starts no countdown.
  const team = s.scenario ? -1 : holder(s);
  if (team !== s.relicTeam) {
    s.relicTeam = team;
    s.relicTimer = team >= 0 ? s.wonderTime : -1;
    s.events.push({ k: 'relicHold', team, ticks: s.relicTimer });
  } else if (s.relicTimer > 0) s.relicTimer--;
}
