import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/data';
import { claimWork } from '../src/sim/landmarks';
import { createGame, step } from '../src/sim/game';
import type { GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer holds what it keeps: it sends soldiers to a landmark of its own that rivals are pulling down. */

const game = (): GameState =>
  createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });

describe('the computer defends its landmarks', () => {
  it('sends its idle soldiers to a landmark of its own that a rival stands on alone', () => {
    const s = game();
    const ai = s.players[1];
    const m = s.landmarks![0];
    m.owner = ai.id;
    m.by = ai.id;
    m.claim = claimWork();
    // A rival raider sits on it; the computer has a band of soldiers at home.
    spawnUnit(s, 0, 'citizen', m.x + 0.5, m.y + 0.5);
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === ai.id)!;
    const band: Unit[] = [];
    for (let i = 0; i < 4; i++) band.push(spawnUnit(s, ai.id, 'infantry', home.x + 2 + i * 0.4, home.y + 3));
    for (let i = 0; i < 12 * TICK_HZ; i++) step(s);
    const gone = band.filter((u) => u.hp > 0 && (u.order.k === 'move' || u.order.k === 'attack') && Math.hypot(u.x - home.x, u.y - home.y) > 3);
    expect(gone.length).toBeGreaterThanOrEqual(3);
  }, 30000);
});

describe('the computer favours its own people\'s landmark kind', () => {
  it('sends its walker to its kin kind when another is a little nearer', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a, b] = s.landmarks!;
    a.kind = 'crag';
    b.kind = 'spring';
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 20; a.y = home.y;
    b.x = home.x + 26; b.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markWalker; i++) step(s);
    expect(s.ai[1]?.markWalker?.id).toBe(b.id);
  }, 30000);
});

describe('the computer recalls a lone walker', () => {
  it('turns its walker home when rival soldiers appear beside it on the road', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 30; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markWalker; i++) step(s);
    const w = s.ai[1]!.markWalker!;
    expect(w).toBeTruthy();
    const u = s.byId.get(w.unit) as Unit;
    // A rival soldier appears next to the walker, far from the landmark.
    const foe = spawnUnit(s, 0, 'infantry', u.x + 3, u.y);
    s.players[1].vis[Math.floor(foe.y) * s.w + Math.floor(foe.x)] = 1;
    for (let i = 0; i < 2 * TICK_HZ; i++) step(s);
    expect(s.ai[1]?.markWalker?.unit).not.toBe(u.id);
  }, 30000);
});
