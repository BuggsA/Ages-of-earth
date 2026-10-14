import { BEACON, secs } from './data';
import type { Building, GameState, Player } from './types';

/** Signal beacons: why a tower can't light its fire now, or null if it can. */
export function beaconProblem(s: GameState, p: Player, b: Building): string | null {
  if (b.owner !== p.id || b.type !== 'tower' || !b.built || b.hp <= 0) return 'Only a finished Watch Tower can light a beacon';
  if (lit(s, b)) return 'The beacon is already burning';
  if (b.beaconReady !== undefined && s.tick < b.beaconReady) return `The fire is not yet laid: ${Math.ceil((b.beaconReady - s.tick) / secs(1))}s`;
  for (const r of ['food', 'wood', 'stone', 'gold'] as const) if (p.res[r] < (BEACON.cost[r] ?? 0)) return `Need ${BEACON.cost[r]} wood for the fire`;
  return null;
}

/** Whether a tower's beacon is burning now. */
export function lit(s: GameState, b: Building): boolean {
  return b.beacon !== undefined && s.tick < b.beacon;
}

export function lightBeacon(s: GameState, p: Player, b: Building): void {
  p.res.wood -= BEACON.cost.wood ?? 0;
  b.beacon = s.tick + secs(BEACON.duration);
  b.beaconReady = s.tick + secs(BEACON.duration + BEACON.cooldown);
  s.events.push({ k: 'beacon', owner: b.owner, building: b.id, x: b.x, y: b.y, on: true });
}

/** Let burnt-out beacons go dark. */
export function beaconStep(s: GameState): void {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.beacon === undefined || s.tick < e.beacon) continue;
    e.beacon = undefined;
    s.events.push({ k: 'beacon', owner: e.owner, building: e.id, x: e.x, y: e.y, on: false });
  }
}
