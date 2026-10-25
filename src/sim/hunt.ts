import { HUNT, secs } from './data';
import { ageDef } from './ages';
import { setOrder } from './units';
import type { GameState, Unit } from './types';

/**
 * The Age of the Wild Hunt (#801, `docs/wild-road.md` §X): a crossing of the Wild and the Steppe, three things.
 * - Packs at heel: a rider trained at a Stable comes out with a War Wolf beside it (`bringOut` in `game.ts`), while the people stands in
 *   the age (`Age.heel`), and the rider costs a fifth more for it.
 * - Followers: a War Wolf standing idle within `HUNT.follow` tiles of a wagon of its people that is on the move, and farther than `HUNT.heel`
 *   from it, runs to the wagon. So the pack goes where the camp goes.
 * - Hawks (`hawk` in `data.ts`): trained at a Hunting Camp, an air unit with sight and no weapon. Arrows may hit it (`canHit`).
 * Everything runs in id order, with + − × ÷ only.
 */

/** Whether `u` is a camp wagon of its people on the move: it carries a packed building and has somewhere to go. */
const rolling = (u: Unit): boolean => u.type === 'wagon' && !!u.packed && u.hp > 0 && !u.inside && u.order.k !== 'idle';

/** Every `HUNT.every` seconds, the idle wolves of a people with the pack at heel run to the nearest rolling wagon of theirs. */
export function huntStep(s: GameState): void {
  if (s.tick % secs(HUNT.every) !== 0) return;
  const heel = s.players.map((p) => ageDef(p).heel === true);
  if (!heel.some((h) => h)) return;
  const wagons: Unit[] = [];
  for (const e of s.ents) if (e.kind === 'unit' && heel[e.owner] && rolling(e)) wagons.push(e);
  if (!wagons.length) return;
  const far = HUNT.follow * HUNT.follow;
  const near = HUNT.heel * HUNT.heel;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'warwolf' || e.hp <= 0 || e.inside || e.order.k !== 'idle' || !heel[e.owner]) continue;
    let best: Unit | null = null;
    let bestD = far;
    for (const w of wagons) {
      if (w.owner !== e.owner) continue;
      const dx = w.x - e.x;
      const dy = w.y - e.y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best && bestD > near) setOrder(e, { k: 'move', x: best.x, y: best.y, amove: false, started: false });
  }
}
