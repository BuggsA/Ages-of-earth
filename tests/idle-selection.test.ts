import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import type { Unit } from '../src/sim/types';
import { idleCitizens, idleSelection, idleShortcut, isIdleCitizen } from '../src/ui/idle';

function fixture() {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  const citizens = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
  return { s, citizens };
}

describe('finding available idle citizens', () => {
  it('leaves citizens in shelter or aboard transports out of the counter and selection', () => {
    const { s, citizens } = fixture();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const transport = spawnUnit(s, 0, 'transport', home.x, home.y);
    citizens[0].inside = home.id;
    citizens[1].inside = transport.id;
    const idle = idleCitizens(s, 0);
    expect(idleSelection(idle, undefined, true)).toEqual(citizens.slice(2).map((u) => u.id));
    expect(isIdleCitizen(citizens[0], 0)).toBe(false);
    expect(isIdleCitizen(citizens[1], 0)).toBe(false);
  });

  it('does not interrupt work, queued jobs, other players, or include dead citizens and soldiers', () => {
    const { s, citizens } = fixture();
    const [busy, queued, dead] = citizens;
    busy.order = { k: 'move', x: busy.x, y: busy.y, amove: false, started: false };
    queued.queue.push({ k: 'move', x: queued.x, y: queued.y, amove: false, started: false });
    dead.hp = 0;
    spawnUnit(s, 0, 'infantry', busy.x, busy.y);
    expect(idleCitizens(s, 0).map((u) => u.id)).toEqual(citizens.slice(3).map((u) => u.id));
    expect(queued.queue).toHaveLength(1);
    expect(busy.order.k).toBe('move');
  });

  it('cycles in order, wraps, and handles empty and stale selections', () => {
    const { s } = fixture();
    const idle = idleCitizens(s, 0);
    expect(idleSelection(idle, undefined, false)).toEqual([idle[0].id]);
    expect(idleSelection(idle, idle[0].id, false)).toEqual([idle[1].id]);
    expect(idleSelection(idle, idle[idle.length - 1].id, false)).toEqual([idle[0].id]);
    expect(idleSelection(idle, -1, false)).toEqual([idle[0].id]);
    expect(idleSelection([], undefined, false)).toEqual([]);
    expect(idleSelection([], undefined, true)).toEqual([]);
  });

  it('recognizes Shift-period when the key becomes >, without taking browser shortcuts', () => {
    const event = { key: '>', code: 'Period', ctrlKey: false, metaKey: false, altKey: false };
    expect(idleShortcut(event)).toBe(true);
    expect(idleShortcut({ ...event, key: '.', code: 'NumpadDecimal' })).toBe(true);
    expect(idleShortcut({ ...event, code: 'Comma' })).toBe(false);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      expect(idleShortcut({ ...event, [modifier]: true })).toBe(false);
    }
  });
});
