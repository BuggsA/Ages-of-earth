import { describe, expect, it } from 'vitest';
import { TIDINGS, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { aiTiding, drawTick } from '../src/sim/tidings';
import { placeBuilding } from '../src/sim/world';
import type { Building, Command, GameState, TidingId } from '../src/sim/types';

/** Tidings at the fire (#443): two cards in the Stone Age, each a choice with a price, answered by command. */

const game = (seed = 11, ai: 'normal' | null = null, startEpoch = 0): GameState =>
  createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai, civ: 'romans' }] });

/** Step to the tick before `tick`. */
const until = (s: GameState, tick: number) => {
  while (s.tick < tick && !s.over) step(s);
};

/** A card set waiting on player 0, as if its draw had just come. */
const deal = (s: GameState, card: TidingId, draw = 0) => {
  s.players[0].tiding = { card, draw, until: s.tick + secs(TIDINGS.fade) };
};

const citizens = (s: GameState, owner: number) => s.ents.filter((e) => e.kind === 'unit' && e.owner === owner && e.type === 'citizen' && e.hp > 0).length;

describe('tidings at the fire', () => {
  it('deals each people two different cards in the Stone Age, at the ticks the seed sets', () => {
    const s = game();
    const seen: TidingId[] = [];
    for (let draw = 0; draw < TIDINGS.at.length; draw++) {
      const at = drawTick(s, 0, draw);
      expect(at).toBeGreaterThanOrEqual(secs(TIDINGS.at[draw]));
      expect(at).toBeLessThan(secs(TIDINGS.at[draw] + TIDINGS.jitter));
      until(s, at);
      expect(s.players[0].tiding).toBeUndefined();
      step(s);
      const t = s.players[0].tiding;
      expect(t?.draw).toBe(draw);
      expect(s.events.some((e) => e.k === 'tiding' && e.owner === 0 && e.how === 'come')).toBe(true);
      seen.push(t!.card);
    }
    expect(seen[0]).not.toBe(seen[1]);
    expect(s.players[0].told).toEqual(seen);
  });

  it('plays the same on every screen: the same seed and commands deal the same cards', () => {
    const a = game(5, 'normal');
    const b = game(5, 'normal');
    for (let i = 0; i < secs(240); i++) {
      step(a);
      step(b);
    }
    expect(a.players.map((p) => p.told)).toEqual(b.players.map((p) => p.told));
    expect(checksum(a)).toBe(checksum(b));
  });

  it('comes only in the Stone Age', () => {
    const s = game(11, null, 1);
    until(s, drawTick(s, 0, 0) + 2);
    expect(s.players[0].tiding).toBeUndefined();
    expect(s.players[0].told).toBeUndefined();
  });

  it('passes with the do-nothing answer when left unanswered', () => {
    const s = game();
    deal(s, 'traveller');
    const food = s.players[0].res.food;
    const n = citizens(s, 0);
    let passed = false;
    for (let i = 0; i <= secs(TIDINGS.fade); i++) {
      step(s);
      passed ||= s.events.some((e) => e.k === 'tiding' && e.how === 'passed');
    }
    expect(passed).toBe(true);
    expect(s.players[0].tiding).toBeUndefined();
    expect(s.players[0].res.food).toBeGreaterThanOrEqual(food);
    expect(citizens(s, 0)).toBe(n);
  });

  it('takes the traveller in for food: a citizen more, when a house has room', () => {
    const s = game();
    deal(s, 'traveller');
    const p = s.players[0];
    const food = p.res.food;
    const n = citizens(s, 0);
    step(s, [{ t: 'tiding', p: 0, card: 'traveller', take: true }]);
    expect(p.tiding).toBeUndefined();
    expect(citizens(s, 0)).toBe(n + 1);
    expect(p.res.food).toBeLessThanOrEqual(food - (TIDINGS.traveller.cost.food ?? 0) + 1);
    // With no room, it is refused and the card still waits.
    deal(s, 'traveller');
    p.cap = p.pop;
    const take: Command = { t: 'tiding', p: 0, card: 'traveller', take: true };
    step(s, [take]);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(true);
    expect(p.tiding?.card).toBe('traveller');
  });

  it('ignores an answer to a card that is not waiting, and one player cannot answer another\'s', () => {
    const s = game();
    deal(s, 'hunter');
    const wood = s.players[0].res.wood;
    step(s, [{ t: 'tiding', p: 0, card: 'fever', take: true }, { t: 'tiding', p: 1, card: 'hunter', take: true }]);
    expect(s.players[0].tiding?.card).toBe('hunter');
    expect(s.players[0].res.wood).toBeGreaterThanOrEqual(wood);
    step(s, [{ t: 'tiding', p: 0, card: 'hunter', take: true }]);
    expect(s.players[0].res.wood).toBeLessThan(wood);
  });

  it('a storm passed by strikes the houses on some seeds and spares them on others', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const s = game(seed);
      const p = s.players[0];
      const house: Building = placeBuilding(s, 0, 'house', Math.floor(p.startX) + 4, Math.floor(p.startY) + 4, true);
      const hp = house.hp;
      deal(s, 'storm');
      step(s, [{ t: 'tiding', p: 0, card: 'storm', take: false }]);
      const how = s.events.find((e) => e.k === 'tiding' && (e.how === 'struck' || e.how === 'spared'));
      expect(how).toBeTruthy();
      if (how!.k === 'tiding' && how!.how === 'struck') expect(house.hp).toBeLessThan(hp);
      else expect(house.hp).toBe(hp);
      outcomes.add(how!.k === 'tiding' ? how!.how : '');
      expect(p.tiding).toBeUndefined();
    }
    expect(outcomes).toEqual(new Set(['struck', 'spared']));
  });

  it('a stranger\'s tale, paid for, lays open ground out in the wild', () => {
    const s = game();
    const p = s.players[0];
    const before = p.seen.reduce((n, v) => n + v, 0);
    deal(s, 'tale');
    step(s, [{ t: 'tiding', p: 0, card: 'tale', take: true }]);
    expect(p.seen.reduce((n, v) => n + v, 0)).toBeGreaterThan(before);
  });

  it('the computer answers its card by its rule, well before the card would fade', () => {
    const s = game(11, 'normal');
    const p = s.players[1];
    p.res.food = 1000;
    p.tiding = { card: 'fever', draw: 0, until: s.tick + secs(TIDINGS.fade) };
    expect(aiTiding(s, p)).toEqual({ card: 'fever', take: true });
    const food = p.res.food;
    for (let i = 0; i < secs(5) && p.tiding; i++) step(s);
    expect(p.tiding).toBeUndefined();
    expect(p.res.food).toBeLessThan(food);
    // Short of food, it waits on the card rather than paying.
    p.res.food = 10;
    p.tiding = { card: 'fever', draw: 1, until: s.tick + secs(TIDINGS.fade) };
    expect(aiTiding(s, p)).toBeNull();
  });
});
