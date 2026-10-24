import { HIVE, TICK_HZ, domainOf, secs } from './data';
import { hasWalked } from './ages';
import { hurt, peace } from './combat';
import { onFire, smokeNear } from './fire';
import { seasonAt } from './seasons';
import { treesNear } from './snares';
import { isEnemy } from './world';
import type { Building, GameState, Player, Unit } from './types';
import { R_TREE } from './types';

/**
 * The Age of the Hive (`docs/wild-road.md` §3): the Wild route's third age, where the woods themselves fight for their people.
 * - A Hive is set among standing trees and works while they stand. Awake, its bees sting every rival on the ground who stands in a
 *   wood within `HIVE.reach` tiles of it, past armour, and slow them. It pays honey as food, or mead as gold by a Market, and in
 *   summer it doubles the Kitchen Gardens beside it (`pollinated`, read by `gardenMul`).
 * - Bees sleep in winter, and smoke quiets them: a fire within `HIVE.smoke` tiles of a Hive puts it to sleep for `HIVE.quiet`
 *   seconds (`Building.smoked`), and fire takes the skep itself (`FIRE.burns`). Fell its woods and the bees are gone.
 * - Blowpipe Hunters' darts put venom in what they hit (`Unit.venom`): doses that stack, burn past armour and slow.
 * - A people that has walked the Hive breeds the Cave Bear at its Den, and its War Wolves grow into Dire Wolves (`statsFor`).
 * Hives, darts and bears belong to any people that has walked the Hive, in every age after (`buildBarred`, `barred`).
 */

/** Whether a people keeps what the Hive gave it: it stands in the Hive, or has stood there. */
export const keepsBees = (p: Player): boolean => hasWalked(p, 'hive');

/** Why a Hive can't go on this tile, or null: too few trees round it, or another Hive too near (anyone's). */
export function hiveSpot(s: GameState, tx: number, ty: number): 'bare' | 'hives' | null {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'hive' || e.hp <= 0) continue;
    if (Math.abs(e.tx - tx) < HIVE.apart && Math.abs(e.ty - ty) < HIVE.apart) return 'hives';
  }
  return treesNear(s, tx, ty) < HIVE.trees ? 'bare' : null;
}

/** Why a Hive's bees are quiet now, or null when they are awake. */
export function hiveQuiet(s: GameState, b: Building): 'winter' | 'smoke' | 'bare' | null {
  if (!b.built || b.hp <= 0) return 'bare';
  if (seasonAt(s) === 3) return 'winter';
  if ((b.smoked !== undefined && s.tick < b.smoked) || onFire(s, b)) return 'smoke';
  return treesNear(s, b.tx, b.ty) < HIVE.trees ? 'bare' : null;
}

/** The Hives awake now, in id order. */
function awakeHives(s: GameState): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'hive' && !s.players[e.owner]?.defeated && !hiveQuiet(s, e)) out.push(e);
  return out;
}

/** Whether a Hive pays mead (gold) rather than honey (food): a finished Market of its people stands within `HIVE.market` tiles. */
export function brewsMead(s: GameState, b: Building): boolean {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'market' || e.owner !== b.owner || !e.built || e.hp <= 0) continue;
    const dx = Math.max(0, e.tx - b.tx, b.tx - (e.tx + e.size - 1));
    const dy = Math.max(0, e.ty - b.ty, b.ty - (e.ty + e.size - 1));
    if (Math.max(dx, dy) <= HIVE.market) return true;
  }
  return false;
}

/** Whether a unit stands in a wood: `HIVE.wood` trees in the 3-by-3 round its tile (the Wildwood's woodland ways ask it too). */
export function inWood(s: GameState, u: Unit): boolean {
  const tx = Math.floor(u.x);
  const ty = Math.floor(u.y);
  let n = 0;
  for (let y = ty - 1; y <= ty + 1; y++) {
    if (y < 0 || y >= s.h) continue;
    for (let x = tx - 1; x <= tx + 1; x++) if (x >= 0 && x < s.w && s.res[y * s.w + x] === R_TREE) n++;
  }
  return n >= HIVE.wood;
}

/** In summer, whether an awake Hive of a Kitchen Garden's people stands within `HIVE.bloom` tiles of it (its yield doubles). */
export function pollinated(s: GameState, garden: Building, hives?: Building[]): boolean {
  if (seasonAt(s) !== 1) return false;
  for (const h of hives ?? awakeHives(s)) {
    if (h.owner !== garden.owner) continue;
    if (Math.abs(h.tx - garden.tx) <= HIVE.bloom && Math.abs(h.ty - garden.ty) <= HIVE.bloom) return true;
  }
  return false;
}

/** The Hives that may pollinate this second: awake ones in summer, none otherwise (so `groveStep` asks once). */
export const pollinators = (s: GameState): Building[] => (seasonAt(s) === 1 ? awakeHives(s) : []);

/** A Blowpipe dart lands: one more dose of venom in the unit hit, up to `HIVE.doses`, lasting `HIVE.venomFor` seconds from now. */
export function envenom(s: GameState, u: Unit, by: number): void {
  if (u.hp <= 0 || domainOf(u.type) !== 'land') return;
  const n = u.venom && s.tick < u.venom.end ? u.venom.n : 0;
  u.venom = { n: Math.min(HIVE.doses, n + 1), end: s.tick + secs(HIVE.venomFor), by };
}

/** What venom or a swarm leaves of a unit's pace: `HIVE.slow` while either is in it, else 1. */
export function stungPace(s: GameState, u: Unit): number {
  return (u.venom && s.tick < u.venom.end) || (u.stung !== undefined && s.tick < u.stung) ? HIVE.slow : 1;
}

/**
 * Once a second: smoke quiets the Hives near a fire and the quieted wake; awake Hives pay their honey or mead and swarm the rivals
 * in their woods; venom burns in whoever carries it.
 */
export function hiveStep(s: GameState): void {
  if (s.tick % TICK_HZ !== 0) return;
  let any = false;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'hive' || e.hp <= 0 || !e.built) continue;
    any = true;
    if (s.fires?.length && smokeNear(s, e, HIVE.smoke)) {
      if (e.smoked === undefined || s.tick >= e.smoked) s.events.push({ k: 'hive', what: 'smoked', id: e.id, owner: e.owner, x: e.x, y: e.y });
      e.smoked = s.tick + secs(HIVE.quiet);
    } else if (e.smoked !== undefined && s.tick >= e.smoked) {
      delete e.smoked;
      s.events.push({ k: 'hive', what: 'wake', id: e.id, owner: e.owner, x: e.x, y: e.y });
    }
  }
  const hives = any ? awakeHives(s) : [];
  if (hives.length && s.tick % secs(HIVE.every) === 0) {
    for (const h of hives) {
      const p = s.players[h.owner];
      const mead = brewsMead(s, h);
      const n = mead ? HIVE.mead : HIVE.honey;
      p.res[mead ? 'gold' : 'food'] += n;
      p.stats.gathered += n;
      p.stats.honey = (p.stats.honey ?? 0) + n;
    }
  }
  const war = !peace(s);
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0) continue;
    if (u.venom) {
      if (s.tick >= u.venom.end) delete u.venom;
      else {
        hurt(s, u, HIVE.dose * u.venom.n, u.venom.by, null);
        if (u.hp <= 0) continue;
      }
    }
    if (!hives.length || !war || u.inside || domainOf(u.type) !== 'land') continue;
    let by: Building | null = null;
    for (const h of hives) {
      if (!isEnemy(s, h.owner, u.owner)) continue;
      const dx = u.x - h.x;
      const dy = u.y - h.y;
      if (dx * dx + dy * dy <= HIVE.reach * HIVE.reach) {
        by = h;
        break;
      }
    }
    if (!by || !inWood(s, u)) continue;
    u.stung = s.tick + secs(HIVE.stingFor);
    s.events.push({ k: 'hive', what: 'swarm', id: by.id, owner: by.owner, x: u.x, y: u.y, target: u.id });
    hurt(s, u, HIVE.sting, by.owner, null);
  }
}

/** The Hive's words for the HUD: what its bees are doing now. */
export function hiveLine(s: GameState, b: Building): string {
  const why = hiveQuiet(s, b);
  if (why === 'winter') return 'The bees sleep through the winter';
  if (why === 'smoke') return 'Smoked quiet: the bees will wake when the smoke clears';
  if (why === 'bare') return b.built ? `The woods round it are too thin: ${HIVE.trees} trees must stand within 3 tiles` : 'Being set up';
  const pay = brewsMead(s, b) ? `mead, ${HIVE.mead} gold` : `honey, ${HIVE.honey} food`;
  return `Swarming its woods; ${pay} every ${HIVE.every} s${seasonAt(s) === 1 ? '; pollinating Gardens' : ''}`;
}
