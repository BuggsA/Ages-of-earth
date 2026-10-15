import { LANDMARKS, domainOf, secs } from './data';
import { maxHp } from './world';
import type { GameState, Landmark, LandmarkKind, Unit } from './types';

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
  grove: { name: 'Sacred Grove', blurb: `Its keeper's priests chant ${LANDMARKS.grove.priest} times as fast within ${LANDMARKS.grove.reach} tiles of it: turn a rival's soldiers, or mend your own, here.` },
  ford: { name: 'Old Ford', blurb: `A crossing the whole country knows: its keeper's soldiers march ${Math.round((LANDMARKS.ford.march - 1) * 100)}% faster, wherever they go. Citizens and traders walk as before.` },
  flint: { name: 'Flint Scatter', blurb: `Good knapping stone lies here: its keeper's citizens chop and mine ${Math.round((LANDMARKS.flint.tools - 1) * 100)}% faster, wherever they work.` },
};

export function landmarkAt(s: GameState, id: number): Landmark | undefined {
  return s.landmarks?.find((m) => m.id === id);
}

/** Ticks of one person's claiming that take a landmark nobody keeps (or pull a held one down to nobody's). */
export function claimWork(): number {
  return secs(LANDMARKS.claim);
}

/** Whether a landmark kind is the one a player's people favour (`LANDMARKS.kin`). */
export function favours(s: GameState, player: number, kind: LandmarkKind): boolean {
  return LANDMARKS.kin[s.players[player].civ] === kind;
}

/** A landmark's bonus part (the `1.8` of 1.8x is `0.8`) grows by `kinMul` for the people who favour that kind. */
export function kinBonus(s: GameState, player: number, kind: LandmarkKind, bonus: number): number {
  return favours(s, player, kind) ? bonus * LANDMARKS.kinMul : bonus;
}

/** The landmarks a player keeps of a kind. */
export function keptOf(s: GameState, player: number, kind: LandmarkKind): number {
  let n = 0;
  for (const m of s.landmarks ?? []) if (m.owner === player && m.kind === kind) n++;
  return n;
}

/** How much faster a priest works for standing in its people's Sacred Grove (1 when it isn't). */
export function groveBoost(s: GameState, u: Unit): number {
  for (const m of s.landmarks ?? []) {
    if (m.kind !== 'grove' || m.owner !== u.owner) continue;
    const dx = u.x - m.x;
    const dy = u.y - m.y;
    if (dx * dx + dy * dy <= LANDMARKS.grove.reach * LANDMARKS.grove.reach) return 1 + kinBonus(s, u.owner, 'grove', LANDMARKS.grove.priest - 1);
  }
  return 1;
}

/** How much faster a soldier marches for its people keeping an Old Ford (1 when they don't, or for citizens and traders). */
export function fordMarch(s: GameState, u: Unit): number {
  if (u.type === 'citizen' || u.type === 'trader' || keptOf(s, u.owner, 'ford') === 0) return 1;
  return 1 + kinBonus(s, u.owner, 'ford', LANDMARKS.ford.march - 1);
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
    e.hp = Math.min(top, e.hp + top * kinBonus(s, m.owner, 'spring', LANDMARKS.spring.heal));
    if (s.tick % secs(LANDMARKS.spring.every * 3) === 0) s.events.push({ k: 'healed', id: e.id, x: e.x, y: e.y });
  }
}

/** The team that keeps every landmark (only in the Lords of the Land game; at least `lordsMin` stand), or -1. */
function lords(s: GameState): number {
  const marks = s.landmarks ?? [];
  if (s.mode !== 'lords' || s.scenario || marks.length < LANDMARKS.lordsMin || marks.some((m) => m.owner < 0)) return -1;
  const team = s.players[marks[0].owner].team;
  return marks.every((m) => s.players[m.owner].team === team) ? team : -1;
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
  // Keeping every landmark long enough makes a side lord of the land.
  const team = lords(s);
  if (team !== (s.landTeam ?? -1)) {
    s.landTeam = team;
    s.landTimer = team >= 0 ? secs(LANDMARKS.lordsSeconds) : -1;
    s.events.push({ k: 'landHold', team, ticks: s.landTimer });
  } else if ((s.landTimer ?? -1) > 0) s.landTimer!--;
}
