import { BATTLE, BUILDINGS, secs } from './data';
import { asleep } from './ages';
import { damageOf, peace } from './combat';
import { gunPower } from './stats';
import type { Building, GameState, Unit } from './types';
import { canHit, isEnemy, statsOf } from './world';
import { sees, seesRect } from './vision';

/**
 * The tide of battle (#606): a read of each fight one player can see, for the HUD. It changes nothing in the
 * state. Foes are counted only where the player sees them, so an army waiting behind the hill stays a surprise.
 */

export interface Battle {
  /** The fight's middle, in tiles. */
  x: number;
  y: number;
  /** The player's side's share of the two sides' strength: 1 is all theirs, 0 all the foe's. */
  share: number;
  /** The player's own fighters there, in id order (to pick them up with one click). */
  ours: number[];
  /** Fighters counted on each side, towers included. */
  mine: number;
  theirs: number;
  /** The foe with the most fighters there (the lowest id on a tie), for the bar's colour. */
  foe: number;
}

export type TideWord = 'crushing' | 'winning' | 'even' | 'losing' | 'routed';

export function tideWord(share: number): TideWord {
  return share >= BATTLE.crushing ? 'crushing' : share >= BATTLE.winning ? 'winning' : share >= BATTLE.even ? 'even' : share >= BATTLE.losing ? 'losing' : 'routed';
}

type Fighter = Unit | Building;

const armed = (s: GameState, e: Fighter) => (e.kind === 'unit' ? statsOf(s, e).attack > 0 : !!BUILDINGS[e.type].guns && e.built);

/** Damage a second one fighter deals another, counters and armour counted (a tower's volley counts its garrison's arrows). */
function dps(s: GameState, a: Fighter, t: Fighter): number {
  if (a.kind === 'unit') {
    if (!canHit(s, a, t)) return 0;
    const st = statsOf(s, a);
    return damageOf(s, a, st, t, st.range > 0) / st.reload;
  }
  const g = BUILDINGS[a.type].guns;
  if (!g || t.kind !== 'unit' || asleep(s, a)) return 0;
  const power = gunPower(s, a.owner, a.type, a.level);
  return (Math.max(1, power - statsOf(s, t).parmor) * (1 + Math.min(10, a.garrison.length))) / g.reload;
}

/** At most `BATTLE.most` of a list, picked at an even stride, so a vast melee costs no more than a large one. */
function sample<T>(list: T[]): T[] {
  if (list.length <= BATTLE.most) return list;
  const out: T[] = [];
  for (let i = 0; i < BATTLE.most; i++) out.push(list[Math.floor((i * list.length) / BATTLE.most)]);
  return out;
}

/** A side's strength against the other: its hit points times its damage a second (Lanchester's square law). */
function strength(s: GameState, side: Fighter[], foes: Fighter[]): number {
  if (!side.length || !foes.length) return 0;
  const hitters = sample(side);
  const targets = sample(foes);
  let hp = 0;
  for (const a of side) hp += a.hp;
  let d = 0;
  for (const a of hitters) {
    let sum = 0;
    for (const t of targets) sum += dps(s, a, t);
    d += sum / targets.length;
  }
  return hp * d * (side.length / hitters.length);
}

/** Every fight `viewer`'s side is in that `viewer` can see, in the order they were found (unit id order). */
export function battlesFor(s: GameState, viewer: number): Battle[] {
  if (peace(s) || !s.players[viewer]) return [];
  const team = s.players[viewer].team;
  const recent = secs(BATTLE.recent);
  const ours: Fighter[] = [];
  const foes: Fighter[] = [];
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    if (e.kind === 'unit') {
      if (e.inside || !armed(s, e)) continue;
    } else if (e.kind !== 'building' || !armed(s, e)) continue;
    if (s.players[e.owner].team === team) ours.push(e);
    else if (isEnemy(s, viewer, e.owner) && (e.kind === 'unit' ? sees(s, viewer, e.x, e.y) : seesRect(s, viewer, e.tx, e.ty, e.size))) foes.push(e);
  }
  if (!ours.length || !foes.length) return [];

  const near2 = BATTLE.near * BATTLE.near;
  const close = (u: Unit, other: Fighter[]) => other.some((o) => (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y) <= near2);
  const busy = (u: Fighter): u is Unit => u.kind === 'unit' && (s.tick - u.hurt <= recent || s.tick - u.swing <= recent);
  // The sparks of each fight, in id order so the read is the same every time.
  const sparks: Unit[] = [];
  for (const u of ours) if (busy(u) && close(u, foes)) sparks.push(u);
  for (const u of foes) if (busy(u) && close(u, ours)) sparks.push(u);
  sparks.sort((a, b) => a.id - b.id);

  const join2 = BATTLE.join * BATTLE.join;
  const groups: { x: number; y: number; n: number }[] = [];
  for (const u of sparks) {
    const g = groups.find((c) => (c.x - u.x) * (c.x - u.x) + (c.y - u.y) * (c.y - u.y) <= join2);
    if (g) {
      g.x += (u.x - g.x) / (g.n + 1);
      g.y += (u.y - g.y) / (g.n + 1);
      g.n++;
    } else groups.push({ x: u.x, y: u.y, n: 1 });
  }

  const reach2 = BATTLE.reach * BATTLE.reach;
  // Citizens at work beside a fight aren't in it until they strike or are struck.
  const fighting = (e: Fighter) => e.kind !== 'unit' || e.type !== 'citizen' || busy(e);
  const within = (list: Fighter[], g: { x: number; y: number }) => list.filter((e) => fighting(e) && (e.x - g.x) * (e.x - g.x) + (e.y - g.y) * (e.y - g.y) <= reach2);
  const out: Battle[] = [];
  for (const g of groups) {
    const a = within(ours, g);
    const b = within(foes, g);
    if (!a.length || !b.length) continue;
    const sa = strength(s, a, b);
    const sb = strength(s, b, a);
    const count = new Map<number, number>();
    for (const e of b) count.set(e.owner, (count.get(e.owner) ?? 0) + 1);
    let foe = b[0].owner;
    for (const [o, n] of count) if (n > count.get(foe)! || (n === count.get(foe) && o < foe)) foe = o;
    out.push({
      x: g.x,
      y: g.y,
      share: sa + sb > 0 ? sa / (sa + sb) : 0.5,
      ours: a.filter((e): e is Unit => e.kind === 'unit' && e.owner === viewer).map((e) => e.id),
      mine: a.length,
      theirs: b.length,
      foe,
    });
  }
  return out;
}
