import './ui/style.css';
import { sound, type SoundName } from './audio/sound';
import { CameraRig } from './render/camera';
import { QUALITY, type QualityName } from './render/post';
import { View, type Pick } from './render/view';
import { wallLine } from './sim/commands';
import { BUILDINGS, CIVS, CIV_IDS, DT, EPOCHS, MAP_TYPES, MILITARY, PLAYER_COLORS, TECHS, TICK_HZ, unitStats } from './sim/data';
import { createGame, scoreOf, step, type GameSetup, type PlayerSetup } from './sim/game';
import { placeProblem } from './sim/grid';
import { findSpot } from './sim/ai';
import { placeBuilding, spawnUnit } from './sim/world';
import type { BuildingType, CivId, Command, Difficulty, Ent, GameEvent, GameState, HistoryPoint, MapSize, MapType, Unit } from './sim/types';
import { R_NONE } from './sim/types';
import { deserialize, serialize } from './sim/save';
import { Hud, nameOf } from './ui/hud';
import { Minimap } from './ui/minimap';
import { Tips } from './ui/tips';

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
const tips = new Tips();

type Mode = 'title' | 'play' | 'over';
let mode: Mode = 'title';
let game: GameState | null = null;
let viewer = 0;
let pending: Command[] = [];
let selection = new Set<number>();
let selectedTile: number | null = null;
let placing: BuildingType | null = null;
let placeAt: { tx: number; ty: number; ok: boolean } | null = null;
/** A wall being dragged out, from tile to tile. */
let wallDrag: { x0: number; y0: number; x1: number; y1: number } | null = null;
/** The next left click picks a target: where to attack-move, or a building to shelter in. */
let targetMode: 'amove' | 'garrison' | null = null;
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
let lastSetup: GameSetup | null = null;

const hud = new Hud({
  issue: (c) => issue(c),
  place: (type) => {
    placing = type;
    wallDrag = null;
    targetMode = null;
    sound.play('click');
  },
  attackMove: () => {
    targetMode = 'amove';
    placing = null;
  },
  garrisonMode: () => {
    targetMode = 'garrison';
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
  const maps = Object.keys(MAP_TYPES) as MapType[];
  game = createGame({ seed, size: 'small', mapType: maps[seed % maps.length], players: [{ name: 'Azure', ai: 'normal' }, { name: 'Crimson', ai: 'hard' }] });
  viewer = 0;
  view.setGame(game, 0);
  view.revealAll();
  view.rig.zoom(1.05);
  minimap.setup(game);
  // Skip ahead so there is a town to look at.
  for (let i = 0; i < TICK_HZ * 150; i++) step(game);
  attractT = 0;
}

/** Leaders for the computer's peoples. */
const LEADERS: Record<CivId, string> = { egyptians: 'Hatshepsut', greeks: 'Pericles', romans: 'Augustus', mongols: 'Genghis', chinese: 'Wu Zetian', britons: 'Boudica' };

/** A match from the title screen's choices. */
function setupFromTitle(seed: number): GameSetup {
  const val = (id: string) => $<HTMLSelectElement>(id).value;
  const diff = val('opt-diff') as Difficulty;
  const foes = Number(val('opt-foes'));
  const ally = val('opt-teams') === 'ally' && foes >= 2;
  const color = Number(val('opt-color'));
  const civChoice = val('opt-civ');
  const civ: CivId = civChoice === 'random' ? CIV_IDS[Math.floor(Math.random() * CIV_IDS.length)] : (civChoice as CivId);
  const colors = [PLAYER_COLORS[color], ...PLAYER_COLORS.filter((_, i) => i !== color)];
  // Rivals each get a different people where possible.
  const others = CIV_IDS.filter((c) => c !== civ).sort(() => Math.random() - 0.5);
  const players: PlayerSetup[] = [{ name: 'You', ai: null, color: colors[0], team: 0, civ }];
  for (let i = 0; i < foes; i++) {
    const c = others[i % others.length];
    const friend = ally && i === 0;
    players.push({ name: `${LEADERS[c]}${friend ? ' (ally)' : ''}`, ai: diff, color: colors[i + 1], team: friend ? 0 : ally ? 1 : i + 1, civ: c });
  }
  return {
    seed,
    size: val('opt-size') as MapSize,
    mapType: val('opt-map') as MapType,
    players,
    startEpoch: Number(val('opt-epoch')),
    peaceMinutes: Number(val('opt-peace')),
  };
}

function startMatch(setup: GameSetup, saved?: GameState): void {
  lastSetup = setup;
  game = saved ?? createGame(setup);
  viewer = 0;
  mode = 'play';
  pending = [];
  selection = new Set();
  selectedTile = null;
  placing = null;
  wallDrag = null;
  targetMode = null;
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
  const me = game.players[viewer];
  const rivals = game.players.filter((p) => p.team !== me.team).map((p) => `${p.name} of the ${CIVS[p.civ].name}`);
  if (!saved) hud.banner(EPOCHS[me.epoch].name, `You lead the ${CIVS[me.civ].name}. Facing ${rivals.join(', ')}.`, 5200);
  else hud.banner('Welcome back', `${EPOCHS[me.epoch].name}, ${fmtClock(game.tick)} into the match.`, 3200);
  sound.startAmbience();
  // Start with the Town Center in view and selected.
  const tc = game.ents.find((e) => e.kind === 'building' && e.owner === viewer && e.type === 'towncenter');
  if (tc) {
    setSelection([tc.id]);
    view.rig.focus(tc.x, tc.y + 3, true);
  }
  tips.start(saved ? 9999 : 0);
}

const fmtClock = (ticks: number) => {
  const sec = Math.floor(ticks / TICK_HZ);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

function toTitle(): void {
  autosave(true);
  tips.hide();
  $('hud').classList.add('hidden');
  $('modal').classList.add('hidden');
  $('title').classList.remove('hidden');
  startAttract();
}

// ---- Saving ----------------------------------------------------------------------------------------

const SAVE_KEY = 'ages-save';

function saveGame(s: GameState, setup: GameSetup): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, setup, at: Date.now(), state: serialize(s) }));
    showContinue();
    return true;
  } catch {
    return false;
  }
}

function loadGame(): { setup: GameSetup; state: GameState } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.v !== 1) return null;
    return { setup: saved.setup, state: deserialize(saved.state) };
  } catch {
    return null;
  }
}

function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Nothing to clear. */
  }
  showContinue();
}

function showContinue(): void {
  let info = '';
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const at = Number(JSON.parse(raw.slice(0, 2000).replace(/,"state".*$/, '}')).at);
      info = at ? new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'saved game';
    }
  } catch {
    info = '';
  }
  const btn = $('continue-btn');
  btn.classList.toggle('hidden', !info);
  btn.textContent = `Continue (${info})`;
}

/** Keep a save as the match goes, and when the page is hidden or closed. */
let autosaveAt = 0;
function autosave(force = false): void {
  if (!game || mode !== 'play' || !lastSetup || game.over) return;
  if (!force && game.tick < autosaveAt) return;
  autosaveAt = game.tick + TICK_HZ * 60;
  saveGame(game, lastSetup);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autosave(true);
});
window.addEventListener('pagehide', () => autosave(true));

// ---- Title screen ----------------------------------------------------------------------------------

const seedInput = $<HTMLInputElement>('opt-seed');
seedInput.value = String(newSeed());
const colorSel = $<HTMLSelectElement>('opt-color');
colorSel.innerHTML = ['Blue', 'Red', 'Gold', 'Green', 'Purple', 'Orange'].map((n, i) => `<option value="${i}">${n}</option>`).join('');
const civSel = $<HTMLSelectElement>('opt-civ');
civSel.innerHTML = `<option value="random">Random</option>` + CIV_IDS.map((c) => `<option value="${c}">${CIVS[c].name}</option>`).join('');
const mapSel = $<HTMLSelectElement>('opt-map');
mapSel.innerHTML = (Object.keys(MAP_TYPES) as MapType[]).map((m) => `<option value="${m}">${MAP_TYPES[m].label}</option>`).join('');
const civBlurb = () => {
  const c = civSel.value;
  const m = MAP_TYPES[mapSel.value as MapType];
  $('civ-blurb').innerHTML = `${c === 'random' ? 'A people chosen at random.' : `<b>${CIVS[c as CivId].name}:</b> ${CIVS[c as CivId].blurb.split(': ').slice(1).join(': ') || CIVS[c as CivId].blurb}`}<br><b>${m.label}:</b> ${m.blurb}`;
};
civSel.addEventListener('change', civBlurb);
showContinue();
mapSel.addEventListener('change', civBlurb);
civBlurb();
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
      startMatch(setupFromTitle(Number(seedInput.value) || newSeed()));
      break;
    case 'continue': {
      const saved = loadGame();
      if (saved) {
        sound.play('click');
        startMatch(saved.setup, saved.state);
      } else hud.toast('The saved game could not be read', 'bad');
      break;
    }
    case 'save':
      if (game && mode === 'play' && lastSetup) {
        hud.toast(saveGame(game, lastSetup) ? 'Game saved' : 'Could not save (browser storage is full or off)', 'info');
        closeModal();
      }
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
      if (lastSetup) startMatch(lastSetup);
      break;
    case 'new-map':
      if (lastSetup) startMatch({ ...lastSetup, seed: newSeed() });
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
  hud.buildMenu = null;
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

/** Every soldier, wherever they are (not citizens, priests or those sheltering). */
function selectArmy(): void {
  if (!game) return;
  const army = game.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === viewer && e.hp > 0 && !e.inside && MILITARY.includes(e.type));
  if (!army.length) {
    hud.toast('You have no army yet', 'info');
    return;
  }
  setSelection(army.map((u) => u.id));
  play('select');
}

// ---- Orders ----------------------------------------------------------------------------------------

function order(clientX: number, clientY: number, forceAttack = false, queue = false): void {
  const s = game;
  if (!s || mode !== 'play') return;
  const units = selectedUnits(s).filter((u) => !u.inside);
  const pk = view.pick(clientX, clientY);
  if (!pk) return;
  const ids = units.map((u) => u.id);
  const q = queue || undefined;
  if (!units.length) {
    // A building of yours: set where its trainees gather.
    const b = [...selection].map((id) => s.byId.get(id)).find((e) => e && e.kind === 'building' && e.owner === viewer);
    if (b) {
      const at = pk.kind === 'ground' ? pk : pk.kind === 'resource' ? { x: (pk.tile % s.w) + 0.5, y: Math.floor(pk.tile / s.w) + 0.5 } : pk.kind === 'animal' ? null : (() => {
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
  if (pk.kind === 'animal') {
    const a = s.animals.find((x) => x.id === pk.id);
    if (!a) return;
    issue({ t: 'hunt', p: viewer, ids, target: a.id, queue: q });
    view.marker(s, a.x, a.y, true);
    play('move');
    return;
  }
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id);
    if (!t) return;
    if (t.owner !== viewer && s.players[t.owner].team !== s.players[viewer].team) {
      issue({ t: 'attack', p: viewer, ids, target: t.id, queue: q });
      view.marker(s, t.x, t.y, true);
      play(units.every((u) => u.type === 'priest') ? 'chant' : 'attack');
      return;
    }
    if (t.kind === 'building' && t.owner === viewer) {
      issue({ t: 'work', p: viewer, ids, target: t.id, queue: q });
      view.marker(s, t.x, t.y, false);
      play(t.built ? 'move' : 'hammer');
      return;
    }
    issue({ t: 'move', p: viewer, ids, x: t.x, y: t.y, amove: forceAttack, queue: q });
    view.marker(s, t.x, t.y, false);
    play('move');
    return;
  }
  if (pk.kind === 'resource') {
    issue({ t: 'gather', p: viewer, ids, tile: pk.tile, queue: q });
    view.marker(s, (pk.tile % s.w) + 0.5, Math.floor(pk.tile / s.w) + 0.5, false);
    play('move');
    return;
  }
  issue({ t: 'move', p: viewer, ids, x: pk.x, y: pk.y, amove: forceAttack, queue: q });
  view.marker(s, pk.x, pk.y, forceAttack);
  play(forceAttack ? 'attack' : 'move');
}

/** Shelter the selection in the building under the pointer. */
function garrisonAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const pk = view.pick(clientX, clientY);
  const b = pk && pk.kind === 'building' ? s.byId.get(pk.id) : undefined;
  if (!b || b.kind !== 'building' || b.owner !== viewer || !BUILDINGS[b.type].garrison || !b.built) {
    hud.toast('Pick your Town Center or a tower to shelter in', 'bad');
    play('error');
    return;
  }
  issue({ t: 'garrison', p: viewer, ids: selectedUnits(s).map((u) => u.id), target: b.id, queue: queue || undefined });
  view.marker(s, b.x, b.y, false);
  play('move');
}

/** The tiles of a planned wall, and whether each can be built. */
function wallPlan(s: GameState): { tiles: { x: number; y: number; ok: boolean }[]; alongY: boolean } | null {
  if (placing !== 'wall') return null;
  const d = wallDrag ?? (placeAt ? { x0: placeAt.tx, y0: placeAt.ty, x1: placeAt.tx, y1: placeAt.ty } : null);
  if (!d) return null;
  const seen = s.players[viewer].seen;
  const tiles = wallLine(d.x0, d.y0, d.x1, d.y1).map((t) => ({
    ...t,
    ok: t.x >= 0 && t.y >= 0 && t.x < s.w && t.y < s.h && !!seen[t.y * s.w + t.x] && !placeProblem(s, 'wall', t.x, t.y),
  }));
  return { tiles, alongY: Math.abs(d.y1 - d.y0) > Math.abs(d.x1 - d.x0) };
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
  issue({ t: 'build', p: viewer, ids, type: placing, tx: placeAt.tx, ty: placeAt.ty, queue: shift || undefined });
  if (!shift) {
    placing = null;
    placeAt = null;
    hud.buildMenu = null;
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
      wallDrag = null;
      return;
    }
    if (targetMode) {
      targetMode = null;
      return;
    }
    order(e.clientX, e.clientY, false, e.shiftKey);
    return;
  }
  if (e.button !== 0) return;
  if (placing === 'wall') {
    updatePlacement(e.clientX, e.clientY);
    if (placeAt) wallDrag = { x0: placeAt.tx, y0: placeAt.ty, x1: placeAt.tx, y1: placeAt.ty };
    return;
  }
  if (placing) {
    placeHere(e.shiftKey);
    return;
  }
  if (targetMode === 'amove') {
    order(e.clientX, e.clientY, true, e.shiftKey);
    if (!e.shiftKey) targetMode = null;
    return;
  }
  if (targetMode === 'garrison') {
    garrisonAt(e.clientX, e.clientY, e.shiftKey);
    targetMode = null;
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
  if (wallDrag && placeAt) {
    wallDrag.x1 = placeAt.tx;
    wallDrag.y1 = placeAt.ty;
  }
});

canvas.addEventListener('pointerleave', () => (pointer.inside = false));

canvas.addEventListener('pointerup', (e) => {
  if (panDrag && (e.button === 1 || e.button === 0)) {
    panDrag = null;
    return;
  }
  if (e.button === 0 && wallDrag && game) {
    const s = game;
    const plan = wallPlan(s);
    const d = wallDrag;
    wallDrag = null;
    if (!plan || !plan.tiles.some((t) => t.ok)) {
      hud.toast("Can't build a wall there", 'bad');
      play('error');
      return;
    }
    const ids = selectedUnits(s).filter((u) => u.type === 'citizen').map((u) => u.id);
    issue({ t: 'wall', p: viewer, ids, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, queue: e.shiftKey || undefined });
    if (!e.shiftKey) {
      placing = null;
      placeAt = null;
      hud.buildMenu = null;
    }
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
  issue({ t: 'move', p: viewer, ids, x, y, amove: targetMode === 'amove' });
  targetMode = null;
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
    if (placing || targetMode) {
      placing = null;
      placeAt = null;
      wallDrag = null;
      targetMode = null;
    } else if (hud.buildMenu) hud.buildMenu = null;
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
    case ',':
      selectArmy();
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
      <label>Tips for new players <input id="menu-tips" type="checkbox" ${tips.enabled ? 'checked' : ''}></label>
    </div>
    <div class="row">
      <button class="btn wide" data-act="save">Save game</button>
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
  $<HTMLInputElement>('menu-tips').addEventListener('change', (e) => (tips.enabled = (e.target as HTMLInputElement).checked));
  play('open');
}

function closeModal(): void {
  $('modal').classList.add('hidden');
}

type Metric = 'score' | 'pop' | 'military' | 'gathered';
const METRICS: Record<Metric, string> = { score: 'Score', pop: 'Population', military: 'Army', gathered: 'Gathered' };

/** A line per player over the match, with the epochs each reached marked. */
function timeline(s: GameState, metric: Metric): string {
  const W = 400;
  const H = 150;
  const series = s.players.map((p) => p.history);
  const last = Math.max(1, s.tick);
  let top = 1;
  for (const h of series) for (const pt of h) top = Math.max(top, pt[metric]);
  const X = (t: number) => (t / last) * (W - 10) + 5;
  const Y = (v: number) => H - 6 - (v / top) * (H - 16);
  const lines = s.players
    .map((p, i) => {
      const h: HistoryPoint[] = [{ tick: 0, pop: 0, military: 0, gathered: 0, score: 0, epoch: 0 }, ...series[i]];
      const pts = h.map((pt) => `${X(pt.tick).toFixed(1)},${Y(pt[metric]).toFixed(1)}`).join(' ');
      const ups = h
        .filter((pt, j) => j > 0 && pt.epoch > h[j - 1].epoch)
        .map((pt) => `<circle cx="${X(pt.tick).toFixed(1)}" cy="${Y(pt[metric]).toFixed(1)}" r="4" fill="${p.color}" stroke="#fff" stroke-width="1.5"><title>${p.name}: ${EPOCHS[pt.epoch].name}</title></circle>`)
        .join('');
      return `<polyline points="${pts}" fill="none" stroke="${p.color}" stroke-width="2.5" stroke-linejoin="round"/>${ups}`;
    })
    .join('');
  const mins = Math.floor(last / TICK_HZ / 60);
  const grid = Array.from({ length: Math.min(mins, 12) }, (_, i) => Math.round(((i + 1) * mins) / Math.min(mins, 12)))
    .map((m) => `<line x1="${X(m * 60 * TICK_HZ)}" y1="4" x2="${X(m * 60 * TICK_HZ)}" y2="${H - 4}" stroke="rgba(255,255,255,0.07)"/>`)
    .join('');
  return `<svg class="timeline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${lines}</svg>`;
}

function showEnd(s: GameState, won: boolean, how: 'conquest' | 'wonder' | 'resign' = 'conquest'): void {
  mode = 'over';
  const m = $('modal');
  const mins = Math.floor(s.tick / TICK_HZ / 60);
  const rows = s.players
    .map(
      (p) => `<tr><td><span class="swatch" style="background:${p.color}"></span>${p.name}<div class="civ-tag">${CIVS[p.civ].name}</div></td><td>${scoreOf(s, p)}</td><td>${EPOCHS[p.epoch].short}</td><td>${p.stats.gathered}</td><td>${p.stats.trained}</td><td>${p.stats.built}</td><td>${p.stats.techs}</td><td>${p.stats.kills}</td><td>${p.stats.losses}</td></tr>`,
    )
    .join('');
  const why = how === 'wonder' ? (won ? 'Your Wonder stood the test of time.' : 'A rival Wonder stood the test of time.') : won ? 'Your rivals have fallen.' : 'Your people are no more.';
  m.innerHTML = `<div class="card wide"><h2>${won ? 'Victory!' : 'Defeat'}</h2>
    <div class="sel-sub">${why} The match lasted ${mins < 1 ? 'less than a minute' : `${mins} minute${mins === 1 ? '' : 's'}`}.</div>
    <div class="chart-tabs">${(Object.keys(METRICS) as Metric[]).map((k) => `<button class="tab ${k === 'score' ? 'on' : ''}" data-metric="${k}">${METRICS[k]}</button>`).join('')}</div>
    <div id="chart">${timeline(s, 'score')}</div>
    <table class="end-stats"><tr><th></th><th>Score</th><th>Epoch</th><th>Gathered</th><th>Trained</th><th>Built</th><th>Techs</th><th>Kills</th><th>Lost</th></tr>${rows}</table>
    <div class="row">
      <button class="btn wide" data-act="watch">Look around</button>
      <button class="btn wide primary" data-act="new-map">Play again</button>
      <button class="btn wide" data-act="quit">Quit to title</button>
    </div></div>`;
  m.querySelector('.chart-tabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-metric]');
    if (!b) return;
    m.querySelectorAll('.chart-tabs .tab').forEach((t) => t.classList.toggle('on', t === b));
    $('chart').innerHTML = timeline(s, b.dataset.metric as Metric);
  });
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
        if (ev.owner === viewer) {
          // Out of the match (allies may fight on): the end screen, with the rest left to watch.
          if (!s.over) {
            clearSave();
            showEnd(s, false, list.some((e) => e.k === 'over' && e.how === 'resign') ? 'resign' : 'conquest');
            return;
          }
        } else hud.toast(`${s.players[ev.owner].name} has been defeated`, s.players[ev.owner].team === s.players[viewer].team ? 'bad' : 'good');
        break;
      case 'researched':
        if (ev.owner === viewer) hud.toast(`${TECHS[ev.tech].name} researched`, 'good');
        break;
      case 'converted':
        if (ev.to === viewer) hud.toast('A priest has won an enemy over to your side', 'good');
        else if (ev.from === viewer) {
          hud.toast('One of yours has been converted by an enemy priest!', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'bell':
        if (ev.owner === viewer) hud.toast(ev.ring ? 'The town bell rings: citizens run for shelter' : 'All clear: back to work', 'info');
        break;
      case 'wonder': {
        const p = s.players[ev.owner];
        const mins = Math.round(ev.ticks / TICK_HZ / 60);
        if (ev.owner === viewer) hud.banner('Your Wonder stands', `Keep it standing ${mins} minutes and you win.`, 5000);
        else {
          const ally = p.team === s.players[viewer].team;
          hud.banner(`${p.name} has built a Wonder`, ally ? `Defend it for ${mins} minutes and your side wins.` : `Destroy it within ${mins} minutes or lose.`, 5000);
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      }
      case 'over':
        clearSave();
        showEnd(s, ev.winner === s.players[viewer].team, ev.how);
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
  if (targetMode === 'amove') return 'cur-amove';
  if (targetMode === 'garrison') return 'cur-garrison';
  if (!pointer.inside || boxing) return '';
  const units = selectedUnits(s);
  const pk: Pick | null = view.pick(pointer.x, pointer.y);
  if (!pk) return '';
  if (pk.kind === 'animal') return units.length ? 'cur-attack' : 'cur-select';
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id) as Ent | undefined;
    if (!t) return '';
    const foe = s.players[t.owner].team !== s.players[viewer].team;
    if (units.length && foe) return units.every((u) => u.type === 'priest') && t.kind === 'unit' ? 'cur-convert' : 'cur-attack';
    if (units.some((u) => u.type === 'citizen') && t.kind === 'building' && t.owner === viewer && (!t.built || t.type === 'farm')) return 'cur-build';
    if (units.length && t.kind === 'building' && t.owner === viewer && t.built && BUILDINGS[t.type].garrison) return 'cur-garrison';
    return 'cur-select';
  }
  if (pk.kind === 'resource' && units.some((u) => u.type === 'citizen')) return 'cur-gather';
  return '';
}

let cursorTimer = 0;

/**
 * Laptops differ a lot: if the game runs below about 30 frames a second for a while on High, step
 * down to Medium (and from there to Low), once each, and say so.
 */
const fps = { time: 0, frames: 0, stepped: 0 };
function watchFrameRate(dt: number): void {
  if (document.hidden || paused || fps.stepped >= 2) return;
  fps.time += dt;
  fps.frames++;
  if (fps.time < 6) return;
  const rate = fps.frames / fps.time;
  fps.time = 0;
  fps.frames = 0;
  if (rate >= 28) return;
  const q = view.qualityName;
  const next: QualityName | null = q === 'high' ? 'medium' : q === 'medium' ? 'low' : null;
  if (!next) return;
  fps.stepped++;
  view.setQuality(next);
  qualitySel.value = next;
  hud.toast(`Graphics set to ${QUALITY[next].label} for a smoother game (change it in the Menu)`, 'info');
}

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
      ghost: placing && placing !== 'wall' && placeAt ? { type: placing, ...placeAt } : null,
      rallyOf: selection.size === 1 ? [...selection][0] : null,
      wall: wallPlan(s),
    });
    if (mode === 'play') watchFrameRate(dt);
    if (mode !== 'title') {
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        refreshHud();
      }
      if (mode === 'play' && !paused) {
        tips.update(s, viewer, dt);
        autosave();
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
  /** What the interface is doing (testing). */
  get ui() {
    return { placing, targetMode, wallDrag, placeAt, selection: [...selection], buildMenu: hud.buildMenu, pending: pending.length };
  },
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
  /** Put up a finished building near a point, or near the player's start (testing). */
  build(owner: number, type: BuildingType, x?: number, y?: number, minR = 4) {
    if (!game) return null;
    const p = game.players[owner];
    const spot = findSpot(game, type, x ?? p.startX, y ?? p.startY, minR, 24);
    return spot ? placeBuilding(game, owner, type, spot.tx, spot.ty, true).id : null;
  },
  /** A finished line of wall (testing). */
  wall(owner: number, x0: number, y0: number, x1: number, y1: number) {
    if (!game) return 0;
    let n = 0;
    for (const t of wallLine(x0, y0, x1, y1)) {
      if (placeProblem(game, 'wall', t.x, t.y)) continue;
      placeBuilding(game, owner, 'wall', t.x, t.y, true);
      n++;
    }
    return n;
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
