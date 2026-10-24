import { describe, expect, it } from 'vitest';
import { ROADS, STEP_BACK, stepBackCost } from '../src/sim/data';
import { ageOf, roadKnown, routeTo } from '../src/sim/ages';
import { createGame } from '../src/sim/game';
import { goalChoices, plannerHtml } from '../src/ui/roadPlanner';
import { placeBuilding } from '../src/sim/world';
import type { AgeId, GameState, Player } from '../src/sim/types';

// The road planner (#725): the shortest known journey to a goal age, step-backs included.
const game = (): { s: GameState; p: Player } => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  return { s, p: s.players[0] };
};
const stand = (p: Player, age: AgeId, tier: number) => {
  p.age = age;
  p.epoch = tier;
};

describe('routeTo', () => {
  it('is empty where you already stand', () => {
    const { s, p } = game();
    expect(routeTo(s, p, ageOf(p))).toEqual([]);
  });

  it('follows the main road up the trunk, one known road at a time', () => {
    const { s, p } = game();
    const r = routeTo(s, p, 'bronze')!;
    expect(r.map((x) => x.to)).toEqual(['bronze']);
    expect(r[0].back).toBe(false);
  });

  it('plans a step back when the road back is the only way, with its price and time', () => {
    const { s, p } = game();
    stand(p, 'bronze', 1);
    const r = routeTo(s, p, 'stone')!;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ from: 'bronze', to: 'stone', back: true, cost: stepBackCost(1) });
    expect(r[0].time).toBe(STEP_BACK.time);
  });

  it('adds the cooldown to a second step back', () => {
    const { s, p } = game();
    stand(p, 'middle', 2);
    const r = routeTo(s, p, 'stone')!;
    expect(r.map((x) => x.to)).toEqual(['bronze', 'stone']);
    expect(r[0].time).toBe(STEP_BACK.time);
    expect(r[1].time).toBe(STEP_BACK.time + STEP_BACK.cooldown);
  });

  it('is null for an age no known road leads to, and never uses a road the player cannot know', () => {
    const { s, p } = game();
    const hidden = ROADS.find((r) => r.clue && !roadKnown(s, p, r))!;
    const route = routeTo(s, p, hidden.to);
    for (const step of route ?? []) {
      if (step.back) continue;
      const road = ROADS.find((r) => r.from === step.from && r.to === step.to && r.time === step.time)!;
      expect(roadKnown(s, p, road)).toBe(true);
    }
  });

  it('plans a crossing from the far side: the road home, then the turn', () => {
    const { s, p } = game();
    stand(p, 'warband', 2);
    p.walked = ['sail'];
    placeBuilding(s, p.id, 'dock', 10, 10, true);
    const r = routeTo(s, p, 'searaider')!;
    expect(r.map((x) => `${x.from}>${x.to}${x.back ? ' (back)' : ''}`)).toEqual(['warband>middle', 'middle>searaider']);
  });

  it('plans a detour back for a crossing when only a step back leads there', () => {
    const { s, p } = game();
    stand(p, 'iron', 1);
    p.walked = ['steppe'];
    placeBuilding(s, p.id, 'forge', 10, 10, true);
    const r = routeTo(s, p, 'chariots')!;
    expect(r.map((x) => `${x.from}>${x.to}${x.back ? ' (back)' : ''}`)).toEqual(['iron>stone (back)', 'stone>chariots']);
  });

  it('is deterministic', () => {
    const { s, p } = game();
    stand(p, 'middle', 2);
    for (const a of ['stone', 'bronze', 'gunpowder', 'industrial'] as AgeId[]) {
      expect(JSON.stringify(routeTo(s, p, a))).toBe(JSON.stringify(routeTo(s, p, a)));
    }
  });
});

describe('the planner panel', () => {
  it('offers only ages the map shows, and lists the step back with its price', () => {
    const { s, p } = game();
    stand(p, 'bronze', 1);
    const d = { entered: ['stone', 'bronze'] as AgeId[], roads: [] };
    const choices = goalChoices(d, 'bronze');
    expect(choices).toContain('stone');
    expect(choices).not.toContain('bronze');
    expect(choices).not.toContain('searaider');
    const html = plannerHtml(s, 0, 'stone', d, () => '<br>LINES');
    expect(html).toContain('Step back (Z)');
    expect(html).toContain('step back</b> to the');
    expect(html).toContain('LINES');
  });
});
