import { describe, expect, it } from 'vitest';
import { TECHS, TRADE } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { portSpot } from '../src/sim/trade';

const game = (seed: number) =>
  createGame({
    seed,
    size: 'small',
    mapType: 'lakes',
    startEpoch: 2,
    players: [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

describe('Lighthouse', () => {
  it('is a Dock technology that widens the port reach', () => {
    expect(TECHS.lighthouse.at).toBe('dock');
    expect(TECHS.lighthouse.needs).toBe('gillnets');
    expect(TECHS.lighthouse.add?.portReach).toBeGreaterThan(0);
  });

  it('makes posts farther from the water ports, for its owner only', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const s = game(seed);
      for (const post of s.posts) {
        if (portSpot(s, post, 0)) continue;
        const p = s.players[0];
        p.techs.push('lighthouse');
        p.statsVersion++;
        const wide = portSpot(s, post, 0);
        if (wide) {
          const dx = wide.x - post.x;
          const dy = wide.y - post.y;
          expect(dx * dx + dy * dy).toBeGreaterThan(TRADE.sea.reach * TRADE.sea.reach);
          expect(portSpot(s, post, 1)).toBeNull();
          expect(portSpot(s, post)).toBeNull();
          found = true;
          break;
        }
        p.techs.pop();
        p.statsVersion++;
      }
    }
    expect(found).toBe(true);
  });
});
