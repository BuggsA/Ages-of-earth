import { describe, expect, it } from 'vitest';
import { BORDERS } from '../src/sim/data';
import { borderMap } from '../src/sim/borders';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { placeBuilding } from '../src/sim/world';

const game = () => createGame({ seed: 5, size: 'small', startEpoch: 1, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('borders', () => {
  it('give each town its land and leave the far ground to no one', () => {
    const s = game();
    const own = borderMap(s);
    const a = s.players[0];
    expect(own[Math.floor(a.startY) * s.w + Math.floor(a.startX)]).toBe(0);
    expect(own[Math.floor(s.players[1].startY) * s.w + Math.floor(s.players[1].startX)]).toBe(1);
    expect(own.some((o) => o === -1)).toBe(true);
    expect(BORDERS.towncenter).toBeGreaterThan(BORDERS.tower!);
  });

  it('count only finished, living claimants and never change the state', () => {
    const s = game();
    const before = serialize(s);
    const x = 3, y = 3;
    placeBuilding(s, 0, 'tower', x, y, false);
    expect(borderMap(s)[y * s.w + x]).toBe(-1);
    placeBuilding(s, 0, 'tower', x, y + 20, true);
    expect(borderMap(s)[(y + 20) * s.w + x]).toBe(0);
    expect(serialize(s)).not.toBe(before);
    const t = serialize(s);
    borderMap(s);
    expect(serialize(s)).toBe(t);
  });
});

describe('attrition', () => {
  it('wears down a soldier deep in enemy land and spares one near its own, and ships and citizens', async () => {
    const { attrition } = await import('../src/sim/borders');
    const { spawnUnit } = await import('../src/sim/world');
    const { ATTRITION, secs } = await import('../src/sim/data');
    const s = game();
    const b = s.players[1];
    const deep = spawnUnit(s, 0, 'infantry', b.startX + 4, b.startY + 4);
    const farm = spawnUnit(s, 0, 'citizen', b.startX + 4, b.startY + 5);
    const home = spawnUnit(s, 1, 'infantry', b.startX + 4, b.startY + 6);
    const h0 = deep.hp;
    const f0 = farm.hp;
    const m0 = home.hp;
    s.tick = secs(ATTRITION.every);
    attrition(s);
    expect(deep.hp).toBeLessThan(h0);
    expect(farm.hp).toBe(f0);
    expect(home.hp).toBe(m0);
    s.tick++;
    const hd = deep.hp;
    attrition(s);
    expect(deep.hp).toBe(hd);
  });
});

describe('the computer reads borders', () => {
  it('pulls back a worn wave deep in enemy land, not a healthy one or one still fighting', async () => {
    const { wornDeep } = await import('../src/sim/ai');
    const { spawnUnit } = await import('../src/sim/world');
    const s = game();
    const b = s.players[1];
    const wave = [0, 1, 2].map((i) => spawnUnit(s, 0, 'infantry', b.startX + 4, b.startY + 4 + i));
    expect(wornDeep(s, s.players[0], wave)).toBe(false);
    for (const u of wave) u.hp *= 0.3;
    expect(wornDeep(s, s.players[0], wave)).toBe(true);
    const foe = spawnUnit(s, 1, 'infantry', b.startX + 6, b.startY + 5);
    expect(wornDeep(s, s.players[0], wave)).toBe(false);
    foe.hp = 0;
    const home = [0, 1].map((i) => spawnUnit(s, 0, 'infantry', s.players[0].startX + 2, s.players[0].startY + 2 + i));
    for (const u of home) u.hp *= 0.3;
    expect(wornDeep(s, s.players[0], home)).toBe(false);
  });
});
