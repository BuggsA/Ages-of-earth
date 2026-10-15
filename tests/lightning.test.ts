import { describe, expect, it } from 'vitest';
import { ageOf, barred, inField, roadKnown, roadProblem, roadTo, workRate } from '../src/sim/ages';
import { lightBeacon } from '../src/sim/beacon';
import { BUILDING_TYPES, LIGHTNING, ROADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { trainTimeFor } from '../src/sim/stats';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { buildingGeometry } from '../src/render/buildingModels';
import type { Building, GameState, Unit } from '../src/sim/types';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const road = ROADS.find((r) => r.to === 'lightning')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
/** Puts player 0 in the Age of Lightning directly. */
const electrify = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'lightning'; });

describe('Age of Lightning (#231)', () => {
  it('is shown by a finished Watch Tower and opens once the towers have lit 6 beacons, relays counted', () => {
    const s = game(); const p = s.players[0]; rich(s);
    expect(roadKnown(s, p, road)).toBe(false);
    const a = placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 8, true);
    placeBuilding(s, 0, 'tower', p.startX + 14, p.startY + 8, true);
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadKnown(s, s.players[1], road)).toBe(false);
    expect(roadProblem(s, p, road)).toContain('(0/6)');
    // One lit beacon passes the flame to the other tower: two beacons.
    lightBeacon(s, p, a);
    expect(p.stats.beacons).toBe(2);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'lightning' }]);
    expect(tc(s).advanceTo).toBeUndefined();
    p.stats.beacons = 6;
    expect(roadProblem(s, p, road)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'lightning' }]); run(s, road.time + 1);
    expect(ageOf(p)).toBe('lightning'); expect(p.epoch).toBe(4);
  });

  it('bars aircraft while there, and the road back brings them again', () => {
    const s = game(); const p = s.players[0]; rich(s); electrify(s);
    expect(barred(p, 'fighter')).toBeTruthy(); expect(barred(p, 'bomber')).toBeTruthy();
    expect(barred(p, 'infantry')).toBeNull();
    const back = roadTo(p, 'industrial')!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'industrial' }]); run(s, back.time + 1);
    expect(ageOf(p)).toBe('industrial'); expect(barred(p, 'fighter')).toBeNull();
  });

  it('a coil\'s field speeds the work near it, and a building outside every field runs slow', () => {
    const s = game(); const p = s.players[0]; rich(s);
    const near = placeBuilding(s, 0, 'barracks', p.startX + 10, p.startY - 6, true);
    const far = placeBuilding(s, 0, 'barracks', p.startX - 12, p.startY - 6, true);
    placeBuilding(s, 0, 'tower', near.x + 4, near.y, true);
    expect(workRate(s, near)).toBe(100);
    electrify(s);
    expect(inField(s, near)).toBe(true); expect(inField(s, far)).toBe(false);
    expect(workRate(s, near)).toBe(LIGHTNING.lit); expect(workRate(s, far)).toBe(LIGHTNING.dark);
    // Train one soldier at each and count the ticks until it walks out.
    const need = secs(trainTimeFor(s, 0, 'infantry', 'barracks'));
    step(s, [{ t: 'train', p: 0, building: near.id, unit: 'infantry' }, { t: 'train', p: 0, building: far.id, unit: 'infantry' }]);
    const done: Record<string, number> = {};
    for (let i = 0; i < need * 2 && Object.keys(done).length < 2; i++) {
      step(s);
      if (!near.queue.length && done.near === undefined) done.near = i;
      if (!far.queue.length && done.far === undefined) done.far = i;
    }
    expect(Math.abs(done.near - need * 100 / LIGHTNING.lit)).toBeLessThan(3);
    expect(Math.abs(done.far - need * 100 / LIGHTNING.dark)).toBeLessThan(3);
    // A fallen coil darkens its quarter.
    for (const e of s.ents) if (e.kind === 'building' && e.type === 'tower') e.hp = 0;
    run(s, 0.1);
    expect(workRate(s, near)).toBe(LIGHTNING.dark);
  });

  it('a coil\'s bolt leaps through a crowd, weaker at each leap, and strikes a spread line once', () => {
    const crowd = (spread: number) => {
      const s = game(); s.peaceUntil = 0; const p = s.players[0]; electrify(s);
      const tower = placeBuilding(s, 0, 'tower', p.startX + 10, p.startY + 10, true);
      const foes: Unit[] = [];
      for (let i = 0; i < 5; i++) foes.push(spawnUnit(s, 1, 'infantry', tower.x + 3 + i * spread, tower.y));
      const hp = foes.map((u) => u.hp);
      for (let i = 0; i < 3 && !s.events.some((e) => e.k === 'arc'); i++) step(s);
      return { s, lost: foes.map((u, i) => hp[i] - u.hp) };
    };
    const tight = crowd(1);
    const arc = tight.s.events.find((e) => e.k === 'arc');
    expect(arc && arc.k === 'arc' && arc.pts.length).toBe(2 + LIGHTNING.strikes * 2);
    const struck = tight.lost.filter((d) => d > 0).sort((a, b) => b - a);
    expect(struck.length).toBe(LIGHTNING.strikes);
    for (let i = 1; i < struck.length; i++) expect(struck[i]).toBeLessThan(struck[i - 1]);
    const loose = crowd(4);
    expect(loose.lost.filter((d) => d > 0).length).toBe(1);
  });

  it('an Industrial tower still looses arrows', () => {
    const s = game(); s.peaceUntil = 0; const p = s.players[0];
    const tower = placeBuilding(s, 0, 'tower', p.startX + 10, p.startY + 10, true);
    spawnUnit(s, 1, 'infantry', tower.x + 3, tower.y);
    let arrow = false, bolt = false;
    for (let i = 0; i < secs(1); i++) {
      step(s);
      arrow ||= s.shots.some((sh) => sh.kind === 'arrow' && sh.owner === 0);
      bolt ||= s.events.some((e) => e.k === 'arc');
    }
    expect(arrow).toBe(true); expect(bolt).toBe(false);
  });

  it('saves and replays alike in the middle of a coil\'s work', () => {
    const s = game(); const p = s.players[0]; rich(s); electrify(s);
    const b = placeBuilding(s, 0, 'barracks', p.startX + 10, p.startY - 6, true);
    step(s, [{ t: 'train', p: 0, building: b.id, unit: 'infantry' }]); run(s, 1.05);
    const saved = deserialize(serialize(s));
    run(saved, 3); run(s, 3);
    expect(serialize(saved)).toBe(serialize(s));
  });

  it('the computer lights beacons toward the road, takes it with towers and no aircraft, and leaves when its coils fall', () => {
    const s = game(); const p = s.players[0]; rich(s); p.ai = 'hard'; s.peaceUntil = 1e9; s.tick = secs(1000);
    for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4);
    placeBuilding(s, 0, 'tower', p.startX + 8, p.startY + 8, true);
    placeBuilding(s, 0, 'tower', p.startX - 8, p.startY + 8, true);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { lightning: true, aeronaut: false } };
    run(s, 2);
    expect(p.stats.beacons ?? 0).toBeGreaterThan(0);
    // The Town Center must stand idle to set out: clear the citizens it queued meanwhile.
    p.stats.beacons = 6; rich(s); s.ai[0].next = 0; tc(s).queue = [];
    run(s, 2); expect(tc(s).advanceTo).toBe('lightning');
    electrify(s); tc(s).advance = -1; delete tc(s).advanceTo;
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 0 && e.type === 'tower') e.hp = 0;
    rich(s); s.ai[0].next = 0;
    run(s, 1); expect(tc(s).advanceTo).toBe('industrial'); expect(s.ai[0].roads!.lightning).toBe(false);
  });

  it('builds every dressed model with finite vertices', () => {
    for (const type of BUILDING_TYPES) {
      const g = buildingGeometry(type, 4, '#cc3333', 0, 'lightning');
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true); g.dispose();
    }
  });
});
