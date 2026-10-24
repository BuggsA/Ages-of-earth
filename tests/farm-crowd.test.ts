import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';
import { applyCommand } from '../src/sim/commands';
import { findSpot } from '../src/sim/ai';
import { placeBuilding, spawnUnit, townCenters } from '../src/sim/world';
import { citizenJob, workforce } from '../src/sim/labor';
import { snareSpot } from '../src/sim/snares';
import type { Building, GameState, Unit } from '../src/sim/types';
import { R_BERRY, R_MEAT, R_NONE, R_TREE } from '../src/sim/types';
import { findResource } from '../src/sim/units';

/**
 * Hands crowding one new field (#344). The Workers panel sent every idle hand to the same half-built field, and
 * builders who finished a field on the same tick all took it as its farmer: all but one then stood idle. In a
 * patient player's 15-minute towns that was most of the idles (`scripts/town-audit.ts`: 191 of 530, six peoples).
 */
function town(): { s: GameState; hands: Unit[]; home: Building } {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
  // No bushes or game: food means fields.
  for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_BERRY || s.res[i] === R_MEAT) s.res[i] = R_NONE;
  s.animals.length = 0;
  s.players[0].res.wood = 1000;
  const home = townCenters(s, 0)[0];
  const hands = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
  while (hands.length < 5) hands.push(spawnUnit(s, 0, 'citizen', hands[0].x, hands[0].y));
  for (const u of hands) u.order = { k: 'idle' };
  return { s, hands, home };
}

describe('a new field takes one farmer (#344)', () => {
  it('the Workers panel sends no second hand to a field still being raised', () => {
    const { s, hands, home } = town();
    const spot = findSpot(s, 'farm', home.x, home.y, 3, 12)!;
    applyCommand(s, { t: 'build', p: 0, ids: [hands[0].id], type: 'farm', tx: spot.tx, ty: spot.ty });
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'food', n: 3 });
    expect(hands.slice(1).every((u) => u.order.k === 'idle')).toBe(true);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(true);
  });

  it('builders called off the woods to raise a field together leave one farmer on it and go back to the woods', () => {
    const { s, hands, home } = town();
    const tree = findResource(s, R_TREE, home.x, home.y, 30);
    for (const u of hands) u.order = { k: 'gather', tile: tree, res: 'wood', phase: 'go' };
    const crew = hands.slice(0, 3);
    const a = findSpot(s, 'farm', home.x, home.y, 3, 12)!;
    applyCommand(s, { t: 'build', p: 0, ids: crew.map((u) => u.id), type: 'farm', tx: a.tx, ty: a.ty });
    const f = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'farm')!;
    for (let i = 0; i < 20 * 60 && !f.built; i++) step(s);
    expect(f.built).toBe(true);
    for (let i = 0; i < 20 * 5; i++) step(s);
    expect(crew.filter((u) => u.order.k === 'farm' && u.order.target === f.id)).toHaveLength(1);
    expect(crew.filter((u) => u.order.k === 'gather' && u.order.res === 'wood')).toHaveLength(2);
  });
});

/** Peoples without fields (#344): the Workers panel counts and sends hands to a snare line or a flock in milk. */
describe('food without fields on the Workers panel (#344)', () => {
  const bare = (civ: 'britons' | 'mongols') => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ }, { name: 'B', ai: null, civ: 'greeks' }] });
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_BERRY || s.res[i] === R_MEAT) s.res[i] = R_NONE;
    s.animals = s.animals.filter((a) => a.kind === 'sheep');
    const hands = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
    for (const u of hands) u.order = { k: 'idle' };
    return { s, hands };
  };

  it('a Briton sent to food walks a snare line nobody walks, one hand to a line', () => {
    const { s, hands } = bare('britons');
    const home = townCenters(s, 0)[0];
    const at = findSpot(s, 'snare', home.x, home.y, 2, 20, 1, (tx, ty) => !snareSpot(s, tx, ty))!;
    const snare = placeBuilding(s, 0, 'snare', at.tx, at.ty, true);
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'food', n: 2 });
    const tenders = hands.filter((u) => u.order.k === 'snare' && u.order.target === snare.id);
    expect(tenders).toHaveLength(1);
    expect(citizenJob(tenders[0])).toBe('food');
    expect(workforce(s, 0).get('food')).toEqual([tenders[0].id]);
  });

  it('a Mongol sent to food milks a ewe of the flock, one hand to a ewe', () => {
    const { s, hands } = bare('mongols');
    const ewes = s.animals.filter((a) => a.kind === 'sheep' && a.owner === 0 && a.lamb === undefined);
    expect(ewes.length).toBeGreaterThanOrEqual(2);
    for (const a of ewes) a.milk = 10;
    applyCommand(s, { t: 'reassign', p: 0, from: 'idle', to: 'food', n: 2 });
    const milkers = hands.filter((u) => u.order.k === 'milk');
    expect(milkers).toHaveLength(2);
    expect(new Set(milkers.map((u) => (u.order as { target: number }).target)).size).toBe(2);
    expect(milkers.every((u) => citizenJob(u) === 'food')).toBe(true);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(false);
  });
});
