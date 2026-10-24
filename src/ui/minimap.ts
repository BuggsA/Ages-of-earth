import { ageOf, assayed, diggersAt, prospected } from '../sim/ages';
import { domainOf } from '../sim/data';
import type { AgeId, GameState, KeyId } from '../sim/types';
import type { ScoutFlag } from './scoutFlags';
import { iceCover, lookFor, mapTint } from '../render/seasonLook';
import { Waymarks } from './waymarks';

/** Polder on the map (#701): a deep field green. */
const POLDER_RGB = [86, 128, 62];
/** Tidal flats bared by the falling tide (#739): wet grey sand. */
const FLATS_RGB = [143, 134, 112];
const WATER_RGB = [0x2f, 0x7f, 0xae];
/** Tiles pumped out of the water so far, by every people. */
const drained = (s: GameState): number => s.players.reduce((n, p) => n + (p.stats.drained ?? 0) + (p.stats.dug ?? 0), (s.flooded ?? 0) + (s.inundated ?? 0) + (s.tideTurns ?? 0));
import { R_BERRY, R_BLOODIRON, R_BOG, R_SALT, R_SALTPETRE, R_FISH, R_GOLD, R_MEAT, R_STONE, R_TREE, T_ROCK, T_SAND, T_WATER } from '../sim/types';
import { R_COCKLE } from '../sim/types';
import { revealed, ringsFor, warnRadius } from '../sim/silo';

/**
 * The overview map: the land through the player's fog, woods and mines, the buildings they know of,
 * units in sight, the camera's view and pings where things happen. Click or drag to look somewhere;
 * right-click to send the selected units there.
 */

/** The chart's marks (#565): each key resource in the colour its ground shows on this map. */
const CHART_COLOR: Record<KeyId, string> = { bogIron: '#c0622a', salt: '#f4f1e8', saltpetre: '#d8d27a', bloodiron: '#a01c2c', ruin: '#d8cfb8' };

/** A side age rings its owner's buildings on the map, so a rival's road shows at a glance (#55). */
const AGE_BLIP: Partial<Record<AgeId, string>> = { merchant: '#ffd166', iron: '#ff7a2a', pilgrim: '#f4efe4', fair: '#e0524a', sail: '#3fb8c8', lightning: '#8fd8ff', warband: '#9b1c2c', ironblood: '#6e0f1c', totalwar: '#4a0a12', hemocraft: '#b0182c', bloodrite: '#5e1a4a', horde: '#c8a24a', silk: '#b8462e' };

interface Ping {
  x: number;
  y: number;
  color: string;
  /** A heavier, slower pulse (the Town Center struck, #452). */
  heavy?: boolean;
  born: number;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export class Minimap {
  onLook: ((x: number, y: number) => void) | null = null;
  onCommand: ((x: number, y: number) => void) | null = null;
  onMark: ((x: number, y: number, danger: boolean) => void) | null = null;
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private baseCtx: CanvasRenderingContext2D;
  private land: Uint8ClampedArray = new Uint8ClampedArray(0);
  /** 1 where the base colour is meadow, which the season recolours. */
  private green: Uint8Array = new Uint8Array(0);
  /** Lake depth under each water tile (0 on land), for the winter ice. */
  private depth: Float32Array = new Float32Array(0);
  /** The ground as painted, and the tiles pumped out by then (#701): land won from the water is repainted as it comes. */
  private terr: Uint8Array = new Uint8Array(0);
  private drainedSeen = 0;
  private img: ImageData | null = null;
  private pings: Ping[] = [];
  private dragging = false;
  readonly waymarks = new Waymarks();
  private w = 1;
  private h = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.baseCtx = this.base.getContext('2d')!;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        const p = this.toMap(e);
        if (e.ctrlKey) this.onMark?.(p.x, p.y, e.shiftKey);
        else this.onCommand?.(p.x, p.y);
        return;
      }
      if (e.button !== 0) return;
      this.dragging = true;
      canvas.setPointerCapture(e.pointerId);
      const p = this.toMap(e);
      this.onLook?.(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const p = this.toMap(e);
      this.onLook?.(p.x, p.y);
    });
    canvas.addEventListener('pointerup', () => (this.dragging = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private toMap(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.w, y: ((e.clientY - r.top) / r.height) * this.h };
  }

  /** Paint the land once per match. */
  setup(s: GameState): void {
    this.w = s.w;
    this.h = s.h;
    this.base.width = s.w;
    this.base.height = s.h;
    this.img = this.baseCtx.createImageData(s.w, s.h);
    this.land = new Uint8ClampedArray(s.w * s.h * 3);
    this.green = new Uint8Array(s.w * s.h);
    this.depth = new Float32Array(s.w * s.h);
    const grass = rgb('#6fa548');
    const grass2 = rgb('#7fb354');
    const sand = rgb('#d9c48a');
    const water = WATER_RGB;
    const rock = rgb('#8d8579');
    for (let i = 0; i < s.w * s.h; i++) {
      const t = s.terrain[i];
      const c = t === T_WATER ? water : t === T_SAND ? sand : t === T_ROCK ? rock : (i * 7) % 5 ? grass : grass2;
      this.land.set(c, i * 3);
      if (t === T_WATER) this.depth[i] = Math.max(0, -0.02 - s.height[Math.floor(i / s.w) * (s.w + 1) + (i % s.w)]);
      // A spring head (#701 s1) shows as a speck of water.
      if (s.springs?.includes(i)) this.land.set(water, i * 3);
      this.green[i] = t === T_WATER || t === T_SAND || t === T_ROCK ? 0 : 1;
    }
    this.terr = Uint8Array.from(s.terrain);
    this.drainedSeen = drained(s);
    this.pings = [];
    this.waymarks.reset();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.canvas.clientWidth || 184;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
  }

  ping(x: number, y: number, color: string, heavy = false): void {
    this.pings.push({ x, y, color, heavy, born: performance.now() });
    if (this.pings.length > 12) this.pings.shift();
  }

  draw(
    s: GameState,
    viewer: number,
    reveal: boolean,
    buildings: Iterable<{ owner: number; x: number; y: number; size: number; type?: string }>,
    footprint: { x: number; z: number }[],
    selected: Set<number>,
    scoutFlags: readonly ScoutFlag[] = [],
    keepsakes: readonly { owner: number; x: number; y: number }[] = [],
  ): void {
    if (!this.img) return;
    const p = s.players[viewer];
    // Polder (#701): water pumped out since the land was painted shows as dark field.
    const won = drained(s);
    if (won !== this.drainedSeen) {
      this.drainedSeen = won;
      for (let i = 0; i < s.w * s.h; i++) {
        if (this.terr[i] === s.terrain[i]) continue;
        this.terr[i] = s.terrain[i];
        // A channel dug (#701, the Age of Rivers) shows as water; land pumped out, as polder.
        const wet = s.terrain[i] === T_WATER;
        // Flats the tide bared (#739) show as wet sand.
        this.land.set(wet ? WATER_RGB : s.terrain[i] === T_SAND ? FLATS_RGB : POLDER_RGB, i * 3);
        this.depth[i] = wet ? Math.max(0, -0.02 - s.height[Math.floor(i / s.w) * (s.w + 1) + (i % s.w)]) : 0;
        this.green[i] = wet || s.terrain[i] === T_SAND ? 0 : 1;
      }
    }
    if (!reveal) this.waymarks.update(s, viewer);
    const d = this.img.data;
    // The year on the map: meadow and woods follow the season, snow lies in winter (as in the land's own look).
    const look = lookFor(s.tick);
    const tree = mapTint(look, true);
    const meadow = mapTint(look, false);
    const meadowK = [meadow[0] / 111, meadow[1] / 165, meadow[2] / 72];
    const gold = rgb('#ffd24a');
    const stone = rgb('#d8d3c8');
    const berry = rgb('#e0405a');
    const fish = rgb('#8fe3f2');
    // Cockle beds (#767), while the tide has bared them.
    const cockle = rgb('#f0dcb8');
    const bog = rgb('#c0622a');
    const salt = rgb('#f4f1e8');
    const petre = rgb('#d8d27a');
    const bloodiron = rgb('#a01c2c');
    for (let i = 0; i < s.w * s.h; i++) {
      const seen = reveal || p.seen[i];
      const vis = reveal || p.vis[i];
      let r = this.land[i * 3];
      let g = this.land[i * 3 + 1];
      let b = this.land[i * 3 + 2];
      if (this.green[i]) {
        r = Math.min(255, r * meadowK[0]);
        g = Math.min(255, g * meadowK[1]);
        b = Math.min(255, b * meadowK[2]);
      }
      if (look.snow > 0 && this.depth[i] > 0) {
        const ice = iceCover(look.snow, this.depth[i]) * 0.9;
        r += (214 - r) * ice;
        g += (232 - g) * ice;
        b += (244 - b) * ice;
      }
      const res = s.res[i];
      if (res === R_TREE) [r, g, b] = tree;
      else if (res === R_GOLD) [r, g, b] = gold;
      else if (res === R_STONE) [r, g, b] = stone;
      else if (res === R_BERRY || res === R_MEAT) [r, g, b] = berry;
      else if (res === R_FISH) [r, g, b] = fish;
      else if (res === R_COCKLE && s.terrain[i] === T_SAND) [r, g, b] = cockle;
      else if (res === R_BOG) [r, g, b] = bog;
      else if (res === R_SALT) [r, g, b] = salt;
      else if (res === R_SALTPETRE) [r, g, b] = petre;
      else if (res === R_BLOODIRON) [r, g, b] = bloodiron;
      const k = seen ? (vis ? 1 : 0.55) : 0;
      d[i * 4] = seen ? r * k : 14;
      d[i * 4 + 1] = seen ? g * k : 22;
      d[i * 4 + 2] = seen ? b * k : 33;
      d[i * 4 + 3] = 255;
    }
    this.baseCtx.putImageData(this.img, 0, 0);
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sx = cw / s.w;
    const sy = ch / s.h;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, cw, ch);

    // The Prospector's Lodge's chart (#565): every key-resource tile as it was charted, a small diamond in the ore's
    // colour wherever the viewer can't see the ground now (where it can, the land itself shows the truth).
    if (!reveal && p.chart) {
      const rr = Math.max(2.8, sx * 1.3);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(10,8,4,0.85)';
      for (const c of p.chart) {
        if (p.vis[c.tile]) continue;
        const x = ((c.tile % s.w) + 0.5) * sx;
        const y = (Math.floor(c.tile / s.w) + 0.5) * sy;
        ctx.fillStyle = CHART_COLOR[c.key];
        ctx.beginPath();
        ctx.moveTo(x, y - rr);
        ctx.lineTo(x + rr, y);
        ctx.lineTo(x, y + rr);
        ctx.lineTo(x - rr, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Assayed (#568): each charted vein someone digs now is ringed in that people's colour, in sight or not.
      if (assayed(p)) {
        const dig = diggersAt(s);
        ctx.lineWidth = 1.5;
        for (const c of p.chart) {
          const who = dig.get(c.tile);
          if (who === undefined) continue;
          ctx.strokeStyle = s.players[who].color;
          ctx.strokeRect(((c.tile % s.w) + 0.5) * sx - rr * 1.4, (Math.floor(c.tile / s.w) + 0.5) * sy - rr * 1.4, rr * 2.8, rr * 2.8);
        }
      }
    }
    const hearts: { owner: number; x: number; y: number }[] = [];
    for (const b of buildings) {
      if (b.type === 'towncenter') {
        hearts.push(b);
        continue;
      }
      const pl = s.players[b.owner];
      ctx.fillStyle = pl.color;
      const age = ageOf(pl);
      const mark = AGE_BLIP[age];
      ctx.strokeStyle = mark ?? 'rgba(0,0,0,0.6)';
      ctx.lineWidth = mark ? 1.5 : 1;
      // At least 1.6 px a side, so a small hut still reads as a block of its people's colour (#626).
      const half = Math.max((b.size / 2) * sx, 1.6);
      ctx.fillRect(b.x * sx - half, b.y * sy - half, half * 2, half * 2);
      ctx.strokeRect(b.x * sx - half, b.y * sy - half, half * 2, half * 2);
    }
    // Every Town Center the viewer knows of, last: a big square in its people's colour with a pale rim and a dark heart, so a found
    // town reads at a glance among the small buildings, and an enemy one is a target to find.
    const dpr = this.canvas.width / (this.canvas.clientWidth || 184);
    for (const h of hearts) {
      const half = Math.max(4.5 * dpr, 2.2 * sx);
      const x = h.x * sx;
      const y = h.y * sy;
      ctx.fillStyle = s.players[h.owner].color;
      ctx.fillRect(x - half, y - half, half * 2, half * 2);
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = '#f5ecd2';
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      ctx.fillRect(x - half * 0.3, y - half * 0.3, half * 0.6, half * 0.6);
    }
    // Game, where the viewer can see it.
    for (const a of s.animals) {
      if (!reveal && !p.vis[Math.floor(a.y) * s.w + Math.floor(a.x)]) continue;
      // Deer pale; a mammoth (#171) big and brown; wolves a warning red.
      ctx.fillStyle = a.kind === 'mammoth' ? '#9a6a3c' : a.kind === 'wolf' ? '#d2493a' : a.kind === 'boar' ? '#b8622e' : a.kind === 'raider' ? '#e0a31f' : '#e8c79a';
      // A flock (#308): wool white, ringed in its people's colour.
      if (a.kind === 'sheep' && a.owner !== undefined) {
        const r = Math.max(1.5, sx * 0.7);
        ctx.fillStyle = s.players[a.owner]?.color ?? '#ffffff';
        ctx.fillRect(a.x * sx - r - 0.6, a.y * sy - r - 0.6, r * 2 + 1.2, r * 2 + 1.2);
        ctx.fillStyle = '#f4efe2';
        ctx.fillRect(a.x * sx - r * 0.6, a.y * sy - r * 0.6, r * 1.2, r * 1.2);
        continue;
      }
      const r = Math.max(1.2, sx * (a.kind === 'mammoth' ? 1.1 : 0.6));
      ctx.fillRect(a.x * sx - r, a.y * sy - r, r * 2, r * 2);
    }
    // Trading posts the viewer has found: a sand-coloured square with a dark rim and a camel-brown dot.
    for (const t of s.posts) {
      // A post that sells rare ore (#573) is named by the viewer's lodge, seen or not, and wears the ore's colour at its heart.
      const sells = t.sells?.[0];
      if (!reveal && !p.seen[Math.floor(t.y) * s.w + Math.floor(t.x)] && !(sells && prospected(p))) continue;
      const rr = Math.max(3, sx * 1.8);
      ctx.fillStyle = '#e8d2a0';
      ctx.fillRect(t.x * sx - rr, t.y * sy - rr, rr * 2, rr * 2);
      ctx.strokeStyle = 'rgba(40,24,0,0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x * sx - rr, t.y * sy - rr, rr * 2, rr * 2);
      ctx.fillStyle = sells ? CHART_COLOR[sells] : '#8a5a2e';
      ctx.fillRect(t.x * sx - rr * 0.4, t.y * sy - rr * 0.4, rr * 0.8, rr * 0.8);
    }
    // Ancient ruins the viewer has found (#64): a pale stone column mark with a dark rim.
    // A dug ruin is hollow and rimmed in its digger's colour; one still standing is a pale column pair.
    // Under fog each shows as it was when last seen (waymarks, #152).
    for (const r of s.ruins ?? []) {
      let by = reveal ? r.by : this.waymarks.ruins.get(r.id);
      // A ruin never seen but charted by the viewer's lodge (#565): drawn as one still standing.
      if (by === undefined && p.chart) by = -1;
      if (by === undefined) continue;
      const rr = Math.max(2.4, sx * 1.4);
      const dug = by >= 0;
      ctx.fillStyle = dug ? '#8d8676' : '#d8cfb8';
      ctx.strokeStyle = dug ? s.players[by].color : 'rgba(40,30,10,0.85)';
      ctx.lineWidth = dug ? 1.5 : 1;
      ctx.fillRect(r.x * sx - rr, r.y * sy - rr * 0.5, rr * 0.7, rr * 1.5);
      ctx.fillRect(r.x * sx + rr * 0.3, r.y * sy - rr, rr * 0.7, rr * 2);
      ctx.strokeRect(r.x * sx - rr, r.y * sy - rr * 0.5, rr * 0.7, rr * 1.5);
      ctx.strokeRect(r.x * sx + rr * 0.3, r.y * sy - rr, rr * 0.7, rr * 2);
      if (dug) {
        ctx.beginPath();
        ctx.moveTo(r.x * sx - rr, r.y * sy + rr);
        ctx.lineTo(r.x * sx + rr, r.y * sy - rr);
        ctx.stroke();
      }
    }
    // Finds (#588): a pale amber ring with a dark rim once the viewer has seen one, hollow in its finder's colour once claimed.
    // What a claimed find taught the viewer (`leads`) shows as a dashed ring in the key resource's colour at the nearest of it.
    for (const f of s.finds ?? []) {
      if (!reveal && !p.seen[Math.floor(f.y) * s.w + Math.floor(f.x)]) continue;
      const rr = Math.max(2.6, sx * 1.5);
      ctx.beginPath();
      ctx.arc(f.x * sx, f.y * sy, rr, 0, Math.PI * 2);
      if (f.by < 0) {
        ctx.fillStyle = '#f0c25a';
        ctx.fill();
        ctx.strokeStyle = 'rgba(50,30,0,0.9)';
        ctx.lineWidth = 1.2;
      } else {
        ctx.strokeStyle = s.players[f.by].color;
        ctx.lineWidth = 1.8;
      }
      ctx.stroke();
    }
    if (!reveal) {
      for (const l of p.leads ?? []) {
        if (!l.at) continue;
        const rr = Math.max(3.2, sx * 2);
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.arc(l.at.x * sx, l.at.y * sy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = CHART_COLOR[l.key];
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Landmarks the viewer has found: a stone-grey triangle, filled in its keeper's colour (as last seen).
    for (const m of s.landmarks ?? []) {
      const keeper = reveal ? m.owner : this.waymarks.landmarks.get(m.id);
      if (keeper === undefined) continue;
      const rr = Math.max(3, sx * 1.8);
      ctx.beginPath();
      ctx.moveTo(m.x * sx, m.y * sy - rr);
      ctx.lineTo(m.x * sx + rr, m.y * sy + rr * 0.8);
      ctx.lineTo(m.x * sx - rr, m.y * sy + rr * 0.8);
      ctx.closePath();
      ctx.fillStyle = keeper >= 0 ? s.players[keeper].color : '#c9c2b2';
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,16,8,0.9)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // Relics lying where the viewer last saw them: a gold diamond with a dark rim, dimmed while out of sight.
    for (const r of s.relics) {
      const m = reveal ? { x: r.x, y: r.y, hidden: !!(r.carrier || r.temple) } : this.waymarks.relics.get(r.id);
      if (!m || m.hidden) continue;
      const rr = Math.max(2.4, sx * 1.4);
      ctx.beginPath();
      ctx.moveTo(m.x * sx, m.y * sy - rr);
      ctx.lineTo(m.x * sx + rr, m.y * sy);
      ctx.lineTo(m.x * sx, m.y * sy + rr);
      ctx.lineTo(m.x * sx - rr, m.y * sy);
      ctx.closePath();
      const live = reveal || p.vis[Math.floor(m.y) * s.w + Math.floor(m.x)];
      ctx.globalAlpha = live ? 1 : 0.55;
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,24,0,0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Spilled key ore (#570): a small square in the ore's colour where the viewer sees it, and everywhere, dimmed under fog, once assayed.
    const assay = assayed(p);
    for (const c of s.caches ?? []) {
      const live = reveal || p.vis[Math.floor(c.y) * s.w + Math.floor(c.x)];
      if (!live && !assay) continue;
      const rr = Math.max(2, sx * 1.1);
      ctx.globalAlpha = live ? 1 : 0.7;
      ctx.fillStyle = CHART_COLOR[c.ore];
      ctx.fillRect(c.x * sx - rr, c.y * sy - rr, rr * 2, rr * 2);
      ctx.strokeStyle = 'rgba(30,18,6,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x * sx - rr, c.y * sy - rr, rr * 2, rr * 2);
      ctx.globalAlpha = 1;
    }
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside) continue;
      if (e.owner !== viewer && !reveal && !p.vis[Math.floor(e.y) * s.w + Math.floor(e.x)]) continue;
      ctx.fillStyle = selected.has(e.id) ? '#ffffff' : s.players[e.owner].color;
      const dom = domainOf(e.type);
      const r = Math.max(1.6, sx * 0.8) * (dom === 'land' ? 1 : 1.35);
      if (dom === 'air') {
        // Aircraft: a little diamond.
        ctx.beginPath();
        ctx.moveTo(e.x * sx, e.y * sy - r * 1.2);
        ctx.lineTo(e.x * sx + r * 1.2, e.y * sy);
        ctx.lineTo(e.x * sx, e.y * sy + r * 1.2);
        ctx.lineTo(e.x * sx - r * 1.2, e.y * sy);
        ctx.fill();
      } else {
        // A dark edge so a dot reads on any ground, whatever its colour (#626).
        const dot = ctx.fillStyle;
        ctx.fillStyle = 'rgba(12,8,4,0.7)';
        ctx.fillRect(e.x * sx - r - 0.7, e.y * sy - r - 0.7, r * 2 + 1.4, r * 2 + 1.4);
        ctx.fillStyle = dot;
        ctx.fillRect(e.x * sx - r, e.y * sy - r, r * 2, r * 2);
        // A thrall (#502): the slayer's colour with a dark pip, so a rival can tell the bound from a free citizen.
        if (e.thrall) {
          ctx.fillStyle = 'rgba(20,12,4,0.9)';
          ctx.fillRect(e.x * sx - r * 0.45, e.y * sy - r * 0.45, r * 0.9, r * 0.9);
        }
      }
    }

    // Your own rooted Ents (the Age of the Wildwood): your colour round a leaf-green core, so you know which trees are yours to wake.
    // A rival sees only a tree.
    for (const w of s.wardens ?? []) {
      if (w.owner !== viewer && !reveal) continue;
      const x = ((w.tile % s.w) + 0.5) * sx;
      const y = (Math.floor(w.tile / s.w) + 0.5) * sy;
      const r = Math.max(1.6, sx * 0.8);
      ctx.fillStyle = s.players[w.owner].color;
      ctx.fillRect(x - r - 0.7, y - r - 0.7, r * 2 + 1.4, r * 2 + 1.4);
      ctx.fillStyle = '#5f9a3a';
      ctx.fillRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2);
    }

    // A rival's keepsake the viewer has seen (#726): a ring in its people's colour with a pale core, over its building.
    for (const k of keepsakes) {
      const x = k.x * sx, y = k.y * sy, r = Math.max(4.5, cw / 46);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.players[k.owner].color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#f5ecd2';
      ctx.fill();
    }
    // Personal notes stay visible on ground the player has already explored.
    for (const f of scoutFlags) {
      const x = f.x * sx, y = f.y * sy;
      const r = Math.max(4, cw / 54);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.85, y + r * 0.7);
      ctx.lineTo(x - r * 0.85, y + r * 0.7);
      ctx.closePath();
      ctx.fillStyle = f.kind === 'danger' ? '#ff655a' : '#ffdf8a';
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, cw / 185);
      ctx.strokeStyle = '#1d2432';
      ctx.stroke();
      ctx.fillStyle = '#1d2432';
      ctx.fillRect(x - 0.8, y - 1, 1.6, 2.2);
    }

    // The camera's view.
    if (footprint.length === 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1, cw / 180);
      ctx.beginPath();
      footprint.forEach((f, i) => (i ? ctx.lineTo(f.x * sx, f.z * sy) : ctx.moveTo(f.x * sx, f.z * sy)));
      ctx.closePath();
      ctx.stroke();
    }

    // Warheads in the air (#762): the rings this viewer is shown, all alike (a rival's three, or the real one flashing once revealed;
    // the launcher's own side its aim, in amber). Never the hidden point.
    for (const l of s.launches ?? []) {
      const own = s.players[viewer].team === s.players[l.owner].team;
      const flash = !own && revealed(s, l);
      ctx.strokeStyle = own ? '#ffb03a' : '#ff3a2a';
      ctx.globalAlpha = flash ? 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 70)) : 0.85;
      ctx.lineWidth = Math.max(1.5, cw / 120);
      for (const g of ringsFor(s, l, viewer)) {
        ctx.beginPath();
        ctx.arc(g.x * sx, g.y * sy, warnRadius(s, l.owner) * sx, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const now = performance.now();
    this.pings = this.pings.filter((pg) => now - pg.born < (pg.heavy ? 4800 : 2400));
    for (const pg of this.pings) {
      const life = pg.heavy ? 4800 : 2400;
      const k = (now - pg.born) / life;
      ctx.strokeStyle = pg.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = pg.heavy ? 3 : 2;
      for (const off of pg.heavy ? [0, 0.25, 0.5] : [0, 0.35]) {
        const kk = (k * (pg.heavy ? 4 : 2) + off) % 1;
        ctx.beginPath();
        ctx.arc(pg.x * sx, pg.y * sy, (4 + kk * (pg.heavy ? 26 : 16)) * (cw / 190), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
