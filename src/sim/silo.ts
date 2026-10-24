import { FALLOUT, FISSION, FUSION, SILO, TICK_HZ, WARHEADS, domainOf, secs } from './data';
import { ageDef } from './ages';
import { hurt, peace } from './combat';
import { distToRect } from './grid';
import { canAfford, isEnemy, pay } from './world';
import { breachAt } from './tides';
import type { Building, Ent, GameState, Launch, Player } from './types';

/**
 * The Missile Silo (#605, the Atomic Age). `launch` names a point on the map; the warhead lands `SILO.fuse` seconds later, a
 * countdown every player sees. A silo destroyed while it counts scrubs the launch. A launch empties the silo, which is refuelled
 * (paid when the launch is made) over `SILO.refuel` seconds before it can fire again. The numbers are `SILO`.
 */

/** How a people works its silos: the plain Atomic Age's rules, or the fork's (Fission: quick and leaky; Fusion: clean, limitless and slow). */
export function rulesOf(p: Player): { fuse: number; refuel: number; fuel: typeof SILO.fuel; air: number; clean: boolean; leak: number; w: WarheadKind } {
  const a = ageDef(p);
  if (a.fission) return { fuse: FISSION.fuse, refuel: FISSION.refuel, fuel: SILO.fuel, air: 1, clean: false, leak: FISSION.ownFallout, w: 'fission' };
  if (a.fusion) return { fuse: FUSION.fuse, refuel: FUSION.refuel, fuel: FUSION.fuel, air: FUSION.air, clean: true, leak: 0, w: 'fusion' };
  return { fuse: SILO.fuse, refuel: SILO.refuel, fuel: SILO.fuel, air: 1, clean: false, leak: 0, w: 'atomic' };
}

export type WarheadKind = 'atomic' | 'fission' | 'fusion';

/**
 * What a blast does at `d` tiles from its centre (#751 s1): `peak / (1 + (d/2)²)`, tapering to nothing over the last `WARHEADS.taper` tiles
 * before the blast radius, and nothing at or past it. Only + − × ÷, so it is the same on every machine.
 */
export function blastDamage(w: WarheadKind, d: number): number {
  const { peak, r } = WARHEADS[w];
  if (d >= r) return 0;
  const q = d / WARHEADS.half;
  const dmg = peak / (1 + q * q);
  return d > r - WARHEADS.taper ? (dmg * (r - d)) / WARHEADS.taper : dmg;
}

/** The people's finished, standing silos, in id order. */
export function silosOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'silo' && e.built && e.hp > 0) out.push(e);
  return out;
}

/** Whether a silo has fuel for a launch now: no warhead in the air from it, and refuelling done. */
export const loaded = (s: GameState, b: Building): boolean => s.tick >= (b.rearm ?? 0) && (s.launches ?? []).filter((l) => l.silo === b.id).length < rulesOf(s.players[b.owner]).air;

/** Why this silo can't launch at this point, or null. */
export function launchProblem(s: GameState, owner: number, silo: Building | undefined, x: number, y: number): string | null {
  const p = s.players[owner];
  if (!silo || silo.kind !== 'building' || silo.type !== 'silo' || silo.owner !== owner) return 'Pick one of your Missile Silos';
  if (!silo.built || silo.hp <= 0) return 'The silo is not finished';
  if (p.epoch < 5) return 'Silos fire only in the Atomic Age';
  if (peace(s)) return 'Not while the peace holds';
  if ((s.launches ?? []).filter((l) => l.silo === silo.id).length >= rulesOf(p).air) return 'A warhead from this silo is already in the air';
  if (s.tick < (silo.rearm ?? 0)) return `Refuelling: ${Math.ceil(((silo.rearm ?? 0) - s.tick) / TICK_HZ)}s to go`;
  if (!(x >= 0 && y >= 0 && x < s.w && y < s.h)) return 'Pick a point on the map';
  if (!canAfford(p, rulesOf(p).fuel)) return `A warhead's fuel takes ${costText(rulesOf(p).fuel)}`;
  return null;
}

const costText = (fuel: typeof SILO.fuel): string => Object.entries(fuel).map(([r, n]) => `${n} ${r}`).join(' and ');

/** Fire: pay the fuel, start the clock, tell the map. Fission also poisons the ground round the silo. */
export function launch(s: GameState, owner: number, silo: Building, x: number, y: number): void {
  const r = rulesOf(s.players[owner]);
  pay(s.players[owner], r.fuel);
  silo.rearm = s.tick + secs(r.refuel);
  (s.launches ??= []).push({ id: s.nextId++, owner, silo: silo.id, x, y, w: r.w, at: s.tick + secs(r.fuse), ...(r.clean ? { clean: true } : {}) });
  if (r.leak > 0) (s.fallout ??= []).push({ id: s.nextId++, owner, x: silo.x, y: silo.y, r: FISSION.reach, until: s.tick + secs(r.leak) });
  s.events.push({ k: 'silo', owner, x, y, what: 'launched', fuse: r.fuse, w: r.w });
}

/**
 * The warhead lands: every rival building whose nearest edge is within the blast radius, and every rival land unit not sheltered in a
 * building, takes `blastDamage` for its distance. The blast clears the fog for everyone for `SILO.lift` seconds; the fallout, if any,
 * keeps its own radius `SILO.reach`.
 */
function strike(s: GameState, l: Launch): void {
  const { owner, x, y } = l;
  const w = l.w ?? 'atomic';
  const R = WARHEADS[w].r;
  const hit: [Ent, number][] = [];
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, owner, e.owner)) continue;
    if (e.kind === 'building') {
      const d = distToRect(x, y, e);
      if (d < R) hit.push([e, d]);
    } else if (!e.inside && domainOf(e.type) === 'land') {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy < R * R) hit.push([e, Math.sqrt(dx * dx + dy * dy)]);
    }
  }
  for (const [e, d] of hit) hurt(s, e, blastDamage(w, d), owner, null);
  // A warhead tears up a rival's causeways too (#748): the road over the flats is cut, its barrage's pond let out.
  breachAt(s, x, y, R, owner);
  (s.blasts ??= []).push({ id: s.nextId++, x, y, r: R, until: s.tick + secs(SILO.lift) });
  if (!l.clean) (s.fallout ??= []).push({ id: s.nextId++, owner, x, y, until: s.tick + secs(FALLOUT.time) });
  s.events.push({ k: 'silo', owner, x, y, what: 'struck', w });
}

/** Every tick, in the order they were launched: a warhead whose silo has fallen is scrubbed; one whose clock has run out lands. */
export function siloStep(s: GameState): void {
  falloutStep(s);
  if (s.blasts) {
    const live = s.blasts.filter((b) => s.tick < b.until);
    if (live.length) s.blasts = live;
    else delete s.blasts;
  }
  if (!s.launches) return;
  const left = [];
  for (const l of s.launches) {
    const b = s.byId.get(l.silo);
    if (!b || b.kind !== 'building' || b.hp <= 0) s.events.push({ k: 'silo', owner: l.owner, x: l.x, y: l.y, what: 'scrubbed' });
    else if (s.tick >= l.at) strike(s, l);
    else left.push(l);
  }
  if (left.length) s.launches = left;
  else delete s.launches;
}

/** Whether (x, y) stands in poisoned ground. */
export const inFallout = (s: GameState, x: number, y: number): boolean =>
  (s.fallout ?? []).some((f) => (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y) <= (f.r ?? SILO.reach) * (f.r ?? SILO.reach));

/** Once a second: spent fallout clears; every land unit left in the rest takes `FALLOUT.dps`, whoever's it is. */
function falloutStep(s: GameState): void {
  if (!s.fallout) return;
  const live = s.fallout.filter((f) => s.tick < f.until);
  if (live.length) s.fallout = live;
  else delete s.fallout;
  if (!s.fallout || s.tick % TICK_HZ !== 0) return;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || domainOf(e.type) !== 'land') continue;
    const f = s.fallout.find((z) => (z.x - e.x) * (z.x - e.x) + (z.y - e.y) * (z.y - e.y) <= (z.r ?? SILO.reach) * (z.r ?? SILO.reach));
    if (f) hurt(s, e, FALLOUT.dps, f.owner, null);
  }
}

/** Seconds of a warhead's clock left (for the HUD and the computer), or null. */
export const clockOf = (s: GameState, l: { at: number }): number => Math.max(0, Math.ceil((l.at - s.tick) / TICK_HZ));

export type { Player };
