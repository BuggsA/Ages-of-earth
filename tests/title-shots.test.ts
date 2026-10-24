import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { DUSK, MORNING, easeHour, titleShot } from '../src/ui/titleShots';
import type { GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const lakes = (): GameState => createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

/** A finished Dock on the shore nearest the player's start. */
function addDock(s: GameState): void {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++) {
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) { bestD = d; best = { tx, ty }; }
    }
  }
  placeBuilding(s, 0, 'dock', best!.tx, best!.ty, true);
}

describe('the title\'s chosen shots (#267)', () => {
  it('looks in on a town when there is no dock or ford to frame', () => {
    const s = lakes();
    for (let slot = 0; slot < 8; slot++) {
      const shot = titleShot(s, slot);
      expect(shot.kind).toBe('town');
      expect(shot.hour).toBeNull();
    }
  });

  it('frames a dock at dusk, facing the water', () => {
    const s = lakes();
    addDock(s);
    const shot = titleShot(s, 1);
    expect(shot.kind).toBe('dock');
    expect(shot.hour).toBe(DUSK);
    expect(shot.note).toBe('a dock at dusk');
    // The camera faces toward water: a step along the look direction from the dock lands on, or nearer, water than a step away.
    const len = Math.hypot(shot.lookX, shot.lookY);
    const wet = (k: number) => {
      const x = Math.floor(shot.x + (shot.lookX / len) * k);
      const y = Math.floor(shot.y + (shot.lookY / len) * k);
      return s.terrain[y * s.w + x] === 2;
    };
    expect(wet(5) || wet(4) || wet(3)).toBe(true);
  });

  it('frames an army at the Old Ford, from the army\'s side', () => {
    const s = lakes();
    s.landmarks = [{ id: 900, x: 30.5, y: 30.5, kind: 'ford', owner: -1, claim: 0, by: -1 }];
    expect(titleShot(s, 3).kind).toBe('town');
    for (let i = 0; i < 5; i++) spawnUnit(s, 1, 'infantry', 24 + i * 0.5, 30);
    const shot = titleShot(s, 3);
    expect(shot.kind).toBe('ford');
    expect(shot.who).toBe(1);
    expect(shot.hour).toBe(MORNING);
    expect(shot.lookX).toBeGreaterThan(0); // the ford lies east of the men
    expect(shot.x).toBeGreaterThan(24);
    expect(shot.x).toBeLessThan(30.5);
  });

  it('eases the hour the short way round, and drifts when a shot has no hour', () => {
    expect(easeHour(23, 1, 1)).toBeGreaterThan(23); // 23 toward 1 goes forward through midnight
    expect(easeHour(1, 23, 1)).toBeLessThan(1 + 24 * 0.01); // and back the other way, wrapping below 1
    let h = 16;
    for (let i = 0; i < 600; i++) h = easeHour(h, DUSK, 1 / 10);
    expect(h).toBeCloseTo(DUSK, 1);
    expect(easeHour(10, null, 20)).toBeCloseTo(11, 5);
    expect(easeHour(23.99, null, 1)).toBeLessThan(0.1);
  });
});
