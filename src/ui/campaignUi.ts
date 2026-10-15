import { SCENARIOS, describe, type Scenario } from '../sim/campaign';
import type { GameState } from '../sim/types';
import { getCloudProgress, putCloudProgress, vaultKey } from '../net/cloud';
import { mergeProgress } from '../net/vault';

/** The campaign screens: chapter list, briefing, and the objectives panel during play. Progress lives in localStorage. */

const KEY = 'ages-campaign';

export type Progress = Record<string, number>;

export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** Keep the best star count for a chapter. */
export function recordStars(id: string, stars: number): void {
  const p = loadProgress();
  if (stars <= (p[id] ?? 0)) return;
  p[id] = stars;
  saveProgress(p);
  pushProgress();
}

const SYNC = 'ages-campaign-sync';

function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* Storage is off: progress is simply not kept. */
  }
}

/**
 * Stars follow the save key (#292): once the cloud panel has been opened, every win is sent up in the
 * background, and opening the panel (or typing in another device's key) merges this browser's stars with
 * the vault's, best of each chapter. Returns how many chapters the vault taught this browser.
 */
export async function syncProgress(): Promise<number> {
  const key = vaultKey();
  const local = loadProgress();
  const remote = await getCloudProgress(key);
  const merged = mergeProgress(local, remote);
  const learned = Object.keys(merged).filter((id) => merged[id] > (local[id] ?? 0)).length;
  saveProgress(merged);
  if (Object.keys(merged).some((id) => merged[id] > (remote[id] ?? 0))) await putCloudProgress(key, merged);
  try {
    localStorage.setItem(SYNC, '1');
  } catch {
    /* No storage: syncing happens only when the panel is opened. */
  }
  return learned;
}

/** After a win: if this browser syncs, send the stars up (a failure is ignored; the panel syncs again). */
function pushProgress(): void {
  try {
    if (localStorage.getItem(SYNC) !== '1') return;
  } catch {
    return;
  }
  void putCloudProgress(vaultKey(), loadProgress()).catch(() => undefined);
}

/** Chapter n opens once the chapter before it has been won. */
export const unlocked = (i: number, p: Progress) => i === 0 || (p[SCENARIOS[i - 1].id] ?? 0) > 0;

const starRow = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function chapterListHtml(): string {
  const p = loadProgress();
  const rows = SCENARIOS.map((sc, i) => {
    const open = unlocked(i, p);
    const stars = p[sc.id] ?? 0;
    return `<button class="chapter ${open ? '' : 'locked'}" ${open ? `data-act="camp-open" data-id="${sc.id}"` : 'disabled'}>
      <span class="ch-num">${i + 1}</span>
      <span class="ch-body"><b>${sc.title}</b><small>${open ? sc.place : 'Win the chapter before to unlock'}</small></span>
      <span class="ch-stars ${stars ? 'won' : ''}">${open ? starRow(stars) : '🔒'}</span>
    </button>`;
  }).join('');
  return `<div class="title-card camp-card"><h1>The <span>Long</span> Road</h1>
    <p class="tagline">Six chapters from the Stone Age to the age of flight. Win to unlock the next; earn stars for bonus goals and for a clean, quick victory.</p>
    <div class="chapters">${rows}</div>
    <div class="title-buttons"><button class="btn big" data-act="camp-back">Back</button></div></div>`;
}

export function briefingHtml(sc: Scenario): string {
  const goals = sc.objectives.map((o) => `<li class="${o.bonus ? 'bonus' : ''}">${o.text}</li>`).join('');
  const limit = sc.limit ? `<p class="hint">Time limit: ${Math.round(sc.limit / 60)} minutes.</p>` : '';
  return `<div class="title-card camp-card"><h1>${sc.title}</h1>
    <p class="tagline">${sc.place}</p>
    <p class="brief">${sc.brief}</p>
    <h3 class="goals-h">Your goals</h3><ul class="goals">${goals}</ul>${limit}
    <div class="title-buttons"><button class="btn primary big" data-act="camp-begin" data-id="${sc.id}">Begin</button><button class="btn big" data-act="camp-list">Chapters</button></div></div>`;
}

/** The goals shown in the corner while playing. */
export function objectivesHtml(s: GameState, sc: Scenario): string {
  const run = s.scenario!;
  const items = sc.objectives
    .map((o, i) => `<li class="${run.done[i] ? 'done' : ''} ${o.bonus ? 'bonus' : ''}"><span class="tick">${run.done[i] ? '✔' : o.bonus ? '★' : '◻'}</span>${describe(s, o)}</li>`)
    .join('');
  const left = sc.limit ? Math.max(0, sc.limit - Math.floor(s.tick / 20)) : -1;
  const clock = left >= 0 ? `<div class="obj-limit ${left < 120 ? 'bad' : ''}">Time left ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div>` : '';
  return `<div class="obj-title">${sc.title}</div><ul>${items}</ul>${clock}`;
}

export { starRow };
