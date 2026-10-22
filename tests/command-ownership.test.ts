import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import type { Building, Command, GameState, Unit } from '../src/sim/types';

/**
 * The Worker stamps every online command with the sender's own seat (`worker/room.ts`), so the one
 * thing left for the rules is to ignore ids that seat doesn't own: a room must never let one player
 * command another's people (`AGENTS.md` §3). This plays one command of every kind from player 1,
 * naming only player 0's units and buildings, and checks player 0 is untouched.
 */

function fixture() {
  const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const citizens = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
  // Something in player 0's queue and a rally point, so `cancel` and `rally` have something to change.
  applyCommand(s, { t: 'train', p: 0, building: tc.id, unit: 'citizen' });
  applyCommand(s, { t: 'rally', p: 0, building: tc.id, x: tc.x + 3, y: tc.y + 3 });
  for (let i = 0; i < 20; i++) step(s);
  // Player 1 can afford anything, so a refusal can only come from ownership.
  for (const r of ['food', 'wood', 'stone', 'gold'] as const) s.players[1].res[r] = 99999;
  return { s, tc, ids: citizens.map((u) => u.id) };
}

/** Everything about player 0: its own state and every entity it owns. */
function snapshot(s: GameState): string {
  return JSON.stringify({ player: s.players[0], ents: s.ents.filter((e) => e.owner === 0) });
}

describe('one player never commands another’s people', () => {
  it('ignores every kind of command naming units or buildings the sender does not own', () => {
    const { s, tc, ids } = fixture();
    const before = snapshot(s);
    expect(JSON.parse(before).player.res).toBeTruthy();
    const x = tc.x + 6;
    const y = tc.y + 6;
    const tile = Math.floor(y) * s.w + Math.floor(x);
    // One of each: a command type added later without a line here fails to compile.
    const every: { [K in Command['t']]: Extract<Command, { t: K }> } = {
      move: { t: 'move', p: 1, ids, x, y },
      arm: { t: 'arm', p: 1, ids },
      disarm: { t: 'disarm', p: 1, ids },
      attack: { t: 'attack', p: 1, ids, target: tc.id },
      gather: { t: 'gather', p: 1, ids, tile },
      work: { t: 'work', p: 1, ids, target: tc.id },
      build: { t: 'build', p: 1, ids, type: 'house', tx: Math.floor(x), ty: Math.floor(y) },
      wall: { t: 'wall', p: 1, ids, x0: Math.floor(x), y0: Math.floor(y), x1: Math.floor(x) + 3, y1: Math.floor(y) },
      hunt: { t: 'hunt', p: 1, ids, target: s.animals[0]?.id ?? 0 },
      convert: { t: 'convert', p: 1, ids, target: ids[0] },
      garrison: { t: 'garrison', p: 1, ids, target: tc.id },
      relic: { t: 'relic', p: 1, ids, target: 0 },
      route: { t: 'route', p: 1, ids, post: 0 },
      board: { t: 'board', p: 1, ids, target: ids[0] },
      unload: { t: 'unload', p: 1, ids, x, y },
      ungarrison: { t: 'ungarrison', p: 1, building: tc.id },
      bell: { t: 'bell', p: 1, ring: true },
      quarantine: { t: 'quarantine', p: 1, on: true },
      greatWork: { t: 'greatWork', p: 1 },
      way: { t: 'way', p: 1, way: 'hunt' },
      vow: { t: 'vow', p: 1 },
      kin: { t: 'kin', p: 1, building: tc.id },
      beacon: { t: 'beacon', p: 1, building: tc.id },
      callUp: { t: 'callUp', p: 1, building: tc.id, n: 5 },
      pack: { t: 'pack', p: 1, building: tc.id },
      pitch: { t: 'pitch', p: 1, ids },
      milk: { t: 'milk', p: 1, ids, target: s.animals[0]?.id ?? 0 },
      lamb: { t: 'lamb', p: 1, building: tc.id },
      cry: { t: 'cry', p: 1, id: ids[0] },
      stance: { t: 'stance', p: 1, ids, stance: 'stand' },
      train: { t: 'train', p: 1, building: tc.id, unit: 'citizen' },
      research: { t: 'research', p: 1, building: tc.id, tech: 'wheelbarrow' },
      cancel: { t: 'cancel', p: 1, building: tc.id, index: 0 },
      advance: { t: 'advance', p: 1, building: tc.id },
      stepBack: { t: 'stepBack', p: 1, building: tc.id },
      rally: { t: 'rally', p: 1, building: tc.id, x, y },
      trade: { t: 'trade', p: 1, res: 'food', buy: true },
      stop: { t: 'stop', p: 1, ids },
      patrol: { t: 'patrol', p: 1, ids, x, y },
      explore: { t: 'explore', p: 1, ids },
      delete: { t: 'delete', p: 1, ids: [...ids, tc.id] },
      dropRelic: { t: 'dropRelic', p: 1, ids },
      dig: { t: 'dig', p: 1, ids, target: 0 },
      salvage: { t: 'salvage', p: 1, ids, target: 0 },
      cache: { t: 'cache', p: 1, ids, target: 0 },
      reassign: { t: 'reassign', p: 1, from: 'idle', to: 'wood', n: 5 },
      tiding: { t: 'tiding', p: 1, card: 'traveller', take: true },
      // Last: these end player 1's part in the match, which must leave player 0 as it was too.
      resign: { t: 'resign', p: 1 },
      leave: { t: 'leave', p: 1 },
    };
    for (const c of Object.values(every)) {
      applyCommand(s, c as Command);
      expect(snapshot(s), `after '${c.t}' from player 1`).toBe(before);
    }
  });

  it('still obeys the owner: the same commands from player 0 do change its people', () => {
    const { s, tc, ids } = fixture();
    const before = snapshot(s);
    applyCommand(s, { t: 'move', p: 0, ids, x: tc.x + 6, y: tc.y + 6 });
    expect(snapshot(s)).not.toBe(before);
    const moved = snapshot(s);
    applyCommand(s, { t: 'cancel', p: 0, building: tc.id, index: 0 });
    expect(snapshot(s)).not.toBe(moved);
  });
});
