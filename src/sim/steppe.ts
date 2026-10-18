import { BUILDINGS, DT, STEPPE } from './data';
import { ageDef } from './ages';
import { isNomad } from './nomad';
import { placeProblem, stampBuilding } from './grid';
import { ungarrison } from './units';
import { maxHp, placeBuilding, spawnUnit } from './world';
import type { Building, BuildingType, GameState, Player, Unit } from './types';

/**
 * The Age of the Steppe (#297): a town on wheels. A Town Center or House is packed onto a wagon, driven,
 * and pitched again, where it raises itself. The numbers are `STEPPE` in `data.ts`.
 */

/** Whether the player's age lets them pack their town onto wagons, or their people was born on the move (#501, the Mongols). */
export const isMobile = (p: Player): boolean => !!ageDef(p).mobile || isNomad(p);

/** What the player's age packs onto wagons: Town Centers and Houses, and on the Silk Road the Market (#326). */
export const packsOf = (p: Player): BuildingType[] => {
  const more = ageDef(p).packs;
  return more ? [...STEPPE.packs, ...more] : STEPPE.packs;
};

/** Why this building can't be packed now, or null. */
export function packProblem(s: GameState, p: Player, b: Building): string | null {
  if (!isMobile(p)) return 'Only a steppe people strikes camp';
  if (!packsOf(p).includes(b.type)) return ageDef(p).packs ? 'Only Town Centers, Houses and Markets pack onto wagons' : 'Only Town Centers and Houses pack onto wagons';
  if (!b.built || b.hp <= 0) return 'It must stand finished first';
  if (b.advance >= 0) return 'Not while the people is changing its age';
  if (b.queue.length) return 'Finish or cancel the training here first';
  void s;
  return null;
}

/** Packs a building onto a wagon where it stands: its people step out, and it rolls with the health it had. */
export function packCamp(s: GameState, b: Building): Unit {
  ungarrison(s, b);
  const share = b.hp / maxHp(s, b);
  stampBuilding(s, b, false);
  s.byId.delete(b.id);
  s.ents = s.ents.filter((e) => e !== b);
  const w = spawnUnit(s, b.owner, 'wagon', b.x, b.y);
  w.packed = b.type;
  w.packedHp = share;
  s.events.push({ k: 'camp', owner: b.owner, id: w.id, type: b.type, x: b.x, y: b.y, pitched: false });
  return w;
}

/**
 * Where a wagon would pitch: the footprint centred on it, or the nearest that fits within `STEPPE.spot`
 * tiles, ring by ring in a fixed order (so every machine picks the same). Null when nothing fits.
 */
export function pitchSpot(s: GameState, w: Unit): { tx: number; ty: number } | null {
  if (!w.packed) return null;
  const n = BUILDINGS[w.packed].size;
  const bx = Math.round(w.x - n / 2);
  const by = Math.round(w.y - n / 2);
  for (let d = 0; d <= STEPPE.spot; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        if (!placeProblem(s, w.packed, bx + dx, by + dy, true, w.owner)) return { tx: bx + dx, ty: by + dy };
      }
    }
  }
  return null;
}

/** Why a wagon can't pitch where it is, or null. */
export function pitchProblem(s: GameState, w: Unit): string | null {
  if (!w.packed || w.hp <= 0) return 'Nothing to pitch';
  if (w.inside) return 'Not while aboard';
  return pitchSpot(s, w) ? null : 'No room to pitch here, or the land is a rival\'s';
}

/** Sets the wagon's building down where it stands; it raises itself over `STEPPE.pitch` seconds. */
export function pitchCamp(s: GameState, w: Unit): Building | null {
  const spot = pitchSpot(s, w);
  if (!spot || !w.packed) return null;
  s.byId.delete(w.id);
  s.ents = s.ents.filter((e) => e !== w);
  const b = placeBuilding(s, w.owner, w.packed, spot.tx, spot.ty, false);
  b.pitch = Math.max(0.05, Math.min(1, w.packedHp ?? 1));
  b.hp = Math.max(1, maxHp(s, b) * b.pitch * 0.2);
  s.events.push({ k: 'camp', owner: w.owner, id: b.id, type: b.type, x: b.x, y: b.y, pitched: true });
  return b;
}

/** Each tick: pitched camps raise themselves, climbing back to the health they were packed with. */
export function raiseCamps(s: GameState): void {
  const step = DT / STEPPE.pitch;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.pitch === undefined || e.hp <= 0) continue;
    if (e.built) {
      delete e.pitch;
      continue;
    }
    const full = maxHp(s, e);
    e.progress = Math.min(1, e.progress + step);
    e.hp = Math.min(full, e.hp + full * e.pitch * 0.8 * step);
    if (e.progress >= 1) {
      e.built = true;
      delete e.pitch;
      s.events.push({ k: 'built', id: e.id, owner: e.owner, type: e.type });
    }
  }
}
