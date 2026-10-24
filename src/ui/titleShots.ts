import type { GameState } from '../sim/types';
import { T_WATER } from '../sim/types';

/**
 * The title's chosen camera shots (#267): the film that plays behind the menu looks in on each town, and now and then
 * holds a framed picture instead: a dock at dusk with the sea beyond, an army at the Old Ford in the morning.
 * Pure reading of the match, so a test can run it; the camera, the light and the caption are main.ts's.
 */

export interface TitleShot {
  kind: 'town' | 'dock' | 'ford';
  /** The player whose town or army it is, for the caption. */
  who: number;
  /** Where the camera looks at. */
  x: number;
  y: number;
  /** The way the camera faces, as a direction on the ground. */
  lookX: number;
  lookY: number;
  /** The hour to hold the light at, or null to let the day drift on. */
  hour: number | null;
  /** How far the camera stands from what it looks at. */
  distance: number;
  /** What the caption says under the people's name. */
  note: string | null;
  /** The town shot's own: an army is marching, so the caption says so. */
  marching: boolean;
}

/** Each slot is 24 s; the cycle of shots, falling back to the next player's town when a shot isn't on offer. */
export const SHOT_SECONDS = 24;
const CYCLE: TitleShot['kind'][] = ['town', 'dock', 'town', 'ford'];
/** Dusk and early morning. */
export const DUSK = 19.2;
export const MORNING = 7.4;
/** An army within this many tiles of a ford counts as at it. */
const FORD_RANGE = 14;

const near = (ax: number, ay: number, bx: number, by: number, r: number): boolean => (ax - bx) * (ax - bx) + (ay - by) * (ay - by) <= r * r;

/** The direction from (x, y) toward the sea: the sum of the water tiles within 9 tiles, or null when there is none. */
function seaward(s: GameState, x: number, y: number): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  const r = 9;
  for (let ty = Math.max(0, Math.floor(y) - r); ty <= Math.min(s.h - 1, Math.floor(y) + r); ty++) {
    for (let tx = Math.max(0, Math.floor(x) - r); tx <= Math.min(s.w - 1, Math.floor(x) + r); tx++) {
      if (s.terrain[ty * s.w + tx] !== T_WATER || !near(tx + 0.5, ty + 0.5, x, y, r)) continue;
      sx += tx + 0.5 - x;
      sy += ty + 0.5 - y;
    }
  }
  return sx * sx + sy * sy < 1 ? null : { x: sx, y: sy };
}

/** The shot for a 24-second slot of the film. */
export function titleShot(s: GameState, slot: number): TitleShot {
  const kind = CYCLE[slot % CYCLE.length];
  // Towns alternate between the players, a shot of the other kind keeping the turn.
  const who = s.players[Math.floor(slot / 2) % s.players.length];
  if (kind === 'dock') {
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[(who.id + i) % s.players.length];
      const dock = s.ents.find((e) => e.kind === 'building' && e.type === 'dock' && e.owner === p.id && e.built);
      const sea = dock && seaward(s, dock.x, dock.y);
      if (dock && sea) return { kind, who: p.id, x: dock.x, y: dock.y, lookX: sea.x, lookY: sea.y, hour: DUSK, distance: 15, note: 'a dock at dusk', marching: false };
    }
  }
  if (kind === 'ford') {
    for (const m of s.landmarks ?? []) {
      if (m.kind !== 'ford') continue;
      const army = s.ents.filter((e) => e.kind === 'unit' && e.type !== 'citizen' && e.type !== 'trader' && near(e.x, e.y, m.x, m.y, FORD_RANGE));
      if (army.length < 3) continue;
      // The army's own people, the most numerous, owns the shot.
      const count = new Map<number, number>();
      for (const e of army) count.set(e.owner, (count.get(e.owner) ?? 0) + 1);
      const owner = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      const cx = army.reduce((a, e) => a + e.x, 0) / army.length;
      const cy = army.reduce((a, e) => a + e.y, 0) / army.length;
      // From the army's side, so the ford and its flag lie ahead of the men; from the map's heart if they stand on it.
      const dx = m.x - cx;
      const dy = m.y - cy;
      const len = Math.hypot(dx, dy);
      // ...unless that would show the edge of the world beyond the ford.
      const fromArmy = len > 2 && m.x + (dx / len) * 20 > 2 && m.x + (dx / len) * 20 < s.w - 2 && m.y + (dy / len) * 20 > 2 && m.y + (dy / len) * 20 < s.h - 2;
      return { kind, who: owner, x: (cx + m.x) / 2, y: (cy + m.y) / 2, lookX: fromArmy ? dx : s.w / 2 - cx, lookY: fromArmy ? dy : s.h / 2 - cy, hour: MORNING, distance: 17, note: 'an army at the Old Ford', marching: true };
    }
  }
  return townShot(s, who.id);
}

/** A look in on one town (or its marching army), the film's usual shot. */
function townShot(s: GameState, id: number): TitleShot {
  const army = s.ents.filter((e) => e.kind === 'unit' && e.type !== 'citizen' && e.owner === id && e.order.k !== 'idle');
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === id && e.type === 'towncenter');
  const p = s.players[id];
  const marching = army.length >= 4;
  const at = marching ? army[0] : (tc ?? { x: p.startX, y: p.startY });
  // Looking from the town toward the middle of the map, so the far side is land and sky, not the map's edge.
  return { kind: 'town', who: id, x: at.x, y: at.y, lookX: s.w / 2 - at.x, lookY: s.h / 2 - at.y, hour: null, distance: 27, note: null, marching };
}

/** An hour of the day's drift: an hour every 20 s, as a whole day in eight minutes. */
const DRIFT = 1 / 20;

/** The film's hour a frame on: eased the short way round to a shot's own hour, or drifting on when it has none. */
export function easeHour(hour: number, to: number | null, dt: number): number {
  if (to === null) return (hour + DRIFT * dt + 24) % 24;
  const diff = ((to - hour + 36) % 24) - 12;
  return (hour + diff * (1 - Math.exp(-dt * 0.6)) + 24) % 24;
}
