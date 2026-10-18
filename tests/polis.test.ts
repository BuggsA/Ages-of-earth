import { describe, expect, it } from 'vitest';
import { barred } from '../src/sim/ages';
import { applyCommand } from '../src/sim/commands';
import { POLIS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { restat } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';

// The polis (#501): Greek citizens are the army. They take up arms where they stand and lay them down at home.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
const mine = (s: GameState, owner: number, type: Unit['type']) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === type && e.hp > 0);
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;

describe('the polis', () => {
  it('trains no foot soldiers, and only the Greeks are barred', () => {
    const s = game();
    expect(barred(s.players[0], 'infantry')).toMatch(/trains no foot soldiers/);
    expect(barred(s.players[0], 'ranged')).toBeNull();
    expect(barred(s.players[1], 'infantry')).toBeNull();
  });

  it('may still hire foreign foot at the Market in the Age of Merchants', () => {
    const s = game();
    const p = s.players[0];
    expect(barred(p, 'infantry', 'barracks')).toMatch(/trains no foot soldiers/);
    restat(s, p, () => { p.age = 'merchant'; p.epoch = 2; });
    expect(barred(p, 'infantry', 'market')).toBeNull();
    expect(barred(p, 'infantry', 'barracks')).toMatch(/trains no foot soldiers/);
  });

  it('arms citizens where they stand, each paying shield and spear, keeping their health share', () => {
    const s = game();
    const [a, b] = mine(s, 0, 'citizen');
    a.hp = a.hp / 2;
    const at = { x: a.x, y: a.y };
    const wood = s.players[0].res.wood;
    applyCommand(s, { t: 'arm', p: 0, ids: [a.id, b.id] });
    const hoplites = mine(s, 0, 'infantry');
    expect(hoplites).toHaveLength(2);
    expect(s.byId.has(a.id)).toBe(false);
    expect(s.players[0].res.wood).toBe(wood - 2 * (POLIS.arm.wood ?? 0));
    const hurt = hoplites.find((u) => u.x === at.x && u.y === at.y)!;
    expect(hurt.hp).toBeLessThan(hoplites.find((u) => u !== hurt)!.hp);
    expect(s.players[0].stats.armed).toBe(2);
  });

  it('lays arms down only near a Town Center, and the soldier is a citizen again', () => {
    const s = game();
    const [a] = mine(s, 0, 'citizen');
    applyCommand(s, { t: 'arm', p: 0, ids: [a.id] });
    const [h] = mine(s, 0, 'infantry');
    const tc = tcOf(s, 0);
    h.x = tc.x + POLIS.home + 5;
    h.y = tc.y;
    applyCommand(s, { t: 'disarm', p: 0, ids: [h.id] });
    expect(mine(s, 0, 'infantry')).toHaveLength(1);
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    h.x = tc.x + 3;
    applyCommand(s, { t: 'disarm', p: 0, ids: [h.id] });
    expect(mine(s, 0, 'infantry')).toHaveLength(0);
    expect(mine(s, 0, 'citizen').length).toBeGreaterThan(0);
  });

  it('is the Greeks\' alone: a Roman citizen cannot take up arms', () => {
    const s = game();
    const [r] = mine(s, 1, 'citizen');
    applyCommand(s, { t: 'arm', p: 1, ids: [r.id] });
    expect(mine(s, 1, 'infantry')).toHaveLength(0);
    expect(s.byId.has(r.id)).toBe(true);
  });
});
