import { ageOf, deedsOf, isSideRoad, roadKnown } from '../sim/ages';
import { AGES, BUILDINGS, PROSPECTOR, ROADS, TECHS, TRUNK, type Road } from '../sim/data';
import type { AgeId, GameState } from '../sim/types';
import { getCloudWeb, putCloudWeb, vaultKey } from '../net/cloud';
import { mergeWeb } from '../net/vault';
import { syncOn } from './campaignUi';

/**
 * The web map (#54): a screen outside the match that draws the web of ages (#37). What it shows
 * fills in over many matches: discovery lives in browser storage, recorded from the main loop,
 * never in the sim, so online play and replays are untouched.
 */

const KEY = 'ages-web';

export interface Discovery {
  /** Ages a player has stood in, in any match. */
  entered: AgeId[];
  /** Side roads a player has known of (`roadKnown`), as "from>to". */
  roads: string[];
}

export const roadKey = (r: Road): string => `${r.from}>${r.to}`;

export type AgeView = 'hidden' | 'grey' | 'known' | 'entered';

export function loadDiscovery(): Discovery {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return { entered: list(raw?.entered).filter((a) => a in AGES) as AgeId[], roads: list(raw?.roads) };
  } catch {
    return { entered: [], roads: [] };
  }
}

export function saveDiscovery(d: Discovery): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* Storage is off: the map shows only the trunk. */
  }
}

/**
 * Discoveries follow the save key (#292 follow-up): opening the Cloud saves panel unions this browser's
 * map with the vault's both ways; once synced, a new find is sent up in the background. Returns how many
 * ages and roads the vault taught this browser.
 */
export async function syncDiscovery(): Promise<number> {
  const key = vaultKey();
  const local = loadDiscovery();
  const remote = await getCloudWeb(key);
  const merged = mergeWeb(local, remote);
  const next: Discovery = { entered: merged.entered.filter((a) => a in AGES) as AgeId[], roads: merged.roads };
  const learned = next.entered.filter((a) => !local.entered.includes(a)).length + next.roads.filter((r) => !local.roads.includes(r)).length;
  saveDiscovery(next);
  if (next.entered.some((a) => !remote.entered.includes(a)) || next.roads.some((r) => !remote.roads.includes(r))) await putCloudWeb(key, next);
  return learned;
}

/** After a new find: if this browser syncs, send the map up (a failure is ignored; the panel syncs again). */
export function pushDiscovery(d: Discovery): void {
  if (syncOn()) void putCloudWeb(vaultKey(), d).catch(() => undefined);
}

/** Fold what a player has now into the record; true if it grew. Trunk ages below the one reached count as entered. */
export function observe(d: Discovery, s: GameState, owner: number): boolean {
  const p = s.players[owner];
  if (!p) return false;
  let grew = false;
  const enter = (a: AgeId) => {
    if (!d.entered.includes(a)) (d.entered.push(a), (grew = true));
  };
  enter(ageOf(p));
  for (let t = 0; t < Math.min(p.epoch, TRUNK.length); t++) enter(TRUNK[t]);
  for (const r of ROADS) {
    if (!isSideRoad(r) || AGES[r.from].tier > p.epoch || d.roads.includes(roadKey(r)) || !roadKnown(s, p, r)) continue;
    d.roads.push(roadKey(r));
    grew = true;
  }
  return grew;
}

/** How the map shows an age: trunk greyed until reached; a side age absent until a road to it is known. */
export function ageView(d: Discovery, a: AgeId): AgeView {
  if (d.entered.includes(a)) return 'entered';
  if (TRUNK.includes(a)) return 'grey';
  return ROADS.some((r) => r.to === a && d.roads.includes(roadKey(r))) ? 'known' : 'hidden';
}

/** Whether a road is drawn, and whether its label is read out: both ends must show; the label once it is known or its end entered. */
export function roadView(d: Discovery, r: Road): 'hidden' | 'faint' | 'known' {
  if (ageView(d, r.from) === 'hidden' || ageView(d, r.to) === 'hidden') return 'hidden';
  if (!isSideRoad(r)) return d.entered.includes(r.to) ? 'known' : 'faint';
  return d.roads.includes(roadKey(r)) || d.entered.includes(r.to) ? 'known' : 'hidden';
}

// ---- Layout: tiers run down the page, lanes across, so it reads at phone width. ----------------

// The Path of Blood keeps the left column (Warband over Iron and Blood, #303, over Total War, #313), so the Reclaimers moved to lane 2
// and the Fairs to lane 3 at tier 3, and Lightning to lane 3 at tier 4 (its road curves under the Aeronauts).
// The Steppe Road (#318) keeps the right column, as the Path of Blood keeps the left: the Steppe over the Horde.
// The Silk Road (#326), the crossing where the horde meets the merchants, steps in to lane 4 under the Sail, between its two roads.
// The first gateway (#577) takes a seventh lane, past the Steppe Road: Alchemy at tier 2 over the Sappers it leads to.
const LANE: Record<AgeId, number> = { iron: 0, reclaimer: 2, stone: 1, bronze: 1, middle: 1, gunpowder: 1, industrial: 1, atomic: 1, fission: 0, fusion: 2, merchant: 2, pilgrim: 3, fair: 3, sail: 4, aeronaut: 2, lightning: 3, warband: 0, steppe: 5, ironblood: 0, totalwar: 0, horde: 5, silk: 4, chariots: 3, hemocraft: 0, bloodrite: 1, alchemy: 6, sapper: 6, searaider: 2, missions: 3, golden: 2, dykes: 5, wild: 4, grove: 4, rivers: 6, hive: 4, waterline: 5, locks: 5, tides: 5, wildwood: 4, bloom: 4 };
// The fork at the end of the Path of Blood (#355 s2) stands at Industrial strength, but past Total War: a row of its own under
// tier 4, Hemocraft below Total War in the path's column and the Blood-rite below the Industrial Age it turns off.
// The first crossing (#585) sits between its two siblings' tier and the next, under the Merchants: half a row down, off the Middle Ages.
// The Water Road (#701) starts half a row under the Horde, in the Steppe Road's column, off the Middle Ages: its later steps follow it down.
// Its trunk's first age, the Age of Rivers (#701 s1), stands at tier 1 in the seventh lane, over Alchemy, its road curving down to the Dykes.
// The Grove (the Wild route's second age) hangs half a row under the Sail, below the Wild in its column; the Hive half a row under the Silk Road;
// the Wildwood half a row under the Industrial Age's row, below the Hive; the Bloom a row under the Wildwood, half a row over the Atomic's.
// The Water Line (#701 s4) follows the Dykes down their column, half a row under the Horde.
// The Age of Tides (#739) stands at the Atomic's row in the Water Road's column.
const ROW: Partial<Record<AgeId, number>> = { atomic: 6, fission: 7, fusion: 7, hemocraft: 5, bloodrite: 5, searaider: 2.5, missions: 2.5, chariots: 1.5, golden: 3.5, dykes: 2.5, grove: 2.5, hive: 3.5, waterline: 3.5, locks: 4.5, tides: 6, wildwood: 4.5, bloom: 5.5 };
/** Seven lanes wide: 48 + 6 × 88 + half a node fits in 616 (Alchemy, lane 6, #577); six rows deep with the fork (#355 s2). */
export const MAP = { w: 616, h: 695, nodeW: 76, nodeH: 34, top: 40, gap: 85 };

export function layout(): Record<AgeId, { x: number; y: number }> {
  const out = {} as Record<AgeId, { x: number; y: number }>;
  for (const a of Object.keys(AGES) as AgeId[]) out[a] = { x: 48 + LANE[a] * 88, y: MAP.top + (ROW[a] ?? AGES[a].tier) * MAP.gap };
  return out;
}

/** Ages the map shows now, in tier order. */
export const visibleAges = (d: Discovery): AgeId[] =>
  (Object.keys(AGES) as AgeId[]).filter((a) => ageView(d, a) !== 'hidden').sort((a, b) => AGES[a].tier - AGES[b].tier);

// ---- HTML ----------------------------------------------------------------------------------------

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A road's label: its window, its clue and its deeds. */
export function roadLabel(r: Road): string {
  const bits = [`Opens from the ${AGES[r.from].name}`];
  // The survey is a Prospector's Lodge's now (#562): the road shows once a lodge finds what it wants.
  if (r.found) bits.push(TECHS[r.found].survey ? `once a ${BUILDINGS.prospector.name} finds ${PROSPECTOR.keys[TECHS[r.found].survey!].name.toLowerCase()} in the world` : `after ${TECHS[r.found].name}`);
  if (r.ruin) bits.push('after your citizens finish excavating an ancient ruin');
  // A crossing (#585): both sibling ages walked.
  if (r.crossing) bits.push(`for a people that walked both the ${AGES[r.crossing[0]].name} and the ${AGES[r.crossing[1]].name}`);
  if (r.clue) bits.push(`seen once you have a ${BUILDINGS[r.clue].name}`);
  const deeds = deedsOf(r).map((x) => x.text);
  return bits.join(', ') + (deeds.length ? `. Deeds: ${deeds.join('; ')}` : '');
}

export function webMapHtml(d: Discovery): string {
  const pos = layout();
  const ages = visibleAges(d);
  const shown = ROADS.filter((r) => roadView(d, r) !== 'hidden');
  const { nodeW: w, nodeH: h } = MAP;
  const lines = shown
    .map((r) => {
      const a = pos[r.from], b = pos[r.to];
      const down = b.y > a.y;
      const side = b.y === a.y;
      // A road along a tier that skips a lane curves under the age between, rather than running through it.
      if (side && Math.abs(b.x - a.x) > 100) {
        const y = a.y + h / 2, dip = y + 34;
        return `<path class="wm-road ${roadView(d, r)} ${isSideRoad(r) ? 'side' : ''}" d="M${a.x} ${y}Q${(a.x + b.x) / 2} ${dip} ${b.x} ${y}" marker-end="url(#wm-arrow)"/>`;
      }
      const x1 = side ? a.x + (b.x > a.x ? w / 2 : -w / 2) : a.x, y1 = side ? a.y : a.y + (down ? h / 2 : -h / 2);
      const x2 = side ? b.x + (b.x > a.x ? -w / 2 : w / 2) : b.x, y2 = side ? b.y : b.y + (down ? -h / 2 : h / 2);
      return `<line class="wm-road ${roadView(d, r)} ${isSideRoad(r) ? 'side' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#wm-arrow)"/>`;
    })
    .join('');
  const nodes = ages
    .map((a) => {
      const v = ageView(d, a), p = pos[a];
      return `<g class="wm-node ${v} ${TRUNK.includes(a) ? 'trunk' : 'side'}" data-age="${a}"><rect x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="8"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${esc(AGES[a].short)}</text></g>`;
    })
    .join('');
  const cards = ages
    .map((a) => {
      const v = ageView(d, a);
      const roads = ROADS.filter((r) => r.to === a && roadView(d, r) === 'known' && isSideRoad(r))
        .map((r) => `<li>${esc(roadLabel(r))}</li>`)
        .join('');
      const body = v === 'grey' ? '<p class="wm-dim">Not yet reached.</p>' : `<p>${esc(AGES[a].blurb)}</p>${roads ? `<ul class="wm-roads">${roads}</ul>` : ''}`;
      const pin = v === 'grey' ? '' : ` <button class="btn" data-act="plan-pin" data-age="${a}" title="Pin as the goal of the road planner (the Roads button in a match)">📍</button>`;
      return `<div class="wm-card ${v}"><h3>${esc(AGES[a].name)} <small>tier ${AGES[a].tier + 1}</small>${pin}</h3>${v === 'known' ? '<p class="wm-dim">A road leads here, not yet taken.</p>' : ''}${body}</div>`;
    })
    .join('');
  const hidden = (Object.keys(AGES) as AgeId[]).length - ages.length;
  return `<div class="title-card camp-card"><h1>The Web of <span>Ages</span></h1>
    <p class="tagline">Five ages stand on the main road. Others are found by play: a side road shows once a match gives you reason to know it.${hidden ? ` ${hidden} still unseen.` : ''}</p>
    <svg class="wm-map" viewBox="0 0 ${MAP.w} ${MAP.h}" role="img" aria-label="The web of ages"><defs><marker id="wm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>${lines}${nodes}</svg>
    <div class="wm-cards">${cards}</div>
    <div class="title-buttons"><button class="btn big" data-act="camp-back">Back</button></div></div>`;
}

