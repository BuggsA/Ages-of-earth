import { describe, expect, it } from 'vitest';
import { HOMELAND_IDS } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import type { HomelandId, Unit } from '../../src/sim/types';

/**
 * Homelands (#473): two computers play the first fifteen minutes on each homeland of one seed. Each one
 * climbs out of the Stone Age wherever it wakes, and the openings differ: the Shore lives on its boats,
 * the Herd Plains on meat.
 */

const play = (hl: HomelandId) => {
  const s = createGame({ seed: 4, size: 'small', homeland: hl, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
  let dockAt = -1;
  for (let i = 0; i < 15 * 60 * 20 && !s.over; i++) {
    step(s);
    if (dockAt < 0 && s.ents.some((e) => e.kind === 'building' && e.type === 'dock' && e.owner === 0)) dockAt = s.tick / 20;
  }
  const boats = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.type === 'fisher' && e.owner === 0).length;
  return { s, dockAt, boats, fished: s.players[0].stats.fished ?? 0, hunted: s.players[0].stats.hunted ?? 0 };
};

describe('the computer on every homeland (#473)', () => {
  const runs = Object.fromEntries(HOMELAND_IDS.map((hl) => [hl, play(hl)])) as Record<HomelandId, ReturnType<typeof play>>;

  it('climbs out of the Stone Age on each', () => {
    // Player A; on this seed's Glade (the world as it always was) B is slow to climb either way.
    for (const hl of HOMELAND_IDS) expect(runs[hl].s.players[0].epoch, hl).toBeGreaterThanOrEqual(1);
  });

  it('opens differently: a Dock first on the Shore, more meat on the Herd Plains', () => {
    expect(runs.shore.dockAt).toBeGreaterThanOrEqual(0);
    expect(runs.shore.dockAt).toBeLessThan(60);
    expect(runs.glade.dockAt < 0 || runs.glade.dockAt > 180).toBe(true);
    expect(runs.shore.fished).toBeGreaterThan(runs.glade.fished);
    expect(runs.herds.hunted).toBeGreaterThan(runs.glade.hunted);
  });
});
