import { SORTIE, domainOf } from './data';
import { ageDef } from './ages';
import { giveOrder } from './units';
import { maxHp } from './world';
import type { Building, GameState } from './types';

/**
 * Sorties (the Age of Aeronauts): its aircraft are cheap but fly on fuel from the Airfield. Once a second
 * each sits in one of three bands by its distance from the nearest finished Airfield of its owner: near
 * (rearmed and mended), out (nothing), past `turn` (its orders dropped, flying home) or past `reach`
 * (burning). No Airfield left, no fuel. It does nothing outside the age.
 */
export function sortieStep(s: GameState): void {
  if (s.tick % 20 !== 0) return;
  const rearm2 = SORTIE.rearm * SORTIE.rearm, reach2 = SORTIE.reach * SORTIE.reach, turn2 = SORTIE.turn * SORTIE.turn;
  let fields: Building[][] | null = null;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || domainOf(u.type) !== 'air' || !ageDef(s.players[u.owner]).sortie) continue;
    if (!fields) {
      fields = s.players.map(() => []);
      for (const b of s.ents) if (b.kind === 'building' && b.type === 'airfield' && b.built && b.hp > 0) fields[b.owner].push(b);
    }
    let home: Building | null = null;
    let best = Infinity;
    for (const b of fields[u.owner]) {
      const d = (b.x - u.x) * (b.x - u.x) + (b.y - u.y) * (b.y - u.y);
      if (d < best) { best = d; home = b; }
    }
    const top = maxHp(s, u);
    if (home && best <= rearm2) {
      u.hp = Math.min(top, u.hp + top * SORTIE.mend);
    } else if (!home || best > reach2) {
      u.hp -= top * SORTIE.burn;
      if (u.hp <= 0) s.events.push({ k: 'sortie', owner: u.owner, id: u.id, x: u.x, y: u.y, what: 'lost' });
    } else if (best > turn2 && !(u.order.k === 'move' && !u.order.amove && (u.order.x - home.x) * (u.order.x - home.x) + (u.order.y - home.y) * (u.order.y - home.y) < 4)) {
      giveOrder(u, { k: 'move', x: home.x, y: home.y, amove: false, started: false });
      s.events.push({ k: 'sortie', owner: u.owner, id: u.id, x: u.x, y: u.y, what: 'home' });
    }
  }
}
