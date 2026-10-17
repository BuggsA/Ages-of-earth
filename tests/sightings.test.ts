import { describe, expect, it } from 'vitest';
import { Sightings } from '../src/render/sightings';
import type { GameState } from '../src/sim/types';

const world = {
  ruins: [{ id: 1, x: 5, y: 5, find: 'hoard', dug: 0, by: -1 }, { id: 2, x: 9, y: 9, find: 'map', dug: 5, by: 0 }],
  landmarks: [{ id: 3, x: 20, y: 20, kind: 'spring', owner: -1, claim: 0, by: -1 }],
  relics: [{ id: 4, x: 7, y: 7, carrier: 0, temple: 0 }, { id: 5, x: 8, y: 8, carrier: 12, temple: 0 }],
} as unknown as GameState;

describe('first sight', () => {
  it('reports each standing find once, when it is first seen', () => {
    const sights = new Sightings();
    sights.reset(world, () => false);
    expect(sights.scan(world, () => false)).toEqual([]);
    const near = (x: number) => x < 10;
    const got = sights.scan(world, near).map((f) => f.what).sort();
    expect(got).toEqual(['relic', 'ruin']);
    expect(sights.scan(world, near)).toEqual([]);
    expect(sights.scan(world, () => true).map((f) => f.what)).toEqual(['spring']);
  });

  it('keeps quiet about what was already in view when the match began', () => {
    const sights = new Sightings();
    sights.reset(world, () => true);
    expect(sights.scan(world, () => true)).toEqual([]);
  });
});
