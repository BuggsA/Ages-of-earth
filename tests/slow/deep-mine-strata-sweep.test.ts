import { describe, expect, it } from 'vitest';
import { LODE, STRATA } from '../../src/sim/data';
import { createGame } from '../../src/sim/game';
import { placeProblem } from '../../src/sim/grid';
import { findSpot } from '../../src/sim/ai';
import { lodeAt } from '../../src/sim/lodes';
import { seamsAt, veinFull } from '../../src/sim/shafts';
import { placeBuilding } from '../../src/sim/world';
import type { MapSize, MapType } from '../../src/sim/types';

/**
 * Rule 1 of the deep mine (#924 m3, `docs/deep-mine.md`), swept wide: on every map size and type, over many seeds and
 * every seat, a town's land is common ground and a shaft by it digs stone and gold from the plain layers.
 */
describe('never starved, swept over sizes, map types and seeds (#924 m3)', () => {
  it('every town of every match digs stone and gold below its own land', () => {
    for (const size of ['small', 'medium', 'large'] as MapSize[]) {
      for (const map of ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'] as MapType[]) {
        for (const seed of [11, 12, 13, 14, 15, 16, 17, 18]) {
          const players = size === 'small' ? 2 : 4;
          const s = createGame({ seed, size, mapType: map, players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, ai: null, civ: 'greeks' as const })) });
          for (const p of s.players) {
            const at = `${size} ${map} ${seed} town ${p.id}`;
            for (let y = Math.floor(p.startY - LODE.home); y <= p.startY + LODE.home; y++) {
              for (let x = Math.floor(p.startX - LODE.home); x <= p.startX + LODE.home; x++) {
                const dx = x + 0.5 - p.startX;
                const dy = y + 0.5 - p.startY;
                if (x < 0 || y < 0 || x >= s.w || y >= s.h || dx * dx + dy * dy > LODE.home * LODE.home) continue;
                expect(lodeAt(s, x + 0.5, y + 0.5), at).toBe(0);
              }
            }
            const spot = findSpot(s, 'shaft', p.startX, p.startY, 4, 12, 1, (tx, ty) => !placeProblem(s, 'shaft', tx, ty, true, p.id));
            expect(spot, at).toBeTruthy();
            const b = placeBuilding(s, p.id, 'shaft', spot!.tx, spot!.ty, true);
            p.epoch = 1;
            expect(seamsAt(s, b), at).toEqual(expect.arrayContaining(['stone', 'gold']));
            expect(STRATA.slice(0, 3).some((_, l) => veinFull(b, l, 'stone') > 0), at).toBe(true);
            expect(STRATA.slice(0, 3).some((_, l) => veinFull(b, l, 'gold') > 0), at).toBe(true);
          }
        }
      }
    }
  }, 600000);
});
