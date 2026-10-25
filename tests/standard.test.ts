import { describe, expect, it } from 'vitest';
import { landOwnerAt } from '../src/sim/borders';
import { STANDARD, TRIBUTE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** The Horde's Horsetail Standard (#727): riders standing by it are paid by the nearest rival whose land lies at its edge. */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const horde = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'horde'; s.players[0].epoch = 2; s.players[0].walked = ['steppe', 'horde']; });

/** Player 1 emptied of people, a standard of player 0's just outside its border with riders beside it. */
function setup(riders = 3, outsideBy = 3) {
  const s = game();
  s.peaceUntil = 0;
  s.ents = s.ents.filter((e) => e.kind !== 'unit' || e.owner !== 1);
  for (const [id, e] of s.byId) if (e.kind === 'unit' && e.owner === 1) s.byId.delete(id);
  horde(s);
  s.players[1].res.gold = 1000;
  const home = tc(s, 1);
  const dir = Math.sign(s.w / 2 - home.x) || 1;
  let d = 10;
  while (landOwnerAt(s, Math.floor(home.x + dir * d), Math.floor(home.y)) === 1) d++;
  const x = home.x + dir * (d + outsideBy);
  const flag = placeBuilding(s, 0, 'standard', Math.floor(x), Math.floor(home.y), true);
  flag.built = true;
  const band = [];
  for (let i = 0; i < riders; i++) band.push(spawnUnit(s, 0, 'cavalry', x + (i - 1) * 0.5, home.y + 1.5));
  return { s, flag, band, x, y: home.y };
}

describe('the Horsetail Standard (#727)', () => {
  it('pays riders standing by it, outside the rival\'s land', () => {
    const { s, band } = setup();
    expect(landOwnerAt(s, Math.floor(band[0].x), Math.floor(band[0].y))).not.toBe(1);
    const before = s.players[0].res.gold;
    run(s, 10);
    expect(s.players[0].res.gold).toBeGreaterThan(before + 3 * STANDARD.rate * 8);
    expect(s.players[1].res.gold).toBeLessThan(1000);
  });

  it('pays nothing without a standard, or when it is cut down, or when the riders are out of reach', () => {
    const none = setup();
    none.flag.hp = 0;
    const g = none.s.players[0].res.gold;
    run(none.s, 10);
    expect(none.s.players[0].res.gold).toBe(g);
    const far = setup();
    for (const u of far.band) u.x -= STANDARD.reach + 3;
    const g2 = far.s.players[0].res.gold;
    run(far.s, 10);
    expect(far.s.players[0].res.gold).toBe(g2);
  });

  it('counts at most TRIBUTE.most riders', () => {
    const { s } = setup(TRIBUTE.most + 6);
    const rich0 = s.players[0].res.gold;
    s.players[1].res.gold = 100000;
    run(s, 10);
    expect(s.players[0].res.gold - rich0).toBeLessThan((TRIBUTE.most + 1) * STANDARD.rate * 10 + 1);
  });

  it('a kept standard goes on paying on another road; an unkept one sleeps', () => {
    const kept = setup();
    restat(kept.s, kept.s.players[0], () => { kept.s.players[0].age = 'middle'; kept.s.players[0].epoch = 2; });
    kept.flag.keep = 'horde';
    const g = kept.s.players[0].res.gold;
    run(kept.s, 10);
    expect(kept.s.players[0].res.gold).toBeGreaterThan(g + 5);
    const asleep = setup();
    restat(asleep.s, asleep.s.players[0], () => { asleep.s.players[0].age = 'middle'; asleep.s.players[0].epoch = 2; });
    const g2 = asleep.s.players[0].res.gold;
    run(asleep.s, 10);
    expect(asleep.s.players[0].res.gold).toBe(g2);
  });
});
