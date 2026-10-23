import { describe, expect, it } from 'vitest';
import { battlesFor, tideWord } from '../src/sim/battles';
import { BATTLE } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import type { GameState, Unit } from '../src/sim/types';
import { updateVision } from '../src/sim/vision';
import { spawnUnit } from '../src/sim/world';

/** The tide of battle (#606): a read of who is winning each fight the player sees. */

const setup = () => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.peaceUntil = 0;
  // An open field: no towers or Town Centers firing into the fight.
  s.ents = [];
  s.byId.clear();
  return s;
};

const band = (s: GameState, owner: number, n: number, x: number, y: number) => {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const u = spawnUnit(s, owner, 'infantry', x, y + i * 0.5);
    u.hurt = s.tick;
    out.push(u);
  }
  return out;
};

describe('the tide of battle', () => {
  it('sees no fight where nobody is fighting, or in a peace', () => {
    const s = setup();
    const a = band(s, 0, 4, 20, 20);
    band(s, 1, 4, 22, 20);
    for (const u of s.ents) if (u.kind === 'unit') u.hurt = -999;
    updateVision(s);
    expect(battlesFor(s, 0)).toEqual([]);
    a[0].hurt = s.tick;
    expect(battlesFor(s, 0)).toHaveLength(1);
    s.peaceUntil = s.tick + 100;
    expect(battlesFor(s, 0)).toEqual([]);
  });

  it('reads four against eight of the same as losing, and eight against four as winning', () => {
    const s = setup();
    const ours = band(s, 0, 4, 20, 20);
    band(s, 1, 8, 22, 20);
    updateVision(s);
    const [b] = battlesFor(s, 0);
    // Lanchester's square law: 4² against 8².
    expect(b.share).toBeCloseTo(16 / 80, 2);
    expect(tideWord(b.share)).toBe('losing');
    expect(b.ours).toEqual(ours.map((u) => u.id));
    expect([b.mine, b.theirs, b.foe]).toEqual([4, 8, 1]);
    const [c] = battlesFor(s, 1);
    expect(c.share).toBeCloseTo(64 / 80, 2);
    expect(tideWord(c.share)).toBe('crushing');
  });

  it('counts the wounded for less', () => {
    const s = setup();
    const ours = band(s, 0, 4, 20, 20);
    band(s, 1, 4, 22, 20);
    updateVision(s);
    expect(battlesFor(s, 0)[0].share).toBeCloseTo(0.5, 5);
    for (const u of ours) u.hp /= 2;
    expect(battlesFor(s, 0)[0].share).toBeLessThan(BATTLE.even);
  });

  it('counts only the foes the player sees', () => {
    const s = setup();
    band(s, 0, 4, 20, 20);
    const foes = band(s, 1, 8, 22, 20);
    updateVision(s);
    const vis = s.players[0].vis;
    for (const f of foes.slice(4)) vis[Math.floor(f.y) * s.w + Math.floor(f.x)] = 0;
    const [b] = battlesFor(s, 0);
    expect(b.theirs).toBe(4);
    expect(b.share).toBeCloseTo(0.5, 2);
  });

  it('tells two fights apart, and changes nothing in the state', () => {
    const s = setup();
    band(s, 0, 3, 12, 12);
    band(s, 1, 3, 14, 12);
    band(s, 0, 3, 40, 40);
    band(s, 1, 3, 42, 40);
    updateVision(s);
    const before = JSON.stringify(s.ents);
    const fights = battlesFor(s, 0);
    expect(fights).toHaveLength(2);
    expect(fights.map((f) => Math.round(f.x))).toEqual([13, 41]);
    expect(JSON.stringify(s.ents)).toBe(before);
  });
});

describe('the tide of battle, at work nearby', () => {
  it('leaves out citizens working beside a fight until they strike or are struck', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 0;
    s.ents = [];
    s.byId.clear();
    band(s, 0, 2, 20, 20);
    band(s, 1, 2, 22, 20);
    const picker = spawnUnit(s, 0, 'citizen', 19, 22);
    updateVision(s);
    expect(battlesFor(s, 0)[0].mine).toBe(2);
    picker.hurt = s.tick;
    expect(battlesFor(s, 0)[0].mine).toBe(3);
  });
});
