import { HOUSEHOLD, SICKNESS, secs } from './data';
import { homes, street } from './household';
import { seasonAt } from './seasons';
import { isMobile } from './steppe';
import { hash2 } from './rng';
import type { GameState, Player, TradePost } from './types';

/**
 * The Sickness (#541): what a crowded, thick-streeted town pays for its size. A town builds taint when its houses are full and its
 * people many (and a street of houses shoulder to shoulder builds it faster); at 1 the Sickness breaks. It slows every citizen's work,
 * kills some when it runs hot, is nursed down by priests standing at a Temple, and spreads by the trade roads: a sick people's trader
 * leaves its post foul, and a trader of any people loading at a foul post carries the taint home. Quarantine keeps the traders home.
 * All numbers are in `SICKNESS`. Everything here is the tick and the seed (`hash2`), so no dice are rolled.
 */

/** Whether this people can fall sick yet: past the Stone Age, not beaten, and not in a campaign chapter (those stay as they were made). */
const open = (s: GameState, p: Player): boolean => !s.scenario && !p.defeated && p.epoch >= SICKNESS.fromEpoch;

/** How full the town is, how big, and how close its houses stand: three 0-to-1 readings the pressure is made of. */
export function readings(s: GameState, p: Player): { full: number; big: number; dense: number } {
  const full = p.cap > 0 ? Math.max(0, (Math.min(1, p.pop / p.cap) - SICKNESS.crowdAt) / (1 - SICKNESS.crowdAt)) : 0;
  const big = Math.max(0, Math.min(1, (p.pop - SICKNESS.bigFrom) / SICKNESS.bigSpan));
  const { houses, markets } = homes(s, p.id);
  let sum = 0;
  for (const h of houses) sum += street(h, houses, markets);
  const dense = houses.length ? sum / (houses.length * HOUSEHOLD.streetMax) : 0;
  return { full, big, dense };
}

/** The pressure on a town now, 0 to 1: what builds its taint. Zero below `minPop` people. */
export function pressure(s: GameState, p: Player): number {
  if (!open(s, p) || p.pop < SICKNESS.minPop) return 0;
  const r = readings(s, p);
  return (0.5 * r.full + 0.5 * r.big) * (SICKNESS.loose + (1 - SICKNESS.loose) * r.dense);
}

/** Finished Temples of a player, in id order. */
function temples(s: GameState, owner: number) {
  return s.ents.filter((e) => e.kind === 'building' && e.owner === owner && e.type === 'temple' && e.built && e.hp > 0);
}

/** How many priests are nursing the sick now: at a finished Temple (inside it, or within `tendReach` tiles), hands free of a relic, at most `tendMost`. */
export function tenders(s: GameState, owner: number): number {
  const ts = temples(s, owner);
  if (!ts.length) return 0;
  const reach = SICKNESS.tendReach * SICKNESS.tendReach;
  let n = 0;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.owner !== owner || u.type !== 'priest' || u.hp <= 0) continue;
    if (s.relics.some((r) => r.carrier === u.id)) continue;
    if (ts.some((t) => u.inside === t.id || (t.x - u.x) * (t.x - u.x) + (t.y - u.y) * (t.y - u.y) <= reach)) n++;
    if (n >= SICKNESS.tendMost) break;
  }
  return n;
}

/** The share of its pace a sick town's citizens work at now: 1 when well. */
export function workShare(s: GameState, owner: number): number {
  const f = s.players[owner]?.fever;
  return f ? 1 - f.sev * SICKNESS.slow : 1;
}

/** Whether a post is foul now. */
export const foulNow = (s: GameState, post: TradePost): boolean => (post.foul ?? 0) > s.tick;

/**
 * A trader of `owner` is loading at `post`. A sick town's trader leaves the post foul; at a foul post a trader of a town not keeping
 * quarantine brings taint home. Returns false if quarantine keeps this trader from loading at all.
 */
export function loadAt(s: GameState, owner: number, post: TradePost): boolean {
  const p = s.players[owner];
  if (!p || !open(s, p)) return true;
  if (p.quarantine) return false;
  if (foulNow(s, post) && !p.fever) addTaint(s, p, SICKNESS.import);
  if (p.fever) post.foul = s.tick + secs(SICKNESS.foul);
  return true;
}

function addTaint(s: GameState, p: Player, by: number): void {
  p.taint = Math.min(1, (p.taint ?? 0) + by);
  if (p.taint >= 1 && !p.fever) breakOut(s, p);
}

function breakOut(s: GameState, p: Player): void {
  p.fever = { sev: SICKNESS.start, since: s.tick };
  p.taint = SICKNESS.after;
  s.events.push({ k: 'sick', owner: p.id, what: 'broke' });
}

/** Citizens the fever takes: `hash2` picks them from those not sheltering, in id order. */
function take(s: GameState, p: Player, n: number): number {
  const ids: number[] = [];
  for (const u of s.ents) if (u.kind === 'unit' && u.owner === p.id && u.type === 'citizen' && u.hp > 0 && !u.inside) ids.push(u.id);
  let died = 0;
  for (let k = 0; k < n && ids.length > 1; k++) {
    const i = Math.floor(hash2(s.seed + p.id, s.tick, 541 + k) * ids.length);
    const u = s.byId.get(ids[i]);
    ids.splice(i, 1);
    if (u && u.kind === 'unit') {
      u.hp = 0;
      died++;
    }
  }
  return died;
}

/** One step for every town, each `SICKNESS.every` seconds. */
export function sickStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(SICKNESS.every) !== 0) return;
  const dt = SICKNESS.every;
  for (const p of s.players) {
    if (!open(s, p)) continue;
    const press = pressure(s, p);
    if (p.fever) {
      const f = p.fever;
      f.sev += (press > SICKNESS.feedAt ? SICKNESS.feed * press : 0) * dt;
      f.sev -= (SICKNESS.wane + (p.quarantine ? SICKNESS.quarantineWane : 0) + SICKNESS.tend * tenders(s, p.id)) * dt;
      if (f.sev <= 0) {
        delete p.fever;
        s.events.push({ k: 'sick', owner: p.id, what: 'ended' });
        continue;
      }
      f.sev = Math.min(1, f.sev);
      if (f.sev >= SICKNESS.deadly && (s.tick - f.since) % secs(SICKNESS.die) < secs(SICKNESS.every)) {
        const died = take(s, p, 1 + Math.floor((f.sev - SICKNESS.deadly) / SICKNESS.dieStep));
        if (died) s.events.push({ k: 'sick', owner: p.id, what: 'died', n: died });
      }
      continue;
    }
    const temple = 1 - Math.min(SICKNESS.templeMost, temples(s, p.id).length) * SICKNESS.temple;
    const rate = press * SICKNESS.crowd * SICKNESS.season[seasonAt(s)] * temple * (isMobile(p) ? SICKNESS.nomad : 1);
    const taint = Math.max(0, (p.taint ?? 0) + (rate - SICKNESS.calm) * dt);
    if (taint > 0) p.taint = Math.min(1, taint);
    else delete p.taint;
    if ((p.taint ?? 0) >= 1) breakOut(s, p);
  }
}
