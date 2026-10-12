import './ui/style.css';
import { sound, type SoundName } from './audio/sound';
import { CameraRig } from './render/camera';
import { QUALITY, type QualityName } from './render/post';
import { View, type Pick } from './render/view';
import { BUILDINGS, DT, EPOCHS, PLAYER_COLORS, TICK_HZ, unitStats } from './sim/data';
import { createGame, step } from './sim/game';
import { placeProblem } from './sim/grid';
import { spawnUnit } from './sim/world';
import type { BuildingType, Command, Difficulty, Ent, GameEvent, GameState, MapSize, Unit } from './sim/types';
import { R_NONE } from './sim/types';
import { Hud, nameOf } from './ui/hud';
import { Minimap } from './ui/minimap';

/**
 * The game in the browser: a title screen over a live match between two computer players, then a
 * match against the computer. The rules advance in fixed ticks (20 a second); the view draws between
 * them at the screen's frame rate. Everything the player does becomes a command for the next tick,
 * exactly as it would be sent to the other browsers in an online match.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const world = $('world');
const view = new View(world);
const minimap = new Minimap($('minimap') as HTMLCanvasElement);

type Mode = 'title' | 'play' | 'over';
let mode: Mode = 'title';
let game: GameState | null = null;
let viewer = 0;
let pending: Command[] = [];
let selection = new Set<number>();
let selectedTile: number | null = null;
let placing: BuildingType | null = null;
let placeAt: { tx: number; ty: number; ok: boolean } | null = null;
let amoveMode = false;
let paused = false;
const SPEEDS = [1, 1.5, 2, 3];
let speedIdx = 0;
const groups = new Map<number, number[]>();
let lastGroupKey = { key: -1, at: 0 };
let lastAlert: { x: number; y: number } | null = null;
let altHeld = false;
let acc = 0;
let lastFrame = performance.now();
let hudTimer = 0;
let mapTimer = 0;
let attractT = 0;
let lastSetup: { diff: Difficulty; size: MapSize; seed: number; color: number } | null = null;

const hud = new Hud({
  issue: (c) => issue(c),
  place: (type) => {
    placing = type;
    amoveMode = false;
    sound.play('click');
  },
  attackMove: () => {
    amoveMode = true;
    placing = null;
  },
  select: (ids) => setSelection(ids),
  focus: (x, y) => view.rig.focus(x, y),
  sound: (n) => sound.play(n),
});

function issue(c: Command): void {
  if (mode !== 'play') return;
  pending.push(c);
}

function play(name: SoundName, pan = 0, gain = 1): void {
  sound.play(name, { pan, gain });
}
view.onCue = (name, pan, gain) => play(name, pan, gain);
view.onPing = (x, y, color) => minimap.ping(x, y, color);

// ---- Starting matches ------------------------------------------------------------------------------

function newSeed(): number {
  return 1 + Math.floor(Math.random() * 999999);
}

function startAttract(): void {
  mode = 'title';
  const seed = newSeed();
  game = createGame({ seed, size: 'small', players: [{ name: 'Azure', ai: 'normal' }, { name: 'Crimson', ai: 'hard' }] });
  viewer = 0;
  view.setGame(game, 0);
  view.revealAll();
  view.rig.zoom(1.05);
  minimap.setup(game);
  // Skip ahead so there is a town to look at.
  for (let i = 0; i < TICK_HZ * 150; i++) step(game);
  attractT = 0;
}

function startMatch(diff: Difficulty, size: MapSize, seed: number, color: number): void {
  lastSetup = { diff, size, seed, color };
  const colors = [...PLAYER_COLORS];
  const rival = color === 1 ? 0 : 1;
  game = createGame({
    seed,
    size,
    players: [
      { name: 'You', ai: null, color: colors[color] },
      { name: 'Rival', ai: diff, color: colors[rival] },
    ],
  });
  viewer = 0;
  mode = 'play';
  pending = [];
  selection = new Set();
  selectedTile = null;
  placing = null;
  amoveMode = false;
  paused = false;
  speedIdx = 0;
  groups.clear();
  lastAlert = null;
  acc = 0;
  hud.reset();
  view.setGame(game, viewer);
  minimap.setup(game);
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('modal').classList.add('hidden');
  $('paused').classList.add('hidden');
  hud.banner(EPOCHS[0].name, 'Gather food and wood, build houses, grow your town.', 4200);
  sound.startAmbience();
  // Start with the Town Center in view and selected.
  const tc = game.ents.find((e) => e.kind === 'building' && e.owner === viewer);
  if (tc) setSelection([tc.id]);
}

function toTitle(): void {
  $('hud').classList.add('hidden');
  $('modal').classList.add('hidden');
  $('title').classList.remove('hidden');
  startAttract();
}

// ---- Title screen ----------------------------------------------------------------------------------

const seedInput = $<HTMLInputElement>('opt-seed');
seedInput.value = String(newSeed());
const colorSel = $<HTMLSelectElement>('opt-color');
colorSel.innerHTML = ['Blue', 'Red', 'Gold', 'Green'].map((n, i) => `<option value="${i}">${n}</option>`).join('');
const qualitySel = $<HTMLSelectElement>('opt-quality');
qualitySel.value = view.qualityName;
qualitySel.addEventListener('change', () => view.setQuality(qualitySel.value as QualityName));

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  sound.unlock();
  const act = el.dataset.act!;
  switch (act) {
    case 'start':
      sound.play('click');
      startMatch($<HTMLSelectElement>('opt-diff').value as Difficulty, $<HTMLSelectElement>('opt-size').value as MapSize, Number(seedInput.value) || newSeed(), Number(colorSel.value));
      break;
    case 'reroll':
      seedInput.value = String(newSeed());
      break;
    case 'idle':
      nextIdle();
      break;
    case 'speed':
      cycleSpeed(1);
      break;
    case 'pause':
      togglePause();
      break;
    case 'sound':
      toggleMute();
      break;
    case 'menu':
      openMenu();
      break;
    case 'resume':
      closeModal();
      break;
    case 'restart':
      if (lastSetup) startMatch(lastSetup.diff, lastSetup.size, lastSetup.seed, lastSetup.color);
      break;
    case 'new-map':
      if (lastSetup) startMatch(lastSetup.diff, lastSetup.size, newSeed(), lastSetup.color);
      break;
    case 'quit':
      toTitle();
      break;
    case 'resign':
      issue({ t: 'resign', p: viewer });
      closeModal();
      break;
    case 'watch':
      $('modal').classList.add('hidden');
      view.revealAll();
      break;
  }
});

// ---- Selection -------------------------------------------------------------------------------------

function setSelection(ids: number[], add = false): void {
  if (!game) return;
  const next = add ? new Set(selection) : new Set<number>();
  for (const id of ids) next.add(id);
  selection = next;
  selectedTile = null;
  hud.buildMenu = false;
  refreshHud();
}

/** Keep the selection to what still lives and can be seen. */
function pruneSelection(s: GameState): void {
  for (const id of selection) {
    const e = s.byId.get(id);
    if (!e || e.hp <= 0 || (e.owner !== viewer && !view.shows(e))) selection.delete(id);
  }
}

function selectedUnits(s: GameState, own = true): Unit[] {
  const out: Unit[] = [];
  for (const id of selection) {
    const e = s.byId.get(id);
    if (e && e.kind === 'unit' && (!own || e.owner === viewer)) out.push(e);
  }
  return out;
}

function nextIdle(): void {
  if (!game) return;
  const idle = game.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === viewer && e.type === 'citizen' && e.order.k === 'idle');
  if (!idle.length) {
    hud.toast('No idle citizens', 'info');
    return;
  }
  const cur = [...selection][0];
  const i = idle.findIndex((u) => u.id === cur);
  const u = idle[(i + 1) % idle.length];
  setSelection([u.id]);
  view.rig.focus(u.x, u.y);
  play('select');
}

function selectHome(): void {
  if (!game) return;
  const tcs = game.ents.filter((e) => e.kind === 'building' && e.owner === viewer && e.type === 'towncenter');
  if (!tcs.length) return;
  const cur = [...selection][0];
  const i = tcs.findIndex((t) => t.id === cur);
  const t = tcs[(i + 1) % tcs.length];
  setSelection([t.id]);
  view.rig.focus(t.x, t.y);
  play('selectBuilding');
}

// ---- Orders ----------------------------------------------------------------------------------------

function order(clientX: number, clientY: number, forceAttack = false): void {
  const s = game;
  if (!s || mode !== 'play') return;
  const units = selectedUnits(s);
  const pk = view.pick(clientX, clientY);
  if (!pk) return;
  const ids = units.map((u) => u.id);
  if (!units.length) {
    // A building of yours: set where its trainees gather.
    const b = [...selection].map((id) => s.byId.get(id)).find((e) => e && e.kind === 'building' && e.owner === viewer);
    if (b) {
      const at = pk.kind === 'ground' ? pk : pk.kind === 'resource' ? { x: (pk.tile % s.w) + 0.5, y: Math.floor(pk.tile / s.w) + 0.5 } : (() => {
        const t = s.byId.get(pk.id);
        return t ? { x: t.x, y: t.y } : null;
      })();
      if (at) {
        issue({ t: 'rally', p: viewer, building: b.id, x: at.x, y: at.y });
        view.marker(s, at.x, at.y, false);
        play('click');
      }
    }
    return;
  }
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id);
    if (!t) return;
    if (t.owner !== viewer) {
      issue({ t: 'attack', p: viewer, ids, target: t.id });
      view.marker(s, t.x, t.y, true);
      play('attack');
      return;
    }
    if (t.kind === 'building') {
      issue({ t: 'work', p: viewer, ids, target: t.id });
      view.marker(s, t.x, t.y, false);
      play(t.built ? 'move' : 'hammer');
      return;
    }
    issue({ t: 'move', p: viewer, ids, x: t.x, y: t.y, amove: forceAttack });
    view.marker(s, t.x, t.y, false);
    play('move');
    return;
  }
  if (pk.kind === 'resource') {
    issue({ t: 'gather', p: viewer, ids, tile: pk.tile });
    view.marker(s, (pk.tile % s.w) + 0.5, Math.floor(pk.tile / s.w) + 0.5, false);
    play('move');
    return;
  }
  issue({ t: 'move', p: viewer, ids, x: pk.x, y: pk.y, amove: forceAttack });
  view.marker(s, pk.x, pk.y, forceAttack);
  play(forceAttack ? 'attack' : 'move');
}

/** Where the building being placed would go under the pointer. */
function updatePlacement(clientX: number, clientY: number): void {
  const s = game;
  if (!s || !placing) {
    placeAt = null;
    return;
  }
  const g = view.groundAt(clientX, clientY);
  if (!g) {
    placeAt = null;
    return;
  }
  const n = BUILDINGS[placing].size;
  const tx = Math.round(g.x - n / 2);
  const ty = Math.round(g.y - n / 2);
  // Only on ground the player has seen.
  let seen = true;
  for (let y = ty; y < ty + n && seen; y++) for (let x = tx; x < tx + n; x++) if (x < 0 || y < 0 || x >= s.w || y >= s.h || !s.players[viewer].seen[y * s.w + x]) seen = false;
  placeAt = { tx, ty, ok: seen && !placeProblem(s, placing, tx, ty) };
}

function placeHere(shift: boolean): void {
  const s = game;
  if (!s || !placing || !placeAt) return;
  if (!placeAt.ok) {
    hud.toast("Can't build there", 'bad');
    play('error');
    return;
  }
  const ids = selectedUnits(s).filter((u) => u.type === 'citizen').map((u) => u.id);
  issue({ t: 'build', p: viewer, ids, type: placing, tx: placeAt.tx, ty: placeAt.ty });
  if (!shift) {
    placing = null;
    placeAt = null;
    hud.buildMenu = false;
  }
}

// ---- Mouse -----------------------------------------------------------------------------------------

const canvas = view.renderer.domElement;
const dragbox = $('dragbox');
let boxStart: { x: number; y: number } | null = null;
let boxing = false;
let panDrag: { x: number; y: number } | null = null;
let spaceDown = false;
let spaceDragged = false;
let pointer = { x: 0, y: 0, inside: false };
let lastClick = { at: 0, id: -1 };

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (mode !== 'play') return;
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 1 || (e.button === 0 && spaceDown)) {
    panDrag = { x: e.clientX, y: e.clientY };
    spaceDragged = true;
    e.preventDefault();
    return;
  }
  if (e.button === 2) {
    if (placing) {
      placing = null;
      placeAt = null;
      return;
    }
    if (amoveMode) {
      amoveMode = false;
      return;
    }
    order(e.clientX, e.clientY);
    return;
  }
  if (e.button !== 0) return;
  if (placing) {
    placeHere(e.shiftKey);
    return;
  }
  if (amoveMode) {
    order(e.clientX, e.clientY, true);
    if (!e.shiftKey) amoveMode = false;
    return;
  }
  boxStart = { x: e.clientX, y: e.clientY };
  boxing = false;
});

canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY, inside: true };
  if (panDrag) {
    const k = view.rig.distance / 600;
    view.rig.pan(-(e.clientX - panDrag.x) * k * 1.6, (e.clientY - panDrag.y) * k * 1.6);
    panDrag = { x: e.clientX, y: e.clientY };
    return;
  }
  if (boxStart) {
    const dx = e.clientX - boxStart.x;
    const dy = e.clientY - boxStart.y;
    if (!boxing && Math.hypot(dx, dy) > 6) boxing = true;
    if (boxing) {
      dragbox.classList.remove('hidden');
      dragbox.style.left = `${Math.min(e.clientX, boxStart.x)}px`;
      dragbox.style.top = `${Math.min(e.clientY, boxStart.y)}px`;
      dragbox.style.width = `${Math.abs(dx)}px`;
      dragbox.style.height = `${Math.abs(dy)}px`;
    }
  }
  if (placing) updatePlacement(e.clientX, e.clientY);
});

canvas.addEventListener('pointerleave', () => (pointer.inside = false));

canvas.addEventListener('pointerup', (e) => {
  if (panDrag && (e.button === 1 || e.button === 0)) {
    panDrag = null;
    return;
  }
  if (e.button !== 0 || !boxStart || !game) return;
  const s = game;
  if (boxing) {
    const ids = view.unitsInBox(boxStart.x, boxStart.y, e.clientX, e.clientY);
    const own = ids.filter((id) => s.byId.get(id)?.owner === viewer);
    const pick = own.length ? own : ids.slice(0, 1);
    if (pick.length || !e.shiftKey) setSelection(pick, e.shiftKey);
    if (pick.length) play('select');
  } else clickSelect(e.clientX, e.clientY, e.shiftKey, e.ctrlKey);
  boxStart = null;
  boxing = false;
  dragbox.classList.add('hidden');
});

function clickSelect(x: number, y: number, shift: boolean, ctrl: boolean): void {
  const s = game!;
  const pk = view.pick(x, y);
  if (!pk || pk.kind === 'ground') {
    if (!shift) setSelection([]);
    return;
  }
  if (pk.kind === 'resource') {
    setSelection([]);
    selectedTile = pk.tile;
    refreshHud();
    return;
  }
  const e = s.byId.get(pk.id);
  if (!e) return;
  const now = performance.now();
  const double = now - lastClick.at < 350 && lastClick.id === e.id;
  lastClick = { at: now, id: e.id };
  if ((double || ctrl) && e.kind === 'unit' && e.owner === viewer) {
    // Every unit of that kind on screen.
    const same = view.unitsOnScreen().filter((id) => {
      const o = s.byId.get(id);
      return o && o.kind === 'unit' && o.owner === viewer && o.type === e.type;
    });
    setSelection(same, shift);
    play('select');
    return;
  }
  if (shift && selection.has(e.id)) {
    selection.delete(e.id);
    refreshHud();
    return;
  }
  // Mixing your units with buildings or others' things doesn't make sense: start over.
  const mixed = shift && [...selection].some((id) => {
    const o = s.byId.get(id);
    return o && (o.owner !== e.owner || o.kind !== e.kind);
  });
  setSelection([e.id], shift && !mixed && e.kind === 'unit');
  play(e.kind === 'building' ? 'selectBuilding' : 'select');
}

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (mode !== 'play') return;
    if (e.shiftKey) {
      view.rig.pan(e.deltaX * 0.02, -e.deltaY * 0.02);
      return;
    }
    view.rig.zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)));
  },
  { passive: false },
);

minimap.onLook = (x, y) => view.rig.focus(x, y);
minimap.onCommand = (x, y) => {
  const s = game;
  if (!s || mode !== 'play') return;
  const ids = selectedUnits(s).map((u) => u.id);
  if (!ids.length) return;
  issue({ t: 'move', p: viewer, ids, x, y, amove: amoveMode });
  amoveMode = false;
  play('move');
};

// ---- Keyboard --------------------------------------------------------------------------------------

const held = new Set<string>();

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  sound.unlock();
  const k = e.key;
  if (k === 'Alt') {
    altHeld = true;
    e.preventDefault();
  }
  if (mode !== 'play') return;
  if (k.startsWith('Arrow')) {
    held.add(k);
    e.preventDefault();
    return;
  }
  if (k === ' ') {
    if (!spaceDown) spaceDragged = false;
    spaceDown = true;
    e.preventDefault();
    return;
  }
  if (e.repeat && !['+', '=', '-'].includes(k)) return;
  if (!$('modal').classList.contains('hidden')) {
    if (k === 'Escape' || k === 'F10') closeModal();
    return;
  }
  // Groups: Ctrl + digit keeps the selection; the digit brings it back; twice looks at it.
  if (/^[1-9]$/.test(k)) {
    const n = Number(k);
    if (e.ctrlKey || e.metaKey) {
      groups.set(n, [...selection]);
      hud.toast(`Group ${n}: ${selection.size} selected`, 'info');
      e.preventDefault();
      return;
    }
    const g = (groups.get(n) ?? []).filter((id) => game?.byId.has(id));
    if (!g.length) return;
    const now = performance.now();
    if (lastGroupKey.key === n && now - lastGroupKey.at < 400) {
      const es = g.map((id) => game!.byId.get(id)!).filter(Boolean);
      view.rig.focus(es.reduce((a, b) => a + b.x, 0) / es.length, es.reduce((a, b) => a + b.y, 0) / es.length);
    }
    lastGroupKey = { key: n, at: now };
    setSelection(g, e.shiftKey);
    play('select');
    return;
  }
  if (k === 'Escape') {
    if (placing || amoveMode) {
      placing = null;
      placeAt = null;
      amoveMode = false;
    } else if (hud.buildMenu) hud.buildMenu = false;
    else if (selection.size) setSelection([]);
    else openMenu();
    refreshHud();
    return;
  }
  if (k === 'F10') {
    e.preventDefault();
    openMenu();
    return;
  }
  // The command card first: its letters change with the selection.
  if (!e.ctrlKey && !e.metaKey && hud.hotkey(k === 'Delete' ? 'DELETE' : k)) {
    e.preventDefault();
    refreshHud();
    return;
  }
  switch (k.toLowerCase()) {
    case '.':
      nextIdle();
      break;
    case 'h':
      selectHome();
      break;
    case 'p':
    case 'pause':
      togglePause();
      break;
    case '+':
    case '=':
      cycleSpeed(1);
      break;
    case '-':
      cycleSpeed(-1);
      break;
    case 'm':
      toggleMute();
      break;
    case '[':
      view.rig.rotate(-Math.PI / 8);
      break;
    case ']':
      view.rig.rotate(Math.PI / 8);
      break;
    case 'backspace':
      view.rig.resetYaw();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  held.delete(e.key);
  if (e.key === 'Alt') altHeld = false;
  if (e.key === ' ') {
    spaceDown = false;
    // A tap (no drag) looks at the last alert.
    if (!spaceDragged && lastAlert && mode === 'play') view.rig.focus(lastAlert.x, lastAlert.y);
  }
});
window.addEventListener('blur', () => {
  held.clear();
  altHeld = false;
  spaceDown = false;
});

const PAUSE_ICON = '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>';
$('pause-btn').innerHTML = PAUSE_ICON;

function togglePause(): void {
  paused = !paused;
  $('paused').classList.toggle('hidden', !paused);
  $('pause-btn').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
}

function cycleSpeed(d: number): void {
  speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, speedIdx + d));
  hud.toast(`Speed ${SPEEDS[speedIdx]}×`, 'info');
  refreshHud();
}

function toggleMute(): void {
  sound.set({ muted: !sound.settings.muted });
  $('sound-btn').textContent = sound.settings.muted ? '🔇' : '🔊';
}

// ---- Menus -----------------------------------------------------------------------------------------

function openMenu(): void {
  if (mode !== 'play') return;
  const m = $('modal');
  m.innerHTML = `<div class="card"><h2>Menu</h2>
    <div class="row"><button class="btn wide primary" data-act="resume">Resume</button></div>
    <div class="row">
      <label>Graphics <select id="menu-quality">${(Object.keys(QUALITY) as QualityName[]).map((q) => `<option value="${q}" ${q === view.qualityName ? 'selected' : ''}>${QUALITY[q].label}</option>`).join('')}</select></label>
      <label>Effects volume <input id="menu-vol" type="range" min="0" max="1" step="0.05" value="${sound.settings.volume}"></label>
      <label>Wind and birds <input id="menu-amb" type="range" min="0" max="1" step="0.05" value="${sound.settings.ambience}"></label>
    </div>
    <div class="row">
      <button class="btn wide" data-act="restart">Restart this map</button>
      <button class="btn wide" data-act="new-map">New map</button>
      <button class="btn wide" data-act="resign">Resign</button>
      <button class="btn wide" data-act="quit">Quit to title</button>
    </div></div>`;
  m.classList.remove('hidden');
  $<HTMLSelectElement>('menu-quality').addEventListener('change', (e) => {
    const q = (e.target as HTMLSelectElement).value as QualityName;
    view.setQuality(q);
    qualitySel.value = q;
  });
  $<HTMLInputElement>('menu-vol').addEventListener('input', (e) => sound.set({ volume: Number((e.target as HTMLInputElement).value) }));
  $<HTMLInputElement>('menu-amb').addEventListener('input', (e) => sound.set({ ambience: Number((e.target as HTMLInputElement).value) }));
  play('open');
}

function closeModal(): void {
  $('modal').classList.add('hidden');
}

function showEnd(s: GameState, won: boolean): void {
  mode = 'over';
  const m = $('modal');
  const mins = Math.floor(s.tick / TICK_HZ / 60);
  const rows = s.players
    .map(
      (p) => `<tr><td><span class="swatch" style="background:${p.color}"></span>${p.name}</td><td>${EPOCHS[p.epoch].short}</td><td>${p.stats.gathered}</td><td>${p.stats.trained}</td><td>${p.stats.built}</td><td>${p.stats.kills}</td><td>${p.stats.losses}</td></tr>`,
    )
    .join('');
  m.innerHTML = `<div class="card"><h2>${won ? 'Victory!' : 'Defeat'}</h2>
    <div class="sel-sub">${won ? 'Your rival has fallen.' : 'Your people are no more.'} The match lasted ${mins} minute${mins === 1 ? '' : 's'}.</div>
    <table class="end-stats"><tr><th></th><th>Epoch</th><th>Gathered</th><th>Trained</th><th>Built</th><th>Kills</th><th>Lost</th></tr>${rows}</table>
    <div class="row">
      <button class="btn wide" data-act="watch">Look around</button>
      <button class="btn wide primary" data-act="new-map">Play again</button>
      <button class="btn wide" data-act="quit">Quit to title</button>
    </div></div>`;
  m.classList.remove('hidden');
  play(won ? 'victory' : 'defeat');
  hud.banner(won ? 'Victory' : 'Defeat', '', 5000);
}

// ---- Events from the rules -------------------------------------------------------------------------

function onEvents(s: GameState, list: GameEvent[]): void {
  view.events(s, list);
  if (mode !== 'play') return;
  for (const ev of list) {
    switch (ev.k) {
      case 'refused':
        if (ev.owner === viewer) {
          hud.toast(ev.why, 'bad');
          play('error');
        }
        break;
      case 'epoch':
        if (ev.owner === viewer) {
          hud.banner(EPOCHS[ev.epoch].name, EPOCHS[ev.epoch].blurb, 4500);
          play('epoch');
        } else hud.toast(`${s.players[ev.owner].name} has reached the ${EPOCHS[ev.epoch].name}`, 'info');
        break;
      case 'alert':
        if (ev.owner === viewer) {
          lastAlert = { x: ev.x, y: ev.y };
          hud.toast(ev.building ? 'A building is under attack! (Space to look)' : 'You are under attack! (Space to look)', 'alert');
          play('alert');
        }
        break;
      case 'built':
        if (ev.owner === viewer && ev.type !== 'farm' && ev.type !== 'house') hud.toast(`${BUILDINGS[ev.type].name} built`, 'good');
        break;
      case 'defeated':
        if (ev.owner !== viewer) hud.toast(`${s.players[ev.owner].name} has been defeated`, 'good');
        break;
      case 'over':
        showEnd(s, ev.winner === s.players[viewer].team);
        break;
    }
  }
}

// ---- The loop --------------------------------------------------------------------------------------

function refreshHud(): void {
  if (!game || mode === 'title') return;
  pruneSelection(game);
  hud.update(game, viewer, [...selection], SPEEDS[speedIdx], selectedTile);
}

function cursorFor(s: GameState): string {
  if (placing) return 'cur-place';
  if (amoveMode) return 'cur-amove';
  if (!pointer.inside || boxing) return '';
  const units = selectedUnits(s);
  const pk: Pick | null = view.pick(pointer.x, pointer.y);
  if (!pk) return '';
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id) as Ent | undefined;
    if (!t) return '';
    if (units.length && t.owner !== viewer) return 'cur-attack';
    if (units.some((u) => u.type === 'citizen') && t.kind === 'building' && t.owner === viewer && (!t.built || t.type === 'farm')) return 'cur-build';
    return 'cur-select';
  }
  if (pk.kind === 'resource' && units.some((u) => u.type === 'citizen')) return 'cur-gather';
  return '';
}

let cursorTimer = 0;

function frame(now: number): void {
  // A frame stamp can be a hair earlier than the clock read at start-up: never step backward.
  const dt = Math.max(0, Math.min(0.1, (now - lastFrame) / 1000));
  lastFrame = now;
  const s = game;
  if (s) {
    if (mode === 'title') {
      // The title's match plays on; the camera drifts over it.
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 4) {
        step(s);
        view.events(s, s.events);
        acc -= DT;
        n++;
      }
      if (s.over) startAttract();
      // Look in on each town in turn, circling slowly.
      attractT += dt;
      const who = s.players[Math.floor(attractT / 24) % s.players.length];
      const tc = s.ents.find((e) => e.kind === 'building' && e.owner === who.id && e.type === 'towncenter');
      const army = s.ents.filter((e) => e.kind === 'unit' && e.type !== 'citizen' && e.owner === who.id && e.order.k !== 'idle');
      const at = army.length >= 4 ? army[0] : (tc ?? { x: who.startX, y: who.startY });
      view.rig.focus(at.x, at.y);
      view.rig.rotate(dt * 0.05);
    } else {
      // Keyboard and screen-edge panning.
      const sp = view.rig.panSpeed * dt;
      let px = 0;
      let pz = 0;
      if (held.has('ArrowLeft')) px -= 1;
      if (held.has('ArrowRight')) px += 1;
      if (held.has('ArrowUp')) pz += 1;
      if (held.has('ArrowDown')) pz -= 1;
      if (pointer.inside && document.hasFocus() && !boxStart && !panDrag && $('modal').classList.contains('hidden')) {
        const edge = 8;
        if (pointer.x < edge) px -= 1;
        if (pointer.x > window.innerWidth - edge) px += 1;
        if (pointer.y < edge) pz += 1;
        if (pointer.y > window.innerHeight - edge) pz -= 1;
      }
      if (px || pz) view.rig.pan(px * sp, pz * sp);

      if (!paused && mode === 'play') {
        acc += dt * SPEEDS[speedIdx];
        let n = 0;
        while (acc >= DT && n < 6) {
          step(s, pending);
          pending = [];
          onEvents(s, s.events);
          acc -= DT;
          n++;
        }
        if (n === 6) acc = 0;
      } else if (mode === 'over') {
        // After the end the world keeps going for a look around.
        acc += dt;
        while (acc >= DT) {
          acc -= DT;
        }
      }
    }
    const alpha = mode === 'play' && !paused ? Math.min(1, acc / DT) : 1;
    pruneSelection(s);
    view.frame(s, alpha, dt, {
      ids: selection,
      allBars: altHeld,
      ghost: placing && placeAt ? { type: placing, ...placeAt } : null,
      rallyOf: selection.size === 1 ? [...selection][0] : null,
    });
    if (mode !== 'title') {
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        refreshHud();
      }
      mapTimer -= dt;
      if (mapTimer <= 0) {
        mapTimer = 0.2;
        minimap.draw(s, viewer, mode === 'over', [...view.knownBuildings()], view.rig.footprint(), selection);
      }
      cursorTimer -= dt;
      if (cursorTimer <= 0) {
        cursorTimer = 0.08;
        const c = cursorFor(s);
        world.className = c;
      }
    }
  }
  requestAnimationFrame(frame);
}

// Development helper: the game state from the console.
(window as unknown as { ages: unknown }).ages = {
  get game() {
    return game;
  },
  view,
  sound,
  /** Run the rules ahead by some seconds (testing); effects are skipped. */
  fast(seconds: number) {
    if (!game) return;
    for (let i = 0; i < seconds * TICK_HZ && !game.over; i++) {
      step(game, pending);
      pending = [];
    }
  },
  /** Put a unit on the map (testing). */
  spawn(owner: number, type: Unit['type'], x: number, y: number) {
    if (!game) return null;
    return spawnUnit(game, owner, type, x, y).id;
  },
  /** Jump a player to an epoch (testing). */
  setEpoch(owner: number, epoch: number) {
    if (game) game.players[owner].epoch = epoch;
  },
  issue,
  select: (ids: number[]) => setSelection(ids),
  unitStats,
  nameOf,
  CameraRig,
  R_NONE,
};

$('loading').classList.add('hidden');
$('title').classList.remove('hidden');
startAttract();
requestAnimationFrame(frame);
