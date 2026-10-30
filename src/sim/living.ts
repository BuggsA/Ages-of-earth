import { BUILDINGS, LIVING, TICK_HZ, UNDER, domainOf, secs } from './data';
import { ageDef, asleep, hasWalked } from './ages';
import { hurt, peace } from './combat';
import { holder } from './forge';
import { chargeOf, crackLine, crackable, engineVent, split } from './fault';
import { distToRect } from './grid';
import { isSunk } from './undercity';
import { canAfford, maxHp, pay } from './world';
import { B_TERRAIN } from './types';
import type { Building, Ent, Fault, GameState } from './types';

/**
 * The Age of the Living Earth (#904, the Deep Road's last age). A Heartstone is raised within `LIVING.tap` tiles of a vent (the Fault
 * Engine's rule, `engineSpot`) and draws on it, as the engines do. It has three orders:
 * - **Raise a ridge** (`heave`): a line charges `LIVING.rise` seconds where every people sees it, then heaves up into ridge (2 in
 *   `GameState.chasm`, `B_TERRAIN`) that nothing crosses but fliers; a chasm on the line closes over instead. The kept stone raises
 *   ridges on any road.
 * - **The Quake** (`quake`): a `LIVING.quake`-second charge, longer than any warhead's clock, then four seams split from its heart (two
 *   chasm, two ridge, `quakeSeams`) and every building within `LIVING.wide` is shaken; the caster's own ground round the stone shakes too.
 * - **Swallow** (`swallow`): every building of its people that may sink within `LIVING.district` tiles of a point goes down at once.
 * And the age's answer to a warhead: a sunk building of a people that walked this age rides it out in its deep vault (`vaulted`).
 * Charges run in `faultStep` (`fault.ts`) beside the engines', stalled by a rival holding the vent and lost if the stone falls.
 */

/** Whether a people is in the Living Earth now (or in a Golden Age that holds its verb). */
const alive = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).living;

/** Whether this Heartstone may raise a ridge now: in the age, or the kept stone on any road. */
const raisesHere = (s: GameState, b: Building): boolean => alive(s, b.owner) || b.keep === 'living';

/** How many Heartstones a people has standing or rising. */
export const stonesOf = (s: GameState, owner: number): number => s.ents.filter((e) => e.kind === 'building' && e.type === 'heartstone' && e.owner === owner && e.hp > 0).length;

/** Why a people can't raise another Heartstone, or null. */
export function stoneLimit(s: GameState, owner: number, type: string): string | null {
  return type === 'heartstone' && stonesOf(s, owner) >= LIVING.most ? `One Heartstone to a people` : null;
}

/** Whole seconds until `at` plus `wait` seconds has passed (0 when it has, or `at` is unset). */
const left = (s: GameState, at: number | undefined, wait: number): number => (at === undefined ? 0 : Math.max(0, Math.ceil((at + secs(wait) - s.tick) / TICK_HZ)));

/** Whole seconds until a Heartstone may raise another ridge. */
export const ridgeWait = (s: GameState, b: Building): number => left(s, b.crackAt, LIVING.reraise);

/** Whole seconds until a Heartstone may wake another Quake. */
export const quakeWait = (s: GameState, b: Building): number => left(s, b.quakeAt, LIVING.again);

/** Why a finished Heartstone can't charge anything now, or null. */
export function stoneIdle(s: GameState, b: Building): string | null {
  if (asleep(s, b)) return 'It sleeps: the Heartstone wakes only in the Age of the Living Earth, or the one kept on leaving it';
  if (engineVent(s, b) < 0) return 'No vent lies near enough to draw on';
  const f = chargeOf(s, b);
  if (f) return f.kind === 'quake' ? 'The Quake is charging' : 'A ridge is charging';
  if (holder(s, engineVent(s, b), b.owner) >= 0) return "A rival's soldiers hold its vent: drive them off";
  return null;
}

/** Why a Heartstone isn't one of `owner`'s, finished and standing, or null. */
function stoneProblem(b: Building | null | undefined, owner: number): string | null {
  if (!b || b.kind !== 'building' || b.type !== 'heartstone' || b.owner !== owner || b.hp <= 0) return 'Pick a Heartstone of your own';
  return b.built ? null : 'It must stand finished first';
}

/** Whether tile (`x`, `y`) lies on the map and its middle within `LIVING.reach` of the stone's. */
function inReach(s: GameState, b: Building, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const dx = x + 0.5 - b.x;
  const dy = y + 0.5 - b.y;
  return dx * dx + dy * dy <= LIVING.reach * LIVING.reach;
}

/** The tiles of a line that would move under a ridge: chasm that closes, or ground that may rise. */
export function ridgeTiles(s: GameState, x0: number, y0: number, x1: number, y1: number): number[] {
  return crackLine(x0, y0, x1, y1)
    .map((t) => t.y * s.w + t.x)
    .filter((i) => (s.chasm?.[i] === 1) || crackable(s, i));
}

/** Why `owner` can't raise a ridge with this Heartstone now, wherever it runs, or null. */
export function heaveReady(s: GameState, owner: number, b: Building | null | undefined): string | null {
  const own = stoneProblem(b, owner);
  if (own) return own;
  if (!raisesHere(s, b!)) return 'Only a people of the Living Earth raises ridges (and its kept Heartstone, on any road)';
  const idle = stoneIdle(s, b!);
  if (idle) return idle;
  const wait = ridgeWait(s, b!);
  if (wait > 0) return `It gathers itself: raises again in ${wait} seconds`;
  if (peace(s)) return 'Not while the peace holds';
  if (!canAfford(s.players[owner], LIVING.ridgeCost)) return 'Not enough to pay for the ridge';
  return null;
}

/** Why `owner` can't raise this ridge with this Heartstone now, or null. */
export function heaveProblem(s: GameState, owner: number, b: Building | null | undefined, x0: number, y0: number, x1: number, y1: number): string | null {
  const ready = heaveReady(s, owner, b);
  if (ready) return ready;
  if (!inReach(s, b!, x0, y0) || !inReach(s, b!, x1, y1)) return `Both ends lie on the map, within ${LIVING.reach} tiles of the stone`;
  const lx = x1 - x0;
  const ly = y1 - y0;
  if (lx * lx + ly * ly > LIVING.len * LIVING.len) return `A ridge runs ${LIVING.len} tiles at most`;
  if (!ridgeTiles(s, x0, y0, x1, y1).length) return 'Nothing there will move: water, rock, ridges and the ground round a vent hold';
  return null;
}

/** Start a Heartstone's ridge charging. Call only once `heaveProblem` is null. */
export function raiseRidge(s: GameState, b: Building, x0: number, y0: number, x1: number, y1: number): Fault {
  pay(s.players[b.owner], LIVING.ridgeCost);
  const f: Fault = { engine: b.id, owner: b.owner, line: ridgeTiles(s, x0, y0, x1, y1), left: secs(LIVING.rise), kind: 'ridge' };
  return charge(s, b, f);
}

/** A charge begins: every people is told, and sees its seams. */
function charge(s: GameState, b: Building, f: Fault): Fault {
  (s.faults ??= []).push(f);
  const t = f.at ?? f.line[f.line.length >> 1] ?? 0;
  s.events.push({ k: 'fault', owner: b.owner, id: b.id, what: 'charge', kind: f.kind, x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 });
  return f;
}

/**
 * The ridge rises along a charge's line: chasm on it closes over into plain ground, and ground that may rise heaves up into ridge (as
 * a crack opens, `split`: what stands there falls, who stands there is thrown clear). Returns the tiles moved.
 */
export function heave(s: GameState, f: Fault): number {
  const shut = f.line.filter((i) => s.chasm?.[i] === 1);
  const up = f.line.filter((i) => crackable(s, i));
  if (!shut.length && !up.length) return 0;
  for (const i of shut) {
    s.chasm![i] = 0;
    s.block[i] &= ~B_TERRAIN;
  }
  if (shut.length) s.blockVersion++;
  if (up.length) split(s, up, f.owner, 2);
  s.heaved = (s.heaved ?? 0) + shut.length + up.length;
  const st = s.players[f.owner].stats;
  st.raised = (st.raised ?? 0) + up.length;
  return shut.length + up.length;
}

/**
 * The seams a Quake round tile (`cx`, `cy`) splits along: four spokes from its heart, square to the map or slanting by the tile it was
 * aimed at (so a player chooses the cross by where they click), out to `LIVING.wide` (a slanting spoke as far, near enough: seven
 * tenths of the steps). The first and third open as chasm, the second and fourth rise as ridge, so a town is cut into quarters, each open
 * to the land beyond. Every tile is listed, whether it may move or not.
 */
export function quakeSeams(s: GameState, cx: number, cy: number): { chasm: number[]; ridge: number[] } {
  const slant = ((cx + cy) & 1) === 1;
  const dirs = slant ? [[1, 1], [-1, 1], [-1, -1], [1, -1]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const r = slant ? Math.floor((LIVING.wide * 7) / 10) : LIVING.wide;
  const out = { chasm: [] as number[], ridge: [] as number[] };
  dirs.forEach(([dx, dy], k) => {
    const x1 = Math.max(0, Math.min(s.w - 1, cx + dx * r));
    const y1 = Math.max(0, Math.min(s.h - 1, cy + dy * r));
    for (const t of crackLine(cx + dx, cy + dy, x1, y1)) (k % 2 ? out.ridge : out.chasm).push(t.y * s.w + t.x);
  });
  return out;
}

/** Why `owner` can't wake the Quake round tile (`x`, `y`) with this Heartstone now, or null. */
export function quakeProblem(s: GameState, owner: number, b: Building | null | undefined, x: number, y: number): string | null {
  const ready = quakeReady(s, owner, b);
  if (ready) return ready;
  // The earth carries it anywhere, as a warhead flies anywhere.
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= s.w || y >= s.h) return 'Pick ground on the map';
  return null;
}

/** Why `owner` can't wake the Quake with this Heartstone now, wherever it is aimed, or null. */
export function quakeReady(s: GameState, owner: number, b: Building | null | undefined): string | null {
  const own = stoneProblem(b, owner);
  if (own) return own;
  if (!alive(s, owner)) return 'Only a people in the Age of the Living Earth wakes the Quake';
  const idle = stoneIdle(s, b!);
  if (idle) return idle;
  const wait = quakeWait(s, b!);
  if (wait > 0) return `The earth is still settling: another Quake in ${wait} seconds`;
  if (peace(s)) return 'Not while the peace holds';
  if (!canAfford(s.players[owner], LIVING.quakeCost)) return 'Not enough to pay for the Quake';
  return null;
}

/** Start a Heartstone's Quake charging round tile (`x`, `y`). Call only once `quakeProblem` is null. */
export function wake(s: GameState, b: Building, x: number, y: number): Fault {
  pay(s.players[b.owner], LIVING.quakeCost);
  const seams = quakeSeams(s, x, y);
  const line = [...seams.chasm, ...seams.ridge].filter((i) => crackable(s, i));
  return charge(s, b, { engine: b.id, owner: b.owner, line, left: secs(LIVING.quake), kind: 'quake', at: y * s.w + x });
}

/** Whether a building is shaken by the Quake at all: open ground (fields, roads over the water) and bridges ride it. */
const shakes = (b: Building): boolean => !BUILDINGS[b.type].open;

/**
 * The Quake strikes round its heart, for good: its chasm seams open and its ridge seams rise (`split`), every building within
 * `LIVING.wide` is shaken (`shake` hundredths of its strength within half that, `shook` beyond; a sunk one `vault` hundredths of that),
 * every land unit in the open there loses `knock`, and then the caster's own buildings within `LIVING.home` of the stone, not already
 * shaken, lose `backlash` hundredths: every great quake shakes your own ground. Returns the tiles moved.
 */
export function quake(s: GameState, f: Fault, stone: Building): number {
  const at = f.at ?? 0;
  const cx = at % s.w;
  const cy = (at - cx) / s.w;
  const seams = quakeSeams(s, cx, cy);
  const open = seams.chasm.filter((i) => crackable(s, i));
  if (open.length) split(s, open, f.owner, 1);
  const up = seams.ridge.filter((i) => crackable(s, i));
  if (up.length) split(s, up, f.owner, 2);
  s.cracked = (s.cracked ?? 0) + open.length;
  s.heaved = (s.heaved ?? 0) + up.length;
  const st = s.players[f.owner].stats;
  st.cracked = (st.cracked ?? 0) + open.length;
  st.raised = (st.raised ?? 0) + up.length;
  st.quakes = (st.quakes ?? 0) + 1;
  const hx = cx + 0.5;
  const hy = cy + 0.5;
  const R = LIVING.wide;
  const shaken = new Set<number>();
  const shake: [Ent, number][] = [];
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    if (e.kind === 'building') {
      if (!shakes(e)) continue;
      const d = distToRect(hx, hy, e);
      if (d >= R) continue;
      shaken.add(e.id);
      const per = (d < R / 2 ? LIVING.shake : LIVING.shook) * (isSunk(e) ? LIVING.vault / 100 : 1);
      shake.push([e, Math.round((maxHp(s, e) * per) / 100)]);
    } else if (!e.inside && e.below === undefined && domainOf(e.type) === 'land') {
      const dx = e.x - hx;
      const dy = e.y - hy;
      if (dx * dx + dy * dy < R * R) shake.push([e, LIVING.knock]);
    }
  }
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || e.owner !== f.owner || e.id === stone.id || shaken.has(e.id) || !shakes(e)) continue;
    if (distToRect(stone.x, stone.y, e) >= LIVING.home) continue;
    shake.push([e, Math.round((maxHp(s, e) * LIVING.backlash * (isSunk(e) ? LIVING.vault / 100 : 1)) / 100)]);
  }
  for (const [e, n] of shake) hurt(s, e, n, f.owner, null);
  return open.length + up.length;
}

/** The buildings of `owner` a swallow at tile (`x`, `y`) would take down: built, standing, of a kind that may sink, not sunk or moving. */
export function districtAt(s: GameState, owner: number, x: number, y: number): Building[] {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const r = LIVING.district;
  const out: Building[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.hp <= 0 || !e.built || !UNDER.kinds.includes(e.type)) continue;
    if (e.sunk || e.sinking !== undefined || e.rising !== undefined) continue;
    if (Math.abs(e.x - cx) > r || Math.abs(e.y - cy) > r) continue;
    out.push(e);
  }
  return out;
}

/** The stone a swallow of these buildings costs: `LIVING.gulpCost` a tile of their footprints. */
export const gulpCost = (bs: Building[]): number => bs.reduce((n, b) => n + LIVING.gulpCost * b.size * b.size, 0);

/** Why `owner` can't swallow a district with this Heartstone now, wherever it is, or null. */
export function swallowReady(s: GameState, owner: number, b: Building | null | undefined): string | null {
  const own = stoneProblem(b, owner);
  if (own) return own;
  if (!alive(s, owner)) return 'Only a people in the Age of the Living Earth swallows a district';
  if (asleep(s, b!)) return 'It sleeps';
  return null;
}

/** Why `owner` can't swallow the district round tile (`x`, `y`) with this Heartstone now, or null. */
export function swallowProblem(s: GameState, owner: number, b: Building | null | undefined, x: number, y: number): string | null {
  const ready = swallowReady(s, owner, b);
  if (ready) return ready;
  if (!inReach(s, b!, x, y)) return `Pick ground on the map within ${LIVING.reach} tiles of the stone`;
  const bs = districtAt(s, owner, x, y);
  if (!bs.length) return `Nothing of yours within ${LIVING.district} tiles may go below: Houses, Storehouses, halls and Barrows only, finished and on the surface`;
  const need = gulpCost(bs);
  if (s.players[owner].res.stone < need) return `Need ${Math.ceil(need - s.players[owner].res.stone)} more stone`;
  return null;
}

/** The district round tile (`x`, `y`) goes down at once: paid now, each of its buildings sunk in `LIVING.gulp` seconds (`underStep`). */
export function swallow(s: GameState, b: Building, x: number, y: number): number {
  const bs = districtAt(s, b.owner, x, y);
  s.players[b.owner].res.stone -= gulpCost(bs);
  for (const e of bs) {
    e.sinking = s.tick + secs(LIVING.gulp);
    s.events.push({ k: 'sink', owner: e.owner, id: e.id, what: 'sinking', x: e.x, y: e.y });
  }
  s.events.push({ k: 'swallow', owner: b.owner, id: b.id, n: bs.length, x: x + 0.5, y: y + 0.5 });
  return bs.length;
}

/** Whether a building rides out a warhead in its deep vault: sunk, of a people that has walked the Living Earth. */
export const vaulted = (s: GameState, b: Building): boolean => isSunk(b) && !!s.players[b.owner] && hasWalked(s.players[b.owner], 'living');

/** A keg blown at (`x`, `y`) levels the ridge tiles within `r` back into plain ground (#904). Returns how many. */
export function levelRidges(s: GameState, x: number, y: number, r: number): number {
  if (!s.chasm || !s.heaved) return 0;
  let n = 0;
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
      const i = ty * s.w + tx;
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      if (s.chasm[i] !== 2 || dx * dx + dy * dy > r * r) continue;
      s.chasm[i] = 0;
      s.block[i] &= ~B_TERRAIN;
      n++;
    }
  if (n) {
    s.blockVersion++;
    s.heaved += n;
  }
  return n;
}
