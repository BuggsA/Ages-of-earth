import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { cursed, grafted, sworn } from '../src/sim/blood';
import { HEMO, ORDERS, RITE, TECHS, secs } from '../src/sim/data';
import { riteProblem } from '../src/sim/fork';
import { createGame, step } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';
import type { AgeId, Building, BuildingType, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Path of Blood's heirlooms (#355 s6): Galvanic Blood (Lightning + Hemocraft) and Military Orders (Pilgrims + Warband). */

const game = (startEpoch = 4): GameState => {
  const s = createGame({ seed: 11, size: 'small', startEpoch, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  s.rares = [];
  // The rival's own people out of the way, in a far corner.
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
  return s;
};
const learn = (s: GameState, tech: 'galvanicBlood' | 'militaryOrders', owner = 0) => {
  const p = s.players[owner];
  p.walked = [...TECHS[tech].walked!];
  p.techs.push(tech);
  p.statsVersion++;
};
const raise = (s: GameState, type: BuildingType, x: number, y: number): Building => {
  const spot = findSpot(s, type, x, y, 0, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
const home = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;

describe('the Path of Blood\'s heirlooms (#355 s6)', () => {
  it('are each shut until both their ages are walked, and add their mod', () => {
    const s = game();
    const pairs: Record<string, [AgeId, AgeId]> = { galvanicBlood: ['lightning', 'hemocraft'], militaryOrders: ['pilgrim', 'warband'] };
    for (const [tech, pair] of Object.entries(pairs) as ['galvanicBlood' | 'militaryOrders', [AgeId, AgeId]][]) {
      expect(TECHS[tech].walked).toEqual(pair);
      expect(techProblem(s, 0, tech)).toMatch(/^An heirloom: walk the /);
    }
    expect(techProblem(s, 0, 'militaryOrders')).toBe('An heirloom: walk the Age of Pilgrims and the Age of the Warband first');
    learn(s, 'galvanicBlood');
    learn(s, 'militaryOrders');
    expect(modsOf(s, 0).veins).toBe(1);
    expect(modsOf(s, 0).sworn).toBe(1);
    expect(modsOf(s, 1).veins).toBe(0);
  });

  describe('Galvanic Blood', () => {
    /** A grafted foot soldier far from any Transfusion Station, beside a finished Watch Tower of its people's. */
    const setup = (heirloom: boolean) => {
      const s = game();
      s.players[0].age = 'industrial';
      if (heirloom) learn(s, 'galvanicBlood');
      const tc = home(s);
      const tower = raise(s, 'tower', tc.tx + 10, tc.ty);
      const u = spawnUnit(s, 0, 'infantry', tower.x + 2, tower.y + 1);
      u.stance = 'stand';
      u.hemo = s.tick + secs(HEMO.last);
      return { s, u, tower };
    };

    it('keeps a graft fed in a Watch Tower\'s reach, after Hemocraft, with no Station anywhere', () => {
      const { s, u } = setup(true);
      run(s, HEMO.last + 10);
      expect(grafted(s, u)).toBe(true);
      expect(u.hemo! - s.tick).toBeGreaterThan(secs(HEMO.last - 2));
    });

    it('does nothing without the heirloom: the graft runs dry', () => {
      const { s, u } = setup(false);
      run(s, HEMO.last + 10);
      expect(grafted(s, u)).toBe(false);
    });

    it('starves the graft once the tower falls', () => {
      const { s, u, tower } = setup(true);
      run(s, 5);
      tower.hp = 0;
      run(s, HEMO.last + 10);
      expect(grafted(s, u)).toBe(false);
    });
  });

  describe('Military Orders', () => {
    /** A foot soldier of A's with (or without) A's priest beside it, and B's priest 4 tiles off. */
    const setup = (heirloom: boolean, withPriest = true) => {
      const s = game(2);
      if (heirloom) learn(s, 'militaryOrders');
      const tc = home(s);
      const x = tc.x + 9;
      const y = tc.y;
      const soldier = spawnUnit(s, 0, 'infantry', x, y);
      soldier.stance = 'stand';
      const priest = withPriest ? spawnUnit(s, 0, 'priest', x - 3, y) : null;
      const rival = spawnUnit(s, 1, 'priest', x + 4, y);
      step(s);
      return { s, soldier, priest, rival };
    };

    it('swears a soldier with its priest near: a rival priest cannot turn it', () => {
      const { s, soldier, rival } = setup(true);
      expect(sworn(s, soldier)).toBe(true);
      step(s, [{ t: 'convert', p: 1, ids: [rival.id], target: soldier.id }]);
      run(s, 30);
      expect(soldier.owner).toBe(0);
      expect(s.players[1].stats.converted).toBe(0);
    });

    it("breaks a chant already under way when the soldier's priest comes to its side", () => {
      const { s, soldier, priest, rival } = setup(true);
      const at = priest!.x;
      priest!.x = soldier.x - ORDERS.reach - 4;
      priest!.stance = 'stand';
      step(s, [{ t: 'convert', p: 1, ids: [rival.id], target: soldier.id }]);
      run(s, 1);
      expect(rival.order.k).toBe('convert');
      priest!.x = at;
      run(s, 30);
      expect(soldier.owner).toBe(0);
    });

    it('holds only while the priest is near, and only with the heirloom', () => {
      const away = setup(true, false);
      expect(sworn(away.s, away.soldier)).toBe(false);
      step(away.s, [{ t: 'convert', p: 1, ids: [away.rival.id], target: away.soldier.id }]);
      run(away.s, 30);
      expect(away.soldier.owner).toBe(1);
      const none = setup(false);
      expect(sworn(none.s, none.soldier)).toBe(false);
      // The priest walks off: the oath lapses.
      const gone = setup(true);
      gone.priest!.x = gone.soldier.x - ORDERS.reach - 2;
      expect(sworn(gone.s, gone.soldier)).toBe(false);
    });

    it('turns aside the Blood-rite: no sacrifice or curse takes a sworn soldier', () => {
      const { s, soldier, rival } = setup(true);
      const b = s.players[1];
      b.epoch = 4;
      b.age = 'bloodrite';
      b.blood = 200;
      b.statsVersion++;
      expect(riteProblem(s, 1, 'sacrifice', soldier)).toMatch(/Sworn/);
      expect(riteProblem(s, 1, 'curse', soldier)).toMatch(/Sworn/);
      // A curse on an unsworn neighbour spares the sworn one beside it.
      const loose = spawnUnit(s, 0, 'citizen', soldier.x + 1, soldier.y);
      expect(riteProblem(s, 1, 'curse', loose)).toBeNull();
      step(s, [{ t: 'convert', p: 1, ids: [rival.id], target: loose.id, rite: 'curse' }]);
      run(s, RITE.chant + 3);
      expect(cursed(s, loose)).toBe(true);
      expect(cursed(s, soldier)).toBe(false);
    });

    it('mends soldiers half again as fast', () => {
      const healed = (heirloom: boolean) => {
        const { s, soldier } = setup(heirloom);
        soldier.hp = 10;
        run(s, 6);
        return soldier.hp - 10;
      };
      const plain = healed(false);
      expect(plain).toBeGreaterThan(0);
      expect(healed(true) / plain).toBeCloseTo(ORDERS.mend, 1);
    });
  });
});
