import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import type { Building, Unit } from '../src/sim/types';
import { maxHp } from '../src/sim/world';

function fixture() {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  const b = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const u = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
  b.hp = maxHp(s, b) / 2;
  return { s, b, u };
}

describe('building repairs', () => {
  it('right-click work repairs a completed town center, caps health and follows queued orders', () => {
    const { s, b, u } = fixture();
    const before = b.hp;
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    expect(u.order).toEqual({ k: 'build', target: b.id });
    applyCommand(s, { t: 'move', p: 0, ids: [u.id], x: u.x, y: u.y, queue: true });
    let repaired = false;
    for (let i = 0; i < 4000; i++) {
      step(s);
      repaired ||= b.hp > before;
      expect(s.events.some((e) => e.k === 'built')).toBe(false);
    }
    expect(repaired).toBe(true);
    expect(b.hp).toBe(maxHp(s, b));
    expect(b.built).toBe(true);
    expect(b.progress).toBe(1);
    expect(u.inside).toBeFalsy();
    expect(u.queue).toHaveLength(0);
    expect(u.order.k).not.toBe('build');
  });

  it('retains explicit garrison and healthy-building right-click behavior', () => {
    const { s, b, u } = fixture();
    applyCommand(s, { t: 'garrison', p: 0, ids: [u.id], target: b.id });
    expect(u.order.k).toBe('garrison');
    b.hp = maxHp(s, b);
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    expect(u.order.k).toBe('garrison');
  });

  it('rejects another player’s building and does not make soldiers repair', () => {
    const { s, b, u } = fixture();
    applyCommand(s, { t: 'work', p: 1, ids: [u.id], target: b.id });
    expect(u.order.k).toBe('idle');
    u.type = 'infantry';
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    expect(u.order.k).toBe('garrison');
  });

  it('continues identically after saving during repairs', () => {
    const { s, b, u } = fixture();
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    for (let i = 0; i < 100; i++) step(s);
    const loaded = deserialize(serialize(s));
    for (let i = 0; i < 1000; i++) { step(s); step(loaded); }
    expect(serialize(loaded)).toBe(serialize(s));
  });
});
