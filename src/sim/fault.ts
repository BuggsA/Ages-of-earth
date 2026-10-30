import { BUILDINGS, FAULT, TICK_HZ, domainOf, secs } from './data';
import { asleep } from './ages';
import { hurt, peace } from './combat';
import { holder } from './forge';
import { landmarkOnTile, postOnTile, ruinOnTile, walkable } from './grid';
import { canAfford, maxHp, pay } from './world';
import { B_RES, B_TERRAIN, R_NONE, T_ROCK, T_WATER } from './types';
import type { Building, Fault, GameState, Player } from './types';

/**
 * The Age of Faults (#900, the Deep Road's fifth age). A Fault Engine is raised within `FAULT.tap` tiles of a vent of the earth's heat
 * (`engineSpot`) and draws on it. Ordered to crack (`fault`), it charges `FAULT.charge` seconds along a line every people sees
 * (`GameState.faults`); its clock stops while a rival's soldiers hold its vent (`holder`), and the charge is lost if it falls. Then the
 * ground opens (`crack`): each tile of the line becomes chasm (`GameState.chasm`, `B_TERRAIN`), for good. What stands there falls:
 * buildings lose `FAULT.fall` hundredths of their strength, land units are thrown clear. A Bridge laid over a chasm lets its people
 * across (`spanOpen`, any people from `FAULT.spanFrom`). The kept engine cracks on any road; others sleep off the age.
 */

/** Whether a tile is chasm. */
export const isChasm = (s: GameState, i: number): boolean => !!s.chasm && s.chasm[i] === 1;

/** The vent an engine centred at (`x`, `y`) draws on: the nearest within `FAULT.tap` (the lower tile on a tie), or -1. */
export function ventNear(s: GameState, x: number, y: number): number {
  if (!s.vents) return -1;
  let best = -1;
  let bestD = FAULT.tap * FAULT.tap;
  for (const v of s.vents) {
    const dx = (v % s.w) + 0.5 - x;
    const dy = Math.floor(v / s.w) + 0.5 - y;
    const d = dx * dx + dy * dy;
    if (d < bestD || (d === bestD && best >= 0 && v < best)) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** The vent a Fault Engine draws on, or -1. */
export const engineVent = (s: GameState, b: Building): number => (b.type === 'faultengine' ? ventNear(s, b.x, b.y) : -1);

/** Why a Fault Engine can't stand on this n-by-n square, or null: its centre goes within `FAULT.tap` tiles of a vent. */
export function engineSpot(s: GameState, tx: number, ty: number, n: number): 'tap' | null {
  return ventNear(s, tx + n / 2, ty + n / 2) >= 0 ? null : 'tap';
}

/** Whether a tile may crack: land (not water or rock) off the map's rim, not yet chasm, and not by a vent, a trading post, a ruin or a landmark. */
export function crackable(s: GameState, i: number): boolean {
  const x = i % s.w;
  const y = (i - x) / s.w;
  if (x < 1 || y < 1 || x >= s.w - 1 || y >= s.h - 1) return false;
  if (s.terrain[i] === T_WATER || s.terrain[i] === T_ROCK || isChasm(s, i)) return false;
  if (s.vents) for (const v of s.vents) if (Math.abs((v % s.w) - x) <= 1 && Math.abs(Math.floor(v / s.w) - y) <= 1) return false;
  return !postOnTile(s, x, y) && !landmarkOnTile(s, x, y) && !ruinOnTile(s, x, y);
}

/** The tiles from one to another in straight steps, one axis at a time, so the line has no corner a walker could slip through. */
export function crackLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const out = [{ x: x0, y: y0 }];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1;
  const sy = y1 > y0 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    if (err * 2 > -dy && x !== x1) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
    out.push({ x, y });
  }
  return out;
}

/** The crackable tiles of a line, in order. */
export function crackTiles(s: GameState, x0: number, y0: number, x1: number, y1: number): number[] {
  return crackLine(x0, y0, x1, y1)
    .map((t) => t.y * s.w + t.x)
    .filter((i) => crackable(s, i));
}

/** The charge an engine holds, if any. */
export const chargeOf = (s: GameState, b: Building): Fault | undefined => s.faults?.find((f) => f.engine === b.id);

/** Whole seconds until an engine may charge again (0 when it may). */
export function crackWait(s: GameState, b: Building): number {
  return b.crackAt === undefined ? 0 : Math.max(0, Math.ceil((b.crackAt + secs(FAULT.again) - s.tick) / TICK_HZ));
}

/** Why a finished engine can't charge now, whatever the line, or null. */
export function engineIdle(s: GameState, b: Building): string | null {
  if (asleep(s, b)) return 'It sleeps: engines crack only in the Age of Faults, or the one kept on leaving it';
  if (engineVent(s, b) < 0) return 'No vent lies near enough to draw on';
  if (chargeOf(s, b)) return 'It is charging';
  const wait = crackWait(s, b);
  if (wait > 0) return `It gathers itself: cracks again in ${wait} seconds`;
  if (holder(s, engineVent(s, b), b.owner) >= 0) return "A rival's soldiers hold its vent: drive them off";
  return null;
}

/** Why `owner` can't crack this line with this engine now, or null. */
export function faultProblem(s: GameState, owner: number, b: Building | null | undefined, x0: number, y0: number, x1: number, y1: number): string | null {
  if (!b || b.kind !== 'building' || b.type !== 'faultengine' || b.owner !== owner || b.hp <= 0) return 'Pick a Fault Engine of your own';
  if (!b.built) return 'It must stand finished first';
  const idle = engineIdle(s, b);
  if (idle) return idle;
  if (peace(s)) return 'Not while the peace holds';
  if (![x0, y0, x1, y1].every((v) => Number.isInteger(v)) || x0 < 0 || y0 < 0 || x1 < 0 || y1 < 0 || x0 >= s.w || x1 >= s.w || y0 >= s.h || y1 >= s.h) return 'Pick ground on the map';
  const lx = x1 - x0;
  const ly = y1 - y0;
  if (lx * lx + ly * ly > FAULT.len * FAULT.len) return `A crack runs ${FAULT.len} tiles at most`;
  const r2 = FAULT.reach * FAULT.reach;
  for (const [x, y] of [[x0, y0], [x1, y1]]) {
    const dx = x + 0.5 - b.x;
    const dy = y + 0.5 - b.y;
    if (dx * dx + dy * dy > r2) return `Both ends lie within ${FAULT.reach} tiles of the engine`;
  }
  if (!crackTiles(s, x0, y0, x1, y1).length) return 'Nothing there will crack: water, rock and the ground round a vent hold';
  if (!canAfford(s.players[owner], FAULT.cost)) return 'Not enough to pay for the crack';
  return null;
}

/** Start an engine's charge along a line. Call only once `faultProblem` is null. */
export function fault(s: GameState, b: Building, x0: number, y0: number, x1: number, y1: number): Fault {
  pay(s.players[b.owner], FAULT.cost);
  const f: Fault = { engine: b.id, owner: b.owner, line: crackTiles(s, x0, y0, x1, y1), left: secs(FAULT.charge) };
  (s.faults ??= []).push(f);
  const mid = middle(s, f);
  s.events.push({ k: 'fault', owner: b.owner, id: b.id, what: 'charge', x: mid.x, y: mid.y });
  return f;
}

/** The middle of a charge's line, in map units. */
export function middle(s: GameState, f: Fault): { x: number; y: number } {
  const t = f.line[f.line.length >> 1] ?? 0;
  return { x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 };
}

/** Whole seconds until a charge cracks. */
export const faultClock = (f: Fault): number => Math.ceil(f.left / TICK_HZ);

/** The nearest open tile within `FAULT.clear` a unit is thrown to from a chasm (a walker of `team`), or -1. */
function clearOf(s: GameState, x: number, y: number, team: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const r = FAULT.clear;
  let best = -1;
  let bestD = Infinity;
  for (let ty = cy - r; ty <= cy + r; ty++)
    for (let tx = cx - r; tx <= cx + r; tx++) {
      if (!walkable(s, tx, ty, team)) continue;
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      const d = dx * dx + dy * dy;
      if (d <= r * r && d < bestD) {
        bestD = d;
        best = ty * s.w + tx;
      }
    }
  return best;
}

/**
 * The ground opens along a charge's line: every tile of it that still may crack becomes chasm. Buildings on it lose `FAULT.fall`
 * hundredths of their strength (a field or other open ground falls in whole); land units on it are thrown to open ground within
 * `FAULT.clear` tiles and lose `FAULT.hurl`, or are lost with none; a relic lying there is thrown clear too. Returns the tiles opened.
 */
export function crack(s: GameState, f: Fault): number {
  const open = f.line.filter((i) => crackable(s, i));
  if (!open.length) return 0;
  const set = new Set(open);
  const chasm = (s.chasm ??= new Uint8Array(s.w * s.h));
  for (const i of open) {
    chasm[i] = 1;
    s.block[i] |= B_TERRAIN;
    // Trees, stone and gold go down into it.
    if (s.res[i] !== R_NONE) {
      s.res[i] = R_NONE;
      s.amount[i] = 0;
      s.block[i] &= ~B_RES;
    }
  }
  s.blockVersion++;
  s.cracked = (s.cracked ?? 0) + open.length;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.hp <= 0) continue;
    let on = false;
    for (let y = b.ty; y < b.ty + b.size && !on; y++) for (let x = b.tx; x < b.tx + b.size && !on; x++) on = set.has(y * s.w + x);
    if (!on) continue;
    hurt(s, b, BUILDINGS[b.type].open ? b.hp : Math.round((maxHp(s, b) * FAULT.fall) / 100), f.owner, null);
  }
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || u.below !== undefined || domainOf(u.type) !== 'land') continue;
    if (!set.has(Math.floor(u.y) * s.w + Math.floor(u.x))) continue;
    const to = clearOf(s, u.x, u.y, s.players[u.owner]?.team ?? -1);
    if (to < 0) {
      hurt(s, u, u.hp, f.owner, null);
      continue;
    }
    u.x = (to % s.w) + 0.5;
    u.y = Math.floor(to / s.w) + 0.5;
    u.path = null;
    if (u.goal) u.wantPath = true;
    hurt(s, u, FAULT.hurl, f.owner, null);
  }
  for (const r of s.relics) {
    if (r.carrier || r.temple || !set.has(Math.floor(r.y) * s.w + Math.floor(r.x))) continue;
    const to = clearOf(s, r.x, r.y, -1);
    if (to >= 0) {
      r.x = (to % s.w) + 0.5;
      r.y = Math.floor(to / s.w) + 0.5;
    }
  }
  const st = s.players[f.owner].stats;
  st.cracked = (st.cracked ?? 0) + open.length;
  return open.length;
}

/** Every tick: each charge runs down unless a rival holds its engine's vent; at zero the ground opens. Charges whose engine fell are lost. */
export function faultStep(s: GameState): void {
  if (!s.faults?.length) return;
  const second = s.tick % TICK_HZ === 0;
  const done: Fault[] = [];
  for (const f of s.faults) {
    const b = s.byId.get(f.engine);
    if (!b || b.kind !== 'building' || b.hp <= 0) {
      const mid = middle(s, f);
      s.events.push({ k: 'fault', owner: f.owner, id: f.engine, what: 'lost', x: mid.x, y: mid.y });
      done.push(f);
      continue;
    }
    if (second) {
      const by = holder(s, engineVent(s, b), b.owner);
      if (by >= 0 && !f.held) s.events.push({ k: 'fault', owner: f.owner, id: b.id, what: 'stall', by, x: b.x, y: b.y });
      else if (by < 0 && f.held) s.events.push({ k: 'fault', owner: f.owner, id: b.id, what: 'go', x: b.x, y: b.y });
      f.held = by >= 0 ? true : undefined;
    }
    if (f.held) continue;
    if (--f.left > 0) continue;
    const mid = middle(s, f);
    const n = crack(s, f);
    b.crackAt = s.tick;
    s.events.push({ k: 'fault', owner: f.owner, id: b.id, what: 'crack', n, x: mid.x, y: mid.y });
    done.push(f);
  }
  if (done.length) s.faults = s.faults.filter((f) => !done.includes(f));
}

/** Whether a people may lay a Bridge over a chasm: any people from `FAULT.spanFrom` on, once a chasm has opened. */
export const spanOpen = (s: GameState, p: Player): boolean => !!s.cracked && p.epoch >= FAULT.spanFrom;

/** Whether a building stands over chasm (a Bridge laid across one). */
export function overChasm(s: GameState, b: Building): boolean {
  if (!s.chasm) return false;
  for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) if (s.chasm[y * s.w + x]) return true;
  return false;
}

/** How many Fault Engines a people has standing or rising. */
export const enginesOf = (s: GameState, owner: number): number => s.ents.filter((e) => e.kind === 'building' && e.type === 'faultengine' && e.owner === owner && e.hp > 0).length;

/** Why a people can't raise another Fault Engine, or null. */
export function engineLimit(s: GameState, owner: number, type: string): string | null {
  return type === 'faultengine' && enginesOf(s, owner) >= FAULT.most ? `At most ${FAULT.most} Fault Engines` : null;
}
