import * as THREE from 'three';
import { battlesFor, tideWord, type Battle } from '../sim/battles';
import { BATTLE, secs } from '../sim/data';
import type { GameState } from '../sim/types';
import { heightAt } from '../render/terrain';

/**
 * The tide of battle (#606): a small bar over each fight the player's side is in, their colour against the foe's,
 * with a word for how it stands and an arrow for which way it swings. A click on the bar picks up the player's
 * own fighters there. `read` refreshes the fights (a few times a second) and returns the ones that just turned.
 */

const WORDS = { crushing: 'Crushing', winning: 'Winning', even: 'Even', losing: 'Losing', routed: 'Routed' };

interface Fight {
  el: HTMLDivElement;
  fill: HTMLDivElement;
  word: HTMLSpanElement;
  b: Battle;
  /** The share smoothed over a few reads, so the bar slides rather than jumps. */
  share: number;
  /** The smoothed share over the last few reads, oldest first: the arrow compares the newest with the oldest. */
  past: number[];
  /** The best it has stood, so a fall from even or better can be told. */
  best: number;
  warned: boolean;
  /** Seconds since a read last found it; it fades out, then goes. */
  gone: number;
}

export class BattleTide {
  private fights: Fight[] = [];
  private v = new THREE.Vector3();
  private lastWarn = -Infinity;

  constructor(private layer: HTMLElement, private pick: (ids: number[]) => void) {}

  /** Read the fights afresh. Returns the fights that turned against the player since the last read. */
  read(s: GameState, viewer: number, dt: number): Battle[] {
    const now = battlesFor(s, viewer);
    const join2 = BATTLE.join * BATTLE.join;
    const taken = new Set<Fight>();
    const turned: Battle[] = [];
    for (const b of now) {
      let f: Fight | undefined;
      let best = join2;
      for (const o of this.fights) {
        if (taken.has(o)) continue;
        const d = (o.b.x - b.x) * (o.b.x - b.x) + (o.b.y - b.y) * (o.b.y - b.y);
        if (d <= best) ((best = d), (f = o));
      }
      if (!f) f = this.make(b);
      taken.add(f);
      f.b = b;
      f.gone = 0;
      f.share += (b.share - f.share) * 0.45;
      f.past.push(f.share);
      if (f.past.length > 6) f.past.shift();
      f.best = Math.max(f.best, f.share);
      if (!f.warned && f.best >= BATTLE.even && f.share < BATTLE.turn) {
        f.warned = true;
        if (s.tick - this.lastWarn >= secs(BATTLE.warnEvery)) {
          this.lastWarn = s.tick;
          turned.push(b);
        }
      }
      // A fight won back may warn again if it turns once more.
      if (f.warned && f.share >= BATTLE.even) f.warned = false;
      this.paint(s, viewer, f);
    }
    for (const f of this.fights) if (!taken.has(f)) f.gone += dt;
    for (const f of this.fights.filter((x) => x.gone > 1.2)) f.el.remove();
    this.fights = this.fights.filter((x) => x.gone <= 1.2);
    return turned;
  }

  /** Whether a point lies within the camera's view. */
  onScreen(s: GameState, camera: THREE.Camera, x: number, y: number): boolean {
    this.v.set(x, heightAt(s, x, y), y).project(camera);
    return this.v.z <= 1 && Math.abs(this.v.x) < 0.95 && Math.abs(this.v.y) < 0.95;
  }

  /** Put the bars on screen, each above its fight. */
  place(s: GameState, camera: THREE.Camera): void {
    const w = this.layer.clientWidth || window.innerWidth;
    const h = this.layer.clientHeight || window.innerHeight;
    for (const f of this.fights) {
      this.v.set(f.b.x, heightAt(s, f.b.x, f.b.y) + 2.2, f.b.y).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1) {
        f.el.style.display = 'none';
        continue;
      }
      f.el.style.display = '';
      f.el.style.opacity = String(Math.max(0, 1 - f.gone / 1.2));
      f.el.style.transform = `translate(-50%, -100%) translate(${(((this.v.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - this.v.y) / 2) * h).toFixed(1)}px)`;
    }
  }

  clear(): void {
    for (const f of this.fights) f.el.remove();
    this.fights = [];
    this.lastWarn = -Infinity;
  }

  private make(b: Battle): Fight {
    const el = document.createElement('div');
    el.className = 'tide';
    const bar = document.createElement('div');
    bar.className = 'tide-bar';
    const fill = document.createElement('div');
    fill.className = 'tide-fill';
    bar.appendChild(fill);
    const word = document.createElement('span');
    word.className = 'tide-word';
    el.append(word, bar);
    const f: Fight = { el, fill, word, b, share: b.share, past: [], best: b.share, warned: false, gone: 0 };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (f.b.ours.length) this.pick(f.b.ours);
    });
    this.layer.appendChild(el);
    this.fights.push(f);
    return f;
  }

  private paint(s: GameState, viewer: number, f: Fight): void {
    const pct = Math.round(f.share * 100);
    f.fill.style.width = `${pct}%`;
    f.fill.style.background = s.players[viewer].color;
    (f.fill.parentElement as HTMLElement).style.background = s.players[f.b.foe]?.color ?? '#c33';
    const swing = f.past.length > 1 ? f.share - f.past[0] : 0;
    const arrow = swing > 0.04 ? ' ▲' : swing < -0.04 ? ' ▼' : '';
    const w = tideWord(f.share);
    f.word.textContent = `${WORDS[w]}${arrow}`;
    f.el.dataset.tide = w;
    f.el.title = `${WORDS[w]}: ${f.b.mine} of yours against ${f.b.theirs} you can see (${pct}% of the strength). Click to pick up your fighters here.`;
  }
}
