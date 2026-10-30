import { ageOf } from './ages';
import { AGES, FIT, FITS, type Fit, type FitLand } from './data';
import { isEnemy } from './world';
import { R_GOLD, R_STONE, R_TREE, T_WATER, type AgeId, type GameState, type Player, type UnitType } from './types';

/**
 * Here, because (`FITS` in `data.ts`): which of an age's situations hold for this player now, each a reason for (`pro`) or
 * against it. Read only from what the player knows: tiles it has seen round its town, beasts and rival soldiers it sees now,
 * and the age each rival stands in, which every player is told. The age-up preview words them.
 */
export type FitRead =
  | { pro: boolean; k: 'land'; on: FitLand; why: string }
  | { pro: boolean; k: 'rival'; rival: number; age: AgeId; why: string }
  | { pro: boolean; k: 'pace'; on: 'quick' | 'slow'; near: number };

/** Hands that do not fight: they never press a town. */
const CALM: ReadonlySet<UnitType> = new Set<UnitType>(['citizen', 'priest', 'fisher', 'transport', 'cog', 'trader', 'wagon', 'barge', 'tow']);

/** How much of each land the player has seen round its town's start, each within its own `FIT.land[].r` (beasts: those it sees now). */
export function landNear(s: GameState, p: Player): Record<FitLand, number> {
  const n: Record<FitLand, number> = { water: 0, stone: 0, wood: 0, gold: 0, game: 0 };
  const L = FIT.land, r = Math.max(L.water.r, L.stone.r, L.wood.r, L.gold.r), cx = Math.floor(p.startX), cy = Math.floor(p.startY);
  const within = (d2: number, on: FitLand) => d2 <= L[on].r * L[on].r;
  for (let y = Math.max(0, cy - r); y <= Math.min(s.h - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(s.w - 1, cx + r); x++) {
      const i = y * s.w + x;
      if (!p.seen[i]) continue;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (s.terrain[i] === T_WATER && within(d2, 'water')) n.water++;
      if (s.amount[i] <= 0) continue;
      const res = s.res[i];
      if (res === R_STONE && within(d2, 'stone')) n.stone++;
      else if (res === R_TREE && within(d2, 'wood')) n.wood++;
      else if (res === R_GOLD && within(d2, 'gold')) n.gold++;
    }
  for (const a of s.animals) {
    if (a.kind !== 'deer' && a.kind !== 'mammoth' && a.kind !== 'boar') continue;
    const x = Math.floor(a.x), y = Math.floor(a.y);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h || !p.vis[y * s.w + x]) continue;
    if (within((a.x - p.startX) * (a.x - p.startX) + (a.y - p.startY) * (a.y - p.startY), 'game')) n.game++;
  }
  return n;
}

/** Rival soldiers the player sees now within `FIT.near` of its town's start. */
export function pressOn(s: GameState, p: Player): number {
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || CALM.has(e.type) || !isEnemy(s, p.id, e.owner)) continue;
    const x = Math.floor(e.x), y = Math.floor(e.y);
    if (x < 0 || y < 0 || x >= s.w || y >= s.h || !p.vis[y * s.w + x]) continue;
    if ((e.x - p.startX) * (e.x - p.startX) + (e.y - p.startY) * (e.y - p.startY) <= FIT.near * FIT.near) n++;
  }
  return n;
}

/** An age's fits, a gateway's `slow` pace added. */
export const fitsFor = (id: AgeId): Fit[] => {
  const f = FITS[id] ?? [];
  return AGES[id].gateway && !f.some((x) => x.k === 'pace') ? [...f, { k: 'pace', on: 'slow' }] : f;
};

/** The reasons for and against the age `id` that hold for player `p` now, in the order its fits list them. */
export function fitsOf(s: GameState, p: Player, id: AgeId): FitRead[] {
  const fits = fitsFor(id);
  if (!fits.length) return [];
  const land = landNear(s, p);
  const near = pressOn(s, p);
  const pressed = near >= FIT.press;
  const out: FitRead[] = [];
  for (const f of fits) {
    if (f.k === 'land') {
      const t = FIT.land[f.on];
      if (land[f.on] >= t.rich) out.push({ pro: true, k: 'land', on: f.on, why: f.why });
      else if (f.need && land[f.on] < t.poor) out.push({ pro: false, k: 'land', on: f.on, why: f.why });
    } else if (f.k === 'rival') {
      for (const o of s.players) {
        if (o.defeated || !isEnemy(s, p.id, o.id)) continue;
        const at = ageOf(o);
        if (!f.ages?.includes(at) && !(AGES[at].routes ?? []).some((r) => f.routes?.includes(r))) continue;
        out.push({ pro: !f.con, k: 'rival', rival: o.id, age: at, why: f.why });
        break;
      }
    } else if (pressed) out.push({ pro: f.on === 'quick', k: 'pace', on: f.on, near });
    else if (f.on === 'slow') out.push({ pro: true, k: 'pace', on: 'slow', near });
  }
  return out;
}
