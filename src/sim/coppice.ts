import { AMOUNT, BUILDINGS, CIVS, COPPICE, secs } from './data';
import { stampBuilding } from './grid';
import { B_RES, R_NONE, R_TREE } from './types';
import type { Building, GameState, Player } from './types';

/**
 * The managed wood (#501, the Britons): a people whose field is the forest. It tills no Farm (`buildBarred`); a tree its
 * citizens fell near its own wood stores is coppiced, and its stool grows a full tree again; it plants Saplings on open
 * ground that root and grow the same way; and its snares (`snares.ts`) fill faster and hold more. Felling a stand starves
 * the snares beside it until it grows back, so the town works its woods in turns. The numbers are `COPPICE` in `data.ts`.
 */
export const isCoppice = (p: Player): boolean => !!CIVS[p.civ].coppice;

/** Whether a tile lies within `COPPICE.reach` tiles of one of `owner`'s finished buildings that take in wood. */
function nearStore(s: GameState, owner: number, tile: number): boolean {
  const tx = tile % s.w;
  const ty = Math.floor(tile / s.w);
  const r = COPPICE.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.hp <= 0 || !e.built || !BUILDINGS[e.type].drop.includes('wood')) continue;
    if (tx >= e.tx - r && tx < e.tx + e.size + r && ty >= e.ty - r && ty < e.ty + e.size + r) return true;
  }
  return false;
}

/** A tree on `tile` was felled to the stump by a unit of `owner`'s: a coppice people's stool stays to grow again, near its stores. */
export function felled(s: GameState, owner: number, tile: number): void {
  const p = s.players[owner];
  if (!p || !isCoppice(p) || !nearStore(s, owner, tile)) return;
  plant(s, tile, COPPICE.regrow);
}

function plant(s: GameState, tile: number, after: number): void {
  const stools = (s.stools ??= []);
  if (stools.some((t) => t.tile === tile)) return;
  stools.push({ tile, from: s.tick, at: s.tick + secs(after) });
}

/** How far a growing stool on `tile` has come, 0 to 1, or -1 if none grows there (for the look and the HUD). */
export function growthAt(s: GameState, tile: number): number {
  const t = s.stools?.find((x) => x.tile === tile);
  return t ? Math.min(1, (s.tick - t.from) / Math.max(1, t.at - t.from)) : -1;
}

/** Whether anything stands on a tile so a tree can't grow up through it: a building, a resource, a unit or a beast. */
function standing(s: GameState, tile: number): 'gone' | 'wait' | null {
  if (s.bldAt[tile] !== 0 || s.res[tile] !== R_NONE) return 'gone';
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const near = (x: number, y: number) => Math.abs(x - cx) < 0.9 && Math.abs(y - cy) < 0.9;
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside && near(e.x, e.y)) return 'wait';
  for (const a of s.animals) if (a.hp > 0 && near(a.x, a.y)) return 'wait';
  return null;
}

/**
 * Once a second: finished Saplings root as stools (the building gives way to the growing tree), and stools that are due grow
 * into full trees, in the order they were cut or planted. A stool built over is grubbed out; one stood on waits `COPPICE.retry`.
 */
export function coppiceStep(s: GameState): void {
  if (s.tick % secs(1) !== 0) return;
  let rooted: Building[] | null = null;
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'sapling' && e.built && e.hp > 0) (rooted ??= []).push(e);
  if (rooted) {
    for (const b of rooted) {
      stampBuilding(s, b, false);
      s.byId.delete(b.id);
      plant(s, b.ty * s.w + b.tx, COPPICE.grow);
    }
    const gone = new Set(rooted);
    s.ents = s.ents.filter((e) => !gone.has(e as Building));
  }
  if (!s.stools?.length) return;
  let grew = false;
  const keep = s.stools.filter((t) => {
    if (s.tick < t.at) return true;
    const why = standing(s, t.tile);
    if (why === 'gone') return false;
    if (why === 'wait') {
      t.at = s.tick + secs(COPPICE.retry);
      return true;
    }
    s.res[t.tile] = R_TREE;
    s.amount[t.tile] = AMOUNT.tree;
    s.block[t.tile] |= B_RES;
    grew = true;
    s.events.push({ k: 'regrown', tile: t.tile });
    return false;
  });
  s.stools = keep;
  if (grew) s.blockVersion++;
}
