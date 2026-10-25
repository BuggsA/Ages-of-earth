import { BUILDINGS, MYCELIUM, TICK_HZ, domainOf, secs } from './data';
import { ageOf } from './ages';
import { hurt, peace } from './combat';
import { distToRect } from './grid';
import type { Spatial } from './spatial';
import { isEnemy, maxHp } from './world';
import type { Building, GameState, Player, Unit } from './types';

/**
 * The Age of the Mycelium (#800, `docs/wild-road.md` §R): the Wild route's rare gateway at tier 2, opened only by glowcaps.
 * - The web: each finished hall (`MYCELIUM.halls`) of a people standing in the age grows a fungus web out from its footprint
 *   (`Building.web`, in tiles), to `MYCELIUM.reach`. Every hall with a web takes in every stock (`nearestDrop` in `world.ts`), and a
 *   load carried onto the web is banked at once (`webDrop`, read by `dropOff` in `units.ts`). All of it counts as `webbed`.
 * - Spores: its units standing on its web are hidden (`Unit.cloak`): no rival sees them (`view.ts`) or aims at them (`canHit`,
 *   `nearestEnemyUnit`) unless a rival unit or building is within `MYCELIUM.reveal` tiles, or they struck in the last `shown` seconds.
 * - Rot: once a second a rival building whose footprint lies within a web loses a share of its health, timber twice as fast as stone.
 * - Fire: any fire within a web cuts it back to the fire, less a tile; a torch may be set to bare ground on a rival's web (`fire.ts`).
 * The web withers, and the spores settle, the moment its people leaves the age. Everything runs in id order, with + − × ÷ and √ only.
 */

/** Whether a people stands in the Mycelium now. */
export const inMycelium = (p: Player | undefined): boolean => !!p && ageOf(p) === 'mycelium';

/** Whether a building spreads the web: a finished hall of its people, standing. */
const threads = (b: Building): boolean => b.built && b.hp > 0 && MYCELIUM.halls.includes(b.type);

/** Whether a hall's web takes in every stock: it has one, and its people stands in the age. */
export const webTakes = (s: GameState, b: Building): boolean => (b.web ?? 0) > 0 && b.hp > 0 && inMycelium(s.players[b.owner]);

/** The hall of `owner`'s whose web covers (x, y), the nearest first (id order on ties), or null. Only while its people stands in the age. */
export function webAt(s: GameState, owner: number, x: number, y: number): Building | null {
  if (!inMycelium(s.players[owner])) return null;
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || !e.web || e.hp <= 0) continue;
    const d = distToRect(x, y, e);
    if (d <= e.web && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Where a load carried by this unit is banked at once: the hall whose web it stands on, or null (fishing boats never). */
export function webDrop(s: GameState, u: Unit): Building | null {
  if (u.type === 'fisher' || u.inside || !inMycelium(s.players[u.owner])) return null;
  return webAt(s, u.owner, u.x, u.y);
}

/** Whether a rival of `owner` has a web over this tile now: where a torch may burn it back. */
export function rivalWebAt(s: GameState, owner: number, tile: number): boolean {
  const x = (tile % s.w) + 0.5;
  const y = Math.floor(tile / s.w) + 0.5;
  for (const p of s.players) if (isEnemy(s, owner, p.id) && webAt(s, p.id, x, y)) return true;
  return false;
}

/** Every web within reach of a burning tile is cut back to it, less a tile. True if any was cut. */
export function burnWeb(s: GameState, tile: number): boolean {
  const x = (tile % s.w) + 0.5;
  const y = Math.floor(tile / s.w) + 0.5;
  let cut = false;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.web || e.hp <= 0) continue;
    const d = distToRect(x, y, e);
    if (d > e.web) continue;
    e.web = Math.max(0, d - 1);
    cut = true;
    s.events.push({ k: 'web', what: 'burnt', owner: e.owner, x, y });
  }
  return cut;
}

/** The gap between two footprints, in tiles: 0 when they touch or overlap. */
function gapBetween(a: Building, b: Building): number {
  const dx = Math.max(0, a.tx - (b.tx + b.size), b.tx - (a.tx + a.size));
  const dy = Math.max(0, a.ty - (b.ty + b.size), b.ty - (a.ty + a.size));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Whether a rival unit or building stands within `MYCELIUM.reveal` tiles of a unit: then the spores don't hide it. */
function seenClose(s: GameState, sp: Spatial, u: Unit): boolean {
  const r = MYCELIUM.reveal;
  let near = false;
  sp.near(u.x, u.y, r, (o) => {
    if (near || o.hp <= 0 || !isEnemy(s, u.owner, o.owner)) return;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    if (dx * dx + dy * dy <= r * r) near = true;
  });
  if (near) return true;
  const cx = Math.floor(u.x);
  const cy = Math.floor(u.y);
  for (let ty = cy - r; ty <= cy + r; ty++) {
    for (let tx = cx - r; tx <= cx + r; tx++) {
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
      const id = s.bldAt[ty * s.w + tx];
      const b = id ? s.byId.get(id) : undefined;
      if (b && b.kind === 'building' && b.hp > 0 && isEnemy(s, u.owner, b.owner) && distToRect(u.x, u.y, b) <= r) return true;
    }
  }
  return false;
}

/** Whether a unit is hidden by its people's spores now. */
function hidden(s: GameState, sp: Spatial, u: Unit): boolean {
  if (u.inside || domainOf(u.type) !== 'land' || s.tick - u.swing < secs(MYCELIUM.shown)) return false;
  return !!webAt(s, u.owner, u.x, u.y) && !seenClose(s, sp, u);
}

/** The web grows, withers, burns and rots, once a second; the spores are read every `MYCELIUM.cloakEvery` ticks. */
export function myceliumStep(s: GameState, sp: Spatial): void {
  const any = s.players.some(inMycelium);
  if (s.tick % MYCELIUM.cloakEvery === 0) {
    for (const e of s.ents) {
      if (e.kind !== 'unit') continue;
      const hide = any && e.hp > 0 && inMycelium(s.players[e.owner]) && hidden(s, sp, e);
      if (hide) e.cloak = true;
      else if (e.cloak) delete e.cloak;
    }
  }
  if (s.tick % TICK_HZ !== 0) return;
  const webs: Building[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'building') continue;
    if (!inMycelium(s.players[e.owner]) || !threads(e)) {
      if (e.web !== undefined) delete e.web;
      continue;
    }
    const was = e.web ?? 0;
    e.web = Math.min(MYCELIUM.reach, was + MYCELIUM.grow);
    if (was < MYCELIUM.reach && e.web >= MYCELIUM.reach && e.type === 'towncenter') s.events.push({ k: 'web', what: 'grown', owner: e.owner, x: e.x, y: e.y });
    webs.push(e);
  }
  if (!webs.length) return;
  // Fire burns the web back: every fire within a web cuts it to the fire, less a tile.
  for (const f of s.fires ?? []) {
    const b = f.b !== undefined ? s.byId.get(f.b) : undefined;
    const box = b && b.kind === 'building' ? b : { tx: f.tile % s.w, ty: Math.floor(f.tile / s.w), size: 1 };
    for (const w of webs) {
      const d = gapBetween(w, box as Building);
      if (d <= (w.web ?? 0)) w.web = Math.max(0, d - 1);
    }
  }
  if (peace(s)) return;
  // Rot: a rival building touching a web loses a share of its health, each web counting once; timber twice as fast as stone.
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0) continue;
    for (const w of webs) {
      if (!w.web || w.hp <= 0 || !isEnemy(s, w.owner, e.owner) || gapBetween(w, e) > w.web) continue;
      const stone = (BUILDINGS[e.type].cost.stone ?? 0) > 0;
      hurt(s, e, maxHp(s, e) * (stone ? MYCELIUM.rot.stone : MYCELIUM.rot.wood), w.owner, null);
      if ((s.tick / TICK_HZ) % 10 === 0) s.events.push({ k: 'web', what: 'rot', owner: w.owner, x: e.x, y: e.y });
      if (e.hp <= 0) break;
    }
  }
}
