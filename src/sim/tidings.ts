import { TIDINGS, secs } from './data';
import { hash2 } from './rng';
import type { Cost, GameState, Player, TidingId, Unit } from './types';
import { RES } from './types';
import { canAfford, exitSpot, pay, spawnUnit, townCenters } from './world';

/**
 * Tidings at the fire (#443): twice in the Stone Age a card comes to each people with a choice that costs
 * something, so two games don't run the same. A traveller asks to stay, a hunter offers a trade, a stranger
 * knows where a camp lies, a storm or a fever gathers. Answer it (a command, so an online match plays it
 * the same on every screen) or let it fade, which is the do-nothing answer: for a storm or a fever that
 * means taking your chances.
 *
 * Which card comes, when, and how a gamble falls are hashes of the seed, the people and the draw: no
 * dice are rolled, so nothing else in the match moves when a card comes. The only state is the card
 * waiting on an answer (`Player.tiding`).
 */

export const TIDING_IDS: TidingId[] = ['traveller', 'hunter', 'tale', 'storm', 'fever'];

export const TIDING_CARDS: Record<TidingId, { icon: string; name: string; text: string; take: string; pass: string }> = {
  traveller: { icon: '🧳', name: 'A lone traveller', text: 'A traveller walks in out of the dusk and asks to sit by your fire.', take: 'Take them in', pass: 'Send them on' },
  hunter: { icon: '🦌', name: 'A hunter\'s trade', text: 'A hunter from over the hills has more meat than he can carry, and no wood for his fire.', take: 'Trade', pass: 'Decline' },
  tale: { icon: '🗣️', name: 'A stranger\'s tale', text: 'A stranger says she has seen something out in the wild, and she is hungry.', take: 'Feed her', pass: 'Send her away' },
  storm: { icon: '⛈️', name: 'A storm gathers', text: 'The sky goes dark in the west. The old ones say the huts won\'t hold.', take: 'Shore up the huts', pass: 'Chance it' },
  fever: { icon: '🤒', name: 'Fever in the camp', text: 'A fever has come into the camp. The sick need food and rest.', take: 'Tend the sick', pass: 'Let it run' },
};

/** What paying a card costs. */
export function tidingCost(card: TidingId): Cost {
  return TIDINGS[card].cost;
}

/** The tick draw `draw` comes to player `p`. */
export function drawTick(s: GameState, p: number, draw: number): number {
  return secs(TIDINGS.at[draw]) + Math.floor(hash2(s.seed, p * 4 + draw, 443) * secs(TIDINGS.jitter));
}

/** Whether a passed gamble strikes, the seed's call. */
function strikes(s: GameState, p: number, draw: number, odds: number): boolean {
  return hash2(s.seed, p * 4 + draw, 4431) < odds;
}

/** The place a stranger's tale tells of: the nearest raider camp still manned, else an undug ruin, else a cave. */
export function taleOf(s: GameState, p: Player): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const consider = (x: number, y: number) => {
    const d = (x - p.startX) * (x - p.startX) + (y - p.startY) * (y - p.startY);
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  };
  for (const a of s.animals) if (a.kind === 'raider' && a.hp > 0) consider(a.homeX, a.homeY);
  if (best) return best;
  for (const r of s.ruins ?? []) if (r.by < 0) consider(r.x, r.y);
  if (best) return best;
  for (const c of s.caves ?? []) consider((c.tile % s.w) + 0.5, Math.floor(c.tile / s.w) + 0.5);
  return best;
}

function houses(s: GameState, owner: number) {
  return s.ents.filter((e) => e.kind === 'building' && e.owner === owner && e.type === 'house' && e.built && e.hp > 0);
}

/** Whether a card can come to this people now: a tale needs something to tell of, a storm houses to blow down. */
function fits(s: GameState, p: Player, card: TidingId): boolean {
  if (card === 'tale') return !!taleOf(s, p);
  if (card === 'storm') return houses(s, p.id).length > 0;
  if (card === 'traveller') return townCenters(s, p.id).some((b) => b.built);
  return true;
}

/** Which card draw `draw` deals this people: the seed picks, never one it has had, and one that doesn't fit gives way to the next. */
export function cardFor(s: GameState, p: Player, draw: number): TidingId | null {
  const n = TIDING_IDS.length;
  const start = Math.floor(hash2(s.seed, p.id * 4 + draw, 4432) * n);
  for (let i = 0; i < n; i++) {
    const card = TIDING_IDS[(start + i) % n];
    if (p.told?.includes(card)) continue;
    if (fits(s, p, card)) return card;
  }
  return null;
}

/** Why `p` can't pay for its waiting card now, or null. */
export function tidingProblem(s: GameState, p: Player, card: TidingId): string | null {
  if (p.tiding?.card !== card) return 'No such tidings wait at your fire';
  if (!canAfford(p, tidingCost(card))) return 'Not enough resources';
  if (card === 'traveller') {
    if (!townCenters(s, p.id).some((b) => b.built)) return 'No fire to take them to';
    if (p.pop >= p.cap) return 'Build more houses';
  }
  return null;
}

function home(s: GameState, p: Player): { x: number; y: number } {
  const tc = townCenters(s, p.id).find((b) => b.built);
  return tc ? { x: tc.x, y: tc.y } : { x: p.startX, y: p.startY };
}

/** Pay for the waiting card and take what it brings. */
function take(s: GameState, p: Player, card: TidingId): void {
  pay(p, tidingCost(card));
  const at = home(s, p);
  if (card === 'traveller') {
    const tc = townCenters(s, p.id).find((b) => b.built)!;
    const spot = exitSpot(s, tc, s.w / 2, s.h / 2);
    spawnUnit(s, p.id, 'citizen', spot.x, spot.y);
    p.pop++;
  } else if (card === 'hunter') {
    p.res.food += TIDINGS.hunter.food;
    p.stats.gathered += TIDINGS.hunter.food;
  } else if (card === 'tale') {
    const t = taleOf(s, p);
    if (t) {
      const r = TIDINGS.tale.reveal;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = Math.floor(t.x) + dx;
        const y = Math.floor(t.y) + dy;
        if (x >= 0 && y >= 0 && x < s.w && y < s.h) p.seen[y * s.w + x] = 1;
      }
      s.events.push({ k: 'tiding', owner: p.id, card, how: 'took', x: t.x, y: t.y });
      return;
    }
  }
  s.events.push({ k: 'tiding', owner: p.id, card, how: 'took', x: at.x, y: at.y });
}

/** Pass the waiting card by; a storm or a fever then strikes or spares, as the seed has it. */
function pass(s: GameState, p: Player, card: TidingId, draw: number): void {
  const at = home(s, p);
  s.events.push({ k: 'tiding', owner: p.id, card, how: 'passed', x: at.x, y: at.y });
  if (card === 'storm') {
    if (!strikes(s, p.id, draw, TIDINGS.storm.odds)) return void s.events.push({ k: 'tiding', owner: p.id, card, how: 'spared', x: at.x, y: at.y });
    const hit = houses(s, p.id);
    for (const h of hit) h.hp = Math.max(1, h.hp - Math.ceil(h.hp * TIDINGS.storm.harm));
    s.events.push({ k: 'tiding', owner: p.id, card, how: 'struck', n: hit.length, x: at.x, y: at.y });
  } else if (card === 'fever') {
    if (!strikes(s, p.id, draw, TIDINGS.fever.odds)) return void s.events.push({ k: 'tiding', owner: p.id, card, how: 'spared', x: at.x, y: at.y });
    // The newest citizen, who had the least time to grow hardy; none sheltering is spared.
    let sick: Unit | null = null;
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === p.id && e.type === 'citizen' && e.hp > 0 && !e.inside) sick = e;
    if (sick) sick.hp = 0;
    s.events.push({ k: 'tiding', owner: p.id, card, how: sick ? 'struck' : 'spared', n: sick ? 1 : 0, x: sick?.x ?? at.x, y: sick?.y ?? at.y });
  }
}

/** The answer to a card, from the `tiding` command. */
export function answerTiding(s: GameState, p: Player, card: TidingId, yes: boolean): void {
  const t = p.tiding!;
  delete p.tiding;
  if (yes) take(s, p, card);
  else pass(s, p, card, t.draw);
}

/** Each tick: deal a card when its draw comes, and let one that has waited too long pass. */
export function tidingStep(s: GameState): void {
  if (s.scenario) return;
  for (const p of s.players) {
    if (p.defeated) continue;
    if (p.tiding) {
      if (s.tick >= p.tiding.until) answerTiding(s, p, p.tiding.card, false);
      continue;
    }
    // Stone Age only: a people that has moved on has other things to hear of.
    if (p.epoch !== 0) continue;
    for (let draw = 0; draw < TIDINGS.at.length; draw++) {
      if (s.tick !== drawTick(s, p.id, draw)) continue;
      const card = cardFor(s, p, draw);
      if (!card) continue;
      p.tiding = { card, draw, until: s.tick + secs(TIDINGS.fade) };
      (p.told ??= []).push(card);
      const at = home(s, p);
      s.events.push({ k: 'tiding', owner: p.id, card, how: 'come', x: at.x, y: at.y });
    }
  }
}

/**
 * The computer's answer (#443), one simple rule a card: pay once what it costs leaves `aiFloor` of that
 * resource behind (and, for a traveller, there's room for one more). Short of that it waits, and if it is
 * still short when the card fades, the card passes. Null while there's nothing to say yet.
 */
export function aiTiding(s: GameState, p: Player): { card: TidingId; take: boolean } | null {
  const t = p.tiding;
  if (!t) return null;
  // The hunter's trade only when wood is the plenty and food the want.
  if (t.card === 'hunter' && p.res.food >= p.res.wood + 100) return { card: t.card, take: false };
  const cost = tidingCost(t.card);
  const rich = RES.every((r) => !cost[r] || p.res[r] - cost[r]! >= TIDINGS[t.card].aiFloor);
  return rich && !tidingProblem(s, p, t.card) ? { card: t.card, take: true } : null;
}
