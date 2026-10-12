import type { CivId, Command, Difficulty, GameMode, MapSize, MapType } from '../sim/types';

/**
 * What the browsers and a room on the server say to each other. Online matches run lockstep: every
 * browser runs the same rules on the same commands. The room is the clock: every TURN_MS it gathers
 * the commands that arrived and sends them to everyone as one numbered turn, and each browser plays a
 * turn's ticks only once it has the turn. The room keeps every turn, so a player who drops can come
 * back and replay the match up to now.
 */

/** Ticks per turn (two ticks of 50 ms: a turn every 100 ms). */
export const TURN_TICKS = 2;
export const TURN_MS = 100;
/** Browsers report a checksum this often (in turns), so a match that drifts apart is caught. */
export const HASH_EVERY = 50;
export const MAX_SEATS = 4;

export interface Seat {
  kind: 'human' | 'ai';
  name: string;
  civ: CivId | 'random';
  color: number;
  team: number;
  /** For computer seats. */
  level?: Difficulty;
  /** For people: whether they are connected now. */
  online?: boolean;
}

export interface RoomSetup {
  seed: number;
  size: MapSize;
  mapType: MapType;
  startEpoch: number;
  peaceMinutes: number;
  mode: GameMode;
}

export interface LobbyState {
  code: string;
  seats: Seat[];
  setup: RoomSetup;
  /** The seat that may change the match and start it. */
  host: number;
  started: boolean;
}

export type ClientMsg =
  | { t: 'seat'; civ?: Seat['civ']; color?: number; team?: number; name?: string }
  | { t: 'setup'; setup: Partial<RoomSetup> }
  | { t: 'addAi'; level: Difficulty }
  | { t: 'removeSeat'; seat: number }
  | { t: 'aiLevel'; seat: number; level: Difficulty }
  | { t: 'start' }
  | { t: 'cmd'; c: Command }
  | { t: 'hash'; n: number; h: number }
  | { t: 'pause'; on: boolean }
  | { t: 'chat'; text: string }
  | { t: 'ping'; at: number };

export interface MatchStart {
  /** Seat order is player order. */
  seats: Seat[];
  setup: RoomSetup;
  /** Civilizations as resolved by the room (random ones picked). */
  civs: CivId[];
}

export type ServerMsg =
  | { t: 'lobby'; lobby: LobbyState; you: number }
  | { t: 'start'; match: MatchStart; you: number }
  /** A turn: its number and the commands it carries, in the order they arrived. */
  | { t: 'turn'; n: number; c: Command[] }
  /** Everything so far, for a player joining a match under way. */
  | { t: 'catchup'; turns: Command[][] }
  | { t: 'paused'; on: boolean; by: string }
  | { t: 'chat'; from: string; color: number; text: string }
  | { t: 'desync'; n: number }
  | { t: 'error'; why: string }
  | { t: 'pong'; at: number };

/** Room codes: easy to read out loud (no 0/O, 1/I). */
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export function validCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_CHARS.includes(ch)) return false;
  return true;
}
