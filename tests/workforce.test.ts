import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import type { Unit } from '../src/sim/types';
import { citizenJob, workforce, WORKFORCE_JOBS } from '../src/ui/workforce';

describe('workforce ledger', () => {
  it('groups all living citizens by actual job, excluding soldiers, rivals and dead workers', () => {
    const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const cs = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
    expect(cs.length).toBeGreaterThanOrEqual(7);
    cs[0].order = { k: 'gather', tile: 0, res: 'wood', phase: 'go' };
    cs[1].order = { k: 'farm', target: 1, phase: 'work' };
    cs[2].order = { k: 'build', target: 1 };
    cs[3].order = { k: 'dig', target: 1 };
    cs[4].inside = 12;
    cs[5].queue.push({ k: 'idle' });
    cs[6].hp = 0;
    spawnUnit(s, 0, 'infantry', cs[0].x, cs[0].y);
    const groups = workforce(s, 0);
    expect(groups.get('wood')).toContain(cs[0].id);
    expect(groups.get('food')).toContain(cs[1].id);
    expect(groups.get('build')).toEqual([cs[2].id, cs[3].id]);
    expect(groups.get('shelter')).toContain(cs[4].id);
    expect(groups.get('other')).toContain(cs[5].id);
    const all = [...groups.values()].flat();
    expect(all).toHaveLength(cs.length - 1);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain(cs[6].id);
    expect(groups.size).toBe(WORKFORCE_JOBS.length);
  });
  it('assigns gather categories from orders, not the worker animation', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const c = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    for (const res of ['food', 'wood', 'stone', 'gold'] as const) {
      c.order = { k: 'gather', tile: 0, res, phase: 'drop' };
      expect(citizenJob(c)).toBe(res);
    }
    c.order = { k: 'move', x: c.x, y: c.y, amove: false, started: false };
    expect(citizenJob(c)).toBe('other');
  });
});
