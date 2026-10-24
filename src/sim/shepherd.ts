import { FLOCK, SHEPHERD, secs } from './data';
import { campOf, flockCap, flockOf, lambProblem, milkable, raiseLamb } from './flocks';
import { isMobile } from './steppe';
import { setOrder } from './units';
import type { Animal, GameState, Unit } from './types';

/**
 * The self-managed flock: a person's steppe people keeps its sheep without a click. The camp raises lambs while there
 * is room and food to spare, idle citizens by the camp take to milking, and one slaughters a sheep fattened past
 * breeding once the flock is full. The computer tends its own flock in `ai.ts`; a person's people has it on (`shepherd`) from
 * the start of a game, and can turn it off. The numbers are `SHEPHERD` in `data.ts`.
 */

/** A grown sheep that can only get fatter: full of fat, with the flock at its limit. */
const surplus = (a: Animal): boolean => a.kind === 'sheep' && a.hp > 0 && a.lamb === undefined && (a.fat ?? 0) >= FLOCK.breed;

/** An idle citizen of a person, free to be put to work near a camp. */
function free(u: Unit): boolean {
  return u.type === 'citizen' && u.hp > 0 && !u.inside && u.order.k === 'idle' && !u.queue.length;
}

/** Once every `SHEPHERD.every` seconds, for each person's herding people. */
export function tendFlocks(s: GameState): void {
  if (s.tick % secs(SHEPHERD.every) !== 0) return;
  for (const p of s.players) {
    if (p.ai || p.left || !p.shepherd || !isMobile(p)) continue;
    const full = flockOf(s, p.id) >= flockCap(s, p.id);
    // A lamb at the first Town Center that can raise one, while a reserve of food stays in the larder.
    if (!full && p.res.food >= (FLOCK.cost.food ?? 0) + SHEPHERD.reserve) {
      for (const e of s.ents) {
        if (e.kind !== 'building' || e.owner !== p.id || e.type !== 'towncenter' || lambProblem(s, p, e)) continue;
        raiseLamb(s, e);
        break;
      }
    }
    const fed = new Set<number>();
    let cull = full && !s.ents.some((e) => e.kind === 'unit' && e.owner === p.id && e.order.k === 'hunt' && s.animals.some((a) => a.id === (e.order as { target: number }).target && a.owner === p.id));
    for (const e of s.ents) {
      if (e.kind === 'unit' && e.owner === p.id && e.order.k === 'milk') fed.add(e.order.target);
    }
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.owner !== p.id || !free(e)) continue;
      const camp = campOf(s, p.id, e.x, e.y);
      if (!camp || (camp.x - e.x) * (camp.x - e.x) + (camp.y - e.y) * (camp.y - e.y) > SHEPHERD.reach * SHEPHERD.reach) continue;
      if (cull) {
        const fat = s.animals.find((a) => a.owner === p.id && surplus(a));
        if (fat) {
          setOrder(e, { k: 'hunt', target: fat.id });
          cull = false;
          continue;
        }
      }
      const ewe = milkable(s, p.id, e.x, e.y, SHEPHERD.reach, undefined, fed);
      if (!ewe) continue;
      fed.add(ewe.id);
      setOrder(e, { k: 'milk', target: ewe.id, phase: 'go' });
    }
  }
}
