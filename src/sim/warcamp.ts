import { CALL_UP, TICK_HZ, WARCAMP, domainOf, secs } from './data';
import { ageDef, buildBarred } from './ages';
import { maxHp, pay, spawnUnit } from './world';
import type { Building, GameState, Player, Unit, UnitType } from './types';

/**
 * War Camps (#303), the Age of Iron and Blood's own building: pitched by foot soldiers where the army
 * stands, enemy land too (`placeProblem`), training foot soldiers at the front and holding a little land
 * (`BORDERS.warcamp`), so the army round it is fed (attrition, #132). The price is that a camp is only as
 * strong as the army keeping it: one left without its people's soldiers burns, and a people that leaves
 * the path strikes its camps (they burn at once).
 */

/** Units that keep a camp: the people's land fighters, not its citizens, priests or traders. */
const KEEPERS_NOT = new Set<UnitType>(['citizen', 'priest', 'trader']);

/** Whether some of the camp's own soldiers stand within `WARCAMP.watch` tiles of it. */
export function kept(s: GameState, b: Building): boolean {
  const r2 = WARCAMP.watch * WARCAMP.watch;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== b.owner || e.hp <= 0 || e.inside || KEEPERS_NOT.has(e.type) || domainOf(e.type) !== 'land') continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** Whole seconds left before an unkept camp catches fire, or 0 once it burns (or while it is kept). */
export function campGrace(b: Building): number {
  return b.alone === undefined ? 0 : Math.max(0, WARCAMP.grace - b.alone);
}

/** Once a second: camps with their soldiers near are kept; the rest count down, then burn. In id order. */
export function warCampStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.type !== 'warcamp' || !b.built || b.hp <= 0) continue;
    const struck = !!buildBarred(s.players[b.owner], b.type);
    if (!struck && kept(s, b)) {
      if (b.alone !== undefined) delete b.alone;
      continue;
    }
    const alone = (b.alone ?? 0) + 1;
    b.alone = alone;
    if (alone === 1) s.events.push({ k: 'campAlone', owner: b.owner, id: b.id, x: b.x, y: b.y, struck });
    if (!struck && alone <= WARCAMP.grace) continue;
    b.hp -= Math.max(1, maxHp(s, b) * WARCAMP.burn);
  }
}

/**
 * The call to arms (the Age of Total War, #313): a War Camp is a muster ground. Its people's citizens within
 * `CALL_UP.reach` tiles, the nearest first (ties in id order), become foot soldiers where they stand.
 */
export function callUpReach(s: GameState, b: Building): Unit[] {
  const r2 = CALL_UP.reach * CALL_UP.reach;
  const near: { u: Unit; d: number }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'citizen' || e.owner !== b.owner || e.hp <= 0 || e.inside) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    const d = dx * dx + dy * dy;
    if (d <= r2) near.push({ u: e, d });
  }
  near.sort((a, c) => a.d - c.d || a.u.id - c.u.id);
  return near.map((n) => n.u);
}

/** Whole seconds before a camp may call to arms again; 0 when it may. */
export function musterWait(s: GameState, b: Building): number {
  return b.muster === undefined ? 0 : Math.max(0, Math.ceil((b.muster - s.tick) / TICK_HZ));
}

/** How many calls to arms the player can pay for now. */
function affordable(p: Player): number {
  let n = CALL_UP.most;
  for (const r of ['food', 'wood', 'stone', 'gold'] as const) {
    const each = CALL_UP.cost[r] ?? 0;
    if (each > 0) n = Math.min(n, Math.floor(p.res[r] / each));
  }
  return n;
}

/** Why this camp can't call anyone to arms now, or null. */
export function callUpProblem(s: GameState, p: Player, b: Building): string | null {
  if (b.owner !== p.id || b.type !== 'warcamp' || !b.built || b.hp <= 0) return 'Only a finished War Camp calls citizens to arms';
  if (!ageDef(p).callUp) return 'Only a people at total war calls its citizens to arms';
  const wait = musterWait(s, b);
  if (wait > 0) return `The camp is mustering the last called: ${wait}s`;
  if (!callUpReach(s, b).length) return `No citizen of yours within ${CALL_UP.reach} tiles`;
  if (affordable(p) < 1) return `Arms for each cost ${CALL_UP.cost.wood} wood and ${CALL_UP.cost.gold} gold`;
  return null;
}

/**
 * Calls up to `n` citizens to arms (at most `CALL_UP.most`, and as many as the player can arm): each is
 * taken off the map and a foot soldier of the age stands where it stood, facing the same way, with the
 * share of health it had. What it carried is dropped. The camp rests `CALL_UP.rest` seconds for each.
 * Returns the new soldiers.
 */
export function callUp(s: GameState, p: Player, b: Building, n = 1): Unit[] {
  const many = Math.max(1, Math.min(Math.floor(n), CALL_UP.most, affordable(p)));
  const called = callUpReach(s, b).slice(0, many);
  if (!called.length) return [];
  const gone = new Set<number>();
  const out: Unit[] = [];
  for (const c of called) {
    pay(p, CALL_UP.cost);
    const share = c.hp / maxHp(s, c);
    gone.add(c.id);
    s.byId.delete(c.id);
    const u = spawnUnit(s, p.id, 'infantry', c.x, c.y);
    u.hp = Math.max(1, maxHp(s, u) * share);
    u.fx = c.fx;
    u.fy = c.fy;
    out.push(u);
  }
  s.ents = s.ents.filter((e) => !gone.has(e.id));
  b.muster = s.tick + secs(CALL_UP.rest) * out.length;
  p.stats.calledUp = (p.stats.calledUp ?? 0) + out.length;
  s.events.push({ k: 'callUp', owner: p.id, camp: b.id, ids: out.map((u) => u.id), x: b.x, y: b.y });
  return out;
}
