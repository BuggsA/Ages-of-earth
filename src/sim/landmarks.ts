import { LANDMARKS, domainOf, secs } from './data';
import { maxHp } from './world';
import type { GameState, Landmark, LandmarkKind } from './types';

/**
 * Contested landmarks: a sacred spring, a lookout crag and an ancestors' cairn, out on the open ground
 * between the towns. Nobody builds them and nobody can break them: they belong to whichever side's people
 * stand round one, alone, long enough, and stay theirs until a rival does the same. A keeper holds the
 * land round it and gets what the place gives. So the Stone Age has somewhere worth walking to, and
 * something worth a fight before either side has an army.
 */

export const LANDMARK_KINDS: Record<LandmarkKind, { name: string; blurb: string }> = {
  spring: { name: 'Sacred Spring', blurb: `Its keeper's people within ${LANDMARKS.spring.reach} tiles mend as they rest: a place to stage a raid from, or to bring the wounded.` },
  crag: { name: 'Lookout Crag', blurb: `Its keeper sees everything within ${LANDMARKS.crag.sight} tiles: who walks the land between the towns.` },
  cairn: { name: "Ancestors' Cairn", blurb: `Its keeper has room for ${LANDMARKS.cairn.pop} more people, as if they had built a house or two.` },
};

export function landmarkAt(s: GameState, id: number): Landmark | undefined {
  return s.landmarks?.find((m) => m.id === id);
}

/** Ticks of one person's claiming that take a landmark nobody keeps (or pull a held one down to nobody's). */
export function claimWork(): number {
  return secs(LANDMARKS.claim);
}

/** The landmarks a player keeps of a kind. */
export function keptOf(s: GameState, player: number, kind: LandmarkKind): number {
  let n = 0;
  for (const m of s.landmarks ?? []) if (m.owner === player && m.kind === kind) n++;
  return n;
}

/** Who stands round a landmark: for each team there, how many (land units, traders aside) and its lowest-id player. */
export function claimants(s: GameState, m: Landmark): Map<number, { n: number; player: number }> {
  const out = new Map<number, { n: number; player: number }>();
  const r2 = LANDMARKS.reach * LANDMARKS.reach;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || e.type === 'trader' || domainOf(e.type) !== 'land') continue;
    const dx = e.x - m.x;
    const dy = e.y - m.y;
    if (dx * dx + dy * dy > r2) continue;
    const team = s.players[e.owner].team;
    const have = out.get(team);
    if (have) have.n++;
    else out.set(team, { n: 1, player: e.owner });
  }
  return out;
}

/** One tick of claiming at one landmark. */
function claimStep(s: GameState, m: Landmark): void {
  const there = claimants(s, m);
  // Nobody there, or two sides face to face: nothing moves.
  if (there.size !== 1) return;
  const [team, { n, player }] = [...there][0];
  const pace = Math.min(n, LANDMARKS.crowd);
  const full = claimWork();
  if (m.owner >= 0) {
    if (s.players[m.owner].team === team) {
      m.claim = Math.min(full, m.claim + pace);
      return;
    }
    // A treaty keeps what is held.
    if (s.tick < s.peaceUntil) return;
    if (m.claim >= full) s.events.push({ k: 'landmarkThreat', id: m.id, kind: m.kind, owner: m.owner, x: m.x, y: m.y });
    m.claim -= pace;
    if (m.claim > 0) return;
    const from = m.owner;
    m.owner = -1;
    m.claim = 0;
    m.by = -1;
    s.events.push({ k: 'landmark', id: m.id, kind: m.kind, owner: -1, from, x: m.x, y: m.y });
    return;
  }
  // Nobody keeps it: a new side's claim starts from nothing.
  if (m.by < 0 || s.players[m.by].team !== team) {
    m.by = player;
    m.claim = 0;
  }
  m.claim += pace;
  if (m.claim < full) return;
  m.owner = m.by;
  m.claim = full;
  m.by = -1;
  s.events.push({ k: 'landmark', id: m.id, kind: m.kind, owner: m.owner, from: -1, x: m.x, y: m.y });
}

/** The Sacred Spring mends its keeper's people near it. */
function springStep(s: GameState, m: Landmark): void {
  if (m.owner < 0 || s.tick % secs(LANDMARKS.spring.every) !== 0) return;
  const r2 = LANDMARKS.spring.reach * LANDMARKS.spring.reach;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || e.owner !== m.owner || domainOf(e.type) !== 'land') continue;
    const dx = e.x - m.x;
    const dy = e.y - m.y;
    if (dx * dx + dy * dy > r2) continue;
    const top = maxHp(s, e);
    if (e.hp >= top) continue;
    e.hp = Math.min(top, e.hp + top * LANDMARKS.spring.heal);
    if (s.tick % secs(LANDMARKS.spring.every * 3) === 0) s.events.push({ k: 'healed', id: e.id, x: e.x, y: e.y });
  }
}

/** Every tick: the claims at each landmark, and what the springs give. A defeated keeper lets go. */
export function landmarkStep(s: GameState): void {
  if (!s.landmarks) return;
  for (const m of s.landmarks) {
    if (m.owner >= 0 && s.players[m.owner].defeated) {
      const from = m.owner;
      m.owner = -1;
      m.claim = 0;
      s.events.push({ k: 'landmark', id: m.id, kind: m.kind, owner: -1, from, x: m.x, y: m.y });
    }
    claimStep(s, m);
    if (m.kind === 'spring') springStep(s, m);
  }
}
