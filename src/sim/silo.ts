import { BUILDINGS, FALLOUT, FISSION, FUSION, SALVO, SILO, TICK_HZ, WARHEADS, domainOf, secs } from './data';
import { ageDef } from './ages';
import { DIRS, roll } from './animals';
import { hurt, peace } from './combat';
import { distToRect } from './grid';
import { canAfford, isEnemy, maxHp, pay, statsOf } from './world';
import { breachAt } from './tides';
import type { Building, BuildingType, Cost, Ent, GameState, Launch, Player, SalvoShot, Warning } from './types';

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
 *
 * The three-zone warning (#762): each rival team is shown three rings, the real zone and two decoys, and cannot tell which is real until
 * `SILO.reveal` seconds before it lands (`warningsOf`, `ringsFor`). The attacker's team sees only its own aim.
 *
 * The salvo (#765): a people with Launch Control may raise a third silo, and three standing silos may fire together (`salvo`): three
 * Atomic warheads from the store, one from each silo, each at its own point, all on one launch and the people's one clock. A rival sees
 * three rings drawn by the same rule as a single strike's, but all three are real; at the reveal all three stay. A fallen silo scrubs its
 * own warhead and its ring; the others fly on.
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

/** The warhead whose ring the rivals are warned of: the widest its people could send. */
const widestOf = (s: GameState, owner: number): WarheadKind => warheadsOf(s.players[owner]).reduce((a, b) => (WARHEADS[b].r > WARHEADS[a].r ? b : a));

/** The warhead a launch carries (absent in older saves: atomic). */
const kindOf = (l: Launch): WarheadKind => l.w ?? 'atomic';

/** Warheads of this people's in store now (`SILO.stock` before its first silo has stood a second). Hidden from rivals. */
export const stockOf = (p: Player): number => p.nukes?.n ?? SILO.stock;

/** A launch's warheads still flying: one for a single strike, a salvo's unscrubbed ones (#765). */
const liveOf = (l: Launch): SalvoShot[] => l.salvo?.filter((sh) => !sh.gone) ?? [{ silo: l.silo, x: l.x, y: l.y }];

/** Warheads of this people's in the air now (a salvo's count one each). */
export const aloftOf = (s: GameState, owner: number): number => (s.launches ?? []).reduce((n, l) => n + (l.owner === owner ? liveOf(l).length : 0), 0);

/** The true points a launch will still strike, in its own order: the attacker's aims, never shown to a rival (#765). */
export const aimsOf = (l: Launch): { x: number; y: number }[] => liveOf(l).map(({ x, y }) => ({ x, y }));

/** Whether this people may fire salvos and raise a third silo (#765): it has learned Launch Control. */
export const salvoPeople = (p: Player): boolean => p.techs.includes('launchControl');

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

/**
 * Why this people can raise no more silos (#753: at most `SILO.most`, finished or rising; #765: `SALVO.trio` with Launch Control), or null.
 */
export function siloLimit(s: GameState, owner: number, type: BuildingType): string | null {
  if (type !== 'silo') return null;
  let n = 0;
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'silo' && e.hp > 0) n++;
  const most = salvoPeople(s.players[owner]) ? SALVO.trio : SILO.most;
  if (n < most) return null;
  return most < SALVO.trio ? `A people raises at most ${most} Missile Silos; Launch Control allows a third` : `A people raises at most ${most} Missile Silos`;
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

/** Spend `n` warheads from the people's store; the next starts being made if none was. */
function spend(s: GameState, p: Player, n = 1): void {
  const pool = (p.nukes ??= { n: SILO.stock });
  pool.n -= n;
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
  const id = s.nextId++;
  (s.launches ??= []).push({ id, owner, silo: silo.id, x, y, w: kind, at: s.tick + secs(r.fuse), ...(cleanOf(kind) ? { clean: true } : {}), warn: warningsOf(s, owner, [{ x, y }]) });
  if (r.leak > 0) (s.fallout ??= []).push({ id: s.nextId++, owner, x: silo.x, y: silo.y, r: FISSION.reach, until: s.tick + secs(r.leak) });
  // The event names no warhead: every player is warned of the same ring whatever was sent (`warnRadius`). Its point is the attacker's
  // own aim; a rival's screen draws the launch's rings for its team instead (`ringsFor`).
  s.events.push({ k: 'silo', owner, x, y, id, what: 'launched', fuse: r.fuse, ring: warnRadius(s, owner) });
}

/** A salvo's fuel (#765): three Atomic warheads' worth, and `SALVO.surcharge` more on each for a plain Atomic people. */
export function salvoFuel(p: Player): Cost {
  const k = SALVO.trio * (rulesOf(p).w === 'atomic' ? 1 + SALVO.surcharge : 1);
  const out: Cost = {};
  for (const [r, n] of Object.entries(SILO.fuel) as [keyof Cost, number][]) out[r] = Math.round(n * k);
  return out;
}

/**
 * The silos a salvo ordered from `first` fires from (#765): that one, then the people's other standing silos in id order, `SALVO.trio`
 * in all; fewer when it stands fewer.
 */
export function salvoSilos(s: GameState, owner: number, first?: number): Building[] {
  const all = silosOf(s, owner);
  const lead = all.find((b) => b.id === first);
  return (lead ? [lead, ...all.filter((b) => b !== lead)] : all).slice(0, SALVO.trio);
}

/**
 * Why this people can't fire a salvo now (#765), or null; with `shots`, also whether those silos and points will do: `SALVO.trio` of the
 * people's own standing silos, each once, and as many points, each on the map and at least `SILO.apart` tiles from the others (the same
 * spacing a single strike's decoys keep, so the rings look alike).
 */
export function salvoProblem(s: GameState, owner: number, shots?: { silo: number; x: number; y: number }[]): string | null {
  const p = s.players[owner];
  if (p.epoch < 5) return 'Silos fire only in the Atomic Age';
  if (!salvoPeople(p)) return 'A salvo needs Launch Control, learned at a Missile Silo';
  if (peace(s)) return 'Not while the peace holds';
  const standing = silosOf(s, owner).length;
  if (standing < SALVO.trio) return `A salvo needs ${SALVO.trio} standing Missile Silos: you have ${standing}`;
  if (stockOf(p) < SALVO.trio) {
    const next = nextNuke(s, p);
    return `A salvo takes ${SALVO.trio} warheads from your store: you have ${Math.max(0, stockOf(p))}${next === null ? ', and the rest are in the air' : `, the next in ${Math.max(1, next)}s`}`;
  }
  const fuel = salvoFuel(p);
  if (!canAfford(p, fuel)) return `A salvo's fuel takes ${costText(fuel)}${rulesOf(p).w === 'atomic' ? ` (a plain Atomic people pays ${Math.round(SALVO.surcharge * 100)}% more on each warhead)` : ''}`;
  if (!shots) return null;
  if (!Array.isArray(shots) || shots.length !== SALVO.trio) return `Pick ${SALVO.trio} points`;
  const used = new Set<number>();
  for (const sh of shots) {
    const b = s.byId.get(sh?.silo);
    if (!b || b.kind !== 'building' || b.type !== 'silo' || b.owner !== owner || !b.built || b.hp <= 0 || used.has(b.id)) return `A salvo fires from ${SALVO.trio} of your standing silos, one warhead each`;
    used.add(b.id);
    if (!(sh.x >= 0 && sh.y >= 0 && sh.x < s.w && sh.y < s.h)) return 'Pick points on the map';
  }
  return apartProblem(shots);
}

/** Whether these points keep `SILO.apart` tiles from each other (#765), or why not. */
export function apartProblem(pts: { x: number; y: number }[]): string | null {
  const A = SILO.apart * SILO.apart;
  for (let i = 0; i < pts.length; i++)
    for (let j = 0; j < i; j++) if ((pts[i].x - pts[j].x) * (pts[i].x - pts[j].x) + (pts[i].y - pts[j].y) * (pts[i].y - pts[j].y) < A) return `A salvo's points must lie at least ${SILO.apart} tiles apart`;
  return null;
}

/**
 * Fire a salvo (#765, checked by `salvoProblem`): spend `SALVO.trio` warheads and the salvo's fuel, start the people's one clock, tell the
 * map. To every rival it is one launch, as a single strike is: one record, one event of the same shape (its point the first aim), one
 * clock, three rings. A Fission people poisons the ground round the first silo only, as for any launch, so the poison never counts silos.
 */
export function salvo(s: GameState, owner: number, shots: { silo: number; x: number; y: number }[]): void {
  const p = s.players[owner];
  const r = rulesOf(p);
  spend(s, p, SALVO.trio);
  pay(p, salvoFuel(p));
  const id = s.nextId++;
  const [{ silo, x, y }] = shots;
  const salvo = shots.map((sh) => ({ silo: sh.silo, x: sh.x, y: sh.y }));
  (s.launches ??= []).push({ id, owner, silo, x, y, w: 'atomic', at: s.tick + secs(r.fuse), warn: warningsOf(s, owner, salvo), salvo });
  if (r.leak > 0) {
    const b = s.byId.get(silo)!;
    (s.fallout ??= []).push({ id: s.nextId++, owner, x: b.x, y: b.y, r: FISSION.reach, until: s.tick + secs(r.leak) });
  }
  s.events.push({ k: 'silo', owner, x, y, id, what: 'launched', fuse: r.fuse, ring: warnRadius(s, owner) });
}

/**
 * The rivals' assets the attacker's team knew of at launch (#762), in id order: a building any tile of which its eyes have ever seen,
 * and a land unit out in the open that they see now. Each carries its worth per point of health (its replacement cost over its full
 * health), so what a blast takes is `per × min(health, damage)`: likely losses, overkill not counted.
 */
function scouted(s: GameState, owner: number): { e: Ent; per: number }[] {
  const { seen, vis } = s.players[owner];
  const known = (x: number, y: number, m: Uint8Array): boolean => x >= 0 && y >= 0 && x < s.w && y < s.h && m[y * s.w + x] === 1;
  const out: { e: Ent; per: number }[] = [];
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, owner, e.owner)) continue;
    let cost: Cost;
    if (e.kind === 'building') {
      let saw = false;
      for (let y = e.ty; y < e.ty + e.size && !saw; y++) for (let x = e.tx; x < e.tx + e.size && !saw; x++) saw = known(x, y, seen);
      if (!saw) continue;
      cost = BUILDINGS[e.type].cost;
    } else {
      if (e.inside || domainOf(e.type) !== 'land' || !known(Math.floor(e.x), Math.floor(e.y), vis)) continue;
      cost = statsOf(s, e).cost;
    }
    const worth = Object.values(cost).reduce((n: number, v) => n + (v ?? 0), 0);
    if (worth > 0) out.push({ e, per: worth / maxHp(s, e) });
  }
  return out;
}

/** What a `w` warhead at (x, y) would take from these assets, in replacement cost (#762). */
function lossAt(assets: { e: Ent; per: number }[], w: WarheadKind, x: number, y: number): number {
  let loss = 0;
  const R = WARHEADS[w].r;
  for (const { e, per } of assets) {
    // Far off on either axis (past the blast and a building's half-width): nothing to take.
    const reach = R + (e.kind === 'building' ? e.size / 2 : 0);
    if (e.x - x > reach || x - e.x > reach || e.y - y > reach || y - e.y > reach) continue;
    const d = e.kind === 'building' ? distToRect(x, y, e) : Math.sqrt((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y));
    if (d < R) loss += per * Math.min(e.hp, blastDamage(w, d));
  }
  return loss;
}

/** The centre of the tile (x, y) stands on: every ring sits on one, so a click's fractions never single out the real ring. */
const tileOf = (v: number): number => Math.floor(v) + 0.5;

/**
 * One decoy point (#762), at least `SILO.apart` tiles from every point already taken. In order, until one is found:
 * 1. a point drawn from `pool` (the tiles of the rival assets the attacker knew of, with what a strike there would take), weighted by that
 *    loss, so a decoy falls where a real attacker might aim: rarely the same two, never always the richest;
 * 2. any tile of an asset it knew of that a strike would take nothing from (a sparse town: drawn evenly);
 * 3. up to 12 even draws within `SILO.spread` tiles of the target, kept on the map;
 * 4. the first compass point `SILO.apart` tiles off the target, from a drawn start, that lies on the map and clear of the others;
 * 5. the corner of the map (inset by `SILO.apart` / 2) farthest from the points taken. Never off the map.
 */
function decoy(s: GameState, pool: { x: number; y: number; v: number }[], taken: { x: number; y: number }[]): { x: number; y: number } {
  const A = SILO.apart * SILO.apart;
  const clear = (x: number, y: number): boolean => taken.every((t) => (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y) >= A);
  const free = pool.filter((c) => clear(c.x, c.y));
  const total = free.reduce((n, c) => n + c.v, 0);
  if (total > 0) {
    let r = roll(s) * total;
    for (const c of free) {
      if (c.v <= 0) continue;
      r -= c.v;
      if (r < 0) return c;
    }
    return free.filter((c) => c.v > 0).pop()!;
  }
  if (free.length) return free[Math.min(free.length - 1, Math.floor(roll(s) * free.length))];
  const [t] = taken;
  const onMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < s.w && y < s.h;
  for (let k = 0; k < 12; k++) {
    const x = tileOf(t.x + (roll(s) * 2 - 1) * SILO.spread), y = tileOf(t.y + (roll(s) * 2 - 1) * SILO.spread);
    if (onMap(x, y) && clear(x, y)) return { x, y };
  }
  const start = Math.floor(roll(s) * DIRS.length);
  for (let k = 0; k < DIRS.length; k++) {
    const [dx, dy] = DIRS[(start + k) % DIRS.length];
    const x = tileOf(t.x + dx * SILO.apart * 1.5), y = tileOf(t.y + dy * SILO.apart * 1.5);
    if (onMap(x, y) && clear(x, y)) return { x, y };
  }
  const m = Math.floor(SILO.apart / 2);
  const corners = [[m, m], [s.w - 1 - m, m], [m, s.h - 1 - m], [s.w - 1 - m, s.h - 1 - m]].map(([x, y]) => ({ x: tileOf(Math.max(0, Math.min(s.w - 1, x))), y: tileOf(Math.max(0, Math.min(s.h - 1, y))) }));
  const near = (c: { x: number; y: number }): number => Math.min(...taken.map((p) => (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y)));
  return corners.reduce((a, b) => (near(b) > near(a) ? b : a));
}

/** A ring's centre: the point's tile moved a whole number of tiles, up to `SILO.blur`, on each axis, kept on the map (#762). */
function blur(s: GameState, p: { x: number; y: number }): { x: number; y: number } {
  const b = SILO.blur;
  const ox = Math.floor(roll(s) * (2 * b + 1)) - b, oy = Math.floor(roll(s) * (2 * b + 1)) - b;
  return { x: Math.max(0.5, Math.min(s.w - 0.5, tileOf(p.x) + ox)), y: Math.max(0.5, Math.min(s.h - 0.5, tileOf(p.y) + oy)) };
}

/**
 * The warnings for a launch at `aims` (#762), drawn once, at launch, from the match's own dice, and frozen on the launch. Each rival team,
 * in team order, gets its own set so allies cannot lay theirs side by side: for a single strike two decoys (`decoy`, from every rival
 * asset the attacker had scouted, valued with the people's widest warhead so the draw never says which is coming), then all three rings
 * blurred alike (the real one first, then the decoys in the order drawn), then shuffled. Every ring follows one rule, so none stands out.
 * A salvo (#765) has three aims and no decoys: its three rings are blurred and shuffled by the same rule, each remembering its warhead.
 */
export function warningsOf(s: GameState, owner: number, aims: { x: number; y: number }[]): Warning[] {
  const w = widestOf(s, owner);
  const assets = scouted(s, owner);
  const pool: { x: number; y: number; v: number }[] = [];
  const at = new Set<number>();
  for (const { e } of assets) {
    const px = tileOf(e.x), py = tileOf(e.y);
    const key = Math.floor(py) * s.w + Math.floor(px);
    if (at.has(key)) continue;
    at.add(key);
    pool.push({ x: px, y: py, v: lossAt(assets, w, px, py) });
  }
  const teams = [...new Set(s.players.filter((p) => isEnemy(s, owner, p.id)).map((p) => p.team))].sort((a, b) => a - b);
  return teams.map((team) => {
    const taken = aims.map(({ x, y }) => ({ x, y }));
    while (taken.length < SALVO.trio) taken.push(decoy(s, pool, taken));
    const rings = taken.map((p) => blur(s, p));
    // `of[i]` is the point ring i was drawn from: the aims first, then the decoys.
    const of = rings.map((_, i) => i);
    for (let i = rings.length - 1; i > 0; i--) {
      const j = Math.floor(roll(s) * (i + 1));
      [rings[i], rings[j]] = [rings[j], rings[i]];
      [of[i], of[j]] = [of[j], of[i]];
    }
    return { team, rings, real: of.indexOf(0), ...(aims.length > 1 ? { of } : {}) };
  });
}

/**
 * Whether a launch has reached its last `SILO.reveal` seconds, when its decoys vanish (#762): true from the end of the tick `siloStep`
 * runs with exactly that much left (the tick of the `revealed` event), as a warhead strikes on the tick its clock reaches `at`.
 */
export const revealed = (s: GameState, l: { at: number }): boolean => s.tick > l.at - secs(SILO.reveal);

/**
 * The rings `viewer` is shown for a launch (#762): its own team's aim (a salvo's live aims), unblurred; a rival team's three rings, or after
 * the reveal only the real one, where it was drawn (it never snaps to the true point). A salvo's rings (#765) are all real: each stays at
 * the reveal, and each goes the moment its silo falls. A launch from an older save shows the true point to all.
 */
export function ringsFor(s: GameState, l: Launch, viewer: number): { x: number; y: number }[] {
  const set = s.players[viewer].team === s.players[l.owner].team ? undefined : l.warn?.find((w) => w.team === s.players[viewer].team);
  if (!set) return aimsOf(l);
  if (set.of && l.salvo) return set.rings.filter((_, i) => !l.salvo![set.of![i]]?.gone);
  return revealed(s, l) ? [set.rings[set.real]] : set.rings;
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
function strike(s: GameState, l: Launch, x: number, y: number): void {
  const { owner } = l;
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

/**
 * Every tick, in the order they were launched: a warhead whose silo has fallen is scrubbed (a salvo's one at a time, in its order: the rest
 * fly on, #765); one whose clock has run out lands, a salvo's on each of its true points.
 */
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
  const fallen = (id: number): boolean => {
    const b = s.byId.get(id);
    return !b || b.kind !== 'building' || b.hp <= 0;
  };
  for (const l of s.launches) {
    let lost = false;
    if (l.salvo) {
      for (const sh of l.salvo) {
        if (sh.gone || !fallen(sh.silo)) continue;
        sh.gone = true;
        s.events.push({ k: 'silo', owner: l.owner, x: sh.x, y: sh.y, id: l.id, what: 'scrubbed' });
      }
      lost = l.salvo.every((sh) => sh.gone);
    } else if (fallen(l.silo)) {
      s.events.push({ k: 'silo', owner: l.owner, x: l.x, y: l.y, id: l.id, what: 'scrubbed' });
      lost = true;
    }
    if (lost) continue;
    if (s.tick >= l.at) for (const p of aimsOf(l)) strike(s, l, p.x, p.y);
    else {
      // Exactly `SILO.reveal` seconds left (#762): the decoys vanish, the real ring flashes where it was drawn, one alarm sounds.
      if (s.tick === l.at - secs(SILO.reveal)) s.events.push({ k: 'silo', owner: l.owner, x: l.x, y: l.y, id: l.id, what: 'revealed' });
      left.push(l);
    }
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
