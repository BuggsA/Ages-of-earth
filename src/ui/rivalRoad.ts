import { AGES, BUILDINGS, ROADS, STEP_BACK, TICK_HZ, TRUNK, secs } from '../sim/data';
import { ageOf, hasWalked } from '../sim/ages';
import type { AgeId, GameState } from '../sim/types';

/**
 * Reading the rival's road (#726, `docs/engagement.md` Phase 1, step 2). A rival's age change was always told to everyone as it
 * happened, so this card only remembers it: the age's verb and door, the road walked so far, the weak window after a step back,
 * and a crossing the rival is half-way to. What it adds from sight is the keepsake: a rival building the viewer has seen that
 * keeps an older age's work names an age the rival has walked. Nothing here reads what the viewer's eyes have not seen.
 */

export interface RoadStep {
  age: AgeId;
  back: boolean;
  tick: number;
}

export interface SeenKeepsake {
  owner: number;
  id: number;
  age: AgeId;
  x: number;
  y: number;
}

export class RivalLedger {
  private steps = new Map<number, RoadStep[]>();
  private kept = new Map<number, SeenKeepsake>();

  /** An age change, as the `epoch` event told it. */
  note(owner: number, age: AgeId, back: boolean, tick: number): void {
    const list = this.steps.get(owner) ?? [];
    list.push({ age, back, tick });
    this.steps.set(owner, list);
  }

  /** The road walked so far, oldest first. A match joined late (a save, a replay) starts from what the rival's record shows. */
  history(s: GameState, owner: number): RoadStep[] {
    const have = this.steps.get(owner);
    if (have?.length) return have;
    const p = s.players[owner];
    const seed: RoadStep[] = [];
    for (let t = 0; t < Math.min(p.epoch, TRUNK.length); t++) seed.push({ age: TRUNK[t], back: false, tick: 0 });
    for (const a of p.walked ?? []) seed.push({ age: a, back: false, tick: 0 });
    if (!seed.some((x) => x.age === ageOf(p))) seed.push({ age: ageOf(p), back: false, tick: 0 });
    return seed;
  }

  /** Seconds left in the weak window after a step back (the units fallen back to their older form), or 0. */
  windowLeft(s: GameState, owner: number): number {
    const last = this.steps.get(owner)?.at(-1);
    if (!last?.back || last.age !== ageOf(s.players[owner])) return 0;
    return Math.max(0, Math.ceil((last.tick + secs(STEP_BACK.time) - s.tick) / TICK_HZ));
  }

  /**
   * Notes the keepsakes of rivals the viewer's eyes are on now (`sees`), and forgets those whose building has fallen.
   * Returns the ones seen for the first time.
   */
  scan(s: GameState, viewer: number, sees: (x: number, y: number) => boolean): SeenKeepsake[] {
    const fresh: SeenKeepsake[] = [];
    for (const id of [...this.kept.keys()]) if (!s.ents.some((e) => e.id === id && e.kind === 'building' && e.hp > 0)) this.kept.delete(id);
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.owner === viewer || !e.keep || e.hp <= 0 || this.kept.has(e.id) || !sees(e.x, e.y)) continue;
      const k = { owner: e.owner, id: e.id, age: e.keep, x: e.x, y: e.y };
      this.kept.set(e.id, k);
      fresh.push(k);
    }
    return fresh;
  }

  keepsakes(owner?: number): SeenKeepsake[] {
    return [...this.kept.values()].filter((k) => owner === undefined || k.owner === owner);
  }
}

/** Crossings (#585) a rival is half-way to: one sibling walked, the other and the crossing age not yet. */
export function halfCrossings(s: GameState, owner: number): { to: AgeId; missing: AgeId }[] {
  const p = s.players[owner];
  const out: { to: AgeId; missing: AgeId }[] = [];
  for (const r of ROADS) {
    if (!r.crossing || hasWalked(p, r.to)) continue;
    const left = r.crossing.filter((a) => !hasWalked(p, a));
    if (left.length === 1 && !out.some((o) => o.to === r.to)) out.push({ to: r.to, missing: left[0] });
  }
  return out;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One rival's card. */
export function rivalCardHtml(s: GameState, owner: number, ledger: RivalLedger): string {
  const p = s.players[owner];
  const here = AGES[ageOf(p)];
  const hist = ledger.history(s, owner);
  const road = hist.map((x) => `${x.back ? '↩ ' : ''}${esc(AGES[x.age].short)}`).join(' → ');
  const out = [`<div class="rv-card"><div class="rv-head"><i style="background:${p.color}"></i>${esc(p.name)} <span>${esc(here.name)}</span></div>`];
  out.push(`<p>${esc(here.verb ?? here.good ?? here.blurb)}</p>`);
  if (here.door) out.push(`<p class="rv-door">Shuts: ${esc(here.door)}</p>`);
  const left = ledger.windowLeft(s, owner);
  if (left > 0) out.push(`<p class="rv-window">↩ Stepped back: its soldiers fall back to their older form for ${left} s. A chance to strike.</p>`);
  out.push(`<p class="rv-road">${road}</p>`);
  for (const c of halfCrossings(s, owner)) out.push(`<p class="rv-cross">🔀 Half-way to the ${esc(AGES[c.to].name)}: it still needs the ${esc(AGES[c.missing].name)}.</p>`);
  for (const k of ledger.keepsakes(owner)) {
    const b = s.ents.find((e) => e.id === k.id);
    out.push(`<p class="rv-keep">🏺 You have seen a ${esc(b && b.kind === 'building' ? BUILDINGS[b.type].name : 'building')} kept from the ${esc(AGES[k.age].name)}: they have walked the ${esc(AGES[k.age].name)}.</p>`);
  }
  out.push('</div>');
  return out.join('');
}

/** The Rivals button's panel: one card per rival still in the match. */
export class RivalPanel {
  private open = false;
  private sig = '';

  constructor(private btn: HTMLElement, private panel: HTMLElement, private ledger: RivalLedger) {
    btn.addEventListener('click', () => this.show(!this.open));
  }

  show(open: boolean): void {
    this.open = open;
    this.panel.classList.toggle('hidden', !open);
    this.btn.setAttribute('aria-expanded', String(open));
    this.sig = '';
  }

  update(s: GameState, viewer: number): void {
    if (!this.open) return;
    const html = s.players.filter((p) => p.id !== viewer && !p.defeated).map((p) => rivalCardHtml(s, p.id, this.ledger)).join('') || '<p class="rv-dim">No rival in sight.</p>';
    if (html === this.sig) return;
    this.sig = html;
    this.panel.innerHTML = html;
  }
}
