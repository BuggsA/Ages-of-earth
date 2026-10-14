import { describe, expect, it } from 'vitest';
import { REPAIR_SHARE } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { buildingCostFor } from '../src/sim/stats';
import { RES, type Building, type Unit } from '../src/sim/types';
import { maxHp } from '../src/sim/world';

function fixture() {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  const b = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const u = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
  b.hp = maxHp(s, b) / 2;
  for (const r of RES) s.players[0].res[r] = 100000;
  return { s, b, u };
}

describe('repairs cost resources', () => {
  it('repairing half a building never costs more than the share of its price for that half', () => {
    const { s, b, u } = fixture();
    const cost = buildingCostFor(s, 0, b.type);
    const before = { ...s.players[0].res };
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    for (let i = 0; i < 6000 && b.hp < maxHp(s, b); i++) step(s);
    expect(b.hp).toBe(maxHp(s, b));
    for (const r of RES) {
      const spent = before[r] - s.players[0].res[r];
      // Other income (gathering) may add to the stock, so only check nothing is overcharged.
      expect(spent).toBeLessThanOrEqual(Math.ceil(REPAIR_SHARE * (cost[r] ?? 0) * 0.5) + 1);
    }
    expect(RES.some((r) => (cost[r] ?? 0) > 0)).toBe(true);
  });

  it('a player who cannot pay gets a refusal and the builder stops', () => {
    const { s, b, u } = fixture();
    for (const r of RES) s.players[0].res[r] = 0;
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    const hp = b.hp;
    let refused = false;
    for (let i = 0; i < 600; i++) {
      step(s);
      refused ||= s.events.some((e) => e.k === 'refused');
    }
    expect(refused).toBe(true);
    expect(b.hp).toBeLessThan(maxHp(s, b));
    expect(b.hp).toBeGreaterThanOrEqual(hp);
    expect(u.order.k).not.toBe('build');
  });
});
