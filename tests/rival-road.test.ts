import { describe, expect, it } from 'vitest';
import { STEP_BACK, TICK_HZ } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { placeBuilding } from '../src/sim/world';
import { RivalLedger, halfCrossings, rivalCardHtml } from '../src/ui/rivalRoad';

// Reading the rival's road (#726): the ledger, the weak window, half-way crossings and seen keepsakes.
const game = () => createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('the rival ledger', () => {
  it('remembers the road in order, and counts the weak window down after a step back', () => {
    const s = game();
    const rival = s.players[1];
    rival.age = 'bronze';
    rival.epoch = 1;
    const l = new RivalLedger();
    l.note(1, 'bronze', false, 100);
    l.note(1, 'stone', true, 200);
    rival.age = 'stone';
    rival.epoch = 0;
    expect(l.history(s, 1).map((x) => x.age)).toEqual(['bronze', 'stone']);
    s.tick = 200 + 5 * TICK_HZ;
    expect(l.windowLeft(s, 1)).toBe(STEP_BACK.time - 5);
    s.tick = 200 + (STEP_BACK.time + 1) * TICK_HZ;
    expect(l.windowLeft(s, 1)).toBe(0);
  });

  it('shows no window once the rival has climbed again', () => {
    const s = game();
    const l = new RivalLedger();
    l.note(1, 'stone', true, 0);
    s.players[1].age = 'bronze';
    s.players[1].epoch = 1;
    expect(l.windowLeft(s, 1)).toBe(0);
  });

  it('seeds a history from the record when no events were seen', () => {
    const s = game();
    s.players[1].walked = ['iron'];
    expect(new RivalLedger().history(s, 1).map((x) => x.age)).toContain('iron');
  });

  it('notes a rival keepsake only while the viewer sees it, once, and drops it when the building falls', () => {
    const s = game();
    const b = placeBuilding(s, 1, 'forge', 20, 20, true);
    b.keep = 'iron';
    const l = new RivalLedger();
    expect(l.scan(s, 0, () => false)).toEqual([]);
    expect(l.keepsakes()).toEqual([]);
    expect(l.scan(s, 0, () => true).map((k) => k.age)).toEqual(['iron']);
    expect(l.scan(s, 0, () => true)).toEqual([]);
    expect(rivalCardHtml(s, 1, l)).toContain('they have walked the Iron Age');
    b.hp = 0;
    l.scan(s, 0, () => true);
    expect(l.keepsakes()).toEqual([]);
  });

  it("never notes the viewer's own keepsake", () => {
    const s = game();
    placeBuilding(s, 0, 'forge', 20, 20, true).keep = 'iron';
    expect(new RivalLedger().scan(s, 0, () => true)).toEqual([]);
  });

  it('names a crossing the rival is half-way to', () => {
    const s = game();
    s.players[1].walked = ['sail'];
    const half = halfCrossings(s, 1);
    expect(half.some((c) => c.to === 'searaider' && c.missing === 'warband')).toBe(true);
  });
});
