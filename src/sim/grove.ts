import { BUILDINGS, GROVE, HIVE, secs } from './data';
import { hasWalked } from './ages';
import { seasonAt } from './seasons';
import { pollinated, pollinators } from './hive';
import { buildingMaxHp } from './stats';
import type { Building, BuildingType, GameState, Player } from './types';
import { R_NONE, T_WATER } from './types';
import { placeBuilding } from './world';

/**
 * The Age of the Grove (`docs/wild-road.md` §2): the Wild route's second age, where a people grows what others build.
 * - A Thornwall is planted like a wall and grows a stage at a time (`Building.level`, 0 seedling to 3 living oak) as `grown`
 *   seconds pile up, faster in spring; its hit points rise with it (`buildingMaxHp`), and a living oak mends. It parts for its
 *   own team as a gate does (`stampBuilding`). Cut down, it leaves a root (`GameState.roots`) that sprouts a seedling again.
 * - A Kitchen Garden is a one-tile field (`isField`) whose gardener works faster when it is fed (`Building.fed`): by a Den's dung
 *   or by water beside it, and in summer twice over beside a Hive (`hive.ts`).
 * - An Orchard bears once grown, and in summer and autumn drops food into its owner's stores by itself.
 * Each is raised by a people that has walked the Grove, in any age after (`buildBarred`). The numbers are `GROVE`.
 */

/** The buildings a people raises once it has walked the Grove. */
export const GROVE_BUILDINGS: BuildingType[] = ['thornwall', 'garden', 'orchard'];

/** Whether a people may plant what the Grove grows: it stands in the Grove, or has stood there. */
export const grows = (p: Player): boolean => hasWalked(p, 'grove');

/** A field worked by one citizen for food: a Farm, or a Kitchen Garden. */
export const isField = (t: BuildingType): boolean => t === 'farm' || t === 'garden';

/**
 * What a Kitchen Garden's gardener works at, as a share of a farmer's pace: 1 unfed, more for dung, more for water, and all of it
 * `HIVE.pollen` times over while a Hive pollinates it in summer (the Age of the Hive).
 */
export function gardenMul(b: Building): number {
  if (b.type !== 'garden') return 1;
  const fed = b.fed ?? 0;
  return (1 + (fed & 1 ? GROVE.dungMul : 0) + (fed & 2 ? GROVE.waterMul : 0)) * (fed & 4 ? HIVE.pollen : 1);
}

/** Whether a Thornwall's stage has come: 0 seedling, 1 bramble, 2 thicket, 3 living oak. */
export const thornStage = (b: Building): number => (b.type === 'thornwall' ? Math.min(3, b.level ?? 0) : 0);

/** Whether an Orchard is grown and bearing (summer or autumn). */
export const orchardGrown = (b: Building): boolean => b.type === 'orchard' && (b.level ?? 0) >= 1;
export const bearing = (s: GameState, b: Building): boolean => orchardGrown(b) && (seasonAt(s) === 1 || seasonAt(s) === 2);

const rectDist = (b: Building, o: Building): number => {
  const dx = Math.max(0, o.tx - (b.tx + b.size - 1), b.tx - (o.tx + o.size - 1));
  const dy = Math.max(0, o.ty - (b.ty + b.size - 1), b.ty - (o.ty + o.size - 1));
  return Math.max(dx, dy);
};

/** Whether water lies within `r` tiles of a building. */
function waterNear(s: GameState, b: Building, r: number): boolean {
  for (let y = Math.max(0, b.ty - r); y < Math.min(s.h, b.ty + b.size + r); y++)
    for (let x = Math.max(0, b.tx - r); x < Math.min(s.w, b.tx + b.size + r); x++) if (s.terrain[y * s.w + x] === T_WATER) return true;
  return false;
}

/** A fallen Thornwall leaves its root, unless its own people grubbed it out, fire took it (`fire.ts`), or its people is gone. */
export function rootThorn(s: GameState, b: Building): void {
  if (b.type !== 'thornwall' || !b.built || b.grub || b.burnt || s.players[b.owner]?.defeated) return;
  (s.roots ??= []).push({ tile: b.ty * s.w + b.tx, owner: b.owner, at: s.tick + secs(GROVE.regrow) });
}

/** Whether anything stands on a tile so a root can't sprout through it: a building or a resource (gone for good), a unit or a beast (wait). */
function standing(s: GameState, tile: number): 'gone' | 'wait' | null {
  if (s.bldAt[tile] !== 0 || s.res[tile] !== R_NONE) return 'gone';
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const near = (x: number, y: number) => Math.abs(x - cx) < 0.9 && Math.abs(y - cy) < 0.9;
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside && near(e.x, e.y)) return 'wait';
  for (const a of s.animals) if (a.hp > 0 && near(a.x, a.y)) return 'wait';
  return null;
}

/** Once a second: Thornwalls and Orchards grow, living oak mends, roots sprout, Gardens learn what feeds them, Orchards bear. */
export function groveStep(s: GameState): void {
  if (s.tick % secs(1) !== 0) return;
  const spring = seasonAt(s) === 0;
  let dens: Building[] | null = null;
  const fedBy = new Map<number, number>();
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !e.built) continue;
    if (e.type === 'den') (dens ??= []).push(e);
    else if (e.type === 'thornwall') {
      const stage = e.level ?? 0;
      if (stage < 3) {
        e.grown = (e.grown ?? 0) + (spring ? GROVE.spring : 1);
        if (e.grown >= GROVE.stage * (stage + 1)) {
          const before = buildingMaxHp(s, e.owner, e.type, stage);
          e.level = stage + 1;
          e.hp += buildingMaxHp(s, e.owner, e.type, e.level) - before;
        }
      } else if (s.tick - e.hurt >= secs(GROVE.calm)) e.hp = Math.min(buildingMaxHp(s, e.owner, e.type, stage), e.hp + GROVE.mend);
    } else if (e.type === 'orchard') {
      if (!orchardGrown(e)) {
        e.grown = (e.grown ?? 0) + 1;
        if (e.grown >= GROVE.orchardGrow) e.level = 1;
      } else if (s.tick % secs(GROVE.orchardEvery) === 0 && bearing(s, e) && !s.players[e.owner].defeated && storeNear(s, e)) {
        const p = s.players[e.owner];
        p.res.food += GROVE.orchardFood;
        p.stats.gathered += GROVE.orchardFood;
      }
    }
  }
  // What feeds each Kitchen Garden, in id order: a Den feeds its `dungFeeds` oldest gardens in reach; water feeds any beside it;
  // in summer a Hive near it pollinates it (4).
  const hives = pollinators(s);
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'garden' || e.hp <= 0) continue;
    let fed = waterNear(s, e, GROVE.water) ? 2 : 0;
    if (dens) {
      for (const d of dens) {
        if (d.owner !== e.owner || rectDist(e, d) > GROVE.dung) continue;
        const n = fedBy.get(d.id) ?? 0;
        if (n >= GROVE.dungFeeds) continue;
        fedBy.set(d.id, n + 1);
        fed |= 1;
        break;
      }
    }
    if (hives.length && pollinated(s, e, hives)) fed |= 4;
    if (fed) e.fed = fed;
    else delete e.fed;
  }
  if (!s.roots?.length) return;
  s.roots = s.roots.filter((r) => {
    if (s.tick < r.at) return true;
    if (s.players[r.owner]?.defeated) return false;
    const why = standing(s, r.tile);
    if (why === 'gone') return false;
    if (why === 'wait') {
      r.at = s.tick + secs(GROVE.retry);
      return true;
    }
    placeBuilding(s, r.owner, 'thornwall', r.tile % s.w, Math.floor(r.tile / s.w), true);
    s.events.push({ k: 'sprout', owner: r.owner, x: (r.tile % s.w) + 0.5, y: Math.floor(r.tile / s.w) + 0.5 });
    return false;
  });
}

/** Whether one of the owner's finished food stores stands within `GROVE.orchardReach` tiles of an Orchard. */
function storeNear(s: GameState, b: Building): boolean {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== b.owner || e.hp <= 0 || !e.built || !BUILDINGS[e.type].drop.includes('food')) continue;
    if (rectDist(b, e) <= GROVE.orchardReach) return true;
  }
  return false;
}
