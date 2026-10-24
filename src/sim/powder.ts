import { BREACH, KEG, TICK_HZ, domainOf, secs } from './data';
import { ageDef } from './ages';
import { hurt, peace } from './combat';
import { distToRect } from './grid';
import { isEnemy } from './world';
import { breachAt } from './tides';
import type { Building, Ent, GameState, Keg, Player, Unit } from './types';

/**
 * Powder (#577, the age road's first gateway, `docs/age-roads.md` rule 3). In the Age of Alchemy the Siege Workshops are mills that
 * grind the saltpetre in store into kegs; in the Age of Sappers citizens and foot soldiers carry a keg to the foot of a rival
 * building, lay it, and the fuse burns down to a blast, unless a rival reaches it first and stamps it out. Kegs are ground only in
 * Alchemy, so how long a people stays in its weak gateway is how much powder it brings. The numbers are `KEG`.
 */

export const mills = (p: Player): boolean => !!ageDef(p).mills;
export const sappers = (p: Player): boolean => !!ageDef(p).sappers;
export const kegsOf = (p: Player): number => p.kegs ?? 0;

/** A unit that may carry a keg: a citizen or a foot soldier. */
export const carriesKegs = (u: Unit): boolean => u.type === 'citizen' || u.type === 'infantry';

/** The finished, standing Siege Workshops of a people: its mills, in id order. */
export function millsOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'workshop' && e.built && e.hp > 0) out.push(e);
  return out;
}

/**
 * The mills that grind for a people now: every finished, standing Siege Workshop in the Age of Alchemy; elsewhere only the old mill,
 * Alchemy's keepsake (#555 s11), if it still stands.
 */
export function grindersOf(s: GameState, p: Player): Building[] {
  const all = millsOf(s, p.id);
  return mills(p) ? all : all.filter((b) => b.keep === 'alchemy');
}

/** Why the mills stand still, or null while they grind. */
export function millProblem(s: GameState, p: Player): string | null {
  if (!mills(p) && !grindersOf(s, p).length) return 'Kegs are ground only in the Age of Alchemy, or at the old mill its people kept';
  if (kegsOf(p) >= KEG.most) return `The store holds ${KEG.most} kegs: lay some before more are ground`;
  if ((p.rare?.saltpetre ?? 0) < KEG.ore) return `Each keg takes ${KEG.ore} saltpetre: dig more`;
  if (!millsOf(s, p.id).length) return 'Raise a Siege Workshop: in this age it is a powder mill';
  return null;
}

/**
 * Once a second, in player order: every mill of a people in the Age of Alchemy (elsewhere, its old mill: `grindersOf`) adds a second of milling, and each `KEG.time` of it
 * grinds a keg from `KEG.ore` saltpetre. Milling never runs ahead of the store: short of saltpetre or full of kegs, it waits.
 */
export function millStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const p of s.players) {
    if (p.defeated) continue;
    const at = grindersOf(s, p);
    if (!at.length) continue;
    let grind = (p.grind ?? 0) + at.length;
    while (grind >= KEG.time && kegsOf(p) < KEG.most && (p.rare?.saltpetre ?? 0) >= KEG.ore) {
      grind -= KEG.time;
      p.rare!.saltpetre! -= KEG.ore;
      p.kegs = kegsOf(p) + 1;
      p.stats.ground = (p.stats.ground ?? 0) + 1;
      const m = at[(p.stats.ground - 1) % at.length];
      s.events.push({ k: 'keg', owner: p.id, x: m.x, y: m.y, what: 'ground' });
    }
    p.grind = Math.min(grind, KEG.time);
  }
}

/** Why a people can't lay a keg at this building, or null. */
export function kegProblem(s: GameState, owner: number, target: Ent | undefined): string | null {
  const p = s.players[owner];
  if (!sappers(p)) return 'Only a people of the Age of Sappers lays powder kegs';
  if (kegsOf(p) < 1) return 'No kegs in store: they are ground at the mills in the Age of Alchemy';
  if (peace(s)) return 'Not while the peace holds';
  if (!target || target.kind !== 'building' || target.hp <= 0 || !isEnemy(s, owner, target.owner)) return 'Pick a rival building';
  return null;
}

/** Whether a carrier stands close enough to a building to lay its keg. */
export const atFoot = (u: Unit, b: Building, radius: number): boolean => distToRect(u.x, u.y, b) - radius <= KEG.lay;

/** A carrier lays a keg from its people's store where it stands, the fuse lit. */
export function layKeg(s: GameState, u: Unit): void {
  const p = s.players[u.owner];
  p.kegs = kegsOf(p) - 1;
  (s.kegs ??= []).push({ id: s.nextId++, x: u.x, y: u.y, owner: u.owner, at: s.tick + secs(KEG.fuse) });
  s.events.push({ k: 'keg', owner: u.owner, x: u.x, y: u.y, what: 'laid' });
}

/** The first rival on the ground, in id order, standing within reach of a burning keg: the one who stamps it out. */
function douser(s: GameState, k: Keg): Unit | null {
  const r2 = KEG.douse * KEG.douse;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !isEnemy(s, k.owner, e.owner) || domainOf(e.type) !== 'land') continue;
    const dx = e.x - k.x, dy = e.y - k.y;
    if (dx * dx + dy * dy <= r2) return e;
  }
  return null;
}

/** A keg blows: every rival building within reach takes `KEG.building` (a dyke `BREACH.keg` times that), every rival on the ground within reach `KEG.unit`. */
function blow(s: GameState, k: Keg): void {
  const r2 = KEG.reach * KEG.reach;
  const hit: Ent[] = [];
  for (const e of s.ents) {
    if (e.hp <= 0 || !isEnemy(s, k.owner, e.owner)) continue;
    if (e.kind === 'building') {
      if (distToRect(k.x, k.y, e) <= KEG.reach) hit.push(e);
    } else if (!e.inside && domainOf(e.type) === 'land') {
      const dx = e.x - k.x, dy = e.y - k.y;
      if (dx * dx + dy * dy <= r2) hit.push(e);
    }
  }
  // A dyke (#701 s3) is earth: powder at its foot tears it open, and the sea does the rest.
  for (const e of hit) hurt(s, e, e.kind === 'building' ? KEG.building * (e.type === 'dyke' || e.type === 'sluice' || e.type === 'dam' ? BREACH.keg : 1) : KEG.unit, k.owner, null);
  // A rival's causeway or barrage (#748) is packed stone on the sand: the blast breaches it.
  breachAt(s, k.x, k.y, KEG.reach, k.owner);
  const p = s.players[k.owner];
  p.stats.blown = (p.stats.blown ?? 0) + 1;
  s.events.push({ k: 'keg', owner: k.owner, x: k.x, y: k.y, what: 'blown' });
}

/** Every tick, in the order they were laid: a keg a rival has reached is stamped out; one whose fuse has burned down blows. */
export function kegStep(s: GameState): void {
  if (!s.kegs) return;
  const left: Keg[] = [];
  for (const k of s.kegs) {
    const by = douser(s, k);
    if (by) s.events.push({ k: 'keg', owner: k.owner, x: k.x, y: k.y, what: 'doused', by: by.owner });
    else if (s.tick >= k.at) blow(s, k);
    else left.push(k);
  }
  if (left.length) s.kegs = left;
  else delete s.kegs;
}
