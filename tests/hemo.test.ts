import { describe, expect, it } from 'vitest';
import { buildBarred } from '../src/sim/ages';
import { bloodOf, grafted, hemoPace } from '../src/sim/blood';
import { BUILDINGS, HEMO, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { damageOf } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { statsOf } from '../src/sim/world';
import type { Building, BuildingType, GameState, Unit, UnitType } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Hemocraft (#355 s3): blood spent on Blood Towers and on grafting soldiers at Transfusion Stations. */

const game = (age: 'ironblood' | 'totalwar' = 'totalwar'): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.players[0].epoch = age === 'totalwar' ? 4 : 3;
  s.players[0].age = age;
  return s;
};

/** A free spot for `type` near a point, as tile coordinates. */
const spotFor = (s: GameState, type: BuildingType, x: number, y: number): { tx: number; ty: number } => {
  for (let r = 0; r < 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!placeProblem(s, type, Math.round(x) + dx, Math.round(y) + dy, true, 0)) return { tx: Math.round(x) + dx, ty: Math.round(y) + dy };
      }
  throw new Error('no room');
};
const raise = (s: GameState, type: BuildingType): Building => {
  const at = spotFor(s, type, s.players[0].startX, s.players[0].startY + 6);
  return placeBuilding(s, 0, type, at.tx, at.ty, true);
};
const soldiers = (s: GameState, b: Building, n: number, type: UnitType = 'infantry'): Unit[] => {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) out.push(spawnUnit(s, 0, type, b.x + 1.5 + i * 0.3, b.y + 1.5));
  return out;
};
const run = (s: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};

describe('the Blood Tower', () => {
  it('is raised only on the Path of Blood, and paid for once in blood', () => {
    const s = game('ironblood');
    expect(buildBarred(s.players[0], 'bloodtower')).toBeNull();
    s.players[0].age = 'gunpowder';
    expect(buildBarred(s.players[0], 'bloodtower')).toBeTruthy();
    s.players[0].age = 'ironblood';
    const p = s.players[0];
    for (const r of ['food', 'wood', 'stone', 'gold'] as const) p.res[r] = 5000;
    const crew = soldiers(s, raise(s, 'drainrig'), 1, 'citizen');
    const at = spotFor(s, 'bloodtower', p.startX - 6, p.startY - 6);
    applyCommand(s, { t: 'build', p: 0, ids: crew.map((u) => u.id), type: 'bloodtower', tx: at.tx, ty: at.ty });
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'bloodtower')).toBe(false);
    expect(s.events.some((e) => e.k === 'refused' && /blood/.test(e.why))).toBe(true);
    p.blood = BUILDINGS.bloodtower.blood! + 5;
    applyCommand(s, { t: 'build', p: 0, ids: crew.map((u) => u.id), type: 'bloodtower', tx: at.tx, ty: at.ty });
    const site = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'bloodtower');
    expect(site).toBeTruthy();
    expect(bloodOf(p)).toBe(5);
    // Pulled down before a stone is laid, its blood comes back.
    applyCommand(s, { t: 'delete', p: 0, ids: [site!.id] });
    expect(bloodOf(p)).toBe(BUILDINGS.bloodtower.blood! + 5);
  });

  it('tears the living, barely scratches the bloodless, and looks for the living first', () => {
    const s = game('ironblood');
    s.peaceUntil = 0;
    const t = raise(s, 'bloodtower');
    const ram = spawnUnit(s, 1, 'siege', t.x + 2.5, t.y);
    const foot = spawnUnit(s, 1, 'infantry', t.x + 5, t.y);
    let shot = null;
    for (let i = 0; i < 40 && !shot; i++) {
      step(s);
      shot = s.shots.find((x) => x.owner === 0 && !x.from && x.x0 === t.x && x.y0 === t.y) ?? null;
    }
    expect(shot).toBeTruthy();
    expect(shot!.target).toBe(foot.id);
    expect(shot!.damage).toBeGreaterThan(30);
    s.ents = s.ents.filter((e) => e !== foot);
    s.byId.delete(foot.id);
    s.shots = [];
    shot = null;
    for (let i = 0; i < 80 && !shot; i++) {
      step(s);
      shot = s.shots.find((x) => x.owner === 0 && !x.from && x.x0 === t.x && x.y0 === t.y) ?? null;
    }
    expect(shot!.target).toBe(ram.id);
    expect(shot!.damage).toBe(1);
  });
});

describe('the Transfusion Station', () => {
  it('is raised only in the Age of Total War', () => {
    const s = game('ironblood');
    expect(buildBarred(s.players[0], 'transfusion')).toBeTruthy();
    s.players[0].age = 'totalwar';
    s.players[0].epoch = 4;
    expect(buildBarred(s.players[0], 'transfusion')).toBeNull();
  });

  it('grafts the soldiers sent inside one at a time for blood, then lets them out', () => {
    const s = game();
    const p = s.players[0];
    p.blood = HEMO.cost * 2 + 7;
    const st = raise(s, 'transfusion');
    const men = soldiers(s, st, 2);
    applyCommand(s, { t: 'garrison', p: 0, ids: men.map((u) => u.id), target: st.id });
    run(s, secs(HEMO.work) * 2 + 60);
    expect(men.every((u) => grafted(s, u))).toBe(true);
    expect(bloodOf(p)).toBe(7);
    expect(p.stats.grafted).toBe(2);
    expect(men.every((u) => u.inside === 0)).toBe(true);
  });

  it('waits for blood, and takes no citizen', () => {
    const s = game();
    const p = s.players[0];
    p.blood = HEMO.cost + 1;
    const st = raise(s, 'transfusion');
    const men = soldiers(s, st, 2);
    const folk = soldiers(s, st, 1, 'citizen');
    applyCommand(s, { t: 'garrison', p: 0, ids: [...men, ...folk].map((u) => u.id), target: st.id });
    run(s, secs(HEMO.work) * 3 + 60);
    expect(men.filter((u) => grafted(s, u)).length).toBe(1);
    expect(grafted(s, folk[0])).toBe(false);
    expect(bloodOf(p)).toBe(1);
    // Still one waiting, so the doors stay shut.
    expect(st.garrison.length).toBe(3);
  });
});

describe('a grafted soldier', () => {
  const graftedPair = () => {
    const s = game();
    const st = raise(s, 'transfusion');
    const [u] = soldiers(s, st, 1);
    const plain = spawnUnit(s, 0, 'infantry', u.x + 0.5, u.y);
    u.hemo = s.tick + secs(HEMO.last);
    return { s, st, u, plain };
  };

  it('hits harder, walks faster, and is hurt less by the living and more by machines', () => {
    const { s, u, plain } = graftedPair();
    const foe = spawnUnit(s, 1, 'infantry', u.x + 3, u.y);
    const gun = spawnUnit(s, 1, 'siege', u.x + 6, u.y);
    const blow = statsOf(s, foe);
    const shell = statsOf(s, gun);
    expect(damageOf(s, u, statsOf(s, u), foe, false)).toBeGreaterThan(damageOf(s, plain, statsOf(s, plain), foe, false));
    expect(hemoPace(s, u)).toBe(HEMO.pace);
    expect(hemoPace(s, plain)).toBe(1);
    expect(damageOf(s, foe, blow, u, false)).toBeLessThan(damageOf(s, foe, blow, plain, false));
    expect(damageOf(s, gun, shell, u, true)).toBeGreaterThan(damageOf(s, gun, shell, plain, true));
  });

  it('cannot be converted', () => {
    const { s, u } = graftedPair();
    s.peaceUntil = 0;
    s.players[1].epoch = 4;
    const priest = spawnUnit(s, 1, 'priest', u.x + 2, u.y);
    applyCommand(s, { t: 'convert', p: 1, ids: [priest.id], target: u.id });
    run(s, secs(30));
    expect(u.owner).toBe(0);
  });

  it('is fed near a Station, mends, and crashes when its graft runs dry far from one', () => {
    const { s, st, u } = graftedPair();
    u.hp = 10;
    run(s, secs(HEMO.last) + 40);
    // Fed beside the Station, mending all the while.
    expect(grafted(s, u)).toBe(true);
    expect(u.hp).toBe(statsOf(s, u).hp);
    // Far from it, the graft runs dry.
    u.x = st.x + 40;
    u.y = st.y;
    u.px = u.x;
    u.py = u.y;
    u.hemo = s.tick + 30;
    const seen: GameState['events'] = [];
    for (let i = 0; i < 60; i++) {
      step(s);
      seen.push(...s.events);
    }
    expect(grafted(s, u)).toBe(false);
    expect(u.hemo).toBeUndefined();
    expect(u.hp).toBeLessThan(statsOf(s, u).hp * (1 - HEMO.crash) + 1);
    expect(seen.some((e) => e.k === 'graft' && e.how === 'crash' && e.id === u.id)).toBe(true);
  });

  it('keeps its graft through a save', () => {
    const { s, u } = graftedPair();
    const back = deserialize(serialize(s));
    const again = back.byId.get(u.id) as Unit;
    expect(again.hemo).toBe(u.hemo);
    expect(grafted(back, again)).toBe(true);
  });
});
