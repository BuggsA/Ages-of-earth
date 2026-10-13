import { domainOf } from '../sim/data';
import type { GameState } from '../sim/types';
import { R_BERRY, R_FISH, R_GOLD, R_MEAT, R_STONE, R_TREE, T_ROCK, T_SAND, T_WATER } from '../sim/types';

/**
 * The overview map: the land through the player's fog, woods and mines, the buildings they know of,
 * units in sight, the camera's view and pings where things happen. Click or drag to look somewhere;
 * right-click to send the selected units there.
 */

interface Ping {
  x: number;
  y: number;
  color: string;
  born: number;
}

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export class Minimap {
  onLook: ((x: number, y: number) => void) | null = null;
  onCommand: ((x: number, y: number) => void) | null = null;
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private baseCtx: CanvasRenderingContext2D;
  private land: Uint8ClampedArray = new Uint8ClampedArray(0);
  private img: ImageData | null = null;
  private pings: Ping[] = [];
  private dragging = false;
  private w = 1;
  private h = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.baseCtx = this.base.getContext('2d')!;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        const p = this.toMap(e);
        this.onCommand?.(p.x, p.y);
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
    const grass = rgb('#6fa548');
    const grass2 = rgb('#7fb354');
    const sand = rgb('#d9c48a');
    const water = rgb('#2f7fae');
    const rock = rgb('#8d8579');
    for (let i = 0; i < s.w * s.h; i++) {
      const t = s.terrain[i];
      const c = t === T_WATER ? water : t === T_SAND ? sand : t === T_ROCK ? rock : (i * 7) % 5 ? grass : grass2;
      this.land.set(c, i * 3);
    }
    this.pings = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = this.canvas.clientWidth || 184;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
  }

  ping(x: number, y: number, color: string): void {
    this.pings.push({ x, y, color, born: performance.now() });
    if (this.pings.length > 12) this.pings.shift();
  }

  draw(
    s: GameState,
    viewer: number,
    reveal: boolean,
    buildings: Iterable<{ owner: number; x: number; y: number; size: number }>,
    footprint: { x: number; z: number }[],
    selected: Set<number>,
  ): void {
    if (!this.img) return;
    const p = s.players[viewer];
    const d = this.img.data;
    const tree = rgb('#2f6a32');
    const gold = rgb('#ffd24a');
    const stone = rgb('#d8d3c8');
    const berry = rgb('#e0405a');
    const fish = rgb('#8fe3f2');
    for (let i = 0; i < s.w * s.h; i++) {
      const seen = reveal || p.seen[i];
      const vis = reveal || p.vis[i];
      let r = this.land[i * 3];
      let g = this.land[i * 3 + 1];
      let b = this.land[i * 3 + 2];
      const res = s.res[i];
      if (res === R_TREE) [r, g, b] = tree;
      else if (res === R_GOLD) [r, g, b] = gold;
      else if (res === R_STONE) [r, g, b] = stone;
      else if (res === R_BERRY || res === R_MEAT) [r, g, b] = berry;
      else if (res === R_FISH) [r, g, b] = fish;
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

    for (const b of buildings) {
      const pl = s.players[b.owner];
      ctx.fillStyle = pl.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      const half = (b.size / 2) * sx;
      ctx.fillRect(b.x * sx - half, b.y * sy - half, half * 2, half * 2);
      ctx.strokeRect(b.x * sx - half, b.y * sy - half, half * 2, half * 2);
    }
    // Game, where the viewer can see it.
    ctx.fillStyle = '#e8c79a';
    for (const a of s.animals) {
      if (!reveal && !p.vis[Math.floor(a.y) * s.w + Math.floor(a.x)]) continue;
      const r = Math.max(1.2, sx * 0.6);
      ctx.fillRect(a.x * sx - r, a.y * sy - r, r * 2, r * 2);
    }
    // Relics lying where the viewer has explored: a gold diamond with a dark rim, easy to spot.
    for (const r of s.relics) {
      if (r.carrier || r.temple || (!reveal && !p.seen[Math.floor(r.y) * s.w + Math.floor(r.x)])) continue;
      const rr = Math.max(2.4, sx * 1.4);
      ctx.beginPath();
      ctx.moveTo(r.x * sx, r.y * sy - rr);
      ctx.lineTo(r.x * sx + rr, r.y * sy);
      ctx.lineTo(r.x * sx, r.y * sy + rr);
      ctx.lineTo(r.x * sx - rr, r.y * sy);
      ctx.closePath();
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,24,0,0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();
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
      } else ctx.fillRect(e.x * sx - r, e.y * sy - r, r * 2, r * 2);
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

    const now = performance.now();
    this.pings = this.pings.filter((pg) => now - pg.born < 2400);
    for (const pg of this.pings) {
      const k = (now - pg.born) / 2400;
      ctx.strokeStyle = pg.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      for (const off of [0, 0.35]) {
        const kk = (k * 2 + off) % 1;
        ctx.beginPath();
        ctx.arc(pg.x * sx, pg.y * sy, (4 + kk * 16) * (cw / 190), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}
