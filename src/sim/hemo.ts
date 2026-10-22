import { HEMO, HEMO_IRON, HEMOCRAFT, TICK_HZ, secs } from './data';
import { ageDef, asleep, inField } from './ages';
import { modsOf } from './stats';
import { GRAFTABLE, bloodOf, grafted } from './blood';
import { ungarrison } from './units';
import { maxHp } from './world';
import type { Building, GameState, Player, Unit } from './types';

/**
 * Hemocraft (#355 s3): soldiers grafted with blood at a Transfusion Station. The Station takes the soldiers sheltered inside one at a
 * time, `HEMO.work` seconds and `HEMO.cost` blood each, and opens its doors once none inside is left ungrafted. A graft is fed while its
 * soldier stands within `HEMO.reach` tiles of one of its people's standing Stations; `HEMO.last` seconds from all of them it runs dry
 * and the soldier crashes. So the Stations are the army's lifeline, and the rival who brings them down with machines unmakes it.
 * With Galvanic Blood (#355 s6) a Watch Tower's reach feeds a graft too, in any age.
 */

/** The people's finished, standing Transfusion Stations that are awake (a Station sleeps outside its ages, #555 s10). */
export function stationsOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'transfusion' && e.owner === owner && e.built && e.hp > 0 && !asleep(s, e)) out.push(e);
  return out;
}

/** The blood a graft costs this people: a quarter less in Hemocraft (#355 s2). */
export const graftCost = (p: Player): number => (ageDef(p).hemocraft ? HEMO.cost * HEMOCRAFT.graft : HEMO.cost);

/** How long a unit's graft lasts away from a Station: longer when quenched in blood-iron. */
export const graftLast = (u: Unit): number => (u.tempered ? HEMO.last * HEMO_IRON.last : HEMO.last);

/** How far from a Station this people's grafts stay fed: farther in Hemocraft (#355 s2). */
export const feedReach = (p: Player): number => (ageDef(p).hemocraft ? HEMOCRAFT.reach : HEMO.reach);

/** Whether a point lies within `reach` tiles of one of these Stations. */
function fed(stations: Building[], x: number, y: number, reach: number): boolean {
  const r2 = reach * reach;
  return stations.some((b) => (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) <= r2);
}

/** The soldiers sheltered in a Station who still wait for a graft, in the order they went in. */
export function waiting(s: GameState, b: Building): Unit[] {
  const out: Unit[] = [];
  for (const id of b.garrison) {
    const u = s.byId.get(id);
    if (u && u.kind === 'unit' && GRAFTABLE.includes(u.type) && !grafted(s, u)) out.push(u);
  }
  return out;
}

/** Whole seconds until the Station's graft in hand is done, or 0 when none is under way. */
export function graftWait(s: GameState, b: Building): number {
  return b.muster === undefined ? 0 : Math.max(0, Math.ceil((b.muster - s.tick) / TICK_HZ));
}

function station(s: GameState, b: Building): void {
  const queue = waiting(s, b);
  if (!queue.length) {
    delete b.muster;
    return;
  }
  const p = s.players[b.owner];
  if (b.muster === undefined) {
    // A graft starts only when the blood for it is in store; it is paid when it is done.
    if (bloodOf(p) >= graftCost(p)) b.muster = s.tick + secs(HEMO.work);
    return;
  }
  if (s.tick < b.muster) return;
  delete b.muster;
  const cost = graftCost(p);
  if (bloodOf(p) < cost) return;
  const u = queue[0];
  p.blood = bloodOf(p) - cost;
  p.stats.grafted = (p.stats.grafted ?? 0) + 1;
  const ore = p.rare?.bloodiron ?? 0;
  if (ore >= HEMO_IRON.cost) {
    p.rare!.bloodiron = ore - HEMO_IRON.cost;
    u.tempered = true;
    p.stats.quenched = (p.stats.quenched ?? 0) + 1;
  } else delete u.tempered;
  u.hemo = s.tick + secs(graftLast(u));
  u.hp = maxHp(s, u);
  s.events.push({ k: 'graft', owner: b.owner, id: u.id, x: b.x, y: b.y, how: 'made' });
  if (queue.length === 1) ungarrison(s, b);
}

/** Each tick: the Stations at work; each second, every graft fed, mended or run dry. */
export function hemoStep(s: GameState): void {
  const by = new Map<number, Building[]>();
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'transfusion' && e.built && e.hp > 0 && e.garrison.length && !asleep(s, e)) station(s, e);
  if (s.tick % TICK_HZ !== 0) return;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hemo === undefined || u.hp <= 0) continue;
    let mine = by.get(u.owner);
    if (!mine) by.set(u.owner, (mine = stationsOf(s, u.owner)));
    // Galvanic Blood (#355 s6): a Watch Tower's reach feeds a graft as a Station does.
    if (fed(mine, u.x, u.y, feedReach(s.players[u.owner])) || (modsOf(s, u.owner).veins > 0 && inField(s, u))) u.hemo = s.tick + secs(graftLast(u));
    if (s.tick >= u.hemo) {
      // Run dry: the graft is gone, and the body pays for it.
      u.hp = Math.max(1, u.hp - maxHp(s, u) * HEMO.crash * (u.tempered ? HEMO_IRON.crash : 1));
      delete u.hemo;
      delete u.tempered;
      s.events.push({ k: 'graft', owner: u.owner, id: u.id, x: u.x, y: u.y, how: 'crash' });
      continue;
    }
    u.hp = Math.min(maxHp(s, u), u.hp + HEMO.mend * (u.tempered ? HEMO_IRON.mend : 1));
  }
}
