import { FALLOUT, FISSION, FUSION, SILO, TICK_HZ, WARHEADS, domainOf, secs } from './data';
import { ageDef } from './ages';
import { hurt, peace } from './combat';
import { distToRect } from './grid';
import { canAfford, isEnemy, pay } from './world';
import { breachAt } from './tides';
import type { Building, BuildingType, Cost, Ent, GameState, Launch, Player } from './types';

/**
 * The Missile Silo (#605, the Atomic Age). `launch` names a point on the map; the warhead lands after its people's clock, a
 * countdown every player sees. A silo destroyed while it counts scrubs the launch, and that warhead is lost. The numbers are `SILO`.
 *
 * The missile pool (#753): a people keeps one store of warheads (`Player.nukes`), not tied to any silo. A launch spends one when it is
 * ordered, from any standing silo; a fallen silo takes no stored warhead with it. The store holds `SILO.stock` when the first silo
 * stands and makes one more every branch `refuel` seconds while store and flight together are under `SILO.cap` (Fusion's `refuel`
 * is 0: a warhead is made the tick a slot frees, so at most `cap` are ever aloft). At launch the people picks Atomic or its branch's
 * own warhead (`warheadsOf`); the clock is the people's whatever it fires, so the clock never says which is coming. Finished silos are
 * seen by every player (`shownToAll`), with no alert.
 */

/** How a people works its silos: the plain Atomic Age's rules, or the fork's (Fission: quick and leaky; Fusion: clean, limitless and slow). */
export function rulesOf(p: Player): { fuse: number; refuel: number; leak: number; w: WarheadKind } {
  const a = ageDef(p);
  if (a.fission) return { fuse: FISSION.fuse, refuel: FISSION.refuel, leak: FISSION.ownFallout, w: 'fission' };
  if (a.fusion) return { fuse: FUSION.fuse, refuel: FUSION.refuel, leak: 0, w: 'fusion' };
  return { fuse: SILO.fuse, refuel: SILO.refuel, leak: 0, w: 'atomic' };
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

/** The warheads a people may fire (#753): Atomic, and its branch's own past the fork. */
export const warheadsOf = (p: Player): WarheadKind[] => (rulesOf(p).w === 'atomic' ? ['atomic'] : ['atomic', rulesOf(p).w]);

/** A warhead's fuel, paid at launch: Atomic `SILO.fuel`, Fission `FISSION.fuel`, Fusion `FUSION.fuel`. */
export const fuelOf = (w: WarheadKind): Cost => (w === 'fission' ? FISSION.fuel : w === 'fusion' ? FUSION.fuel : SILO.fuel);

/** A Fusion warhead leaves no fallout where it lands. */
const cleanOf = (w: WarheadKind): boolean => w === 'fusion';

/**
 * The ring a rival is warned of for a launch: the widest blast its people could have sent, never the warhead's own (#753), so neither
 * the ring nor the clock gives the warhead away. The computer runs from this ring too.
 */
export const warnRadius = (s: GameState, owner: number): number => Math.max(...warheadsOf(s.players[owner]).map((w) => WARHEADS[w].r));

/** The warhead a launch carries (absent in older saves: atomic). */
const kindOf = (l: Launch): WarheadKind => l.w ?? 'atomic';

/** Warheads of this people's in store now (`SILO.stock` before its first silo has stood a second). Hidden from rivals. */
export const stockOf = (p: Player): number => p.nukes?.n ?? SILO.stock;

/** Warheads of this people's in the air now. */
export const aloftOf = (s: GameState, owner: number): number => (s.launches ?? []).reduce((n, l) => n + (l.owner === owner ? 1 : 0), 0);

/** Seconds until this people's next warhead is made, or null when none is being made (the store and the air are full). */
export function nextNuke(s: GameState, p: Player): number | null {
  const at = p.nukes?.next;
  return at === undefined ? null : Math.max(0, Math.ceil((at - s.tick) / TICK_HZ));
}

/** Whether this finished silo is drawn for every player through the fog (#753): standing silos are no secret. */
export const shownToAll = (b: { kind: string; type?: string; built?: boolean; hp: number }): boolean => b.kind === 'building' && b.type === 'silo' && !!b.built && b.hp > 0;

/** The people's finished, standing silos, in id order. */
export function silosOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'silo' && e.built && e.hp > 0) out.push(e);
  return out;
}

/** Why this people can raise no more silos (#753: at most `SILO.most`, finished or rising), or null. */
export function siloLimit(s: GameState, owner: number, type: BuildingType): string | null {
  if (type !== 'silo') return null;
  let n = 0;
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'silo' && e.hp > 0) n++;
  return n >= SILO.most ? `A people raises at most ${SILO.most} Missile Silos` : null;
}

/** Whether this silo can fire now: it stands and its people has a warhead in store. */
export const loaded = (s: GameState, b: Building): boolean => b.built && b.hp > 0 && stockOf(s.players[b.owner]) > 0;

/** Why this silo can't launch this warhead (the people's own by default) at this point, or null. */
export function launchProblem(s: GameState, owner: number, silo: Building | undefined, x: number, y: number, w?: WarheadKind): string | null {
  const p = s.players[owner];
  if (!silo || silo.kind !== 'building' || silo.type !== 'silo' || silo.owner !== owner) return 'Pick one of your Missile Silos';
  if (!silo.built || silo.hp <= 0) return 'The silo is not finished';
  if (p.epoch < 5) return 'Silos fire only in the Atomic Age';
  if (peace(s)) return 'Not while the peace holds';
  const kind = w ?? rulesOf(p).w;
  if (!warheadsOf(p).includes(kind)) return 'Your people cannot make that warhead';
  if (stockOf(p) <= 0) {
    const next = nextNuke(s, p);
    return next === null ? `All ${SILO.cap} of your warheads are already in the air` : `Refuelling: the next warhead is ready in ${Math.max(1, next)}s`;
  }
  if (!(x >= 0 && y >= 0 && x < s.w && y < s.h)) return 'Pick a point on the map';
  if (!canAfford(p, fuelOf(kind))) return `A warhead's fuel takes ${costText(fuelOf(kind))}`;
  return null;
}

/** The warheads' names, for the HUD and refusals. */
export const WARHEAD_NAMES: Record<WarheadKind, string> = { atomic: 'Atomic', fission: 'Fission', fusion: 'Fusion' };

const costText = (fuel: Cost): string => Object.entries(fuel).map(([r, n]) => `${n} ${r}`).join(' and ');

/** Spend one warhead from the people's store; the next starts being made if none was. */
function spend(s: GameState, p: Player): void {
  const pool = (p.nukes ??= { n: SILO.stock });
  pool.n--;
  pool.next ??= s.tick + secs(rulesOf(p).refuel);
}

/**
 * Fire: spend a warhead from the pool, pay its fuel, start the people's clock, tell the map. A Fission people also poisons the ground
 * round the silo, whatever it fires (so the poison never says which warhead went up).
 */
export function launch(s: GameState, owner: number, silo: Building, x: number, y: number, w?: WarheadKind): void {
  const p = s.players[owner];
  const r = rulesOf(p);
  const kind = w ?? r.w;
  spend(s, p);
  pay(p, fuelOf(kind));
  (s.launches ??= []).push({ id: s.nextId++, owner, silo: silo.id, x, y, w: kind, at: s.tick + secs(r.fuse), ...(cleanOf(kind) ? { clean: true } : {}) });
  if (r.leak > 0) (s.fallout ??= []).push({ id: s.nextId++, owner, x: silo.x, y: silo.y, r: FISSION.reach, until: s.tick + secs(r.leak) });
  // The event names no warhead: every player is warned of the same ring whatever was sent (`warnRadius`).
  s.events.push({ k: 'silo', owner, x, y, what: 'launched', fuse: r.fuse, ring: warnRadius(s, owner) });
}

/**
 * Every tick, in id order: a people whose first silo has stood gets its pool (`SILO.stock`), and a pool under its cap (store and
 * flight together) makes its next warhead when the clock comes due. Fusion's clock is 0, so a freed slot fills the same tick.
 */
function poolStep(s: GameState): void {
  for (const p of s.players) {
    if (p.epoch < 5) continue;
    if (!p.nukes) {
      if (s.tick % TICK_HZ !== 0 || !silosOf(s, p.id).length) continue;
      p.nukes = { n: SILO.stock };
    }
    const pool = p.nukes;
    const refuel = secs(rulesOf(p).refuel);
    if (pool.n + aloftOf(s, p.id) >= SILO.cap) {
      delete pool.next;
      continue;
    }
    pool.next ??= s.tick + refuel;
    while (s.tick >= pool.next && pool.n + aloftOf(s, p.id) < SILO.cap) {
      pool.n++;
      pool.next += refuel;
    }
    if (pool.n + aloftOf(s, p.id) >= SILO.cap) delete pool.next;
  }
}

/**
 * The warhead lands: every rival building whose nearest edge is within the blast radius, and every rival land unit not sheltered in a
 * building, takes `blastDamage` for its distance. The blast clears the fog for everyone for `SILO.lift` seconds; the fallout, if any,
 * keeps its own radius `SILO.reach`.
 */
function strike(s: GameState, l: Launch): void {
  const { owner, x, y } = l;
  const w = kindOf(l);
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
  poolStep(s);
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
