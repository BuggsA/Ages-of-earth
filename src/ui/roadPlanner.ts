import { ROADS, AGES } from '../sim/data';
import { ageOf, backTo, crossingLeft, hasWalked, roadKnown, roadsFrom, routeTo, type RouteStep } from '../sim/ages';
import type { AgeId, GameState } from '../sim/types';
import { ageView, type Discovery } from './webMap';
import { costHtml } from './icons';

/**
 * The road planner (#725, `docs/engagement.md` Phase 1): a panel beside the age chip, opened by a toggle the browser remembers,
 * listing the roads known from where the people stands with their prices and what leaving does, and the shortest journey to a
 * pinned goal age. It reads the rules and issues nothing; the pin lives in browser storage, like the web map's discoveries.
 */

const KEY = 'ages-planner';

export interface PlannerPrefs {
  open: boolean;
  goal: AgeId | null;
}

export function loadPlannerPrefs(): PlannerPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { open: raw?.open === true, goal: typeof raw?.goal === 'string' && raw.goal in AGES ? (raw.goal as AgeId) : null };
  } catch {
    return { open: false, goal: null };
  }
}

export function savePlannerPrefs(prefs: PlannerPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Storage is off: the panel starts shut and unpinned next time. */
  }
}

/** The ages a goal may be pinned to: only those the map shows (seen, never a hidden age), and not where the people stands. */
export const goalChoices = (d: Discovery, here: AgeId): AgeId[] =>
  (Object.keys(AGES) as AgeId[]).filter((a) => a !== here && ageView(d, a) !== 'hidden').sort((a, b) => AGES[a].tier - AGES[b].tier);

const secs = (n: number) => `${Math.round(n)} s`;

/** One leg as a line: "step back (cost, time)" or "Sail (cost, time)", and what still keeps the people off it. */
function stepHtml(step: RouteStep, have: Parameters<typeof costHtml>[1], extra: string): string {
  const name = step.back ? 'step back' : AGES[step.to].name;
  const dest = step.back ? ` to the ${AGES[step.to].name}` : '';
  return `<li><b>${name}</b>${dest} <span class="rp-cost">${costHtml(step.cost, have)} · ${secs(step.time)}</span>${step.problem ? `<br><span class="rp-problem">${step.problem}</span>` : ''}${extra}</li>`;
}

/**
 * The panel body. `lines` gives the keep / sleep / wake / lose lines for leaving the age where the people stands for another
 * (the HUD's `planLines`); they show on the first leg of a route and on each road out.
 */
export function plannerHtml(s: GameState, viewer: number, goal: AgeId | null, d: Discovery, lines: (to: AgeId, back: boolean) => string): string {
  const p = s.players[viewer];
  const here = ageOf(p);
  const out: string[] = [`<div class="rp-head">Roads from the ${AGES[here].name}</div>`];
  const choices = goalChoices(d, here);
  if (goal && !choices.includes(goal)) goal = hasWalked(p, goal) && goal !== here ? goal : null;
  out.push(
    `<label class="rp-goal">Goal <select data-rp="goal"><option value="">None</option>${choices.map((a) => `<option value="${a}"${a === goal ? ' selected' : ''}>${AGES[a].name}${hasWalked(p, a) ? ' ✓' : ''}</option>`).join('')}</select></label>`,
  );
  if (goal) {
    const route = routeTo(s, p, goal);
    if (!route) out.push(`<p class="rp-dim">No road you know leads to the ${AGES[goal].name} yet.</p>`);
    else {
      const total = route.reduce((t, x) => t + x.time, 0);
      out.push(`<div class="rp-route"><div class="rp-sub">To the ${AGES[goal].name}: ${route.length} step${route.length > 1 ? 's' : ''}, ${secs(total)}</div><ol>`);
      route.forEach((step, i) => out.push(stepHtml(step, i === 0 ? p.res : undefined, i === 0 ? lines(step.to, step.back) : '')));
      out.push('</ol></div>');
    }
  }
  const known = roadsFrom(p).filter((r) => roadKnown(s, p, r));
  const down = backTo(p);
  if (known.length || down) {
    out.push('<div class="rp-sub">Open from here</div><ul>');
    for (const r of known) out.push(`<li><b>${AGES[r.to].name}</b> <span class="rp-cost">${costHtml(r.cost, p.res)} · ${secs(r.time)}</span><button data-rp="pin" data-age="${r.to}" title="Plan a route to this age">📍</button>${lines(r.to, false)}</li>`);
    if (down) out.push(`<li><b>Step back (Z)</b> to the ${AGES[down].name} <span class="rp-cost">${costHtml(routeTo(s, p, down)?.[0]?.cost ?? {}, p.res)} · ${secs(routeTo(s, p, down)?.[0]?.time ?? 0)}</span><button data-rp="pin" data-age="${down}" title="Plan a route to this age">📍</button>${lines(down, true)}</li>`);
    out.push('</ul>');
  }
  // Half-walked crossings (#585) stand as goals: the road shows because one sibling is walked; the other is the way.
  const half = ROADS.filter((r) => r.crossing && roadKnown(s, p, r) && !hasWalked(p, r.to) && crossingLeft(p, r));
  if (half.length) {
    out.push('<div class="rp-sub">Half a crossing</div><ul>');
    for (const r of half) out.push(`<li>🔀 <b>${AGES[r.to].name}</b>: walk the ${AGES[crossingLeft(p, r)!].name} too<button data-rp="pin" data-age="${crossingLeft(p, r)}" title="Plan a route to the age it needs">📍</button></li>`);
    out.push('</ul>');
  }
  return out.join('');
}

/** The toggle and its panel in the top bar. */
export class RoadPlanner {
  private prefs = loadPlannerPrefs();
  private sig = '';
  private state: GameState | null = null;
  private viewer = 0;
  private disc: Discovery = { entered: [], roads: [] };

  constructor(private btn: HTMLElement, private panel: HTMLElement, private lines: (s: GameState, viewer: number, to: AgeId, back: boolean) => string) {
    this.sync();
    btn.addEventListener('click', () => {
      this.prefs.open = !this.prefs.open;
      savePlannerPrefs(this.prefs);
      this.sync();
      this.sig = '';
      if (this.state) this.update(this.state, this.viewer, this.disc);
    });
    panel.addEventListener('change', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-rp="goal"]');
      if (el) this.pin((el.value || null) as AgeId | null);
    });
    panel.addEventListener('click', (e) => {
      const pin = (e.target as HTMLElement).closest<HTMLElement>('[data-rp="pin"]');
      if (pin) this.pin(pin.dataset.age as AgeId);
    });
  }

  private sync(): void {
    this.panel.classList.toggle('hidden', !this.prefs.open);
    this.btn.setAttribute('aria-expanded', String(this.prefs.open));
  }

  pin(goal: AgeId | null): void {
    this.prefs.goal = goal;
    savePlannerPrefs(this.prefs);
    this.sig = '';
    if (this.state) this.update(this.state, this.viewer, this.disc);
  }

  /** Redraw when something it shows changed (cheap signature of the markup). */
  update(s: GameState, viewer: number, d: Discovery): void {
    this.state = s;
    this.viewer = viewer;
    this.disc = d;
    if (!this.prefs.open) return;
    const html = plannerHtml(s, viewer, this.prefs.goal, d, (to, back) => this.lines(s, viewer, to, back));
    if (html === this.sig) return;
    this.sig = html;
    this.panel.innerHTML = html;
  }
}
