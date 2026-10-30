import { describe, expect, it } from 'vitest';
import { AGES, FAULT, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { engineVent } from '../src/sim/fault';
import type { Building } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer in the Age of Faults (#900): it raises a Fault Engine by its home vent, and cracks the ground across a rival army. */
describe('the computer in the Age of Faults (#900)', () => {
  it('raises an engine by the vent near its town, and opens a chasm across a rival band coming at it', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.faults.tier;
      p.age = 'faults';
    });
    p.walked = ['megaliths', 'delvings', 'undercity', 'forges', 'faults'];
    p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
    const engines = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'faultengine' && e.built);
    for (let i = 0; i < secs(150) && !engines().length; i++) step(s);
    const b = engines()[0];
    expect(b).toBeDefined();
    expect(engineVent(s, b)).toBe(s.vents![0]);
    s.peaceUntil = 0;
    // A band halfway between the towns, standing its ground, seen by the computer.
    const q = s.players[1];
    const dx = q.startX - p.startX;
    const dy = q.startY - p.startY;
    const d = Math.sqrt(dx * dx + dy * dy);
    const at = { x: p.startX + (dx / d) * 15, y: p.startY + (dy / d) * 15 };
    const band = Array.from({ length: FAULT.aiArmy + 1 }, (_, i) => spawnUnit(s, 1, 'infantry', at.x + (i % 3) - 1, at.y + Math.floor(i / 3)));
    for (const u of band) u.stance = 'stand';
    for (let i = 0; i < secs(FAULT.charge + 10) && !(p.stats.cracked ?? 0); i++) {
      step(s);
      for (const e of band) p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)] = 1;
    }
    expect(p.stats.cracked ?? 0).toBeGreaterThan(0);
  });
});
