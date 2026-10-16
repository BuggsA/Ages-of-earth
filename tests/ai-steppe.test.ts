import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { AI_STEPPE, FLOCK, secs } from '../src/sim/data';
import { addSheep, flockOf } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import type { Building, CivId, GameState, Unit } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer on the steppe (#320): the road there, the flock, and striking camp. */

const game = (civ: CivId = 'mongols', citizens = 14): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null }] });
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  const home = tc(s);
  for (let i = 0; i < citizens; i++) spawnUnit(s, 0, 'citizen', home.x + 3 + (i % 8) * 0.5, home.y + 3 + (i >> 3) * 0.5);
  return s;
};
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number, each?: () => void) => {
  for (let i = 0; i < secs(seconds); i++) {
    step(s);
    each?.();
  }
};
/** Puts player 0 on the steppe directly. */
const nomads = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'steppe'; s.players[0].epoch = 1; });
const sheep = (s: GameState, owner = 0) => s.animals.filter((a) => a.kind === 'sheep' && a.owner === owner && a.hp > 0);
const citizens = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

describe('the computer on the steppe (#320)', () => {
  it('a riding people in the Stone Age raises a Hunting Camp by the deer and puts more hunters out', () => {
    const s = game();
    let hunters = 0;
    run(s, 40, () => { hunters = Math.max(hunters, citizens(s).filter((u) => u.order.k === 'hunt').length); });
    expect(s.ai[0].roads?.steppe).toBe(true);
    const camp = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'huntcamp');
    expect(camp).toBeTruthy();
    expect(dist(camp!, tc(s))).toBeLessThan(AI_STEPPE.campTo + 6);
    expect(hunters).toBeGreaterThan(3);
  });

  it('a people that passed the steppe by raises no camp for it', () => {
    const s = game('greeks');
    // Only deer: a mammoth or boar kill far out earns a camp of its own (#171).
    s.animals = s.animals.filter((a) => a.kind === 'deer');
    step(s);
    s.ai[0].roads = { steppe: false, iron: false };
    run(s, 40);
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'huntcamp')).toBe(false);
  });

  it('on the steppe it raises lambs, milks the flock and lays no fields', () => {
    const s = game();
    nomads(s);
    const refused: string[] = [];
    let milkers = 0;
    // Long enough for the first lambs to grow up and give milk.
    run(s, FLOCK.lamb + 20, () => {
      for (const e of s.events) if (e.k === 'refused' && e.owner === 0) refused.push(e.why);
      milkers = Math.max(milkers, citizens(s).filter((u) => u.order.k === 'milk').length);
    });
    expect(flockOf(s, 0)).toBeGreaterThanOrEqual(4);
    expect(milkers).toBeGreaterThan(0);
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'farm')).toBe(false);
    expect(refused.filter((why) => why.includes('fields'))).toEqual([]);
  });

  it('slaughters a sheep too fat to breed once the flock is full', () => {
    const s = game();
    nomads(s);
    const t = tc(s);
    for (let i = 0; i < FLOCK.cap; i++) addSheep(s, 0, t.x - 3.5 + (i % 4), t.y + 4.5 + (i >> 2), false);
    const fat = sheep(s)[3];
    fat.fat = FLOCK.breed;
    run(s, 30);
    expect(s.animals.includes(fat)).toBe(false);
  });

  it('strikes camp when the flock has grazed its pasture out, and pitches on fresh grass', () => {
    const s = game();
    nomads(s);
    const t = tc(s);
    const was = { x: t.x, y: t.y };
    for (let i = 0; i < 4; i++) addSheep(s, 0, t.x - 3.5 + i, t.y + 4.5, false);
    // The ground round camp cropped bare for a long while, and the game round it hunted out.
    s.grazed!.fill(0);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (dist({ x, y }, was) < 9) s.grazed![y * s.w + x] = secs(9999);
    s.animals = s.animals.filter((a) => a.kind === 'sheep' || dist(a, was) > AI_STEPPE.bare + 2);
    step(s);
    s.ai[0].steppe = { since: -secs(AI_STEPPE.every) };
    let packed = false;
    run(s, 90, () => { packed ||= s.events.some((e) => e.k === 'camp' && e.owner === 0 && !e.pitched); });
    expect(packed).toBe(true);
    const now = tc(s);
    expect(now).toBeTruthy();
    expect(dist(now, was)).toBeGreaterThan(AI_STEPPE.move - 3);
    expect(dist(now, was)).toBeLessThan(AI_STEPPE.far + 4);
    // The flock went with it.
    for (const a of sheep(s)) expect(dist(a, now)).toBeLessThan(FLOCK.range + 4);
    expect(s.ai[0].steppe?.to).toBeUndefined();
  });

  it('keeps to the steppe for a while before rejoining the trunk', () => {
    const s = game('mongols', 40);
    nomads(s);
    s.tick = secs(700);
    s.peaceUntil = 0;
    run(s, AI_STEPPE.stay - 30);
    expect(ageOf(s.players[0])).toBe('steppe');
    expect(tc(s).advance).toBeLessThan(0);
  });
});
