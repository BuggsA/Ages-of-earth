import './ui/style.css';
import { Music } from './audio/music';
import { sound, type SoundName } from './audio/sound';
import { CameraRig } from './render/camera';
import { QUALITY, type QualityName } from './render/post';
import { View, type Pick } from './render/view';
import { SIGHT_LORE } from './render/sightings';
import { wallLine } from './sim/commands';
import { AGES, BUILDINGS, CIVS, ORE_TRADE, RARE, CIV_IDS, DT, CONVOY, VIGIL, EPOCHS, FAIR, MAP_TYPES, MILITARY, PLAYER_COLORS, RECLAIM, RELIC, RUINS, SEASONS, STEPPE, TECHS, TICK_HZ, TIDINGS, TRIBUTE, TRUNK, WARCAMP, WAYS, WORKS, domainOf, unitStats } from './sim/data';
import { crestSvg } from './ui/crests';
import { isEnemy } from './sim/world';
import { grantAll, topUp } from './sim/god';
import { checksum, createGame, scoreOf, step, type GameSetup, type PlayerSetup } from './sim/game';
import { placeProblem, walkable } from './sim/grid';
import { findDockSpot, findSpot } from './sim/ai';
import { maxHp, placeBuilding, spawnUnit } from './sim/world';
import { arrivalText, epochArrivals } from './ui/endReport';
import type { AgeId, BuildingType, CivId, Command, Difficulty, Ent, GameEvent, GameMode, GameState, HistoryPoint, MapSize, MapType, Unit } from './sim/types';
import { R_FISH, R_NONE } from './sim/types';
import { carriedBy, relicAt } from './sim/relics';
import { RUIN_FINDS, ruinAt } from './sim/ruins';
import { TIDING_CARDS } from './sim/tidings';
import { LANDMARK_KINDS, landmarkAt } from './sim/landmarks';
import { postAt } from './sim/trade';
import { chantedOver, consecrateProblem, consecrates } from './sim/consecrate';
import { riteProblem } from './sim/fork';
import { ageDef, ageOf, canRaise, heirloomsOpened, isSideRoad, roadKnown, roadsFrom, suspendedTechs } from './sim/ages';
import { NetClient, newRoomCode, saveName, savedName } from './net/client';
import { HASH_EVERY, TURN_TICKS, type MatchStart, type ServerMsg } from './net/protocol';
import { deserialize, serialize } from './sim/save';
import { VAULT_SLOTS, formatVaultKey, normalizeVaultKey, type CloudSlot } from './net/vault';
import { qrSvg } from './ui/qr';
import { deleteCloud, listCloud, loadCloud, saveCloud, useVaultKey, vaultKey } from './net/cloud';
import { SCENARIOS, scenarioById, starsFor } from './sim/campaign';
import { loadDiscovery, observe, pushDiscovery, saveDiscovery, syncDiscovery, webMapHtml } from './ui/webMap';
import { idleCitizens, idleSelection, idleShortcut } from './ui/idle';
import { CameraBookmarks, bookmarkShortcut } from './ui/cameraBookmarks';
import { ScoutFlags } from './ui/scoutFlags';
import { briefingHtml, chapterListHtml, recordStars, starRow, syncProgress } from './ui/campaignUi';
import { Lobby } from './ui/lobby';
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
const music = new Music();
/** The style of music wanted now (it starts once the browser lets sound play). */
let musicEpoch = 2;
let musicAge: AgeId | undefined;
sound.onReady = (ctx, out) => {
  music.attach(ctx, out);
  music.start(musicEpoch, musicAge);
};
/** The age an `epoch` event announces (older replays carry only the epoch). */
const ageName = (ev: { epoch: number; age?: keyof typeof AGES }) => (ev.age ? AGES[ev.age] : EPOCHS[ev.epoch]).name;

function playMusic(epoch: number, age?: AgeId): void {
  musicEpoch = epoch;
  musicAge = age;
  if (music.attached) {
    music.start(epoch, age);
    music.setEpoch(epoch, age);
  }
}

type Mode = 'title' | 'play' | 'over';
let mode: Mode = 'title';
let game: GameState | null = null;
let viewer = 0;
let pending: Command[] = [];
let selection = new Set<number>();
let selectedTile: number | null = null;
/** A relic picked out with a left click, to read about. */
let selectedRelic: number | null = null;
/** A trading post picked out with a left click. */
let selectedPost: number | null = null;
/** An ancient ruin picked out with a left click, to read about (#64). */
let selectedRuin: number | null = null;
let selectedLandmark: number | null = null;
let placing: BuildingType | null = null;
let placeAt: { tx: number; ty: number; ok: boolean } | null = null;
/** A wall being dragged out, from tile to tile. */
let wallDrag: { x0: number; y0: number; x1: number; y1: number } | null = null;
/** The next left click picks a target: where to attack-move, or a building to shelter in. */
let targetMode: 'amove' | 'patrol' | 'garrison' | 'unload' | 'sacrifice' | 'curse' | null = null;
let paused = false;
const SPEEDS = [1, 1.5, 2, 3];
let speedIdx = 0;
const groups = new Map<number, number[]>();
const cameraBookmarks = new CameraBookmarks();
const scoutFlags = new ScoutFlags();
let lastGroupKey = { key: -1, at: 0 };
let lastAlert: { x: number; y: number } | null = null;
/** When the flock last told of a lamb born, or of bare ground (#308), so the toasts don't pile up. */
const flockToast = { born: -1e9, hungry: -1e9 };
/** When tribute was last told of (#318), taken by the viewer's riders or from the viewer's land. */
const tributeToast = { took: -1e9, paid: -1e9 };
/** When a toll was last told of (#334), taken by the viewer's land or paid by the viewer's traders. */
const tollToast = { took: -1e9, paid: -1e9 };
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
  patrolMode: () => {
    targetMode = 'patrol';
    placing = null;
  },
  riteMode: (how) => {
    targetMode = how;
    placing = null;
  },
  garrisonMode: () => {
    targetMode = 'garrison';
    placing = null;
  },
  unloadMode: () => {
    targetMode = 'unload';
    placing = null;
  },
  select: (ids) => setSelection(ids),
  focus: (x, y) => view.rig.focus(x, y),
  sound: (n) => sound.play(n),
});

function issue(c: Command): void {
  if (mode !== 'play' || watching || spectating) return;
  if (online && net) net.send({ t: 'cmd', c });
  else pending.push(c);
}

/** Personal battlefield notes neither issue unit orders nor send online packets. */
function markScout(x: number, y: number, danger: boolean): void {
  if (!game || mode !== 'play' || watching || spectating) return;
  const result = scoutFlags.toggle(game, viewer, x, y, danger ? 'danger' : 'plan');
  if (result === 'unexplored') {
    hud.toast('Scout that ground before placing a flag', 'bad');
    play('error');
    return;
  }
  play('click');
  hud.toast(result === 'removed' ? 'Scout flag removed' : result === 'changed' ? 'Scout flag changed' : danger ? 'Danger marked on your map' : 'Scout flag placed on your map', 'info');
  mapTimer = 0;
}

// ---- Online ----------------------------------------------------------------------------------------

/** In an online match: the room's line, the turns received so far and how far they reach unbroken. */
let net: NetClient | null = null;
let online = false;
let netTurns: Command[][] = [];
let netReach = 0;
let netPaused = false;
/** Looking in on someone else's online match: nothing is sent, and the whole map shows. */
let spectating = false;
let spectateAll = true;

const lobby = new Lobby(
  {
    create: async (name) => {
      saveName(name);
      lobby.showConnecting('…');
      try {
        connectRoom(await newRoomCode(), name);
      } catch {
        lobby.showEntry('', 'Could not reach the game server. Online play needs the game served by its Worker (see the README).');
      }
    },
    join: (code, name) => {
      saveName(name);
      connectRoom(code, name);
    },
    watch: (code, name) => {
      saveName(name);
      connectRoom(code, name, true);
    },
    leave: () => leaveOnline(),
    send: (m) => net?.send(m),
  },
  () => savedName(),
);

function connectRoom(code: string, name: string, watch = false): void {
  net?.close();
  lobby.showConnecting(code);
  const n = new NetClient(code, name, watch);
  net = n;
  n.onMessage = (m) => net === n && onNet(m);
  n.onClosed = (why) => {
    if (net !== n) return;
    net = null;
    if (online && mode !== 'title') {
      hud.banner('Disconnected', why, 6000);
      online = false;
      mode = 'over';
    } else lobby.showEntry(code, why);
  };
  n.onStatus = (st) => {
    if (online && st === 'retrying') hud.toast('Connection lost: reconnecting…', 'alert');
  };
  n.connect();
  history.replaceState(null, '', `?room=${code}${watch ? '&watch=1' : ''}`);
}

function leaveOnline(): void {
  if (net && online && !spectating && game && !game.over) net.send({ t: 'cmd', c: { t: 'leave', p: viewer } });
  spectating = false;
  $('replay-bar').classList.add('hidden');
  net?.close();
  net = null;
  online = false;
  lobby.hide();
  history.replaceState(null, '', location.pathname);
  $('title').classList.remove('hidden');
}

function onNet(m: ServerMsg): void {
  switch (m.t) {
    case 'lobby':
      if (!m.lobby.started && mode === 'title') {
        $('title').classList.add('hidden');
        lobby.showRoom(m.lobby, m.you);
      }
      break;
    case 'start':
      startOnline(m.match, m.you);
      break;
    case 'turn':
      netTurns[m.n] = m.c;
      while (netTurns[netReach] !== undefined) netReach++;
      break;
    case 'catchup':
      netTurns = m.turns.slice();
      netReach = netTurns.length;
      break;
    case 'paused':
      netPaused = m.on;
      $('paused').classList.toggle('hidden', !m.on);
      $('pause-btn').innerHTML = m.on ? PLAY_ICON : PAUSE_ICON;
      if (m.by) hud.toast(`${m.by} ${m.on ? 'paused' : 'resumed'} the game`, 'info');
      break;
    case 'chat':
      if (online && mode !== 'title') chatLine(m.from, m.color, m.text);
      else lobby.addChat(m.from, m.color, m.text);
      break;
    case 'desync':
      hud.banner('Out of step', 'This browser and the others no longer agree. Reload the page to rejoin.', 8000);
      break;
    case 'error':
      if (online && mode !== 'title') hud.toast(m.why, 'bad');
      else lobby.showError(m.why);
      break;
  }
}

function startOnline(match: MatchStart, you: number): void {
  const players: PlayerSetup[] = match.seats.map((seat, i) => ({
    name: seat.kind === 'ai' ? `${LEADERS[match.civs[i]]}` : seat.name,
    ai: seat.kind === 'ai' ? (seat.level ?? 'normal') : null,
    color: PLAYER_COLORS[seat.color],
    team: seat.team,
    civ: match.civs[i],
  }));
  netTurns = [];
  netReach = 0;
  netPaused = false;
  online = true;
  lobby.hide();
  startMatch({ ...match.setup, players }, undefined, Math.max(0, you));
  if (you < 0) {
    spectating = true;
    spectateAll = true;
    tips.hide();
    view.revealAll();
    $('replay-bar').classList.remove('hidden');
    spectateBar();
    hud.banner('Watching', 'You can look but not touch: pick whose eyes to see through in the bar above.', 5000);
  }
}

function spectateBar(): void {
  const s = game;
  if (!s) return;
  const views = [`<option value="-1">Everything</option>`, ...s.players.map((p, i) => `<option value="${i}" ${!spectateAll && i === viewer ? 'selected' : ''}>${p.name}'s eyes</option>`)].join('');
  $('replay-bar').innerHTML = `<span class="rb-title">Watching</span><select id="rb-view">${views}</select><button class="tb-btn" data-rb="exit">Leave</button>`;
}

/** A line of chat, shown over the game for a while. */
function chatLine(from: string, color: number, text: string): void {
  const box = $('chat-lines');
  const div = document.createElement('div');
  div.className = 'chat-line';
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  div.innerHTML = from ? `<b style="color:${PLAYER_COLORS[color] ?? '#fff'}">${esc(from)}:</b> ${esc(text)}` : `<i>${esc(text)}</i>`;
  box.appendChild(div);
  while (box.children.length > 6) box.firstChild!.remove();
  setTimeout(() => div.classList.add('old'), 12000);
  if (from) play('click');
}

function openChat(): void {
  const input = $<HTMLInputElement>('chat-input');
  input.classList.remove('hidden');
  input.focus();
}

$('chat-input').addEventListener('keydown', (e) => {
  const input = e.target as HTMLInputElement;
  e.stopPropagation();
  if (e.key === 'Enter') {
    const text = input.value.trim();
    if (text && net) net.send({ t: 'chat', text });
    input.value = '';
    input.classList.add('hidden');
    input.blur();
  } else if (e.key === 'Escape') {
    input.value = '';
    input.classList.add('hidden');
    input.blur();
  }
});

function play(name: SoundName, pan = 0, gain = 1): void {
  sound.play(name, { pan, gain });
}
view.onCue = (name, pan, gain) => play(name, pan, gain);
view.onSighting = (what) => {
  const look = SIGHT_LORE[what];
  play('sighting');
  hud.banner(look.title, look.lore, 4200);
};
view.onPing = (x, y, color) => minimap.ping(x, y, color);

// ---- Starting matches ------------------------------------------------------------------------------

function newSeed(): number {
  return 1 + Math.floor(Math.random() * 999999);
}

function startAttract(skipAhead = true): void {
  mode = 'title';
  const seed = newSeed();
  const maps = Object.keys(MAP_TYPES) as MapType[];
  // Any map, starting in any epoch: sometimes there are galleons on the sea or biplanes overhead.
  game = createGame({ seed, size: 'small', mapType: maps[seed % maps.length], startEpoch: Math.floor(seed / maps.length) % EPOCHS.length, players: [{ name: 'Azure', ai: 'normal' }, { name: 'Crimson', ai: 'hard' }] });
  viewer = 0;
  view.setGame(game, 0);
  view.revealAll();
  view.rig.zoom(1.05);
  minimap.setup(game);
  // Skip ahead so there is a town to look at.
  if (skipAhead) for (let i = 0; i < TICK_HZ * 150; i++) step(game);
  attractT = 0;
  playMusic(2);
}

let captionKey = '';
/** Names the town the title's camera is visiting, fading it out and in as the camera moves on. */
function captionTown(who: GameState['players'][number], marching: boolean): void {
  const key = `${who.id}${marching ? 'a' : 't'}${who.epoch}`;
  if (key === captionKey) return;
  captionKey = key;
  const el = $('title-caption');
  el.classList.remove('on');
  setTimeout(() => {
    if (mode !== 'title' || captionKey !== key) return;
    el.innerHTML = `<b>${escHtml(who.name)} of the ${CIVS[who.civ].name}</b>${marching ? 'an army on the march' : `${ageDef(who).name}`}`;
    el.classList.add('on');
  }, 1200);
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
    mode: val('opt-mode') as GameMode,
  };
}

/** The opening of a new match (wonder): the haze lifts off the home valley while a pad swells. */
function dawn(): void {
  const el = $('dawn');
  el.classList.remove('lift');
  void el.offsetWidth;
  el.classList.add('lift');
  play('dawn');
}

function startMatch(setup: GameSetup, saved?: GameState, seat = 0): void {
  lastSetup = setup;
  if (!online) {
    net?.close();
    net = null;
  }
  game = saved ?? createGame(setup);
  viewer = seat;
  record = [];
  if (!watchingNext) {
    watching = null;
    $('replay-bar').classList.add('hidden');
  }
  watchingNext = false;
  spectating = false;
  mode = 'play';
  lastEnd = null;
  pending = [];
  godOn = false;
  godTyped = '';
  $('god-btn').classList.add('hidden');
  selection = new Set();
  selectedTile = null;
  selectedRelic = null;
  selectedPost = null;
  selectedRuin = null;
  selectedLandmark = null;
  placing = null;
  wallDrag = null;
  targetMode = null;
  paused = false;
  speedIdx = 0;
  groups.clear();
  cameraBookmarks.reset();
  scoutFlags.reset();
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
  const goal = game.mode === 'regicide' ? ' Keep your King alive: shelter them in the Town Center.' : game.mode === 'deathmatch' ? ' Everyone starts rich: build fast.' : game.mode === 'lords' ? ' Keep every landmark for four minutes and you win.' : '';
  const chapter = game.scenario ? scenarioById(game.scenario.id) : undefined;
  if (!saved && chapter) hud.banner(chapter.title, chapter.place, 6000);
  else if (!saved) hud.banner(ageDef(me).name, `You lead the ${CIVS[me.civ].name}. Facing ${rivals.join(', ')}.${goal} ${view.weatherWords}`.trim(), 6000);
  else hud.banner('Welcome back', `${ageDef(me).name}, ${fmtClock(game.tick)} into the match.`, 3200);
  sound.setWeather(view.weatherDay.kind, view.weatherDay.strength);
  view.onWeather = (d) => sound.setWeather(d.kind, d.strength);
  view.onSeason = (sn) => sound.setSeason(sn);
  sound.startAmbience();
  playMusic(me.epoch, ageOf(me));
  // Start facing north, as the minimap does, whatever way the title's drifting camera had turned.
  view.rig.faceNorth();
  // Start with the Town Center in view and selected.
  const tc = game.ents.find((e) => e.kind === 'building' && e.owner === viewer && e.type === 'towncenter');
  if (tc) {
    setSelection([tc.id]);
    view.rig.focus(tc.x, tc.y + 3, true);
  }
  if (!saved) dawn();
  tips.start(saved ? 9999 : 0);
  $('chat-lines').innerHTML = '';
  document.body.classList.toggle('online', online);
  if (online) chatLine('', 0, 'Online match: press Enter to chat.');
}

const fmtClock = (ticks: number) => {
  const sec = Math.floor(ticks / TICK_HZ);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

function showCampaign(html: string): void {
  $('title').classList.add('hidden');
  const c = $('campaign');
  c.innerHTML = html;
  c.classList.remove('hidden');
}

function startChapter(id: string): void {
  const sc = scenarioById(id);
  if (!sc) return;
  $('campaign').classList.add('hidden');
  startMatch({ ...sc.setup, scenario: id });
}

function toTitle(): void {
  $('campaign').classList.add('hidden');
  autosave(true);
  if (watching) {
    watching = null;
    $('replay-bar').classList.add('hidden');
  }
  if (online || net) leaveOnline();
  document.body.classList.remove('online');
  tips.hide();
  $('hud').classList.add('hidden');
  $('modal').classList.add('hidden');
  $('title').classList.remove('hidden');
  startAttract();
}

// ---- Saving ----------------------------------------------------------------------------------------

const SAVE_KEY = 'ages-save';
/** Bumped when the state's shape changes, so an older save is set aside instead of loading broken (2: relics; 3: trading posts). */
const SAVE_V = 3;

interface SavedMatch {
  setup: GameSetup;
  state: GameState;
  record: [number, Command[]][];
}

/** A match as save text, the same for the browser's own save and a cloud slot. */
function saveText(s: GameState, setup: GameSetup): string {
  return JSON.stringify({ v: SAVE_V, setup, at: Date.now(), state: serialize(s), record });
}

/** Save text back to a match; null if it can't be read or is from an older shape (`SAVE_V`). */
function readSave(raw: string | null): SavedMatch | null {
  try {
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.v !== SAVE_V) return null;
    return { setup: saved.setup, state: deserialize(saved.state), record: Array.isArray(saved.record) ? saved.record : [] };
  } catch {
    return null;
  }
}

function saveGame(s: GameState, setup: GameSetup): boolean {
  try {
    localStorage.setItem(SAVE_KEY, saveText(s, setup));
    showContinue();
    return true;
  } catch {
    return false;
  }
}

function loadGame(): SavedMatch | null {
  try {
    return readSave(localStorage.getItem(SAVE_KEY));
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
  if (!game || mode !== 'play' || !lastSetup || game.over || online || watching) return;
  if (!force && game.tick < autosaveAt) return;
  autosaveAt = game.tick + TICK_HZ * 60;
  saveGame(game, lastSetup);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) autosave(true);
});
window.addEventListener('pagehide', () => autosave(true));

// ---- Cloud saves (#290) ----------------------------------------------------------------------------

const escHtml = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** What a cloud slot is called: the chapter, or your people, their age and the time played. */
function cloudTitle(s: GameState): string {
  const me = s.players[viewer];
  const minutes = Math.floor(s.tick / (TICK_HZ * 60));
  const chapter = s.scenario ? scenarioById(s.scenario.id) : undefined;
  return `${chapter ? chapter.title : `${CIVS[me.civ].name}, ${ageDef(me).name}`} · ${minutes} min`;
}

/** Whether the match on screen may go to the cloud: your own, under way, not online or watched. */
function canCloudSave(): boolean {
  return !!game && mode === 'play' && !!lastSetup && !game.over && !online && !watching;
}

let cloudBusy = false;
/** Where the panel is open (the modal or the campaign screen), or null when it is closed. */
let cloudBox: HTMLElement | null = null;
/** Bumped by each draw, so a slow answer never paints over a newer panel. */
let cloudDraw = 0;

async function openCloud(note = ''): Promise<void> {
  const draw = ++cloudDraw;
  const key = vaultKey();
  // In a match the panel is the pause menu's modal; on the title screen (where the HUD and its modal are
  // hidden) it takes the campaign screen, as the Web of Ages does.
  const inMatch = !$('hud').classList.contains('hidden');
  const saving = canCloudSave();
  const html = `<div class="card wide cloud"><h2>Cloud saves</h2>
    <p class="hint">Kept on the server under your save key, ${VAULT_SLOTS} slots. Enter the same key on another device to play them there; your Long Road stars and Web of Ages finds follow the key too. A key nobody uses for a year is emptied.${saving ? '' : ' To save, open Cloud saves from the Menu during a match.'}</p>
    <div class="cloud-slots" ><div class="hint">Opening your saves…</div></div>
    ${note ? `<div class="hint cloud-note">${escHtml(note)}</div>` : ''}
    <div class="row cloud-key">
      <label>Your save key <code id="cloud-key">${formatVaultKey(key)}</code></label>
      <button class="btn" data-act="cloud-copy">Copy key</button>
      <button class="btn" data-act="cloud-qr">Show QR code</button>
      <label>Key from another device <input id="cloud-key-in" maxlength="30" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"></label>
      <button class="btn" data-act="cloud-use">Use this key</button>
    </div>
    <div class="cloud-qr hidden"></div>
    <div class="row"><button class="btn wide" data-act="cloud-close">Back</button></div></div>`;
  if (inMatch) {
    $('modal').innerHTML = html;
    $('modal').classList.remove('hidden');
  } else showCampaign(`<div class="modal">${html}</div>`);
  const box = (cloudBox = inMatch ? $('modal') : $('campaign'));
  const list = box.querySelector<HTMLElement>('.cloud-slots')!;
  let slots: (CloudSlot | null)[];
  try {
    slots = await listCloud(key);
  } catch (err) {
    if (draw === cloudDraw) list.innerHTML = `<div class="hint bad">${escHtml((err as Error).message)}</div>`;
    return;
  }
  if (draw !== cloudDraw || !box.querySelector('.cloud') || box.classList.contains('hidden')) return;
  syncProgress().then(
    (learned) => {
      if (learned) hud.toast(`Campaign stars from your cloud: ${learned} chapter${learned === 1 ? '' : 's'} brought here`, 'info');
    },
    () => undefined,
  );
  syncDiscovery().then(
    (learned) => {
      discovery = null; // reread on the next find
      if (learned) hud.toast(`Web of Ages finds from your cloud: ${learned} brought here`, 'info');
    },
    () => undefined,
  );
  list.innerHTML = slots
    .map((slot, i) => {
      const n = i + 1;
      const when = slot ? new Date(slot.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
      return `<div class="cloud-slot">
        <div class="cloud-what"><b>Slot ${n}</b> ${slot ? `${escHtml(slot.title)}<span class="hint">${when}</span>` : '<span class="hint">Empty</span>'}</div>
        <div class="cloud-acts">
          ${saving ? `<button class="btn ${slot ? '' : 'primary'}" data-act="cloud-save" data-slot="${n}">${slot ? 'Save over' : 'Save here'}</button>` : ''}
          ${slot ? `<button class="btn ${saving ? '' : 'primary'}" data-act="cloud-load" data-slot="${n}">Load</button><button class="btn" data-act="cloud-delete" data-slot="${n}">Delete</button>` : ''}
        </div></div>`;
    })
    .join('');
}

/** One cloud call at a time, with its outcome told in a toast and the panel drawn afresh. */
async function cloudDo(work: () => Promise<string | void>): Promise<void> {
  if (cloudBusy) return;
  cloudBusy = true;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.cloud button')) b.disabled = true;
  try {
    const said = await work();
    if (said) hud.toast(said, 'info');
  } catch (err) {
    hud.toast((err as Error).message, 'bad');
  } finally {
    cloudBusy = false;
  }
  if (cloudBox?.querySelector('.cloud') && !cloudBox.classList.contains('hidden')) void openCloud();
}

function cloudAct(act: string, el: HTMLElement): void {
  const slot = Number(el.dataset.slot);
  switch (act) {
    case 'cloud':
      sound.play('click');
      void openCloud();
      break;
    case 'cloud-save':
      if (!canCloudSave() || !game || !lastSetup) break;
      {
        const text = saveText(game, lastSetup);
        const title = cloudTitle(game);
        void cloudDo(async () => {
          await saveCloud(vaultKey(), slot, title, text);
          return `Saved to cloud slot ${slot}`;
        });
      }
      break;
    case 'cloud-load':
      void cloudDo(async () => {
        const saved = readSave(await loadCloud(vaultKey(), slot));
        if (!saved) throw new Error('That save is from an older version of the game and cannot be opened.');
        sound.play('click');
        cloudBox = null;
        $('campaign').innerHTML = '';
        $('campaign').classList.add('hidden');
        startMatch(saved.setup, saved.state);
        record = saved.record;
        return `Loaded cloud slot ${slot}`;
      });
      break;
    case 'cloud-delete':
      if (!confirm(`Delete the save in cloud slot ${slot}? It can't be brought back.`)) break;
      void cloudDo(async () => {
        await deleteCloud(vaultKey(), slot);
        return `Cloud slot ${slot} emptied`;
      });
      break;
    case 'cloud-copy': {
      const key = formatVaultKey(vaultKey());
      const fail = () => hud.toast(`Your save key: ${key}`, 'info');
      if (navigator.clipboard) navigator.clipboard.writeText(key).then(() => hud.toast('Save key copied. Keep it secret: it opens your saves.', 'info'), fail);
      else fail();
      break;
    }
    case 'cloud-qr': {
      // The key rides in the link's #fragment, which a browser never sends to any server.
      const box = cloudBox?.querySelector<HTMLElement>('.cloud-qr');
      if (!box) break;
      if (box.classList.toggle('hidden')) {
        el.textContent = 'Show QR code';
        box.innerHTML = '';
      } else {
        el.textContent = 'Hide QR code';
        const link = `${location.origin}${location.pathname}#vault=${vaultKey()}`;
        box.innerHTML = `${qrSvg(link)}<div class="hint">Scan with your phone's camera to open the game there with this key. It opens your saves: show it to nobody else.</div>`;
      }
      break;
    }
    case 'cloud-use': {
      const typed = cloudBox?.querySelector<HTMLInputElement>('#cloud-key-in')?.value ?? '';
      if (!typed.trim()) break;
      if (useVaultKey(typed)) void openCloud('Now using that key. Copy your old key first if you may want its saves again.');
      else hud.toast('That is not a save key: 20 letters and digits, like ABCD-EFGH-JKLM-NPQR-STUV', 'bad');
      break;
    }
    case 'cloud-close':
      cloudDraw++;
      cloudBox = null;
      if (!$('hud').classList.contains('hidden')) openMenu();
      else {
        $('campaign').innerHTML = '';
        $('campaign').classList.add('hidden');
        $('title').classList.remove('hidden');
      }
      break;
  }
}

// ---- Replays --------------------------------------------------------------------------------------

declare const __BUILD__: string;

/** A recorded match: how it was set up and every command, by the tick it took effect. */
interface ReplayFile {
  v: 1;
  build: string;
  date: number;
  setup: GameSetup;
  viewer: number;
  end: number;
  cmds: [number, Command[]][];
}

const REPLAY_KEY = 'ages-replay';
/** Commands of this match so far, for its replay. */
let record: [number, Command[]][] = [];
let watching: { file: ReplayFile; at: Map<number, Command[]>; speed: number; all: boolean } | null = null;
let watchingNext = false;

function replayOf(s: GameState): ReplayFile | null {
  if (!lastSetup) return null;
  return { v: 1, build: __BUILD__, date: Date.now(), setup: lastSetup, viewer, end: s.tick, cmds: record };
}

/** Keep the last match's replay in the browser (if it fits). */
function keepReplay(s: GameState): void {
  const r = replayOf(s);
  if (!r) return;
  try {
    localStorage.setItem(REPLAY_KEY, JSON.stringify(r));
  } catch {
    /* Too big for storage: it can still be downloaded from the end screen. */
  }
  showReplayButton();
}

function downloadReplay(s: GameState): void {
  const r = replayOf(s);
  if (!r) return;
  const blob = new Blob([JSON.stringify(r)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date(r.date);
  a.download = `ages-of-earth-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function showReplayButton(): void {
  let has = false;
  try {
    has = !!localStorage.getItem(REPLAY_KEY);
  } catch {
    has = false;
  }
  $('replay-last-btn').classList.toggle('hidden', !has);
}

function watchReplay(file: ReplayFile): void {
  if (!file || file.v !== 1 || !file.setup || !Array.isArray(file.cmds)) {
    hud.toast('That is not a replay file', 'bad');
    return;
  }
  online = false;
  watching = { file, at: new Map(file.cmds), speed: 1, all: true };
  watchingNext = true;
  startMatch(file.setup, undefined, file.viewer);
  tips.hide();
  view.revealAll();
  $('replay-bar').classList.remove('hidden');
  replayBar();
  hud.banner('Replay', file.build !== __BUILD__ ? 'Recorded with another version of the game: it may not play out the same.' : `${new Date(file.date).toLocaleString()}`, 4000);
}

/** Play a replay's commands at the chosen speed. */
function stepReplay(s: GameState, dt: number): void {
  const w = watching!;
  if (paused || s.tick >= w.file.end) return;
  acc += dt * w.speed;
  let n = 0;
  while (acc >= DT && n < 40 && s.tick < w.file.end) {
    step(s, w.at.get(s.tick) ?? []);
    view.events(s, s.events);
    for (const ev of s.events) if (ev.k === 'epoch') hud.toast(`${s.players[ev.owner].name} ${ev.back ? 'stepped back to' : 'reached'} the ${ageName(ev)}`, 'info');
    acc -= DT;
    n++;
  }
  if (n === 40) acc = 0;
  if (s.tick >= w.file.end) hud.banner('End of the replay', '', 4000);
}

/** Jump ahead (without the sights and sounds on the way). */
function skipReplay(seconds: number): void {
  const s = game;
  const w = watching;
  if (!s || !w) return;
  const to = Math.min(w.file.end, s.tick + seconds * TICK_HZ);
  while (s.tick < to) step(s, w.at.get(s.tick) ?? []);
  view.events(s, [{ k: 'depleted', tile: 0 }]);
}

function replayBar(): void {
  const w = watching;
  const s = game;
  if (!w || !s) return;
  const views = [`<option value="-1">Everything</option>`, ...s.players.map((p, i) => `<option value="${i}">${p.name}'s eyes</option>`)].join('');
  $('replay-bar').innerHTML = `<span class="rb-title">Replay</span>
    <button class="tb-btn" data-rb="pause">${paused ? PLAY_ICON : PAUSE_ICON}</button>
    ${[1, 2, 4, 8].map((k) => `<button class="tb-btn ${w.speed === k ? 'alert' : ''}" data-rb="speed" data-k="${k}">${k}×</button>`).join('')}
    <button class="tb-btn" data-rb="skip" title="Jump ahead a minute">+1 min</button>
    <select id="rb-view">${views}</select>
    <button class="tb-btn" data-rb="exit">Exit</button>`;
}

$('replay-bar').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rb]');
  if (b && spectating && b.dataset.rb === 'exit') return toTitle();
  if (!b || !watching) return;
  switch (b.dataset.rb) {
    case 'pause':
      togglePause();
      break;
    case 'speed':
      watching.speed = Number(b.dataset.k);
      break;
    case 'skip':
      skipReplay(60);
      break;
    case 'exit':
      toTitle();
      return;
  }
  replayBar();
});
$('replay-bar').addEventListener('change', (e) => {
  const sel = e.target as HTMLSelectElement;
  if (sel.id !== 'rb-view' || !game) return;
  const v = Number(sel.value);
  if (watching) watching.all = v < 0;
  else if (spectating) spectateAll = v < 0;
  if (v < 0) view.setViewer(game, viewer, true);
  else {
    viewer = v;
    view.setViewer(game, v, false);
    setSelection([]);
  }
});

const replayInput = document.createElement('input');
replayInput.type = 'file';
replayInput.accept = '.json,application/json';
replayInput.addEventListener('change', async () => {
  const f = replayInput.files?.[0];
  replayInput.value = '';
  if (!f) return;
  try {
    watchReplay(JSON.parse(await f.text()));
  } catch {
    hud.toast('Could not read that replay', 'bad');
  }
});

// ---- Title screen ----------------------------------------------------------------------------------

const seedInput = $<HTMLInputElement>('opt-seed');
const moreOpts = $<HTMLDetailsElement>('more-opts');
try { moreOpts.open = localStorage.getItem('aoe-more-opts') === '1'; } catch { /* storage blocked: stay folded */ }
moreOpts.addEventListener('toggle', () => { try { localStorage.setItem('aoe-more-opts', moreOpts.open ? '1' : '0'); } catch { /* ignore */ } });
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
  $('civ-crest').innerHTML = crestSvg(c as CivId | 'random', PLAYER_COLORS[Number(colorSel.value)] ?? PLAYER_COLORS[0]);
  $('civ-blurb').innerHTML = `${c === 'random' ? 'A people chosen at random.' : `<b>${CIVS[c as CivId].name}:</b> ${CIVS[c as CivId].blurb.split(': ').slice(1).join(': ') || CIVS[c as CivId].blurb}`}<br><b>${m.label}:</b> ${m.blurb}`;
};
civSel.addEventListener('change', civBlurb);
colorSel.addEventListener('change', civBlurb);
showContinue();
showReplayButton();
mapSel.addEventListener('change', civBlurb);
civBlurb();
// A shared world link (?seed=N&size=&map=&foes=): the title screen opens with that world's settings (the seed atlas prints them).
{
  const q = new URLSearchParams(location.search);
  const seed = Math.floor(Number(q.get('seed')));
  if (seed >= 1 && seed <= 2 ** 31 - 1) seedInput.value = String(seed);
  for (const [key, id] of [['size', 'opt-size'], ['map', 'opt-map'], ['foes', 'opt-foes']] as const) {
    const v = q.get(key);
    const sel = $<HTMLSelectElement>(id);
    if (v !== null && [...sel.options].some((o) => o.value === v)) sel.value = v;
  }
  civBlurb();
}
const qualitySel = $<HTMLSelectElement>('opt-quality');
qualitySel.value = view.qualityName;
qualitySel.addEventListener('change', () => view.setQuality(qualitySel.value as QualityName));

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  sound.unlock();
  const act = el.dataset.act!;
  if (act.startsWith('cloud')) return cloudAct(act, el);
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
        record = saved.record;
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
    case 'copy-world': {
      const seed = Math.floor(Number(seedInput.value));
      if (!(seed >= 1 && seed <= 2 ** 31 - 1)) {
        hud.toast('Enter a map seed first', 'bad');
        break;
      }
      const q = new URLSearchParams({ seed: String(seed) });
      for (const [key, id] of [['size', 'opt-size'], ['map', 'opt-map'], ['foes', 'opt-foes']] as const) q.set(key, $<HTMLSelectElement>(id).value);
      const link = `${location.origin}${location.pathname}?${q}`;
      const done = () => hud.toast('World link copied', 'info');
      const fail = () => hud.toast(link, 'info');
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, fail);
      else fail();
      break;
    }
    case 'idle':
      nextIdle(e.shiftKey);
      break;
    case 'speed':
      cycleSpeed(1, true);
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
    case 'replay-last':
      try {
        const raw = localStorage.getItem(REPLAY_KEY);
        if (raw) watchReplay(JSON.parse(raw));
      } catch {
        hud.toast('Could not read the last replay', 'bad');
      }
      break;
    case 'replay-open':
      replayInput.click();
      break;
    case 'replay-save':
      if (game) downloadReplay(game);
      break;
    case 'campaign':
      sound.play('click');
      showCampaign(chapterListHtml());
      break;
    case 'web-map':
      sound.play('click');
      showCampaign(webMapHtml(loadDiscovery()));
      break;
    case 'camp-back':
      $('campaign').classList.add('hidden');
      $('title').classList.remove('hidden');
      break;
    case 'camp-list':
      showCampaign(chapterListHtml());
      break;
    case 'camp-open': {
      const sc = scenarioById(el.dataset.id!);
      if (sc) showCampaign(briefingHtml(sc));
      break;
    }
    case 'camp-begin':
      sound.play('click');
      startChapter(el.dataset.id!);
      break;
    case 'camp-next': {
      const next = SCENARIOS[SCENARIOS.findIndex((c) => c.id === el.dataset.id) + 1];
      if (next) {
        $('modal').classList.add('hidden');
        toTitle();
        showCampaign(briefingHtml(next));
      }
      break;
    }
    case 'online':
      sound.play('click');
      $('title').classList.add('hidden');
      lobby.showEntry();
      break;
    case 'resign':
      issue({ t: 'resign', p: viewer });
      closeModal();
      break;
    case 'watch':
      $('modal').classList.add('hidden');
      view.revealAll();
      hud.toast('Esc or ☰ Menu brings the results back', 'info');
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
  selectedRelic = null;
  selectedPost = null;
  selectedRuin = null;
  selectedLandmark = null;
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

function nextIdle(all = false): void {
  if (!game) return;
  const idle = idleCitizens(game, viewer);
  if (!idle.length) {
    hud.toast('No idle citizens', 'info');
    return;
  }
  const cur = [...selection][0];
  const ids = idleSelection(idle, cur, all);
  setSelection(ids);
  if (!all) {
    const u = game.byId.get(ids[0])!;
    view.rig.focus(u.x, u.y);
  }
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
      const at = pk.kind === 'ground' ? pk : pk.kind === 'resource' ? { x: (pk.tile % s.w) + 0.5, y: Math.floor(pk.tile / s.w) + 0.5 } : pk.kind === 'animal' ? null : pk.kind === 'relic' ? (relicAt(s, pk.id) ?? null) : pk.kind === 'post' ? (postAt(s, pk.id) ?? null) : pk.kind === 'ruin' ? (ruinAt(s, pk.id) ?? null) : pk.kind === 'landmark' ? (landmarkAt(s, pk.id) ?? null) : (() => {
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
    // Your own flock (#308): citizens milk it; attack-move (A) slaughters it.
    if (a.kind === 'sheep' && a.owner === viewer && !forceAttack && units.some((u) => u.type === 'citizen')) {
      issue({ t: 'milk', p: viewer, ids, target: a.id, queue: q });
      view.marker(s, a.x, a.y, false);
      play('move');
      ack('move');
      return;
    }
    issue({ t: 'hunt', p: viewer, ids, target: a.id, queue: q });
    view.marker(s, a.x, a.y, true);
    play('move');
    return;
  }
  if (pk.kind === 'relic') {
    const r = relicAt(s, pk.id);
    if (!r) return;
    issue({ t: 'relic', p: viewer, ids, target: r.id, queue: q });
    view.marker(s, r.x, r.y, false);
    play('move');
    ack('move');
    return;
  }
  if (pk.kind === 'ruin') {
    const r = ruinAt(s, pk.id);
    if (!r) return;
    if (forceAttack || !units.some((u) => u.type === 'citizen')) issue({ t: 'move', p: viewer, ids, x: r.x, y: r.y, amove: forceAttack, queue: q });
    else issue({ t: 'dig', p: viewer, ids, target: r.id, queue: q });
    view.marker(s, r.x, r.y, forceAttack);
    play(forceAttack ? 'attack' : 'move');
    ack(forceAttack ? 'attack' : 'move');
    return;
  }
  if (pk.kind === 'landmark') {
    // Stand on it to claim it (or hold it).
    const m = landmarkAt(s, pk.id);
    if (!m) return;
    issue({ t: 'move', p: viewer, ids, x: m.x, y: m.y, amove: forceAttack, queue: q });
    view.marker(s, m.x, m.y, forceAttack);
    play(forceAttack ? 'attack' : 'move');
    ack(forceAttack ? 'attack' : 'move');
    return;
  }
  if (pk.kind === 'post') {
    const post = postAt(s, pk.id);
    if (!post) return;
    if (forceAttack) issue({ t: 'move', p: viewer, ids, x: post.x, y: post.y, amove: true, queue: q });
    else issue({ t: 'route', p: viewer, ids, post: post.id, queue: q });
    view.marker(s, post.x, post.y, forceAttack);
    play(forceAttack ? 'attack' : 'move');
    ack(forceAttack ? 'attack' : 'move');
    return;
  }
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id);
    if (!t) return;
    // Your own transport: those on foot go aboard.
    if (t.kind === 'unit' && t.type === 'transport' && t.owner === viewer && board(s, units, t, q)) return;
    if (t.owner !== viewer && s.players[t.owner].team !== s.players[viewer].team) {
      issue({ t: 'attack', p: viewer, ids, target: t.id, queue: q, spread: true });
      view.marker(s, t.x, t.y, true);
      play(units.every((u) => u.type === 'priest') ? 'chant' : 'attack');
      ack('attack');
      return;
    }
    if (t.kind === 'building' && t.owner === viewer) {
      issue({ t: 'work', p: viewer, ids, target: t.id, queue: q });
      view.marker(s, t.x, t.y, false);
      play(units.some((u) => u.type === 'citizen') && (!t.built || t.hp < maxHp(s, t)) ? 'hammer' : 'move');
      return;
    }
    issue({ t: 'move', p: viewer, ids, x: t.x, y: t.y, amove: forceAttack, queue: q });
    view.marker(s, t.x, t.y, false);
    play('move');
    return;
  }
  if (pk.kind === 'resource') {
    issue({ t: 'gather', p: viewer, ids, tile: pk.tile, queue: q, spread: true });
    view.marker(s, (pk.tile % s.w) + 0.5, Math.floor(pk.tile / s.w) + 0.5, false);
    play('move');
    ack('move');
    return;
  }
  // Loaded transports sent onto land put their passengers ashore there; everyone else moves.
  const loaded = forceAttack ? [] : units.filter((u) => u.type === 'transport' && u.cargo.length);
  if (loaded.length && walkable(s, Math.floor(pk.x), Math.floor(pk.y))) {
    issue({ t: 'unload', p: viewer, ids: loaded.map((u) => u.id), x: pk.x, y: pk.y, queue: q });
    const rest = ids.filter((id) => !loaded.some((u) => u.id === id));
    if (rest.length) issue({ t: 'move', p: viewer, ids: rest, x: pk.x, y: pk.y, queue: q });
    view.marker(s, pk.x, pk.y, false);
    play('move');
    ack('move');
    return;
  }
  issue({ t: 'move', p: viewer, ids, x: pk.x, y: pk.y, amove: forceAttack, queue: q });
  view.marker(s, pk.x, pk.y, forceAttack);
  play(forceAttack ? 'attack' : 'move');
  ack(forceAttack ? 'attack' : 'move');
}

/** Those of the selection on foot board a transport (the rest sail or fly to it). Whether any could. */
function board(s: GameState, units: Unit[], ship: Unit, queue: true | undefined): boolean {
  const riders = units.filter((u) => domainOf(u.type) === 'land');
  if (!riders.length) return false;
  const room = (unitStats('transport', s.players[viewer].epoch).capacity ?? 0) - ship.cargo.length;
  if (room <= 0) {
    hud.toast('That transport is full', 'bad');
    play('error');
    return true;
  }
  issue({ t: 'board', p: viewer, ids: riders.map((u) => u.id), target: ship.id, queue });
  const rest = units.filter((u) => domainOf(u.type) !== 'land' && u.id !== ship.id).map((u) => u.id);
  if (rest.length) issue({ t: 'move', p: viewer, ids: rest, x: ship.x, y: ship.y, queue });
  if (riders.length > room) hud.toast(`Room for ${room} more aboard`, 'info');
  view.marker(s, ship.x, ship.y, false);
  play('move');
  ack('move');
  return true;
}

/** Sail the selected transports to a shore and land their passengers. */
/** Patrol between where the selection stands and the ground under the pointer (#454); Shift adds a waypoint. */
function patrolAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const g = view.groundAt(clientX, clientY);
  const units = selectedUnits(s).filter((u) => !u.inside);
  if (!g || !units.length) return;
  issue({ t: 'patrol', p: viewer, ids: units.map((u) => u.id), x: g.x, y: g.y, queue: queue || undefined });
  view.marker(s, g.x, g.y, true);
  play('move');
}

function unloadAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const g = view.groundAt(clientX, clientY);
  const ships = selectedUnits(s).filter((u) => u.type === 'transport');
  if (!g || !ships.length) return;
  issue({ t: 'unload', p: viewer, ids: ships.map((u) => u.id), x: g.x, y: g.y, queue: queue || undefined });
  view.marker(s, g.x, g.y, false);
  play('move');
}

/** Shelter the selection in the building under the pointer. */
/** A Blood-rite priest's sacrifice or curse (#355 s4) on the enemy under the pointer. */
function riteAt(clientX: number, clientY: number, how: 'sacrifice' | 'curse', queue: boolean): void {
  const s = game;
  if (!s) return;
  const pk = view.pick(clientX, clientY);
  const t = pk && pk.kind === 'unit' ? s.byId.get(pk.id) : undefined;
  const why = t ? riteProblem(s, viewer, how, t) : 'Pick an enemy that bleeds';
  if (!t || why) {
    hud.toast(why ?? 'Pick an enemy that bleeds', 'bad');
    play('error');
    return;
  }
  const ids = selectedUnits(s).filter((u) => u.type === 'priest').map((u) => u.id);
  issue({ t: 'convert', p: viewer, ids, target: t.id, rite: how, queue: queue || undefined });
  view.marker(s, t.x, t.y, true);
  play('move');
}

function garrisonAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const pk = view.pick(clientX, clientY);
  const ship = pk && pk.kind === 'unit' ? s.byId.get(pk.id) : undefined;
  if (ship && ship.kind === 'unit' && ship.type === 'transport' && ship.owner === viewer) {
    board(s, selectedUnits(s).filter((u) => !u.inside), ship, queue || undefined);
    return;
  }
  const b = pk && pk.kind === 'building' ? s.byId.get(pk.id) : undefined;
  if (!b || b.kind !== 'building' || b.owner !== viewer || !BUILDINGS[b.type].garrison || !b.built) {
    hud.toast('Pick your Town Center or a tower to shelter in, or a transport to board', 'bad');
    play('error');
    return;
  }
  issue({ t: 'garrison', p: viewer, ids: selectedUnits(s).map((u) => u.id), target: b.id, queue: queue || undefined });
  view.marker(s, b.x, b.y, false);
  play('move');
}

/** A gate faces along the wall it joins: across, unless wall stands at its left or right. */
function gateTurned(s: GameState, tx: number, ty: number): boolean {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && !!s.bldAt[y * s.w + x];
  return !(at(tx - 1, ty) || at(tx + 2, ty));
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
  placeAt = { tx, ty, ok: seen && !placeProblem(s, placing, tx, ty, true, viewer) };
}

function placeHere(shift: boolean): void {
  const s = game;
  if (!s || !placing || !placeAt) return;
  if (!placeAt.ok) {
    hud.toast("Can't build there", 'bad');
    play('error');
    return;
  }
  // Citizens raise everything; foot soldiers pitch War Camps (#303).
  const kind = placing;
  const ids = selectedUnits(s).filter((u) => canRaise(u.type, kind)).map((u) => u.id);
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
// Right-click on the speed button slows the game a step.
$('speed-btn').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (mode === 'play') cycleSpeed(-1);
});
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
    if (e.ctrlKey) {
      const point = view.groundAt(e.clientX, e.clientY);
      if (point) markScout(point.x, point.y, e.shiftKey);
      return;
    }
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
  if (targetMode === 'patrol') {
    patrolAt(e.clientX, e.clientY, e.shiftKey);
    if (!e.shiftKey) targetMode = null;
    return;
  }
  if (targetMode === 'garrison') {
    garrisonAt(e.clientX, e.clientY, e.shiftKey);
    targetMode = null;
    return;
  }
  if (targetMode === 'sacrifice' || targetMode === 'curse') {
    riteAt(e.clientX, e.clientY, targetMode, e.shiftKey);
    if (!e.shiftKey) targetMode = null;
    return;
  }
  if (targetMode === 'unload') {
    unloadAt(e.clientX, e.clientY, e.shiftKey);
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
    if (pick.length) {
      play('select');
      ack('select');
    }
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
  if (pk.kind === 'relic') {
    setSelection([]);
    selectedRelic = pk.id;
    refreshHud();
    play('click');
    return;
  }
  if (pk.kind === 'landmark') {
    setSelection([]);
    selectedLandmark = pk.id;
    refreshHud();
    play('click');
    return;
  }
  if (pk.kind === 'ruin') {
    setSelection([]);
    selectedRuin = pk.id;
    refreshHud();
    play('click');
    return;
  }
  if (pk.kind === 'post') {
    setSelection([]);
    selectedPost = pk.id;
    refreshHud();
    play('click');
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
    ack('select');
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
  if (e.kind === 'unit' && e.owner === viewer) ack('select');
}

/** The selected units answer (one voice for the group). */
function ack(mood: 'select' | 'move' | 'attack'): void {
  const s = game;
  if (!s || watching) return;
  const u = selectedUnits(s)[0];
  if (!u) return;
  const who = u.type === 'citizen' || u.type === 'fisher' || u.type === 'wagon' ? 'citizen' : u.type === 'priest' ? 'priest' : u.type === 'hero' ? 'hero' : u.type === 'siege' || domainOf(u.type) !== 'land' ? 'engineer' : 'soldier';
  sound.speak(who, mood, u.id);
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
minimap.onMark = (x, y, danger) => markScout(x, y, danger);
minimap.onCommand = (x, y) => {
  const s = game;
  if (!s || mode !== 'play') return;
  const ids = selectedUnits(s).map((u) => u.id);
  if (!ids.length) return;
  if (targetMode === 'patrol') issue({ t: 'patrol', p: viewer, ids, x, y });
  else issue({ t: 'move', p: viewer, ids, x, y, amove: targetMode === 'amove' });
  targetMode = null;
  play('move');
};

// ---- Keyboard --------------------------------------------------------------------------------------

const held = new Set<string>();

// God mode (#399): typed in a solo match, never offered by a button; the one visible control leaves it.
const GOD_CODE = 'Anissa1030';
let godTyped = '';
let godOn = false;
function setGod(on: boolean): void {
  godOn = on;
  $('god-btn').classList.toggle('hidden', !on);
  if (on && game) {
    grantAll(game, viewer);
    hud.toast('God mode: everything unlocked', 'info');
  } else if (!on) hud.toast('God mode off', 'info');
}
$('god-btn').addEventListener('click', () => setGod(false));

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  sound.unlock();
  const k = e.key;
  if (k === 'Alt') {
    altHeld = true;
    e.preventDefault();
  }
  if (mode === 'over' && (k === 'Escape' || k === 'F10')) {
    e.preventDefault();
    if ($('modal').classList.contains('hidden')) openMenu();
    else closeModal();
    return;
  }
  if (mode !== 'play' && !(mode === 'over' && k.startsWith('Arrow'))) return;
  if (k.length === 1 && !online && !watching && !spectating && game && !godOn) {
    godTyped = (godTyped + k).slice(-GOD_CODE.length);
    if (godTyped === GOD_CODE) {
      godTyped = '';
      setGod(true);
    }
  }
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
  // Camera bookmarks share the digits without disturbing ordinary control groups.
  const mark = bookmarkShortcut(e);
  if (mark) {
    e.preventDefault();
    if (mark.action === 'save') {
      cameraBookmarks.save(mark.slot, { x: view.rig.target.x, z: view.rig.target.z });
      hud.toast(`View ${mark.slot} remembered`, 'info');
    } else {
      const point = cameraBookmarks.recall(mark.slot);
      if (point) {
        view.rig.focus(point.x, point.z);
        hud.toast(`View ${mark.slot}`, 'info');
      } else hud.toast(`View ${mark.slot} is empty — Ctrl+Shift+${mark.slot} to save`, 'info');
    }
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
  if (k === 'Enter' && online) {
    e.preventDefault();
    openChat();
    return;
  }
  // The command card first: its letters change with the selection.
  if (!e.ctrlKey && !e.metaKey && hud.hotkey(k === 'Delete' ? 'DELETE' : k)) {
    e.preventDefault();
    refreshHud();
    return;
  }
  if (idleShortcut(e)) {
    e.preventDefault();
    nextIdle(e.shiftKey);
    return;
  }
  switch (k.toLowerCase()) {
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
    case 'o':
      view.showBorders = !view.showBorders;
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
  if (online) {
    net?.send({ t: 'pause', on: !netPaused });
    return;
  }
  paused = !paused;
  $('paused').classList.toggle('hidden', !paused);
  $('pause-btn').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
}

/** Steps the game speed by d; with wrap, stepping past the fastest comes back round to 1×. */
function cycleSpeed(d: number, wrap = false): void {
  if (online) {
    hud.toast('Online matches run at normal speed', 'info');
    return;
  }
  speedIdx = wrap ? (speedIdx + d + SPEEDS.length) % SPEEDS.length : Math.max(0, Math.min(SPEEDS.length - 1, speedIdx + d));
  hud.toast(`Speed ${SPEEDS[speedIdx]}×`, 'info');
  refreshHud();
}

function toggleMute(): void {
  sound.set({ muted: !sound.settings.muted });
  $('sound-btn').textContent = sound.settings.muted ? '🔇' : '🔊';
}

// ---- Menus -----------------------------------------------------------------------------------------

function openMenu(): void {
  if (mode === 'over' && game) {
    // After the match, the menu is the results card, with its way back to the title.
    if (lastEnd) showEnd(game, lastEnd.won, lastEnd.how, true);
    else {
      const m = $('modal');
      m.innerHTML = `<div class="card"><h2>The match is over</h2>
        <div class="row"><button class="btn wide" data-act="resume">Keep looking</button>
        <button class="btn wide primary" data-act="quit">Quit to title</button></div></div>`;
      m.classList.remove('hidden');
    }
    return;
  }
  if (mode !== 'play') return;
  const m = $('modal');
  m.innerHTML = `<div class="card"><h2>Menu</h2>
    <div class="row"><button class="btn wide primary" data-act="resume">Resume</button></div>
    <div class="row">
      <label>Graphics <select id="menu-quality">${(Object.keys(QUALITY) as QualityName[]).map((q) => `<option value="${q}" ${q === view.qualityName ? 'selected' : ''}>${QUALITY[q].label}</option>`).join('')}</select></label>
      <label>Effects volume <input id="menu-vol" type="range" min="0" max="1" step="0.05" value="${sound.settings.volume}"></label>
      <label>Wind and birds <input id="menu-amb" type="range" min="0" max="1" step="0.05" value="${sound.settings.ambience}"></label>
      <label>Music <input id="menu-music" type="range" min="0" max="1" step="0.05" value="${sound.settings.music}"></label>
      <label>Tips for new players <input id="menu-tips" type="checkbox" ${tips.enabled ? 'checked' : ''}></label>
    </div>
    <div class="row">
      ${online ? `<div class="hint">Online room ${net?.code ?? ''} · ${net?.rtt ?? 0} ms</div>` : `<button class="btn wide" data-act="save">Save game</button>
      <button class="btn wide" data-act="cloud">Cloud saves</button>
      <button class="btn wide" data-act="restart">Restart this map</button>
      ${game?.scenario ? '' : '<button class="btn wide" data-act="new-map">New map</button>'}`}
      <button class="btn wide" data-act="resign">Resign</button>
      <button class="btn wide" data-act="quit">${online ? 'Leave the match' : 'Quit to title'}</button>
    </div></div>`;
  m.classList.remove('hidden');
  $<HTMLSelectElement>('menu-quality').addEventListener('change', (e) => {
    const q = (e.target as HTMLSelectElement).value as QualityName;
    view.setQuality(q);
    qualitySel.value = q;
  });
  $<HTMLInputElement>('menu-vol').addEventListener('input', (e) => sound.set({ volume: Number((e.target as HTMLInputElement).value) }));
  $<HTMLInputElement>('menu-amb').addEventListener('input', (e) => sound.set({ ambience: Number((e.target as HTMLInputElement).value) }));
  $<HTMLInputElement>('menu-music').addEventListener('input', (e) => sound.set({ music: Number((e.target as HTMLInputElement).value) }));
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

type EndHow = 'conquest' | 'wonder' | 'relics' | 'lands' | 'resign' | 'time' | 'scenario';
/** How the viewer's match ended, so the menu can bring the results back after a look around. */
let lastEnd: { won: boolean; how: EndHow; tick: number } | null = null;

function showEnd(s: GameState, won: boolean, how: EndHow = 'conquest', again = false): void {
  mode = 'over';
  if (!again) {
    keepReplay(s);
    lastEnd = { won, how, tick: s.tick };
  }
  const m = $('modal');
  const mins = Math.floor((lastEnd?.tick ?? s.tick) / TICK_HZ / 60);
  const rows = s.players
    .map(
      (p) => `<tr><td><span class="swatch" style="background:${p.color}"></span>${p.name}<div class="civ-tag">${crestSvg(p.civ, p.color, 14)}${CIVS[p.civ].name}</div></td><td>${scoreOf(s, p)}</td><td data-tip="<b>Ages reached</b>${arrivalText(epochArrivals(p.history), EPOCHS.map((e) => e.name), TICK_HZ) || 'Never left the first age.'}">${ageDef(p).short}</td><td>${p.stats.gathered}</td><td>${p.stats.traded ?? 0}</td><td>${p.stats.trained}</td><td>${p.stats.built}</td><td>${p.stats.techs}</td><td>${p.stats.kills}</td><td>${p.stats.losses}</td></tr>`,
    )
    .join('');
  const sc = s.scenario ? scenarioById(s.scenario.id) : undefined;
  const stars = sc ? starsFor(s) : 0;
  if (sc && !again) recordStars(sc.id, stars);
  const nextCh = sc ? SCENARIOS[SCENARIOS.indexOf(sc) + 1] : undefined;
  const why = sc
    ? won
      ? sc.epilogue
      : how === 'time'
        ? 'Time ran out before the goals were met.'
        : 'Your people are no more.'
    : how === 'wonder'
      ? won ? 'Your Wonder stood the test of time.' : 'A rival Wonder stood the test of time.'
      : how === 'lands'
        ? won ? 'Every landmark in the land is yours: you are its lord.' : 'A rival became lord of every landmark in the land.'
      : how === 'relics'
        ? won ? 'Every relic in the world rests in your temples.' : 'A rival kept every relic in the world.'
        : won ? 'Your rivals have fallen.' : 'Your people are no more.';
  const extra = sc ? `${won ? `<div class="end-stars">${starRow(stars)}</div>` : ''}<ul class="goals">${sc.objectives.map((o, i) => `<li class="${o.bonus ? 'bonus' : ''}">${s.scenario!.done[i] ? '✔' : '✖'} ${o.text}</li>`).join('')}</ul>` : '';
  m.innerHTML = `<div class="card wide"><h2>${won ? (sc ? sc.title + ': victory!' : 'Victory!') : 'Defeat'}</h2>
    <div class="sel-sub">${why} The match lasted ${mins < 1 ? 'less than a minute' : `${mins} minute${mins === 1 ? '' : 's'}`}.</div>
    ${extra}
    <div class="chart-tabs">${(Object.keys(METRICS) as Metric[]).map((k) => `<button class="tab ${k === 'score' ? 'on' : ''}" data-metric="${k}">${METRICS[k]}</button>`).join('')}</div>
    <div id="chart">${timeline(s, 'score')}</div>
    <table class="end-stats"><tr><th></th><th>Score</th><th>Epoch</th><th>Gathered</th><th>Traded</th><th>Trained</th><th>Built</th><th>Techs</th><th>Kills</th><th>Lost</th></tr>${rows}</table>
    <div class="row">
      <button class="btn wide" data-act="watch">Look around</button>
      <button class="btn wide" data-act="replay-save">Download the replay</button>
      ${sc ? (won && nextCh ? `<button class="btn wide primary" data-act="camp-next" data-id="${sc.id}">Next chapter: ${nextCh.title}</button>` : '') + '<button class="btn wide' + (won && nextCh ? '' : ' primary') + '" data-act="restart">Play the chapter again</button>' : online ? '' : '<button class="btn wide primary" data-act="new-map">Play again</button>'}
      <button class="btn wide" data-act="quit">Quit to title</button>
    </div></div>`;
  m.querySelector('.chart-tabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-metric]');
    if (!b) return;
    m.querySelectorAll('.chart-tabs .tab').forEach((t) => t.classList.toggle('on', t === b));
    $('chart').innerHTML = timeline(s, b.dataset.metric as Metric);
  });
  m.classList.remove('hidden');
  if (again) return;
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
          const age = ev.age ? AGES[ev.age] : EPOCHS[ev.epoch];
          if (ev.back) {
            // A step back (#47): what waits until the climb, and what roads it reopened.
            const p = s.players[viewer];
            const idle = suspendedTechs(p).map((t) => TECHS[t].name);
            const opens = roadsFrom(p).filter((r) => isSideRoad(r) && roadKnown(s, p, r)).map((r) => AGES[r.to].name);
            hud.banner(
              `Back to the ${age.name}`,
              `Your people return to the older ways.${idle.length ? ` Suspended until you climb again: ${idle.join(', ')}.` : ''}${opens.length ? ` The road to the ${opens.join(' and the ')} is open again.` : ''}`,
              5500,
            );
            play('stepBack');
          } else {
            hud.banner(age.name, age.blurb, 4500);
            play('epoch');
          }
          playMusic(ev.epoch, ageOf(s.players[viewer]));
          // Heirlooms (#224): two roads walked open a craft neither teaches alone.
          if (ev.age && !ev.back) {
            const p = s.players[viewer];
            const opened = heirloomsOpened(p, ev.age).filter((t) => !p.techs.includes(t));
            if (opened.length) setTimeout(() => play('heirloom'), 900);
            for (const t of opened) hud.toast(`${TECHS[t].icon} An heirloom opens: ${TECHS[t].name}, at the ${BUILDINGS[TECHS[t].at].name}`, 'good');
          }
        } else hud.toast(`${s.players[ev.owner].name} has ${ev.back ? 'stepped back to' : 'reached'} the ${ageName(ev)}`, 'info');
        break;
      case 'wages':
        if (ev.owner === viewer) {
          hud.toast(ev.gone ? `💰 ${ev.gone} hired sword${ev.gone > 1 ? 's' : ''} walked off unpaid${ev.late > ev.gone ? `; ${ev.late - ev.gone} more unpaid` : ''}` : `💰 The treasury is short: ${ev.late} hired sword${ev.late > 1 ? 's' : ''} unpaid, and will walk off next payday`, 'bad');
          play('error');
        }
        break;
      case 'season': {
        const sn = SEASONS[ev.i];
        hud.toast(`${sn.icon} ${sn.name}. ${sn.blurb}`, 'info');
        break;
      }
      case 'hit':
        if (view.sees(ev.x, ev.y)) music.stir(0.012);
        break;
      case 'alert':
        if (ev.owner === viewer) {
          music.stir(0.5);
          lastAlert = { x: ev.x, y: ev.y };
          hud.toast(ev.heart ? 'Your Town Center is under attack! (Space to look)' : ev.wild === 'wolf' ? 'Wolves are attacking your people! (Space to look)' : ev.wild === 'boar' ? 'A wild boar is charging your people! (Space to look)' : ev.wild === 'raider' ? 'A raider camp has turned on your people! (Space to look)' : ev.wild === 'mammoth' ? 'A mammoth has turned on your hunters! (Space to look)' : ev.hunter ? 'Raiders fall on your hunters! (Space to look)' : ev.building ? 'A building is under attack! (Space to look)' : 'You are under attack! (Space to look)', 'alert');
          play('alert');
        }
        break;
      case 'heartless':
        if (ev.owner === viewer) {
          hud.toast(`Your last Town Center has fallen! Raise another within ${ev.left} seconds, or your people is lost.`, 'alert');
          play('alert');
        }
        break;
      case 'built':
        if (ev.owner === viewer && ev.type !== 'farm' && ev.type !== 'house') hud.toast(`${BUILDINGS[ev.type].name} built`, 'good');
        // The first sign of a side road (#37): its clue goes up while the road is open.
        if (ev.owner === viewer)
          for (const road of roadsFrom(s.players[viewer]))
            if (road.clue === ev.type && !s.ents.some((e) => e.kind === 'building' && e.owner === viewer && e.type === ev.type && e.built && e.id !== ev.id))
              hud.banner('Another road', `${CIVS[s.players[viewer].civ].name} talk of the ${AGES[road.to].name}. Select a Town Center to see what it takes.`, 5000);
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
      case 'survey':
        // The survey's answer (#39): yes or no, never where.
        if (ev.owner !== viewer) break;
        if (!ev.found) hud.toast('The prospectors found no bog iron anywhere in this world', 'info');
        else {
          const road = roadsFrom(s.players[viewer]).find((r) => r.found === ev.tech);
          hud.banner(
            'Bog iron',
            road
              ? `There is bog iron somewhere in this world: rust-red ore in the marshes. Find it and dig it, and the Town Center can lead you into the ${AGES[road.to].name} instead of the Bronze Age.`
              : 'There is bog iron somewhere in this world: rust-red ore in the marshes, paid in as gold. The road to the Iron Age closed with the Stone Age.',
            6000,
          );
        }
        break;
      case 'left':
        hud.toast(`${s.players[ev.owner].name} has left: the computer leads their people now`, 'info');
        break;
      case 'converted':
        if (ev.to === viewer) hud.toast('A priest has won an enemy over to your side', 'good');
        else if (ev.from === viewer) {
          hud.toast('One of yours has been converted by an enemy priest!', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'consecrated':
        if (ev.to === viewer) hud.toast(`✨ Your priests have won over a ${BUILDINGS[ev.type].name}`, 'good');
        else if (ev.from === viewer) {
          hud.toast(`Your ${BUILDINGS[ev.type].name} has been won over by ${s.players[ev.to].name}'s priests!`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'chanting':
        if (ev.owner === viewer) {
          hud.toast(`${s.players[ev.by].name}'s priests are chanting at your ${BUILDINGS[ev.type].name}: strike them down before it turns!`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'trade':
        if (ev.owner === viewer && !ev.buy && ev.res in RARE) {
          const ore = ev.res as keyof typeof ORE_TRADE.gold;
          hud.toast(`Sold ${ORE_TRADE.lot} ${RARE[ore].name.toLowerCase()} for ${ORE_TRADE.gold[ore]} gold`, 'good');
        }
        break;
      case 'bell':
        if (ev.owner === viewer) hud.toast(ev.ring ? 'The town bell rings: citizens run for shelter' : 'All clear: back to work', 'info');
        break;
      case 'cry':
        if (ev.owner === viewer) {
          play('rally');
          hud.toast(`📯 Rallying Cry! ${ev.n} soldier${ev.n === 1 ? '' : 's'} stirred`, 'good');
        } else if (isEnemy(s, viewer, ev.owner)) {
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'callUp':
        // Citizens called to arms at a War Camp (#313).
        if (ev.owner === viewer) {
          play('callUp');
          hud.toast(`📯 ${ev.ids.length === 1 ? 'A citizen takes' : `${ev.ids.length} citizens take`} up arms at the War Camp`, 'good');
        }
        break;
      case 'graft':
        // Hemocraft (#355 s3): a soldier grafted at a Transfusion Station, or a graft run dry far from every Station.
        if (ev.owner === viewer) {
          play(ev.how === 'made' ? 'graft' : 'crash');
          if (ev.how === 'crash') hud.toast('🩸 A graft ran dry far from the Transfusion Stations: the soldier crashes', 'bad');
        }
        break;
      case 'rite':
        // The Blood-rite (#355 s4): the sound and the spray are the view's; here the words.
        if (ev.owner === viewer) hud.toast(ev.how === 'sacrifice' ? `🩸 Sacrificed: ${ev.n} blood into your store` : `☠ Cursed ${ev.n} of the enemy: every blow on them lands harder`, 'good');
        else if (ev.against === viewer) {
          hud.toast(ev.how === 'sacrifice' ? 'An enemy priest has sacrificed one of yours!' : `An enemy priest has cursed ${ev.n} of yours!`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'blood':
        // Blood drawn at a Drain Rig (#355). Hemocraft's drain (s2) bleeds every second: the spray shows it, and the toast stays for kills and levies.
        // A sacrifice (#355 s4) tells of itself in the `rite` event.
        // A bled flock and the captives held at a rig (#355) bleed every second too: the mist shows them, and the rig's panel counts them.
        if (ev.owner === viewer && ev.how !== 'drain' && ev.how !== 'sacrifice' && ev.how !== 'flock' && ev.how !== 'captive') {
          play('blood');
          hud.toast(ev.how === 'levy' ? `🩸 ${ev.n} blood drawn from the levy` : ev.how === 'beast' ? `🩸 ${ev.n} blood drawn from the slain beast` : `🩸 ${ev.n} blood drawn from the fallen`, 'good');
        }
        break;
      case 'captive':
        // Captives (#355): taken at a rig, freed when it falls. The sound and the burst are the view's; here the words.
        if (ev.what === 'taken') {
          if (ev.owner === viewer) hud.toast('⛓ A captive taken to your rig: it will be bled for blood', 'good');
          else if (ev.from === viewer) {
            hud.toast(`⛓ ${s.players[ev.owner].name} has taken one of your citizens captive! Raze the rig that holds them to set them free`, 'alert');
            lastAlert = { x: ev.x, y: ev.y };
          }
        } else if (ev.what === 'freed' && ev.from === viewer) hud.toast('⛓ The rig has fallen: your captive people are free and come home', 'good');
        break;
      case 'tribute': {
        // A horde's riders standing in a rival's land (#318).
        const fresh = (at: number, gap: number) => s.tick - at > gap * TICK_HZ || s.tick < at;
        const rate = (ev.gold / TRIBUTE.every).toFixed(1);
        if (ev.owner === viewer && fresh(tributeToast.took, 60)) {
          tributeToast.took = s.tick;
          hud.toast(`🐎 Your riders exact tribute from ${s.players[ev.from].name}: ${rate} gold a second while they stand in its land`, 'good');
        } else if (ev.from === viewer && fresh(tributeToast.paid, 30)) {
          tributeToast.paid = s.tick;
          hud.toast(`🐎 ${s.players[ev.owner].name}'s horde exacts tribute in your land (${rate} gold a second): drive its riders off with spears and towers`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      }
      case 'toll': {
        // Safe passage on the Silk Road (#334): a rival trader paid its way across a caravan people's land.
        const fresh = (at: number, gap: number) => s.tick - at > gap * TICK_HZ || s.tick < at;
        if (ev.owner === viewer && fresh(tollToast.took, 45)) {
          tollToast.took = s.tick;
          hud.toast(`🐫 A trader of ${s.players[ev.from].name}'s pays ${ev.gold} gold for safe passage across your land`, 'good');
        } else if (ev.from === viewer && fresh(tollToast.paid, 45)) {
          tollToast.paid = s.tick;
          hud.toast(`🐫 Your trader pays ${s.players[ev.owner].name} a toll of ${ev.gold} gold crossing its land: a post whose road keeps out of it pays in full`, 'info');
        }
        break;
      }
      case 'campAlone':
        // A War Camp left without its soldiers (#303).
        if (ev.owner === viewer) {
          hud.toast(ev.struck ? '🔥 Off the Path of Blood, your War Camps are struck and burn' : `⛺ A War Camp is left without soldiers: it burns in ${WARCAMP.grace}s`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'flock':
        // The flock (#308): lambs, losses and a grazed-out camp.
        if (ev.what === 'rustled' && ev.by === viewer) {
          hud.toast('🐑 Your people drive off a rival\'s sheep: lead it home to a Town Center', 'good');
          play('bleat');
        } else if (ev.owner !== viewer) break;
        else if (ev.what === 'raised') play('lambBleat');
        else if (ev.what === 'born') {
          play('lambBleat');
          if (s.tick - flockToast.born > 30 * TICK_HZ || s.tick < flockToast.born) hud.toast('🐑 A lamb is born to your flock', 'good');
          flockToast.born = s.tick;
        } else if (ev.what === 'wolf') {
          hud.toast('🐺 Wolves have taken a sheep from your flock!', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        } else if (ev.what === 'rustled') {
          hud.toast(`🐑 ${s.players[ev.by ?? 0]?.name ?? 'Raiders'} drove off one of your sheep, left with no one to watch it!`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
          play('bleat');
        } else if (ev.what === 'hungry' && (s.tick - flockToast.hungry > 45 * TICK_HZ || s.tick < flockToast.hungry)) {
          flockToast.hungry = s.tick;
          hud.toast('🌾 Your flock has grazed the land bare: strike camp (J) and drive on to fresh grass', 'info');
          play('bleat');
        }
        break;
      case 'camp':
        if (ev.owner === viewer) {
          play(ev.pitched ? 'pitchCamp' : 'strikeCamp');
          hud.toast(ev.pitched ? `⛺ The ${BUILDINGS[ev.type].name} is pitched: it raises itself in ${STEPPE.pitch}s` : `🛞 Camp struck: the ${BUILDINGS[ev.type].name} rolls on a wagon (P to pitch)`, 'info');
        }
        break;
      case 'beacon':
        if (ev.owner === viewer && ev.on) play('beacon');
        if (ev.owner === viewer) hud.toast(ev.on ? '🔥 The beacon is lit: the tower sees far, and so is seen' : 'The beacon burns out', ev.on ? 'good' : 'info');
        else if (ev.on && isEnemy(s, viewer, ev.owner)) {
          hud.toast('A rival\'s beacon burns on the horizon', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'way': {
        const w = WAYS[ev.way];
        if (ev.deep || ev.turned) {
          const who = s.players[ev.owner];
          const what = ev.deep ? `deepens ${w.name}` : `turns to ${w.name}`;
          if (ev.owner === viewer) hud.toast(`${w.icon} Your people ${ev.deep ? `deepen ${w.name}: ${w.deep.blurb}` : `turn to ${w.name}: ${w.blurb}`}`, 'good');
          else hud.toast(`${who.name} ${what}`, who.team === s.players[viewer].team ? 'info' : 'alert');
          if (ev.owner === viewer) play('relicKeep');
        } else if (ev.owner === viewer) {
          hud.toast(`${w.icon} ${w.name}: ${w.blurb}`, 'good');
          play(ev.way === 'hunt' ? 'wayHunters' : ev.way === 'hearth' ? 'wayHearth' : 'wayWarband');
        } else if (s.players[ev.owner].team === s.players[viewer].team) hud.toast(`${s.players[ev.owner].name} takes ${w.name}`, 'info');
        else hud.toast(`${s.players[ev.owner].name} lives by ${w.name}`, 'alert');
        break;
      }
      case 'greatWork':
        if (ev.owner === viewer) {
          const w = WORKS[s.players[viewer].civ];
          hud.toast(ev.on ? `${w.icon} ${w.name}: ${w.blurb}` : `${w.name} has run its course`, ev.on ? 'good' : 'info');
          if (ev.on) play('greatWork');
        } else if (ev.on && !isEnemy(s, viewer, ev.owner)) hud.toast(`${s.players[ev.owner].name} calls ${WORKS[s.players[ev.owner].civ].name}`, 'info');
        else if (ev.on) hud.toast(`${s.players[ev.owner].name} calls ${WORKS[s.players[ev.owner].civ].name}`, 'alert');
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
      case 'wonderRising': {
        // #361: a Wonder's whole build is contestable, so everyone hears when one is begun.
        const p = s.players[ev.owner];
        if (ev.owner === viewer) hud.banner('Your Wonder rises', 'Every rival now knows where it stands. Guard it while it is built.', 5000);
        else if (p.team === s.players[viewer].team) hud.banner(`${p.name} begins a Wonder`, 'Guard it while it rises.', 5000);
        else {
          hud.banner(`${p.name} begins a Wonder`, 'Strike it before it is finished, while it is weakest (Space to look).', 5000);
          lastAlert = { x: ev.x, y: ev.y };
        }
        play('wonderRising');
        break;
      }
      case 'fair':
        if (ev.owner === viewer) hud.toast(`A feast day opens at your fairground: trade trips paid there pay ${Math.round((FAIR.pay - 1) * 100)}% more, and soldiers raised there cost ${Math.round((1 - FAIR.levy) * 100)}% less, for ${FAIR.open} seconds`, 'good');
        break;
      case 'joust':
        if (ev.owner === viewer) hud.toast(`Your hero held the lists at the fair: healed whole, and the crowd paid ${ev.gold} gold`, 'good');
        break;
      case 'convoy':
        if (ev.owner === viewer) hud.toast(`Warships sail with your merchant ship: its cargo is worth ${Math.round((CONVOY.pay - 1) * 100)}% more`, 'good');
        break;
      case 'vigil':
        if (ev.owner === viewer) hud.toast(`${ev.priests} ${ev.priests === 1 ? 'priest keeps' : 'priests keep'} vigil at your shrine: each adds ${VIGIL.each} gold to every relic payment`, 'good');
        break;
      case 'sortie':
        if (ev.owner === viewer) hud.toast(ev.what === 'home' ? 'Low fuel: aircraft turn for their Airfield. Raise a forward Airfield to reach farther' : 'An aircraft ran out of fuel and fell', ev.what === 'lost' ? 'bad' : 'alert');
        break;
      case 'foundation':
        if (ev.owner === viewer) hud.toast(ev.what === 'kept' ? `Foundations of your ${BUILDINGS[ev.type].name} will keep ${RECLAIM.window / 60} minutes: raise it again on the spot for ${Math.round(RECLAIM.cost * 100)}%` : `${BUILDINGS[ev.type].name} raised on old foundations, half built`, ev.what === 'kept' ? 'info' : 'good');
        break;
      case 'ruin': {
        // A dig comes good (#64): what came up, for the finder; a rival's dig, if we watched it.
        if (ev.owner === viewer) {
          const what =
            ev.find === 'hoard' ? `a buried hoard: +${RUINS.gold} gold`
            : ev.find === 'lore' ? `lost knowledge: ${ev.tech ? TECHS[ev.tech].name : 'a technology'}, learned for nothing`
            : ev.find === 'map' ? 'an old map: the whole land lies open to you'
            : 'a relic! Send a priest to carry it to a Temple';
          const first = s.ruins?.filter((r) => r.by === viewer).length === 1;
          hud.banner(RUIN_FINDS[ev.find].name, `Your diggers found ${what}.${first ? ' A new road is revealed: the Age of Reclaimers opens from the Middle Ages at your Town Center.' : ''}`, 5000);
        } else if (view.sees(ev.x, ev.y)) hud.toast(`${s.players[ev.owner].name} dug out the ruins`, 'info');
        break;
      }
      case 'tiding': {
        // Tidings at the fire (#443): the card itself is the HUD's; here the cue and what the answer brought.
        if (ev.owner !== viewer) break;
        const c = TIDING_CARDS[ev.card];
        if (ev.how === 'come') play('tidingCome');
        else if (ev.how === 'took') {
          play('tidingTook');
          hud.toast(
            ev.card === 'traveller' ? `${c.icon} The traveller stays: a citizen more by your fire`
            : ev.card === 'hunter' ? `${c.icon} Traded: +${TIDINGS.hunter.food} food`
            : ev.card === 'tale' ? `${c.icon} She tells of a place out in the wild: it lies open on your map (Space to look)`
            : ev.card === 'storm' ? `${c.icon} The huts are shored up against the storm`
            : `${c.icon} The sick are tended`,
            'good',
          );
          if (ev.card === 'tale' && ev.x !== undefined && ev.y !== undefined) lastAlert = { x: ev.x, y: ev.y };
        } else if (ev.how === 'struck') {
          play('tidingStorm');
          hud.toast(ev.card === 'storm' ? `${c.icon} The storm tore at ${ev.n} house${ev.n === 1 ? '' : 's'}: send citizens to mend them` : `${c.icon} The fever took one of your citizens`, 'bad');
        } else if (ev.how === 'spared') hud.toast(ev.card === 'storm' ? `${c.icon} The storm passed you by` : `${c.icon} The fever burned itself out`, 'info');
        break;
      }
      case 'campCleared':
        // A raider camp falls (own pitch): the plunder, for whoever struck the last blow.
        if (ev.owner === viewer) hud.banner('Raider camp cleared', `Your people took the plunder: +${ev.gold} gold, +${ev.food} food, +${ev.wood} wood.`, 4500);
        else if (view.sees(ev.x, ev.y)) hud.toast(`${s.players[ev.owner].name} cleared a raider camp`, 'info');
        break;
      case 'landmark': {
        const name = LANDMARK_KINDS[ev.kind].name;
        const team = s.players[viewer].team;
        if (ev.owner === viewer) hud.banner(`You hold the ${name}`, `${LANDMARK_KINDS[ev.kind].blurb} Keep rivals off it, or they'll take it.`, 4500);
        else if (ev.from === viewer) {
          hud.toast(`You have lost the ${name}! (Space to look)`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        } else if (ev.owner >= 0 && s.players[ev.owner].team === team) hud.toast(`${s.players[ev.owner].name} holds the ${name}`, 'good');
        else if (ev.owner >= 0 && (view.sees(ev.x, ev.y) || s.players[viewer].seen[Math.floor(ev.y) * s.w + Math.floor(ev.x)])) hud.toast(`${s.players[ev.owner].name} has taken the ${name}`, 'info');
        break;
      }
      case 'landmarkThreat':
        if (ev.owner === viewer) {
          hud.toast(`Rivals are taking the ${LANDMARK_KINDS[ev.kind].name}! (Space to look)`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'relic':
        if (ev.owner === viewer && ev.what === 'kept') hud.toast(`A relic rests in your Temple: +${Math.round((60 / RELIC.every) * RELIC.gold)} gold a minute`, 'good');
        else if (ev.owner === viewer && ev.what === 'taken') hud.toast('Your priest has taken up a relic: bring it to a Temple', 'info');
        else if (ev.owner === viewer && ev.what === 'dropped' && !list.some((e) => e.k === 'die' && e.owner === viewer)) break;
        else if (ev.owner === viewer && ev.what === 'dropped') {
          hud.toast('A relic has been lost! (Space to look)', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
      case 'relicHold': {
        const mins = Math.round(ev.ticks / TICK_HZ / 60);
        if (ev.team < 0) {
          hud.toast('A relic has changed hands: the relic countdown stops', 'info');
          break;
        }
        const ours = ev.team === s.players[viewer].team;
        if (ours) hud.banner('Every relic is yours', `Keep them all ${mins} minutes and you win.`, 5000);
        else {
          const keepers = s.players.filter((q) => q.team === ev.team).map((q) => q.name).join(' and ');
          hud.banner(`${keepers} ${keepers.includes(' and ') ? 'keep' : 'keeps'} every relic`, `Take one back within ${mins} minutes or lose.`, 5000);
        }
        play('wonder');
        break;
      }
      case 'landHold': {
        const mins = Math.round(ev.ticks / TICK_HZ / 60);
        if (ev.team < 0) {
          hud.toast('A landmark has changed hands: the lords\' countdown stops', 'info');
          break;
        }
        if (ev.team === s.players[viewer].team) hud.banner('Lords of the Land', `Keep every landmark ${mins} minutes and you win.`, 5000);
        else {
          const keepers = s.players.filter((q) => q.team === ev.team).map((q) => q.name).join(' and ');
          hud.banner(`${keepers} ${keepers.includes(' and ') ? 'keep' : 'keeps'} every landmark`, `Take one back within ${mins} minutes or lose.`, 5000);
        }
        play('wonder');
        break;
      }
      case 'story':
        hud.banner(ev.title, ev.text, 5000);
        play(ev.bad ? 'alert' : 'coin');
        break;
      case 'objective': {
        const sc = s.scenario && scenarioById(s.scenario.id);
        if (sc) hud.toast(`${sc.objectives[ev.index].bonus ? 'Bonus goal' : 'Goal'} complete: ${sc.objectives[ev.index].text.replace(/^Bonus: /, '')}`, 'good');
        play('ready');
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

let discovery: ReturnType<typeof loadDiscovery> | null = null;
let discoveryTick = -1;

/** The web map (#54) fills in as the viewer's people find the roads: recorded here, outside the sim. */
function recordDiscovery(s: GameState): void {
  if (s.tick - discoveryTick < 20 && s.tick >= discoveryTick) return;
  discoveryTick = s.tick;
  discovery ??= loadDiscovery();
  const before = discovery.entered.length;
  if (observe(discovery, s, viewer)) {
    saveDiscovery(discovery);
    pushDiscovery(discovery);
    // A side age found for the first time, ever, is worth a line: it is now on the title-screen map.
    for (const a of discovery.entered.slice(before)) {
      if (!TRUNK.includes(a)) hud.toast(`A new age for your web map: the ${AGES[a].name}`, 'good');
    }
  }
}

function refreshHud(): void {
  if (!game || mode === 'title') return;
  pruneSelection(game);
  recordDiscovery(game);
  hud.update(game, viewer, [...selection], SPEEDS[speedIdx], selectedTile, selectedRelic, selectedPost, selectedRuin !== null ? { id: selectedRuin, dug: view.ruins.dugAsSeen(selectedRuin) } : null, selectedLandmark !== null ? { id: selectedLandmark, keeper: view.landmarks.keeperAsSeen(selectedLandmark) } : null);
}

function cursorFor(s: GameState): string {
  if (placing) return 'cur-place';
  if (targetMode === 'amove' || targetMode === 'patrol') return 'cur-amove';
  if (targetMode === 'garrison') return 'cur-garrison';
  if (targetMode === 'sacrifice' || targetMode === 'curse') return 'cur-convert';
  if (targetMode === 'unload') return 'cur-garrison';
  if (!pointer.inside || boxing) return '';
  const units = selectedUnits(s);
  const pk: Pick | null = view.pick(pointer.x, pointer.y);
  if (!pk) return '';
  if (pk.kind === 'animal') {
    const a = s.animals.find((x) => x.id === pk.id);
    if (a?.kind === 'sheep' && a.owner === viewer && targetMode !== 'amove' && units.some((u) => u.type === 'citizen')) return 'cur-gather';
    return units.length ? 'cur-attack' : 'cur-select';
  }
  if (pk.kind === 'relic') return units.some((u) => u.type === 'priest' && !carriedBy(s, u)) ? 'cur-gather' : 'cur-select';
  if (pk.kind === 'post') return units.some((u) => u.type === 'trader') ? 'cur-gather' : 'cur-select';
  if (pk.kind === 'landmark') return units.length ? 'cur-gather' : 'cur-select';
  if (pk.kind === 'ruin') return units.some((u) => u.type === 'citizen') && !view.ruins.dugAsSeen(pk.id) ? 'cur-gather' : 'cur-select';
  if (pk.kind === 'unit' || pk.kind === 'building') {
    const t = s.byId.get(pk.id) as Ent | undefined;
    if (!t) return '';
    const foe = s.players[t.owner].team !== s.players[viewer].team;
    if (units.length && foe) return units.every((u) => u.type === 'priest') && (t.kind === 'unit' || !consecrateProblem(s, viewer, t)) ? 'cur-convert' : 'cur-attack';
    if (units.some((u) => u.type === 'citizen') && t.kind === 'building' && t.owner === viewer && (!t.built || t.hp < maxHp(s, t) || t.type === 'farm')) return 'cur-build';
    if (t.kind === 'building' && t.owner === viewer && chantedOver(s, t) && consecrates(s, viewer) && units.some((u) => u.type === 'priest' && !carriedBy(s, u))) return 'cur-gather';
    if (units.length && t.kind === 'building' && t.owner === viewer && t.built && BUILDINGS[t.type].garrison) return 'cur-garrison';
    if (t.kind === 'building' && t.type === 'temple' && t.owner === viewer && t.built && units.some((u) => u.type === 'priest' && carriedBy(s, u))) return 'cur-gather';
    if (t.kind === 'building' && t.type === 'market' && t.owner === viewer && t.built && units.some((u) => u.type === 'trader')) return 'cur-gather';
    if (t.kind === 'unit' && t.type === 'transport' && t.owner === viewer && units.some((u) => domainOf(u.type) === 'land')) return 'cur-garrison';
    return 'cur-select';
  }
  if (pk.kind === 'resource' && units.some((u) => u.type === 'citizen' || (u.type === 'fisher' && s.res[pk.tile] === R_FISH))) return 'cur-gather';
  if (pk.kind === 'ground' && units.some((u) => u.type === 'transport' && u.cargo.length) && walkable(s, Math.floor(pk.x), Math.floor(pk.y))) return 'cur-garrison';
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

/**
 * Play the turns the room has sent: in step with the clock while up to date, and as fast as the frame
 * allows while behind (after a stall, or when rejoining a match under way).
 */
function stepOnline(s: GameState, dt: number): void {
  // Paused, the room sends no more turns; the ones already here are still played.
  const reach = netReach * TURN_TICKS;
  acc += dt;
  const t0 = performance.now();
  let replaying = false;
  while (s.tick < reach) {
    const behind = reach - s.tick;
    if (behind > 6) {
      // Behind: catch up within a slice of the frame.
      if (performance.now() - t0 > 30) break;
    } else {
      if (acc < DT) break;
      acc -= DT;
    }
    const cmds = s.tick % TURN_TICKS === 0 ? (netTurns[s.tick / TURN_TICKS] ?? []) : [];
    if (cmds.length) record.push([s.tick, cmds]);
    step(s, cmds);
    if (behind > 60) {
      replaying = true;
      // Fast-forwarding: only what matters to the outcome.
      const key = s.events.filter((e) => e.k === 'over' || e.k === 'defeated');
      if (key.length) onEvents(s, key);
    } else onEvents(s, s.events);
    if (s.tick % (TURN_TICKS * HASH_EVERY) === 0 && net && !spectating) net.send({ t: 'hash', n: s.tick / TURN_TICKS, h: checksum(s) });
    if (mode === 'title') return;
  }
  if (replaying) view.events(s, [{ k: 'depleted', tile: 0 }]);
  // Waiting on the room: don't bank time to burn later.
  if (s.tick >= reach) acc = Math.min(acc, DT);
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
      // A whole day in eight minutes, opening at the golden hour.
      view.titleHour = (16 + attractT / 20) % 24;
      captionTown(who, army.length >= 4);
    } else {
      view.titleHour = null;
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

      if (online) stepOnline(s, dt);
      else if (watching) stepReplay(s, dt);
      else if (!paused && mode === 'play') {
        acc += dt * SPEEDS[speedIdx];
        let n = 0;
        while (acc >= DT && n < 6) {
          if (godOn) topUp(s, viewer);
          if (pending.length) record.push([s.tick, pending]);
          step(s, pending);
          pending = [];
          onEvents(s, s.events);
          acc -= DT;
          n++;
        }
        if (n === 6) acc = 0;
      } else if (mode === 'over' && !s.over && !paused) {
        // Out of the match while others fight on: the world keeps going for a look around.
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 6) {
          step(s);
          view.events(s, s.events);
          acc -= DT;
          n++;
        }
        if (n === 6) acc = 0;
      }
    }
    const alpha = (mode === 'play' && !paused) || online ? Math.min(1, acc / DT) : 1;
    pruneSelection(s);
    view.frame(s, alpha, dt, {
      ids: selection,
      allBars: altHeld,
      ghost: placing && placing !== 'wall' && placeAt ? { type: placing, ...placeAt, turn: placing === 'gate' && gateTurned(s, placeAt.tx, placeAt.ty) } : null,
      rallyOf: selection.size === 1 ? [...selection][0] : null,
      wall: wallPlan(s),
      scoutFlags: scoutFlags.all,
    });
    if (mode === 'play') watchFrameRate(dt);
    if (online && net && mode !== 'title') $('clock').title = `Online · ${net.rtt} ms`;
    if (mode !== 'title') {
      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.12;
        refreshHud();
      }
      if (mode === 'play' && !paused && !watching) {
        tips.update(s, viewer, dt);
        autosave();
      }
      mapTimer -= dt;
      if (mapTimer <= 0) {
        mapTimer = 0.2;
        minimap.draw(s, viewer, mode === 'over' || !!watching?.all || (spectating && spectateAll), [...view.knownBuildings()], view.rig.footprint(), selection, scoutFlags.all);
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
  /** The match's checksum, and the state of the online line (testing). */
  checksum: () => (game ? checksum(game) : 0),
  get netInfo() {
    return { online, reach: netReach, paused: netPaused, rtt: net?.rtt ?? -1, viewer };
  },
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
    const spot = type === 'dock' ? findDockSpot(game, x ?? p.startX, y ?? p.startY, 30) : findSpot(game, type, x ?? p.startX, y ?? p.startY, minR, 24);
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
// A shared room link: straight into the room (or back into a match after a reload).
const roomCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
startAttract(roomCode.length !== 5);
if (roomCode.length === 5 && savedName()) connectRoom(roomCode, savedName(), new URLSearchParams(location.search).get('watch') === '1');
else if (roomCode.length === 5) lobby.showEntry(roomCode);
else $('title').classList.remove('hidden');
requestAnimationFrame(frame);
// A scanned save-key link (#vault=KEY): the key leaves the address bar at once, then the player is asked.
{
  const scanned = /^#vault=([A-Za-z0-9-]+)$/.exec(location.hash)?.[1];
  if (scanned && roomCode.length !== 5) {
    history.replaceState(null, '', location.pathname + location.search);
    const key = normalizeVaultKey(scanned);
    if (!key) hud.toast('That save-key link is not valid.', 'bad');
    else if (key === vaultKey() || confirm('Use the save key from this link? Your Cloud saves and campaign stars will be the ones under that key.')) {
      if (key !== vaultKey()) useVaultKey(key);
      void openCloud();
    }
  }
}

