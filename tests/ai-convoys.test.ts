import { describe, expect, it } from 'vitest';
import { AI_CONVOY, CONVOY, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { NAVAL, nearestWalkable, placeProblem } from '../src/sim/grid';
import { portSpot } from '../src/sim/trade';
import type { AgeId, Difficulty, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer sails in convoy (#379 s3): in the Age of Sail a warship keeps the port where its cogs load. */
function setup(level: Difficulty, age: AgeId) {
  const s: GameState = createGame({ seed: 2, size: 'small', mapType: 'sea', players: [{ name: 'A', ai: level, civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.age = age;
  for (let i = 0; i < 6; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + i * 0.5, p.startY - 4);
  // A Dock on the shore nearest home, and the trading post whose port is nearest it.
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++)
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const d = (tx - p.startX) * (tx - p.startX) + (ty - p.startY) * (ty - p.startY);
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  const dock = placeBuilding(s, 0, 'dock', best!.tx, best!.ty, true);
  const ports = s.posts.map((post) => ({ post, at: portSpot(s, post, 0) })).filter((x) => x.at);
  ports.sort((a, b) => (a.at!.x - dock.x) ** 2 + (a.at!.y - dock.y) ** 2 - ((b.at!.x - dock.x) ** 2 + (b.at!.y - dock.y) ** 2));
  const { post, at } = ports[0];
  // A cog bound for that post, and a warship lying off the Dock.
  const cog = spawnUnit(s, 0, 'cog', at!.x, at!.y);
  cog.order = { k: 'trade', post: post.id, market: dock.id, phase: 'back' };
  const w = nearestWalkable(s, dock.x, dock.y, 6, NAVAL);
  const ship = spawnUnit(s, 0, 'warship', (w % s.w) + 0.5, Math.floor(w / s.w) + 0.5);
  return { s, port: at!, ship, cog };
}

const off = (u: { x: number; y: number }, at: { x: number; y: number }) => Math.hypot(u.x - at.x, u.y - at.y);

describe('the computer sails in convoy', () => {
  it('in the Age of Sail, a warship keeps the port where its cogs load', () => {
    const { s, port, ship } = setup('normal', 'sail');
    expect(off(ship, port)).toBeGreaterThan(CONVOY.reach);
    let convoys = 0;
    for (let i = 0; i < secs(90); i++) {
      step(s);
      convoys += s.events.filter((e) => e.k === 'convoy' && e.owner === 0).length;
    }
    expect(off(ship, port)).toBeLessThanOrEqual(AI_CONVOY.stay + 1);
    expect(convoys).toBeGreaterThan(0);
  });

  it('keeps its warships by the Dock in another age', () => {
    const { s, port, ship } = setup('normal', 'middle');
    let convoys = 0;
    for (let i = 0; i < secs(90); i++) {
      step(s);
      convoys += s.events.filter((e) => e.k === 'convoy' && e.owner === 0).length;
    }
    expect(off(ship, port)).toBeGreaterThan(CONVOY.reach);
    expect(convoys).toBe(0);
  });
});
