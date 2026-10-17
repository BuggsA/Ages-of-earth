import { EPOCHS, LAST_EPOCH, TECHS } from './data';
import type { GameState, TechId } from './types';
import { RES } from './types';
import { restat } from './world';

/** Stock a god-mode player is held at (#399). */
export const GOD_STOCK = 99999;

/**
 * Testing aid (#399): the last epoch, every technology that isn't tied to a single side age, and a full
 * treasury. Solo play only, and applied straight to the state, never as a command: a room must not let
 * anyone cheat, and the cheat is not part of the rules a replay would play back.
 */
export function grantAll(s: GameState, owner: number): void {
  const p = s.players[owner];
  if (!p) return;
  restat(s, p, () => {
    p.epoch = Math.min(LAST_EPOCH, EPOCHS.length - 1);
    delete p.suspended;
    for (const id of Object.keys(TECHS) as TechId[]) {
      if (TECHS[id].only || p.techs.includes(id)) continue;
      p.techs.push(id);
    }
  });
  topUp(s, owner);
}

/** Keep the treasury full while god mode is on. */
export function topUp(s: GameState, owner: number): void {
  const p = s.players[owner];
  if (!p) return;
  for (const r of RES) if (p.res[r] < GOD_STOCK) p.res[r] = GOD_STOCK;
}
