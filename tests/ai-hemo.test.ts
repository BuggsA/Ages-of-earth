import { describe, expect, it } from 'vitest';
import { enemyTarget, hemoTarget } from '../src/sim/ai';
import { grafted } from '../src/sim/blood';
import { applyCommand } from '../src/sim/commands';
import { AI_HEMO, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and Hemocraft (#355 s5): it draws blood, spends it on Blood Towers and grafts, and sends machines at a rival's. */

const game = (age: 'ironblood' | 'totalwar'): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null }] });
  s.rares = [];
  const p = s.players[0];
  p.epoch = age === 'ironblood' ? 3 : 4;
  p.age = age;
  p.walked = age === 'ironblood' ? ['warband'] : ['warband', 'ironblood'];
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  const home = tc(s);
  for (let i = 0; i < 60; i++) spawnUnit(s, 0, 'citizen', home.x + 3 + (i % 10) * 0.5, home.y + 3 + (i >> 4) * 0.5);
  return s;
};
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const spot = (s: GameState, type: BuildingType, x: number, y: number, lo: number, hi: number, owner = 0) => {
  for (let r = lo; r <= hi; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx;
        const ty = Math.round(y) + dy;
        if (!placeProblem(s, type, tx, ty, true, owner)) return { tx, ty };
      }
  throw new Error('no room');
};
const raise = (s: GameState, owner: number, type: BuildingType, x: number, y: number, lo = 0, hi = 12) => {
  const at = spot(s, type, x, y, lo, hi, owner);
  return placeBuilding(s, owner, type, at.tx, at.ty, true);
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const mine = (s: GameState, type: BuildingType, owner = 0) => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === type && e.owner === owner);
const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
/** Rival foot soldiers standing `d` tiles east of the Town Center. */
const foes = (s: GameState, n: number, d: number, type: Unit['type'] = 'infantry') => {
  const home = tc(s);
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) out.push(spawnUnit(s, 1, type, home.x + d, home.y - 2 + i * 0.6));
  return out;
};

describe('the computer draws blood', () => {
  it('raises a Drain Rig toward where rival soldiers come', () => {
    const s = game('ironblood');
    const near = foes(s, 3, 18);
    run(s, 6);
    const rigs = mine(s, 'drainrig');
    expect(rigs.length).toBe(1);
    expect(d2(rigs[0], near[0])).toBeLessThan(d2(tc(s), near[0]));
  });

  it('raises none while its town is small', () => {
    const s = game('ironblood');
    const town = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
    for (const e of town.slice(AI_HEMO.town - 6)) e.hp = 0;
    foes(s, 3, 18);
    run(s, 6);
    expect(mine(s, 'drainrig').length).toBe(0);
  });

  it('raises none off the Path of Blood', () => {
    const s = game('ironblood');
    s.players[0].age = undefined;
    s.players[0].walked = [];
    foes(s, 3, 18);
    run(s, 6);
    expect(mine(s, 'drainrig').length).toBe(0);
  });

  it('short of blood for a Blood Tower, gives citizens to the levy, then raises the tower toward the foes', () => {
    const s = game('ironblood');
    const home = tc(s);
    raise(s, 0, 'drainrig', home.x + 4, home.y + 4, 0);
    const near = foes(s, 3, 18);
    run(s, 40);
    expect(s.players[0].stats.levied ?? 0).toBeGreaterThan(0);
    const towers = mine(s, 'bloodtower');
    expect(towers.length).toBe(1);
    expect(d2(towers[0], near[0])).toBeLessThan(d2(home, near[0]));
  });

  it('keeps its citizens and raises no Blood Tower against a rival of machines', () => {
    const s = game('ironblood');
    const home = tc(s);
    raise(s, 0, 'drainrig', home.x + 4, home.y + 4, 0);
    foes(s, 3, 18);
    for (let i = 0; i < 6; i++) spawnUnit(s, 1, 'siege', home.x + 30, home.y + i);
    run(s, 40);
    expect(s.players[0].stats.levied ?? 0).toBe(0);
    expect(mine(s, 'bloodtower').length).toBe(0);
  });
});

describe('the computer grafts its soldiers', () => {
  it('raises a Transfusion Station in Total War once it has an army', () => {
    const s = game('totalwar');
    run(s, 6);
    expect(mine(s, 'transfusion').length).toBe(0);
    const home = tc(s);
    for (let i = 0; i < AI_HEMO.army; i++) spawnUnit(s, 0, 'infantry', home.x - 4 + i * 0.4, home.y - 4);
    run(s, 6);
    expect(mine(s, 'transfusion').length).toBe(1);
  });

  it('sends idle soldiers by its Station inside, and they come out grafted', () => {
    const s = game('totalwar');
    const home = tc(s);
    const st = raise(s, 0, 'transfusion', home.x - 6, home.y - 6, 0);
    s.players[0].blood = 200;
    // Three of them pitch a War Camp at home and stay as its guard (#307); the rest go in.
    const men: Unit[] = [];
    for (let i = 0; i < 7; i++) men.push(spawnUnit(s, 0, 'infantry', st.x + 2 + i * 0.4, st.y + 2));
    run(s, 40);
    expect(s.players[0].stats.grafted ?? 0).toBeGreaterThanOrEqual(4);
    expect(men.filter((u) => grafted(s, u)).length).toBeGreaterThanOrEqual(4);
    for (const u of men) expect(u.inside).toBeFalsy();
  });

  it('short of blood for its soldiers, gives citizens to the levy and grafts them', () => {
    const s = game('totalwar');
    const home = tc(s);
    raise(s, 0, 'drainrig', home.x + 4, home.y + 4, 0);
    const st = raise(s, 0, 'transfusion', home.x - 6, home.y - 6, 0);
    for (let i = 0; i < 7; i++) spawnUnit(s, 0, 'infantry', st.x + 2 + i * 0.4, st.y + 2);
    run(s, 60);
    expect(s.players[0].stats.levied ?? 0).toBeGreaterThan(0);
    expect(s.players[0].stats.grafted ?? 0).toBeGreaterThan(0);
  });

  it('lets out soldiers who wait inside on blood it has not got', () => {
    const s = game('totalwar');
    const home = tc(s);
    const st = raise(s, 0, 'transfusion', home.x - 6, home.y - 6, 0);
    const u = spawnUnit(s, 0, 'infantry', st.x + 2, st.y + 2);
    u.inside = st.id;
    st.garrison.push(u.id);
    s.players[0].blood = 0;
    run(s, 3);
    expect(u.inside).toBeFalsy();
  });
});

describe('the computer sends machines at a rival Hemocraft', () => {
  it('counts a rival Station nearer than a Blood Tower beside it', () => {
    const s = game('totalwar');
    const at = { x: s.w - 20, y: s.h - 20 };
    const tower = raise(s, 1, 'bloodtower', at.x, at.y);
    const station = raise(s, 1, 'transfusion', tower.x + 4, tower.y);
    s.players[0].seen.fill(1);
    expect(hemoTarget(s, s.players[0], tower.x - 2, tower.y, 22)).toBe(station);
    expect(hemoTarget(s, s.players[0], tower.x - 40, tower.y, 22)).toBe(null);
  });

  it('bombs a rival Station before its Town Center', () => {
    const s = game('totalwar');
    const rival = tc(s, 1);
    const station = raise(s, 1, 'transfusion', rival.x, rival.y, 5, 14);
    s.players[0].seen.fill(1);
    expect(enemyTarget(s, s.players[0])).toBe(station);
  });

  it('turns the siege marching with a wave on a rival Station near it', () => {
    const s = game('totalwar');
    s.players[0].seen.fill(1);
    const rival = tc(s, 1);
    const station = raise(s, 1, 'transfusion', rival.x, rival.y, 8, 18);
    const ram = spawnUnit(s, 0, 'siege', station.x - 12, station.y);
    step(s);
    s.ai[0].attacking = true;
    applyCommand(s, { t: 'move', p: 0, ids: [ram.id], x: rival.x, y: rival.y, amove: true });
    run(s, 3);
    expect(ram.order.k).toBe('attack');
    expect(ram.order.k === 'attack' && ram.order.target).toBe(station.id);
  });
});

describe('a forward Transfusion Station', () => {
  const front = () => {
    const s = game('totalwar');
    const rival = tc(s, 1);
    const at = spot(s, 'warcamp', rival.x, rival.y, 16, 22, 0);
    const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
    const foot: Unit[] = [];
    for (let i = 0; i < 6; i++) foot.push(spawnUnit(s, 0, 'infantry', camp.x + 2 + (i % 3) * 0.5, camp.y + 3 + (i >> 2) * 0.5));
    step(s);
    s.ai[0].attacking = true;
    for (const u of foot) u.order = { k: 'move', x: rival.x, y: rival.y, amove: true } as Unit['order'];
    return { s, camp, foot };
  };
  it('is raised beside the wave\'s War Camp at the front', () => {
    const { s, camp } = front();
    run(s, 12);
    const made = mine(s, 'transfusion');
    expect(made.length).toBe(1);
    expect(d2(made[0], camp)).toBeLessThanOrEqual(AI_HEMO.forward * AI_HEMO.forward);
  });
  it('is not raised once a Station already stands within reach of the camp', () => {
    const { s, camp } = front();
    raise(s, 0, 'transfusion', camp.x, camp.y, 2, 6);
    run(s, 12);
    expect(mine(s, 'transfusion').length).toBe(1);
  });
});
