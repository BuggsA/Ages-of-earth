import { describe, expect, it } from 'vitest';
import { spared } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { KILL_CAMP, SEASON, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { herdAtHome, wayBarred } from '../src/sim/ways';
import type { Animal, Building, GameState } from '../src/sim/types';

/** The Hunters on the Herd Plains sow while their herd is away on its trek (#529). */

const herds = (ai: 'hard' | null = null): GameState => {
  const s = createGame({ seed: 3, size: 'small', homeland: 'herds', players: [{ name: 'A', ai }, { name: 'B', ai }] });
  applyCommand(s, { t: 'way', p: 0, way: 'hunt' });
  return s;
};
const tcOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
/** Every beast but one of town 0's own deer and one wild deer is gone; both stand by town 0's Town Center. */
function byHome(s: GameState): { own: Animal; wild: Animal } {
  const tc = tcOf(s, 0);
  const own = s.animals.find((a) => a.kind === 'deer' && a.town === 0)!;
  const wild = s.animals.find((a) => a.kind === 'deer' && a.town === undefined) ?? s.animals.find((a) => a.kind === 'deer' && a !== own)!;
  wild.town = undefined;
  for (const a of s.animals) if (a !== own && a !== wild) a.hp = 0;
  Object.assign(own, { x: tc.x + 6, y: tc.y + 2, hp: 8 });
  Object.assign(wild, { x: tc.x + 2, y: tc.y + 6, hp: 8 });
  return { own, wild };
}

describe("the Hunters' fields and the Herd Plains' trek", () => {
  it('in spring and summer the town\'s own herd bars its fields, and the town is told the ground opens in autumn', () => {
    const s = herds();
    const { wild } = byHome(s);
    wild.hp = 0;
    expect(herdAtHome(s, 0)).toBe(1);
    expect(wayBarred(s, s.players[0], 'farm')).toMatch(/treks out in autumn/);
    s.tick = secs(SEASON.len) + 1;
    expect(wayBarred(s, s.players[0], 'farm')).toMatch(/herd grazes/);
  });

  it('in autumn and winter its own herd is away, wherever it grazes, and only other game bars the fields', () => {
    const s = herds();
    const { wild } = byHome(s);
    for (const season of [2, 3]) {
      s.tick = secs(SEASON.len) * season + 1;
      wild.hp = 8;
      expect(herdAtHome(s, 0)).toBe(1);
      expect(wayBarred(s, s.players[0], 'farm')).toMatch(/herd grazes/);
      expect(wayBarred(s, s.players[0], 'farm')).not.toMatch(/treks out/);
      wild.hp = 0;
      expect(herdAtHome(s, 0)).toBe(0);
      expect(wayBarred(s, s.players[0], 'farm')).toBeNull();
    }
    // Spring again: the herd is home.
    s.tick = secs(SEASON.len) * 4 + 1;
    expect(wayBarred(s, s.players[0], 'farm')).toMatch(/herd grazes/);
  });

  it("a rival's herd still bars the fields while it is out", () => {
    const s = herds();
    const { own } = byHome(s);
    own.town = 1;
    s.tick = secs(SEASON.len) * 2 + 1;
    expect(herdAtHome(s, 0)).toBe(2);
  });

  it('the computer of the Hunters spares its own herd but no wild deer by home, which would bar its fields', () => {
    const s = herds('hard');
    const { own, wild } = byHome(s);
    const tc = tcOf(s, 0);
    // A second wild deer of the same herd, so a pair would be spared elsewhere, and a wild pair far out.
    const mate = s.animals.find((a) => a.kind === 'deer' && a !== own && a !== wild)!;
    Object.assign(mate, { x: wild.x + 1, y: wild.y, hp: 8, herd: wild.herd ?? wild.id, town: undefined });
    const keep = spared(s, s.players[0])!;
    expect(keep(own)).toBe(true);
    expect(keep(wild)).toBe(false);
    expect(keep(mate)).toBe(false);
    // A people of another Way spares the pair, wherever it grazes.
    expect(spared(s, s.players[1])!(wild)).toBe(true);
    // Out past the ring, a wild pair is spared as before (#491).
    for (const a of [wild, mate]) Object.assign(a, { x: tc.x + KILL_CAMP.home + 4 + (a === mate ? 1 : 0), y: tc.y });
    expect(spared(s, s.players[0])!(wild)).toBe(true);
  });
});
