import { AGORA, BUILDINGS, CIVS, secs } from './data';
import type { Building, GameState, Player } from './types';

/**
 * The agora (#729, the Greeks): a Market draws trade in proportion to the square left open round it, and to the town standing
 * round that square. Gold is paid by what is not built, so the plan is the economy, as the household tax's streets are (`household.ts`).
 */
export const keepsAgora = (p: Player): boolean => !!CIVS[p.civ].agora;

/** The finished Markets of a player, in id order. */
const markets = (s: GameState, owner: number): Building[] => {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === 'market' && e.built && e.hp > 0) out.push(e);
  return out;
};

/** The tiles of a Market's square: how many there are, and how many are open (land with nothing built, grown or risen on it). */
export function square(s: GameState, m: Building): { open: number; total: number } {
  const r = AGORA.inner;
  let open = 0;
  const total = (m.size + 2 * r) ** 2 - m.size ** 2;
  for (let y = m.ty - r; y < m.ty + m.size + r; y++) {
    for (let x = m.tx - r; x < m.tx + m.size + r; x++) {
      if (x >= m.tx && x < m.tx + m.size && y >= m.ty && y < m.ty + m.size) continue;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      const i = y * s.w + x;
      if (s.block[i] === 0 && s.bldAt[i] === 0) open++;
    }
  }
  return { open, total };
}

/** The gap in tiles between two footprints (0 when they touch). */
const gap = (a: Building, b: Building): number =>
  Math.max(0, Math.max(a.tx - (b.tx + b.size), b.tx - (a.tx + a.size), a.ty - (b.ty + b.size), b.ty - (a.ty + a.size)));

/** The owner's own buildings standing round a Market's square: past it, and within `outer` tiles. Walls and fields are not a town. */
export function rim(s: GameState, m: Building): number {
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== m.owner || e === m || !e.built || e.hp <= 0) continue;
    const d = gap(m, e);
    if (d >= AGORA.inner && d <= AGORA.outer && !BUILDINGS[e.type].open) n++;
  }
  return Math.min(AGORA.rimMax, n);
}

/** What one Market trades for a second now. */
export function tradeOf(s: GameState, m: Building): number {
  const { open, total } = square(s, m);
  return (open / total) * (AGORA.gold + AGORA.rim * rim(s, m));
}

/** The gold a second a people's agoras draw now (zero for a people that keeps none), for the HUD. */
export function agoraRate(s: GameState, owner: number): number {
  const p = s.players[owner];
  if (!p || !keepsAgora(p) || p.defeated) return 0;
  let sum = 0;
  for (const m of markets(s, owner)) sum += tradeOf(s, m);
  return sum;
}

/** Whether a footprint of `size` at (tx, ty) would stand in the square of a finished Market of an agora people, any owner's. */
export function inAgora(s: GameState, tx: number, ty: number, size: number): boolean {
  const r = AGORA.inner;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'market' || !e.built || !keepsAgora(s.players[e.owner])) continue;
    if (tx < e.tx + e.size + r && tx + size > e.tx - r && ty < e.ty + e.size + r && ty + size > e.ty - r) return true;
  }
  return false;
}

/** Every `AGORA.every` seconds, in id order: each agora people's Markets pay their trade into its treasury. */
export function agoraStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(AGORA.every) !== 0) return;
  for (const p of s.players) {
    if (!keepsAgora(p) || p.defeated) continue;
    let gold = 0;
    for (const m of markets(s, p.id)) gold += tradeOf(s, m) * AGORA.every;
    if (gold <= 0) continue;
    p.res.gold += gold;
    p.stats.agora = (p.stats.agora ?? 0) + gold;
  }
}
