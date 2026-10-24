import './ui/style.css';
import { Music } from './audio/music';
import { sound, type SoundName } from './audio/sound';
import { CameraRig } from './render/camera';
import { QUALITY, type QualityName } from './render/post';
import { View, type Pick } from './render/view';
import { SIGHT_LORE } from './render/sightings';
import { wallLine } from './sim/commands';
import { AGES, AI_DYKE, AI_RIVERS, AI_TIDES, TIDE, BUILDINGS, SHAFT, CIVS, PROSPECTOR, FLOOD, HOMELANDS, HOMELAND_IDS, ORE_TRADE, RARE, CIV_IDS, DT, CONVOY, VIGIL, EPOCHS, FAIR, FINDS, MAP_TYPES, MILITARY, PLAYER_COLORS, RECLAIM, RELIC, RUINS, SALVAGE, SEASONS, STEPPE, TECHS, TICK_HZ, TIDINGS, SILO, TRIBUTE, TRUNK, WARCAMP, WAYS, KIN, WORKS, domainOf, unitStats } from './sim/data';
import { siteGrade } from './sim/shafts';
import { crestSvg } from './ui/crests';
import { unitPicture } from './ui/thumbs';
import { easeHour, SHOT_SECONDS, titleShot } from './ui/titleShots';
import { isEnemy } from './sim/world';
import { carriesKegs, kegProblem } from './sim/powder';
import { carriesTorch, torchProblem } from './sim/fire';
import { launchProblem, ringsFor, type WarheadKind } from './sim/silo';
import { jumpAge, rush, topUp } from './sim/god';
import { checksum, createGame, scoreOf, step, type GameSetup, type PlayerSetup } from './sim/game';
import { placeProblem, stampBuilding, walkable } from './sim/grid';
import { findDockSpot, findSpot, millSpotFor } from './sim/ai';
import { channelPlan, dig, dykePlan, heldBack, waterLine } from './sim/water';
import { bared, tideMillSpot, wakeTide } from './sim/tides';
import { barragePlan, isCauseway, kegTileProblem } from './sim/tides';
import { AI_BARRAGE, BLOOM, secs } from './sim/data';
import { rooted, slingProblem } from './sim/bloom';
import { maxHp, placeBuilding, restat, spawnUnit } from './sim/world';
import { arrivalText, epochArrivals } from './ui/endReport';
import { journeyHtml } from './ui/journeyReport';
import type { AgeId, Building, BuildingType, CivId, Command, Difficulty, Ent, GameEvent, GameMode, GameState, HistoryPoint, HomelandId, MapSize, MapType, Unit, UnitType } from './sim/types';
import { KEYS, R_FISH, R_NONE, RES, T_WATER } from './sim/types';
import { carriedBy, relicAt } from './sim/relics';
import { RUIN_FINDS, ruinAt } from './sim/ruins';
import { salvages } from './sim/salvage';
import { TIDING_CARDS } from './sim/tidings';
import { LANDMARK_KINDS, landmarkAt } from './sim/landmarks';
import { postAt } from './sim/trade';
import { chantedOver, consecrateProblem, consecrates } from './sim/consecrate';
import { riteProblem } from './sim/fork';
import { legionKind, legionary } from './sim/legion';
import { tames, wildBeast } from './sim/tame';
import { ageDef, ageOf, canRaise, heirloomsOpened, isSideRoad, opensOf, roadKnown, roadsFrom, suspendedTechs } from './sim/ages';
import { NetClient, newRoomCode, saveName, savedName } from './net/client';
import { HASH_EVERY, ROOM_KEEP_HOURS, TURN_TICKS, type MatchStart, type ServerMsg } from './net/protocol';
import { deserialize, serialize } from './sim/save';
import { VAULT_SLOTS, formatVaultKey, normalizeVaultKey, type CloudSlot } from './net/vault';
import { qrSvg } from './ui/qr';
import { deleteCloud, listCloud, loadCloud, saveCloud, useVaultKey, vaultKey } from './net/cloud';
import { SCENARIOS, scenarioById, starsFor } from './sim/campaign';
import { loadDiscovery, observe, pushDiscovery, saveDiscovery, syncDiscovery, webMapHtml } from './ui/webMap';
import { idleCitizens, idleSelection, idleShortcut } from './ui/idle';
import { NO_TAP, doubleOrder, type Tap } from './ui/doubleOrder';
import { CameraBookmarks, bookmarkShortcut } from './ui/cameraBookmarks';
import { ScoutFlags } from './ui/scoutFlags';
import { briefingHtml, chapterListHtml, recordStars, starRow, syncProgress } from './ui/campaignUi';
import { Lobby } from './ui/lobby';
import { Hud, nameOf, planLines } from './ui/hud';
import { RivalLedger, RivalPanel } from './ui/rivalRoad';
import { RoadPlanner, loadPlannerPrefs, savePlannerPrefs } from './ui/roadPlanner';
import { Minimap } from './ui/minimap';
import { BattleTide } from './ui/battleTide';
import { Tips } from './ui/tips';
import { openingFor } from './ui/opening';

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
let launchSilo = 0;
/** The Seed Spire whose Bloom Seed is being aimed (the Age of the Bloom). */
let slingSpire = 0;
/** The warhead chosen for the launch being aimed (#753); absent for the people's own. */
let launchWarhead: WarheadKind | undefined;
let targetMode: 'amove' | 'patrol' | 'garrison' | 'unload' | 'sacrifice' | 'curse' | 'keg' | 'torch' | 'launch' | 'sling' | null = null;
/** When the viewer was last told one of its living buildings caught fire, so a spreading fire tells once. */
let fireToldAt = -9999;
/** When a swarm on your people was last told (the Age of the Hive), so a fight in the woods tells it once. */
let hiveToldAt = -9999;
/** When a waking Ent was last told (the Age of the Wildwood), so a forest rising round an army tells it once. */
let entToldAt = -9999;
let paused = false;
const SPEEDS = [1, 1.5, 2, 3];
let speedIdx = 0;
const groups = new Map<number, number[]>();
const cameraBookmarks = new CameraBookmarks();
const scoutFlags = new ScoutFlags();
let lastGroupKey = { key: -1, at: 0 };
let lastAlert: { x: number; y: number } | null = null;
/** When a rival's sluice was last told (#701 s4), so a Water Line is told once in a while, not every time it opens. */
let sluiceToldAt = -Infinity;
/** When the sea last broke into the viewer's polder (#701 s3), so a flood is told once, not for every tile. */
let floodToldAt = -99999;
/** The tide (#739): whether its waking was told, and when the viewer's people were last told they were swept off the flats. */
let tideTold = false;
let sweptToldAt = -99999;
/** When a breached causeway (#748) was last told: one toast a blast. */
let breachToldAt = -1;
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
let tideTimer = 0;
let attractT = 0;
/** The title's hour of day: drifting on through the film, eased to a chosen shot's own hour while it holds. */
let titleClock = 16;
let lastSetup: GameSetup | null = null;

let planner: RoadPlanner | null = null;
const rivalLedger = new RivalLedger();
let rivalPanel: RivalPanel | null = null;
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
  kegMode: () => {
    targetMode = 'keg';
    placing = null;
  },
  torchMode: () => {
    targetMode = 'torch';
    placing = null;
  },
  launchMode: (silo, w) => {
    launchSilo = silo;
    launchWarhead = w;
    targetMode = 'launch';
    placing = null;
  },
  slingMode: (spire) => {
    slingSpire = spire;
    targetMode = 'sling';
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
      hud.banner('Disconnected', `${why} Reload the page, or join room ${code} again, to pick the match up: the room keeps it for ${ROOM_KEEP_HOURS} hours.`, 9000);
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
  // Leaving a paused match is stepping away: the room keeps the seat until you come back with its code.
  if (net && online && !spectating && game && !game.over && !netPaused) net.send({ t: 'cmd', c: { t: 'leave', p: viewer } });
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
    case 'open':
      $('title').classList.add('hidden');
      lobby.showSeats(m.code, m.seats);
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
    shepherd: true,
  }));
  netTurns = [];
  netReach = 0;
  netPaused = false;
  online = true;
  lobby.hide();
  // Every seat rolls the same homeland from the room's seed (#473).
  startMatch({ homeland: 'random', ...match.setup, players }, undefined, Math.max(0, you));
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
view.onPing = (x, y, color, heavy) => minimap.ping(x, y, color, heavy);
// The tide of battle (#606): a click on a fight's bar picks up your fighters there.
const tide = new BattleTide(view.labelLayer, (ids) => {
  setSelection(ids);
  play('select');
});

// ---- Starting matches ------------------------------------------------------------------------------

function newSeed(): number {
  return 1 + Math.floor(Math.random() * 999999);
}

function startAttract(skipAhead = true): void {
  mode = 'title';
  const seed = newSeed();
  const maps = Object.keys(MAP_TYPES) as MapType[];
  // Any map, starting in any epoch: sometimes there are galleons on the sea or biplanes overhead.
  game = createGame({ seed, size: 'small', mapType: maps[seed % maps.length], homeland: 'random', startEpoch: Math.floor(seed / maps.length) % EPOCHS.length, players: [{ name: 'Azure', ai: 'normal' }, { name: 'Crimson', ai: 'hard' }] });
  viewer = 0;
  view.setGame(game, 0);
  view.revealAll();
  view.rig.zoom(1.05);
  minimap.setup(game);
  // Skip ahead so there is a town to look at.
  if (skipAhead) for (let i = 0; i < TICK_HZ * 150; i++) step(game);
  attractT = 0;
  titleClock = 16;
  playMusic(2);
}

let captionKey = '';
/** Names the town the title's camera is visiting, fading it out and in as the camera moves on. */
function captionTown(who: GameState['players'][number], marching: boolean, note: string | null = null): void {
  const key = `${who.id}${marching ? 'a' : 't'}${who.epoch}${note ?? ''}`;
  if (key === captionKey) return;
  captionKey = key;
  const el = $('title-caption');
  el.classList.remove('on');
  setTimeout(() => {
    if (mode !== 'title' || captionKey !== key) return;
    el.innerHTML = `<b>${escHtml(who.name)} of the ${CIVS[who.civ].name}</b>${note ?? (marching ? 'an army on the march' : ageDef(who).name)}`;
    el.classList.add('on');
  }, 1200);
}

/** Leaders for the computer's peoples. */
const LEADERS: Record<CivId, string> = { egyptians: 'Hatshepsut', greeks: 'Pericles', romans: 'Augustus', mongols: 'Genghis', chinese: 'Wu Zetian', britons: 'Boudica' };

/** A match from the title screen's choices. */
function setupFromTitle(seed: number): GameSetup {
  const val = (id: string) => $<HTMLSelectElement>(id).value;
  const diff = val('opt-diff') as Difficulty;
  const foes = Number($<HTMLSelectElement>('opt-foes').value);
  const ally = val('opt-teams') === 'ally' && foes >= 2;
  const color = Number(val('opt-color'));
  const civChoice = val('opt-civ');
  const civ: CivId = civChoice === 'random' ? CIV_IDS[Math.floor(Math.random() * CIV_IDS.length)] : (civChoice as CivId);
  const colors = [PLAYER_COLORS[color], ...PLAYER_COLORS.filter((_, i) => i !== color)];
  // Rivals each get a different people where possible.
  const others = CIV_IDS.filter((c) => c !== civ).sort(() => Math.random() - 0.5);
  const players: PlayerSetup[] = [{ name: 'You', ai: null, color: colors[0], team: 0, civ, shepherd: true }];
  for (let i = 0; i < foes; i++) {
    const c = others[i % others.length];
    const friend = ally && i === 0;
    players.push({ name: `${LEADERS[c]}${friend ? ' (ally)' : ''}`, ai: diff, color: colors[i + 1], team: friend ? 0 : ally ? 1 : i + 1, civ: c });
  }
  return {
    seed,
    size: val('opt-size') as MapSize,
    mapType: val('opt-map') as MapType,
    homeland: val('opt-homeland') as HomelandId | 'random',
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
  $('god-age').classList.add('hidden');
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
  floodToldAt = -99999;
  tide.clear();
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
  else if (!saved) {
    // The land every town wakes in (#473): read it before choosing an opening.
    const hl = game.homeland ? HOMELANDS[game.homeland] : undefined;
    const land = hl ? ` ${hl.icon} ${hl.name}: ${hl.short}.` : '';
    hud.banner(ageDef(me).name, `You lead the ${CIVS[me.civ].name}. Facing ${rivals.join(', ')}.${land}${goal} ${view.weatherWords}`.trim(), 6000);
  } else hud.banner('Welcome back', `${ageDef(me).name}, ${fmtClock(game.tick)} into the match.`, 3200);
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
  const opening = !saved && !chapter ? openingFor(game, viewer) : undefined;
  if (opening) tips.open(opening);
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
const SAVE_V = 6;

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
  btn.innerHTML = `Continue<small>The match you saved, ${escHtml(info)}</small>`;
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
const homeSel = $<HTMLSelectElement>('opt-homeland');
homeSel.innerHTML = `<option value="random">Random (by the seed)</option>` + HOMELAND_IDS.map((k) => `<option value="${k}">${HOMELANDS[k].icon} ${HOMELANDS[k].name}</option>`).join('');
const civBlurb = () => {
  const c = civSel.value;
  const m = MAP_TYPES[mapSel.value as MapType];
  const hl = homeSel.value === 'random' ? undefined : HOMELANDS[homeSel.value as HomelandId];
  showTiles();
  playSum();
  $('civ-crest').innerHTML = crestSvg(c as CivId | 'random', PLAYER_COLORS[Number(colorSel.value)] ?? PLAYER_COLORS[0]);
  const people = c === 'random' ? undefined : CIVS[c as CivId];
  // A people is told by its core loop (`verb`) and its catch (`door`); the long account sits one click down.
  const peopleHtml = !people ? 'A people chosen at random.'
    : people.verb ? `<b>${people.name}:</b> ${people.verb}.${people.door ? `<br><span class="civ-catch"><b>The catch:</b> ${people.door}.</span>` : ''}<details class="civ-more"><summary>More about the ${people.name}</summary>${people.blurb}</details>`
    : `<b>${people.name}:</b> ${people.blurb}`;
  $('civ-blurb').innerHTML = `${peopleHtml}<br><b>${m.label}:</b> ${m.blurb}<br>${hl ? `<b>${hl.icon} ${hl.name}:</b> ${hl.blurb}` : '<b>Homeland:</b> the seed decides what lies round every town: the Glade, the Shore, the Herd Plains or the Deep Wood.'}`;
};
const civTiles = $('civ-tiles');
/** The soldier each people's tile shows: the line whose mark (plume, crest, headdress) is theirs, in the bronze age. */
const TILE_SOLDIER: Record<CivId, UnitType> = { egyptians: 'ranged', greeks: 'infantry', romans: 'infantry', mongols: 'cavalry', chinese: 'infantry', britons: 'ranged' };
let tileFigures = false;
const showTiles = () => {
  const color = PLAYER_COLORS[Number(colorSel.value)] ?? PLAYER_COLORS[0];
  civTiles.innerHTML = (['random', ...CIV_IDS] as (CivId | 'random')[]).map((c) => {
    // The soldiers are drawn the first time the sheet opens, not while the title loads.
    const face = c !== 'random' && tileFigures ? unitPicture(TILE_SOLDIER[c], 1, color, c) : '';
    const art = face ? `<span class="civ-face"><img src="${face}" alt="">${crestSvg(c, color, 18)}</span>` : crestSvg(c, color, 40);
    return `<button class="civ-tile" type="button" role="radio" aria-checked="${civSel.value === c}" data-civ="${c}" title="${c === 'random' ? 'A people chosen at random' : (CIVS[c].verb ?? CIVS[c].name).replace(/"/g, '&quot;')}">${art}${c === 'random' ? 'Random' : CIVS[c].name}</button>`;
  }).join('');
};
civTiles.addEventListener('click', (e) => {
  const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-civ]');
  if (!tile || civSel.value === tile.dataset.civ) return;
  sound.unlock();
  sound.play('select');
  civSel.value = tile.dataset.civ!;
  civSel.dispatchEvent(new Event('change'));
});
/** One line under Play saying what it will start; a click opens the setup. */
const playSum = () => {
  const civ = civSel.value === 'random' ? 'Any people' : CIVS[civSel.value as CivId].name;
  const diff = $<HTMLSelectElement>('opt-diff').selectedOptions[0]?.text.split(':')[0] ?? '';
  const foes = Number($<HTMLSelectElement>('opt-foes').value);
  $('play-sum').innerHTML = `<b>${civ}</b> · ${diff} · ${MAP_TYPES[mapSel.value as MapType].label} · ${foes} ${foes === 1 ? 'rival' : 'rivals'} <span aria-hidden="true">✎</span>`;
};
civSel.addEventListener('change', civBlurb);
colorSel.addEventListener('change', civBlurb);
for (const id of ['opt-diff', 'opt-foes']) $(id).addEventListener('change', playSum);
showContinue();
showReplayButton();
mapSel.addEventListener('change', civBlurb);
homeSel.addEventListener('change', civBlurb);
civBlurb();
// A shared world link (?seed=N&size=&map=&foes=): the title screen opens with that world's settings (the seed atlas prints them).
{
  const q = new URLSearchParams(location.search);
  const seed = Math.floor(Number(q.get('seed')));
  if (seed >= 1 && seed <= 2 ** 31 - 1) seedInput.value = String(seed);
  for (const [key, id] of [['size', 'opt-size'], ['map', 'opt-map'], ['foes', 'opt-foes'], ['homeland', 'opt-homeland']] as const) {
    const v = q.get(key);
    const sel = $<HTMLSelectElement>(id);
    if (v !== null && [...sel.options].some((o) => o.value === v)) sel.value = v;
  }
  civBlurb();
}
const qualitySel = $<HTMLSelectElement>('opt-quality');
qualitySel.value = view.qualityName;
qualitySel.addEventListener('change', () => view.setQuality(qualitySel.value as QualityName));

/** The title's two sheets, the match's setup and the rules: one open at a time. */
function openSheet(id: 'title-setup' | 'title-howto'): void {
  const open = !$(id).classList.contains('hidden');
  closeSheets();
  if (open) return;
  sound.play('open');
  $(id).classList.remove('hidden');
  if (id === 'title-setup' && !tileFigures) { tileFigures = true; showTiles(); }
}
function closeSheets(): void {
  $('title-setup').classList.add('hidden');
  $('title-howto').classList.add('hidden');
}
// A soft pluck as the mouse finds a way in, once per button it enters.
let hovered: Element | null = null;
$('title').addEventListener('pointerover', (e) => {
  const btn = (e.target as HTMLElement).closest('.title-buttons .btn, .civ-tile');
  if (btn === hovered) return;
  hovered = btn;
  if (btn) sound.play('menuHover');
});

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  sound.unlock();
  const act = el.dataset.act!;
  if (act.startsWith('cloud')) return cloudAct(act, el);
  switch (act) {
    case 'start':
    case 'start-setup':
      sound.play('click');
      closeSheets();
      startMatch(setupFromTitle(Number(seedInput.value) || newSeed()));
      break;
    case 'setup':
    case 'howto':
      openSheet(act === 'setup' ? 'title-setup' : 'title-howto');
      break;
    case 'sheet-close':
      closeSheets();
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
      for (const [key, id] of [['size', 'opt-size'], ['map', 'opt-map'], ['foes', 'opt-foes'], ['homeland', 'opt-homeland']] as const) q.set(key, $<HTMLSelectElement>(id).value);
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
      closeSheets();
      showCampaign(chapterListHtml());
      break;
    case 'web-map':
      sound.play('click');
      closeSheets();
      showCampaign(webMapHtml(loadDiscovery()));
      break;
    case 'plan-pin': {
      // The web map pins a goal age for the road planner (#725); it opens in the next match.
      const goal = el.dataset.age as AgeId;
      if (planner) planner.pin(goal);
      else savePlannerPrefs({ ...loadPlannerPrefs(), goal });
      sound.play('click');
      hud.toast(`Pinned the ${AGES[goal].name} as your goal: the Roads panel plans the way`, 'info');
      break;
    }
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
      closeSheets();
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

/**
 * What an order lands on: a friendly unit (your own transport aside) is looked past to the sheep, stone or tree it
 * stands at, since a citizen already milking or quarrying there (often one of those selected) would otherwise take
 * the click and turn the order into a walk to them. On open ground the unit still counts.
 */
function orderPick(s: GameState, clientX: number, clientY: number): Pick | null {
  const pk = view.pick(clientX, clientY, (id) => {
    const u = s.byId.get(id);
    return !!u && u.kind === 'unit' && s.players[u.owner].team === s.players[viewer].team && !(u.type === 'transport' && u.owner === viewer);
  });
  return pk?.kind === 'ground' ? view.pick(clientX, clientY) : pk;
}

function order(clientX: number, clientY: number, forceAttack = false, queue = false): void {
  const s = game;
  if (!s || mode !== 'play') return;
  const units = selectedUnits(s).filter((u) => !u.inside);
  const pk = orderPick(s, clientX, clientY);
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
  // A reclaimer's citizens sent onto rubble strip it (#503).
  if (pk.kind === 'ground' && !forceAttack && s.rubble && salvages(s, viewer) && units.some((u) => u.type === 'citizen')) {
    const r = s.rubble.find((x) => Math.abs(pk.x - x.x) <= SALVAGE.reach && Math.abs(pk.y - x.y) <= SALVAGE.reach && view.sees(x.x, x.y));
    if (r) {
      issue({ t: 'salvage', p: viewer, ids, target: r.id, queue: q });
      view.marker(s, r.x, r.y, false);
      play('move');
      ack('move');
      return;
    }
  }
  // Citizens sent onto spilled key ore carry it home (#570), whoever's it was.
  if (pk.kind === 'ground' && !forceAttack && s.caches && units.some((u) => u.type === 'citizen')) {
    const c = s.caches.find((x) => Math.abs(pk.x - x.x) <= 1.2 && Math.abs(pk.y - x.y) <= 1.2 && view.sees(x.x, x.y));
    if (c) {
      issue({ t: 'cache', p: viewer, ids, target: c.id, queue: q });
      view.marker(s, c.x, c.y, false);
      play('move');
      ack('move');
      return;
    }
  }
  if (pk.kind === 'animal') {
    const a = s.animals.find((x) => x.id === pk.id);
    if (!a) return;
    // The Age of the Wild: citizens tame a wild wolf, boar or mammoth; attack-move (A) hunts it instead.
    if (!forceAttack && tames(s.players[viewer]) && wildBeast(a) && units.some((u) => u.type === 'citizen')) {
      issue({ t: 'tame', p: viewer, ids, target: a.id, queue: q });
      view.marker(s, a.x, a.y, false);
      play('move');
      ack('move');
      return;
    }
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
      play(units.some((u) => u.type === 'citizen' || legionary(s, u)) && (!t.built || t.hp < maxHp(s, t)) ? 'hammer' : 'move');
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
  // Click a trading post (or a trader on its road) to guard that road.
  const pk = view.pick(clientX, clientY);
  const trade = pk?.kind === 'unit' ? s.byId.get(pk.id) : null;
  const post = pk?.kind === 'post' ? pk.id : trade && trade.kind === 'unit' && trade.owner === viewer && trade.order.k === 'trade' ? trade.order.post : undefined;
  if (post !== undefined) {
    const p = postAt(s, post);
    if (p) {
      issue({ t: 'patrol', p: viewer, ids: units.map((u) => u.id), x: p.x, y: p.y, post, queue: queue || undefined });
      view.marker(s, p.x, p.y, true);
      play('move');
      return;
    }
  }
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

/** The Age of Sappers (#577): the selected citizens and foot soldiers carry a keg each to the rival building clicked. */
function kegAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const pk = view.pick(clientX, clientY);
  const b = pk && pk.kind === 'building' ? s.byId.get(pk.id) : undefined;
  // A rival's causeway or barrage (#748): the keg is laid on the tile itself, to breach the road.
  const g = b ? null : view.groundAt(clientX, clientY);
  const tile = g ? Math.floor(g.y) * s.w + Math.floor(g.x) : -1;
  if (!b && tile >= 0 && isCauseway(s, tile)) {
    const no = kegTileProblem(s, viewer, tile);
    if (no) {
      hud.toast(no, 'bad');
      play('error');
      return;
    }
    const ids = selectedUnits(s).filter((u) => !u.inside && carriesKegs(u)).map((u) => u.id);
    issue({ t: 'kegTile', p: viewer, ids, tile, queue: queue || undefined });
    view.marker(s, (tile % s.w) + 0.5, Math.floor(tile / s.w) + 0.5, true);
    play('move');
    return;
  }
  const why = kegProblem(s, viewer, b);
  if (!b || why) {
    hud.toast(why ?? 'Pick a rival building', 'bad');
    play('error');
    return;
  }
  const ids = selectedUnits(s).filter((u) => !u.inside && carriesKegs(u)).map((u) => u.id);
  issue({ t: 'keg', p: viewer, ids, target: b.id, queue: queue || undefined });
  view.marker(s, b.x, b.y, true);
  play('move');
}

/** Fire (`fire.ts`): the selected citizens and foot soldiers carry torches to the rival's living building, tree or root clicked. */
function torchAt(clientX: number, clientY: number, queue: boolean): void {
  const s = game;
  if (!s) return;
  const pk = view.pick(clientX, clientY);
  const b = pk && pk.kind === 'building' ? s.byId.get(pk.id) : undefined;
  const g = b ? null : view.groundAt(clientX, clientY);
  const at = b ? { target: b.id } : g ? { tile: Math.floor(g.y) * s.w + Math.floor(g.x) } : null;
  const why = at ? torchProblem(s, viewer, at) : "Pick a tree, a rival's Thornwall root, or a rival's living building";
  if (!at || why) {
    hud.toast(why ?? 'Pick something to burn', 'bad');
    play('error');
    return;
  }
  const ids = selectedUnits(s).filter((u) => !u.inside && carriesTorch(u)).map((u) => u.id);
  issue({ t: 'torch', p: viewer, ids, ...at, queue: queue || undefined });
  const t = at.tile ?? -1;
  view.marker(s, b ? b.x : (t % s.w) + 0.5, b ? b.y : Math.floor(t / s.w) + 0.5, true);
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

/** Buildings laid out by dragging a line: walls, dykes and channels (#701) and Thornwalls (the Age of the Grove). */
const lined = (t: BuildingType | null): t is 'wall' | 'dyke' | 'thornwall' | 'channel' | 'causeway' => t === 'wall' || t === 'dyke' || t === 'thornwall' || t === 'channel' || t === 'causeway';

/** The tiles of a planned wall (or line of dykes), and whether each can be built. */
function wallPlan(s: GameState): { tiles: { x: number; y: number; ok: boolean }[]; alongY: boolean; type: 'wall' | 'dyke' | 'thornwall' | 'channel' | 'causeway' } | null {
  if (!lined(placing)) return null;
  const type = placing;
  const d = wallDrag ?? (placeAt ? { x0: placeAt.tx, y0: placeAt.ty, x1: placeAt.tx, y1: placeAt.ty } : null);
  if (!d) return null;
  const seen = s.players[viewer].seen;
  const tiles = wallLine(d.x0, d.y0, d.x1, d.y1).map((t) => ({
    ...t,
    ok: t.x >= 0 && t.y >= 0 && t.x < s.w && t.y < s.h && !!seen[t.y * s.w + t.x] && !placeProblem(s, type, t.x, t.y),
  }));
  return { tiles, alongY: Math.abs(d.y1 - d.y0) > Math.abs(d.x1 - d.x0), type };
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
    // Ground the tide comes back to (#739) is said as such: it looks like land at low water.
    hud.toast(placeProblem(s, placing, placeAt.tx, placeAt.ty, true, viewer) === 'tidal' ? "Can't build on the tidal flats: the sea comes back over them" : "Can't build there", 'bad');
    play('error');
    return;
  }
  // Citizens raise everything; foot soldiers pitch War Camps (#303).
  const kind = placing;
  const ids = selectedUnits(s).filter((u) => canRaise(u.type, kind, s.players[viewer].civ)).map((u) => u.id);
  issue({ t: 'build', p: viewer, ids, type: placing, tx: placeAt.tx, ty: placeAt.ty, queue: shift || undefined });
  // A Mine Shaft's ground (#681): say how well it will dig here.
  if (kind === 'shaft') {
    const site = { tx: placeAt.tx, ty: placeAt.ty, size: BUILDINGS.shaft.size };
    const g = siteGrade(s, site);
    hud.toast(`${{ old: 'Old workings', hill: 'Mountain rock', open: 'Open ground' }[g]}: a shaft here digs at ${Math.round(SHAFT.grade[g] * 100)}% of an open deposit's pace`);
  }
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
let lastTap: Tap = NO_TAP;

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
  if (lined(placing)) {
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
  if (targetMode === 'keg') {
    kegAt(e.clientX, e.clientY, e.shiftKey);
    if (!e.shiftKey) targetMode = null;
    return;
  }
  if (targetMode === 'torch') {
    torchAt(e.clientX, e.clientY, e.shiftKey);
    if (!e.shiftKey) targetMode = null;
    return;
  }
  if (targetMode === 'launch') {
    const g = view.groundAt(e.clientX, e.clientY);
    const s = game;
    if (g && s) {
      const why = launchProblem(s, viewer, s.byId.get(launchSilo) as Building | undefined, g.x, g.y, launchWarhead);
      if (why) {
        hud.toast(why, 'bad');
        play('error');
      } else {
        issue({ t: 'launch', p: viewer, silo: launchSilo, x: g.x, y: g.y, ...(launchWarhead ? { w: launchWarhead } : {}) });
        view.marker(s, g.x, g.y, true);
      }
    }
    targetMode = null;
    return;
  }
  if (targetMode === 'sling') {
    const g = view.groundAt(e.clientX, e.clientY);
    const s = game;
    if (g && s) {
      const why = slingProblem(s, viewer, s.byId.get(slingSpire), g.x, g.y);
      if (why) {
        hud.toast(why, 'bad');
        play('error');
      } else {
        issue({ t: 'sling', p: viewer, spire: slingSpire, x: g.x, y: g.y });
        view.marker(s, g.x, g.y, true);
      }
    }
    targetMode = null;
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
      hud.toast(plan?.type === 'causeway' ? "Can't lay a causeway there: causeways go over the tidal flats or the shallow open sea" : plan?.type === 'dyke' ? "Can't raise a dyke there: dykes go on shallow water, or on the shore beside it" : plan?.type === 'channel' ? "Can't dig a channel there: channels go across open land, starting beside water" : "Can't build a wall there", 'bad');
      play('error');
      return;
    }
    const ids = selectedUnits(s).filter((u) => u.type === 'citizen' || legionary(s, u)).map((u) => u.id);
    issue({ t: 'wall', p: viewer, ids, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, queue: e.shiftKey || undefined, dyke: plan.type === 'dyke' || undefined, thorn: plan.type === 'thornwall' || undefined, channel: plan.type === 'channel' || undefined, causeway: plan.type === 'causeway' || undefined });
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
  } else {
    // A double-click on anything but your own unit is a right-click for the units selected before it (`doubleOrder`).
    const pk = lastTap.before.length ? orderPick(s, e.clientX, e.clientY) : view.pick(e.clientX, e.clientY);
    const hit = pk?.kind === 'unit' || pk?.kind === 'building' ? s.byId.get(pk.id) : undefined;
    const now = performance.now();
    // Your own building (a pitched camp too) is picked by the first click, so the second can't be its rally order.
    const again = doubleOrder(lastTap, now, e.clientX, e.clientY, hit?.owner === viewer && (hit.kind === 'unit' || !lastTap.before.some((id) => s.byId.get(id)?.kind === 'unit')));
    if (again) {
      lastTap = NO_TAP;
      setSelection(again);
      order(e.clientX, e.clientY, false, e.shiftKey);
    } else {
      lastTap = { at: now, x: e.clientX, y: e.clientY, before: [...selection].filter((id) => s.byId.get(id)?.owner === viewer) };
      clickSelect(e.clientX, e.clientY, e.shiftKey, e.ctrlKey);
    }
  }
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
const godAge = $('god-age') as HTMLSelectElement;
for (const id of Object.keys(AGES) as AgeId[]) godAge.add(new Option(AGES[id].name, id));
godAge.addEventListener('change', () => {
  if (game && godOn) jumpAge(game, viewer, godAge.value as AgeId);
  godAge.blur();
});
function setGod(on: boolean): void {
  godOn = on;
  $('god-btn').classList.toggle('hidden', !on);
  godAge.classList.toggle('hidden', !on);
  if (on && game) {
    topUp(game, viewer);
    godAge.value = game.players[viewer]?.age ?? '';
    hud.toast('God mode: full treasury, instant builds and upgrades, any age from the picker', 'info');
  } else if (!on) hud.toast('God mode off', 'info');
}
$('god-btn').addEventListener('click', () => setGod(false));

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  sound.unlock();
  const k = e.key;
  if (mode === 'title' && k === 'Escape') closeSheets();
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

type EndHow = 'conquest' | 'wonder' | 'relics' | 'lands' | 'greening' | 'resign' | 'time' | 'scenario';
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
      : how === 'greening'
        ? won ? 'Your land stayed green: the Greening is complete, and the world is a forest again.' : 'A rival kept its land green until the Greening was complete.'
      : how === 'relics'
        ? won ? 'Every relic in the world rests in your temples.' : 'A rival kept every relic in the world.'
        : won ? 'Your rivals have fallen.' : 'Your people are no more.';
  const extra = sc ? `${won ? `<div class="end-stars">${starRow(stars)}</div>` : ''}<ul class="goals">${sc.objectives.map((o, i) => `<li class="${o.bonus ? 'bonus' : ''}">${s.scenario!.done[i] ? '✔' : '✖'} ${o.text}</li>`).join('')}</ul>` : '';
  m.innerHTML = `<div class="card wide"><h2>${won ? (sc ? sc.title + ': victory!' : 'Victory!') : 'Defeat'}</h2>
    <div class="sel-sub">${why} The match lasted ${mins < 1 ? 'less than a minute' : `${mins} minute${mins === 1 ? '' : 's'}`}.</div>
    ${extra}
    <div class="chart-tabs">${(Object.keys(METRICS) as Metric[]).map((k) => `<button class="tab ${k === 'score' ? 'on' : ''}" data-metric="${k}">${METRICS[k]}</button>`).join('')}</div>
    <div id="chart">${timeline(s, 'score')}</div>
    ${journeyHtml(s, viewer, lastEnd?.tick ?? s.tick)}
    <table class="end-stats"><tr><th></th><th>Score</th><th>Epoch</th><th>Gathered</th><th>Traded</th><th>Trained</th><th>Built</th><th>Techs</th><th>Kills</th><th>Lost</th></tr>${rows}</table>
    <div class="row">
      <button class="btn wide" data-act="watch">Look around</button>
      <button class="btn wide" data-act="replay-save">Download the replay</button>
      ${sc ? (won && nextCh ? `<button class="btn wide primary" data-act="camp-next" data-id="${sc.id}">Next chapter: ${nextCh.title}</button>` : '') + '<button class="btn wide' + (won && nextCh ? '' : ' primary') + '" data-act="restart">Play the chapter again</button>' : online ? '' : '<button class="btn wide" data-act="restart" title="The same map, peoples and rivals">Play this seed again</button><button class="btn wide primary" data-act="new-map">Play again</button>'}
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
  // A rooted Bloom Seed is heard growing on every screen, a slow wooden heartbeat every ten seconds (the Age of the Bloom).
  if (s.tick % secs(10) === 0 && s.blooms?.some((l) => rooted(s, l))) play('bloomGrow');
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
        } else {
          // A rival's road (#726): remembered, and a click on the notice opens its card.
          if (ev.age) rivalLedger.note(ev.owner, ev.age, !!ev.back, s.tick);
          hud.toast(`${s.players[ev.owner].name} has ${ev.back ? 'stepped back to' : 'reached'} the ${ageName(ev)}${ev.back ? ': a chance to strike' : ''} (click to read)`, 'info', () => rivalPanel?.show(true));
        }
        break;
      case 'wages':
        if (ev.owner === viewer) {
          hud.toast(ev.gone ? `💰 ${ev.gone} hired sword${ev.gone > 1 ? 's' : ''} walked off unpaid${ev.late > ev.gone ? `; ${ev.late - ev.gone} more unpaid` : ''}` : `💰 The treasury is short: ${ev.late} hired sword${ev.late > 1 ? 's' : ''} unpaid, and will walk off next payday`, 'bad');
          play('error');
        }
        break;
      case 'season': {
        const sn = SEASONS[ev.i];
        // The turning year (#479): what the season does to this homeland.
        const turn = s.homeland ? HOMELANDS[s.homeland].year[ev.i] : '';
        hud.toast(`${sn.icon} ${sn.name}. ${sn.blurb}${turn ? ` ${HOMELANDS[s.homeland!].icon} ${turn}` : ''}`, 'info');
        // The Nile flood (#501 s1): a flood people hears the river rise and fall.
        if (CIVS[s.players[viewer]?.civ]?.flood && (ev.i === FLOOD.season || ev.i === (FLOOD.season + 1) % 4)) {
          hud.toast(ev.i === FLOOD.season ? '🌊 The Nile floods: the fields lie under the river and yield nothing. Call the farmers to build: the corvée works twice as fast.' : '🌾 The river falls and leaves its black silt: back to the fields.', ev.i === FLOOD.season ? 'bad' : 'good');
        }
        break;
      }
      case 'spawned':
        // The Shore's spring (#482): what last year's sparing bought.
        hud.toast(`🐟 The shoals spawned: ${ev.grew} more fish in the water${ev.seeded ? `, and ${ev.seeded} new shoal${ev.seeded > 1 ? 's' : ''}` : ''}.`, 'good');
        break;
      case 'hit':
        if (view.sees(ev.x, ev.y)) music.stir(0.012);
        break;
      case 'tide': {
        // The tide (#739): its waking told once, and the flood told to a people with feet on the flats.
        if (!tideTold) {
          tideTold = true;
          const who = s.players.find((q) => AGES[ageOf(q)].tides);
          hud.toast(`🌊 The tide has woken${who ? `: ${who.id === viewer ? 'your people keeps' : `${who.name} keeps`} the sea's hours` : ''}. Every ${TIDE.period / 60} minutes the sea falls to low water and back: the shallows bare as wet flats anyone may cross, and drown again. The clock is at the top of the screen.`, 'info');
          break;
        }
        if (ev.level === 0) hud.toast('🌊 Low water: the flats are bare. Ships on them sit aground until the water comes back.', 'info');
        else if (ev.rising && ev.level === 1) {
          const caught = s.ents.some((u) => u.kind === 'unit' && u.owner === viewer && u.hp > 0 && !u.inside && bared(s, Math.floor(u.y) * s.w + Math.floor(u.x)));
          if (caught) {
            hud.toast('🌊 The tide is coming in! Get your people off the flats before the water reaches them.', 'alert');
            play('alert');
          }
        }
        break;
      }
      case 'breached':
        // Barrages (#748): a causeway of yours torn up, told once a blast; a rival's, once too.
        if (s.tick !== breachToldAt && (ev.owner === viewer || ev.by === viewer)) {
          breachToldAt = s.tick;
          if (ev.owner === viewer) {
            lastAlert = { x: ev.x, y: ev.y };
            hud.toast(`${s.players[ev.by]?.name ?? 'A rival'} has breached your causeway${ev.pond ? ': the barrage is open, and its pond drains at the next turn of the tide. Lay causeways in the gap to shut it again' : ': the road over the flats is cut'}. (Space to look)`, 'bad');
          } else hud.toast(ev.pond ? 'The barrage is breached: its pond drains at the next turn of the tide, and its mills grind half as much' : 'The causeway is breached: the road over the flats is cut', 'good');
        }
        break;
      case 'pond':
        if (ev.owner === viewer) {
          hud.toast(`🌊 The barrage holds: ${ev.tiles} tiles of tidal flats are a pond now, wet at every hour. Tide Mills by it grind its flats twice, on the flood and on the ebb.`, 'good');
          play('pondShut');
        }
        break;
      case 'tideSwept':
        if (ev.owner === viewer && s.tick - sweptToldAt > TICK_HZ * 10) {
          sweptToldAt = s.tick;
          lastAlert = { x: ev.x, y: ev.y };
          hud.toast(ev.drowned ? '🌊 The tide took some of your people, caught far out on the flats. (Space to look)' : '🌊 The tide swept some of your people off the flats, hurt. (Space to look)', 'bad');
        }
        break;
      case 'sluice':
        // The Water Line (#701 s4): a rival's sluice opened where the viewer can see it, said once in a while.
        if (ev.open && ev.owner !== viewer && view.sees(ev.x, ev.y) && s.tick - sluiceToldAt > TICK_HZ * 30) {
          sluiceToldAt = s.tick;
          lastAlert = { x: ev.x, y: ev.y };
          hud.toast(`${s.players[ev.owner].name} has opened a sluice: the low ground round it is going under water. Soldiers wade it at a crawl and siege bogs down; go round, or wait for it to drain. (Space to look)`, 'alert');
        }
        break;
      case 'flooded':
        // The breach (#701 s3): the sea in your polder, said once a flood, not for every tile.
        if (ev.owner === viewer && s.tick - floodToldAt > TICK_HZ * 15) {
          floodToldAt = s.tick;
          music.stir(0.4);
          lastAlert = { x: ev.x, y: ev.y };
          hud.toast('The sea is in your polder! A dyke has given way: raise it again (K) to stop the flood, and a windmill will pump it out. (Space to look)', 'alert');
          play('alert');
        }
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
        if (ev.owner !== viewer && s.players[ev.owner].team !== s.players[viewer].team) hud.toast(`${s.players[ev.owner].name} has lost their last Town Center! ${ev.left} seconds to finish them.`, 'good');
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
        if (ev.owner !== viewer) break;
        // The Prospector's Lodge's chart (#565): where each key resource lies, now marked on the map.
        if (ev.tech === 'chart') {
          play('prospect');
          const n = s.players[viewer].chart?.length ?? 0;
          hud.banner('The land is charted', `${n ? `${n} spots of rare ore` : 'No rare ore'}${s.ruins?.length ? ` and ${s.ruins.length} ancient ruins` : ''} are marked on your map, under the fog too: the land as it lay when charted, not who digs there now.`, 7000);
        } else if (ev.tech === 'assay') {
          // The third level (#568): who digs where, and what each people holds.
          play('prospect');
          hud.banner('The holdings are assayed', 'Every charted vein someone digs is ringed in their colour on your map, and the lodge tells what each people holds of salt, saltpetre and blood-iron, and how much bog iron it has dug.', 7000);
        } else hud.toast(`${TECHS[ev.tech].name} researched`, 'good');
        break;
      case 'prospect': {
        // The Prospector's Lodge reports (#562): yes or no for every key resource, never where.
        if (ev.owner !== viewer) break;
        play('prospect');
        const name = (k: (typeof KEYS)[number]) => `${PROSPECTOR.keys[k].icon} ${PROSPECTOR.keys[k].name.toLowerCase()}`;
        const shut = KEYS.filter((k) => !ev.finds.includes(k) && opensOf(k).only.length);
        const iron = ev.finds.includes('bogIron') && roadsFrom(s.players[viewer]).some((r) => r.to === 'iron');
        hud.banner(
          'What this world holds',
          `The prospectors are back. ${ev.finds.length ? `They found ${ev.finds.map(name).join(', ')}.` : 'They found nothing rare.'}` +
            `${KEYS.length > ev.finds.length ? ` No ${KEYS.filter((k) => !ev.finds.includes(k)).map(name).join(', no ')} anywhere.` : ''}` +
            `${shut.length ? ` Shut for good: ${shut.flatMap((k) => opensOf(k).only).map((a) => `the ${AGES[a].name}`).join(', ')}.` : ''}` +
            `${iron ? ` Dig the bog iron and the Town Center can lead you into the ${AGES.iron.name} instead of the Bronze Age.` : ''} Select the lodge to read it again.`,
          8000,
        );
        break;
      }
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
        // A nomad people (#501) takes cut stone with the gold.
        const rate = `${(ev.gold / TRIBUTE.every).toFixed(1)} gold${ev.stone ? ` and ${(ev.stone / TRIBUTE.every).toFixed(1)} stone` : ''}`;
        if (ev.owner === viewer && fresh(tributeToast.took, 60)) {
          tributeToast.took = s.tick;
          hud.toast(`🐎 Your riders exact tribute from ${s.players[ev.from].name}: ${rate} a second while they stand in its land`, 'good');
        } else if (ev.from === viewer && fresh(tributeToast.paid, 30)) {
          tributeToast.paid = s.tick;
          hud.toast(`🐎 ${s.players[ev.owner].name}'s horde exacts tribute in your land (${rate} a second): drive its riders off with spears and towers`, 'alert');
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
      case 'golden': {
        // A Golden Age (#703): told to every people, with the ages it weaves and when it ends.
        const who = s.players[ev.owner].name;
        const woven = ev.threads.map((a) => AGES[a].short).join(', ');
        const mins = Math.round((ev.ends - s.tick) / TICK_HZ / 60);
        if (ev.over) {
          if (ev.owner === viewer) hud.banner('The Golden Age ends', 'Your people wakes in the Gunpowder Age. Every thread falls asleep, and the road will not open again.', 5500);
          else hud.toast(`🌅 The Golden Age of ${who} is over: its threads sleep`, 'good');
          if (ev.owner === viewer) play('stepBack');
        } else if (ev.owner === viewer) {
          setTimeout(() => play('golden'), 1200);
          hud.toast(`✨ Woven together for ${mins} minutes: ${woven}`, 'good');
        } else {
          hud.banner(`${who}: a Golden Age`, `Every way of life ${who} has lived wakes at once (${woven}), with none of their prices, for ${mins} minutes. Hold out, and strike when it ends.`, 6500);
          play('golden');
        }
        break;
      }
      case 'keepsake':
        // A people left an age (#555 s11): one building keeps its work.
        if (ev.owner === viewer) {
          const k = AGES[ev.age].keepsake;
          if (k) hud.toast(`🏺 Your ${BUILDINGS[k.building].name} keeps ${k.does}: the ${AGES[ev.age].name}'s keepsake`, 'good');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
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
      case 'kin':
        if (ev.owner === viewer) {
          hud.toast(`🔥 ${ev.n} kin come to the hearth${ev.n > KIN.n ? ': the winter call draws more' : ''}`, 'good');
          play('wayHearth');
        }
        break;
      case 'raided':
        if (!ev.tell) break;
        if (ev.owner === viewer) {
          hud.toast('🗡 Raiders are carrying off your food! (Space to look)', 'alert');
          lastAlert = { x: ev.x, y: ev.y };
          play('alert');
        } else if (ev.by === viewer) hud.toast('🗡 Your raiders carry the rival\'s food home', 'good');
        break;
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
      case 'cache': {
        // Key ore knocked loose and carried off (#570).
        const ore = RARE[ev.ore].name.toLowerCase();
        if (ev.what === 'spilled' && ev.from === viewer) {
          hud.toast(`${ev.n} of your ${ore} lies spilled on the ground: send citizens to carry it back before a rival does`, 'alert');
          play('oreSpill');
        } else if (ev.what === 'spilled' && view.sees(ev.x, ev.y)) {
          hud.toast(`${ev.n} ${ore} of ${s.players[ev.from].name}'s lies spilled: select citizens and right-click it to carry it home`, 'good');
          play('oreSpill');
        } else if (ev.what === 'taken' && ev.from === viewer && ev.owner !== viewer) hud.toast(`${s.players[ev.owner].name} is carrying off your ${ore}! Fell the carrier and it drops it`, 'bad');
        else if (ev.what === 'kept' && ev.owner === viewer) {
          hud.toast(`${ev.n} ${ore} carried home${ev.from !== viewer ? ` from ${s.players[ev.from].name}'s store: it counts toward your ore doors` : ''}`, 'good');
          play('oreHome');
        }
        break;
      }
      case 'keg':
        // Powder (#577): ground at the mills, laid, blown, or stamped out.
        if (ev.what === 'ground') {
          if (ev.owner === viewer) {
            hud.toast(`The mills grind a keg of powder: ${s.players[viewer].kegs ?? 0} in store`, 'good');
            play('kegGround');
          }
        } else if (ev.what === 'laid' && ev.owner !== viewer && s.players[ev.owner] && isEnemy(s, viewer, ev.owner) && view.sees(ev.x, ev.y)) {
          hud.toast(`${s.players[ev.owner].name}'s sappers have lit a powder keg by your walls: reach it before it blows`, 'bad');
        } else if (ev.what === 'doused') {
          if (ev.owner === viewer) hud.toast(`${s.players[ev.by ?? 0].name} stamped out your keg's fuse: cover the next one`, 'alert');
          else if (ev.by === viewer) hud.toast('Your people stamped out a burning keg', 'good');
        } else if (ev.what === 'blown' && ev.owner === viewer) hud.toast('A keg blows: what stood by it is shaken to its footings', 'good');
        else if (ev.what === 'drowned' && ev.owner === viewer) hud.toast('🌊 The tide came over your keg and drowned its fuse: lay powder on the flats only with time to spare', 'alert');
        break;
      case 'fire':
        // Fire (`fire.ts`): told once when a living building of yours catches (a spreading fire would tell every second), and when one is beaten out.
        if (ev.what === 'lit' && ev.owner === viewer && s.tick - fireToldAt > 15 * TICK_HZ) {
          fireToldAt = s.tick;
          hud.toast(`${ev.by !== viewer && s.players[ev.by] ? `${s.players[ev.by].name} has set your` : 'Your'} ${ev.tree ? 'woods' : 'living buildings'} alight: send citizens to beat it out before it spreads`, 'alert');
        } else if (ev.what === 'out' && ev.owner === viewer) hud.toast('The fire is beaten out', 'good');
        else if (ev.what === 'root' && ev.owner === viewer) hud.toast('Fire took a Thornwall root: it will not grow again', 'bad');
        break;
      case 'hive': {
        // The Age of the Hive: told once in a while when a swarm finds your people in a rival's woods, and when your Hive is smoked quiet.
        const victim = ev.what === 'swarm' ? s.byId.get(ev.target ?? 0) : undefined;
        if (victim && victim.owner === viewer && s.tick - hiveToldAt > 20 * TICK_HZ) {
          hiveToldAt = s.tick;
          hud.toast(`Bees! ${s.players[ev.owner]?.name ?? 'A rival'}'s Hive swarms your people in its woods: keep out of the trees there, or smoke it quiet with a fire`, 'alert');
        } else if (ev.what === 'smoked' && ev.owner === viewer) hud.toast('Smoke has quieted one of your Hives: its bees will wake when it clears', 'alert');
        break;
      }
      case 'bloom': {
        // The Age of the Bloom: every Seed is public, so every player is told when one is slung, where it roots, and how it ends; the
        // Greening's hold is told to all, as a Wonder's is.
        const who = s.players[ev.owner]?.name ?? 'A rival';
        const mine = ev.owner === viewer;
        const foe = isEnemy(s, viewer, ev.owner);
        if (ev.what === 'slung') {
          hud.toast(mine ? `Seed away: it roots in ${BLOOM.flight} seconds, and its ring cracks ${BLOOM.grow} seconds after unless their citizens hack it out. Guard the root` : `${who} has slung a Bloom Seed${foe ? ': it comes down inside the green ring' : ''}`, mine ? 'good' : foe ? 'bad' : 'info');
          if (foe) minimap.ping(ev.x, ev.y, '#7fd84a', true);
          play('bloomSling');
        } else if (ev.what === 'rooted') {
          if (foe) hud.toast(`${who}'s Bloom Seed has rooted: in ${BLOOM.grow} seconds every building of yours within ${BLOOM.r} tiles turns to forest. Send citizens to hack out its heart-root (the yellow ring)`, 'alert');
          else if (mine) hud.toast(`Your Seed has rooted: ${BLOOM.grow} seconds to the Bloom`, 'good');
          minimap.ping(ev.x, ev.y, '#d6f07a', true);
          play('bloomRoot');
        } else if (ev.what === 'withered') {
          if (mine) hud.toast('Your Seed found no open ground to root in and withered', 'bad');
        } else if (ev.what === 'hacked') {
          hud.toast(mine ? 'Your Seed was hacked out before it bloomed' : foe ? `The heart-root is cut: ${who}'s Bloom fails` : `${who}'s Seed was hacked out`, mine ? 'bad' : 'good');
          play('bloomCut');
        } else if (ev.what === 'cracked') {
          hud.toast(mine ? `The Bloom! ${ev.n ?? 0} of their buildings crack into forest` : foe ? `${who}'s Bloom cracks ${ev.n ?? 0} of your buildings into forest` : `${who}'s Seed has bloomed`, mine ? 'good' : foe ? 'bad' : 'info');
          minimap.ping(ev.x, ev.y, '#7fd84a', true);
          play('bloomCrack');
        } else if (ev.what === 'held') {
          hud.toast(mine ? `The Greening: keep your Heart Tree and your land green for ${BLOOM.hold / 60} minutes and you win` : `${who} has begun the Greening: fell and burn their woods, or fell their Heart Tree, within ${BLOOM.hold / 60} minutes`, mine ? 'good' : foe ? 'alert' : 'info');
          play('bloomGreen');
        } else if (ev.what === 'faded') {
          hud.toast(mine ? 'Your Greening has faded: green your land again' : `${who}'s Greening has faded`, mine ? 'bad' : 'good');
        } else if (ev.what === 'storm' && (mine || s.players[viewer]?.vis[Math.floor(ev.y) * s.w + Math.floor(ev.x)] === 1)) {
          if (foe) hud.toast(`A pollen storm blows from ${who}'s woods: your soldiers and towers near their Heart Tree see half as far`, 'alert');
          play('bloomStorm');
        }
        break;
      }
      case 'wildwood':
        // The Age of the Wildwood: a tree that wakes beside your people is told once in a while; your own Ent lost with its tree, and the
        // spring's Spreading, are told to its people.
        if (ev.what === 'wake' && ev.owner !== viewer && s.players[viewer]?.vis[Math.floor(ev.y) * s.w + Math.floor(ev.x)] === 1 && s.tick - entToldAt > 20 * TICK_HZ) {
          entToldAt = s.tick;
          hud.toast(`A tree wakes! ${s.players[ev.owner]?.name ?? 'A rival'}'s Ent was rooted there: in a Wildwood people's woods, any tree may be one. Fire takes them`, 'alert');
        } else if (ev.what === 'felled' && ev.owner === viewer) hud.toast('One of your rooted Ents was felled with its tree', 'bad');
        else if (ev.what === 'spread' && ev.owner === viewer && ev.n) hud.toast(`Spring: your woods spread round the Heart Tree, ${ev.n} seedlings`, 'good');
        break;
      case 'silo':
        // The Atomic Age (#605): the clock is public, so every player is told when a warhead goes up. A rival is shown three rings, the
        // real zone and two decoys (#762), never the event's point (the attacker's own aim): no marker, ping or camera jump there.
        if (ev.what === 'launched') {
          if (ev.owner === viewer) hud.toast(`Warhead away: it lands in ${ev.fuse ?? SILO.fuse} seconds. Rivals see your target among two decoys until the last ${SILO.reveal}`, 'good');
          else if (isEnemy(s, viewer, ev.owner)) {
            hud.toast(`${s.players[ev.owner].name} has launched a warhead: it lands in ${ev.fuse ?? SILO.fuse} seconds, in one of three rings. Clear them, or destroy the silo`, 'bad');
            const l = s.launches?.find((k) => k.id === ev.id);
            for (const g of l ? ringsFor(s, l, viewer) : []) minimap.ping(g.x, g.y, '#ff4a3a', true);
          }
          play('siloLaunch');
        } else if (ev.what === 'revealed') {
          // Exactly SILO.reveal seconds left (#762): the decoys vanish, the real ring flashes where it was drawn, one alarm.
          const l = s.launches?.find((k) => k.id === ev.id);
          if (l && isEnemy(s, viewer, ev.owner)) {
            hud.toast(`${SILO.reveal} seconds: the decoys are gone. ${s.players[ev.owner].name}'s warhead falls in the ring that flashes`, 'bad');
            for (const g of ringsFor(s, l, viewer)) minimap.ping(g.x, g.y, '#ff2a1a', true);
            play('siloAlarm');
          }
        } else if (ev.what === 'scrubbed') {
          hud.toast(ev.owner === viewer ? 'Your silo fell: the launch is scrubbed' : `${s.players[ev.owner].name}'s silo fell: the launch is scrubbed`, ev.owner === viewer ? 'alert' : 'good');
          play('siloScrub');
        } else {
          // The blast is seen by everyone, through the fog (#752): a ping on every minimap, and the boom.
          minimap.ping(ev.x, ev.y, '#ffd25a', true);
          play('siloBlast');
        }
        break;
      case 'oreBuy':
        // A load of rare ore bought at a post (#573).
        if (ev.owner === viewer) {
          hud.toast(`Bought ${ev.n} ${RARE[ev.ore].name.toLowerCase()} for ${ev.gold} gold: guard your trader on the road home`, 'info');
          play('tradeLoad');
        }
        break;
      case 'salvage':
        if (ev.owner !== viewer) break;
        if (ev.what === 'stripped') hud.toast(`Stripped the rubble of a ${BUILDINGS[ev.type].name}: ${RES.filter((r) => ev.gain?.[r]).map((r) => `+${ev.gain![r]} ${r}`).join(', ')}`, 'good');
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
      case 'find': {
        // A find claimed (#588): the finder learns what the world holds; a rival's claim, if we watched it.
        if (ev.owner === viewer) {
          const kind = FINDS.kinds[ev.kind];
          const gain = RES.filter((r) => kind.reward[r]).map((r) => `+${kind.reward[r]} ${r}`).join(', ');
          hud.banner(kind.name, `${kind.hint} (${gain}.)${ev.key ? ' A mark on the map shows where.' : ''}`, 5000);
          play('ruinFind');
        } else if (view.sees(ev.x, ev.y)) hud.toast(`${s.players[ev.owner].name} has found ${FINDS.kinds[ev.kind].name.toLowerCase()}`, 'info');
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
      case 'sighted':
        if (ev.owner === viewer) {
          hud.toast(`Scouts report an army of ${ev.n} (Space to look)`, 'alert');
          lastAlert = { x: ev.x, y: ev.y };
        }
        break;
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
  planner ??= new RoadPlanner($('roads-btn'), $('roads-panel'), (st, v, to, back) => planLines(st, st.players[v], to, back));
  planner.update(game, viewer, discovery ?? loadDiscovery());
  rivalPanel ??= new RivalPanel($('rivals-btn'), $('rivals-panel'), rivalLedger);
  for (const k of rivalLedger.scan(game, viewer, (x, y) => view.sees(x, y))) {
    hud.toast(`🏺 You see ${game.players[k.owner].name}'s ${BUILDINGS[(game.ents.find((e) => e.id === k.id) as { type: keyof typeof BUILDINGS }).type].name}: they have walked the ${AGES[k.age].name}`, 'info', () => rivalPanel?.show(true));
  }
  rivalPanel.update(game, viewer);
  hud.update(game, viewer, [...selection], SPEEDS[speedIdx], selectedTile, selectedRelic, selectedPost, selectedRuin !== null ? { id: selectedRuin, dug: view.ruins.dugAsSeen(selectedRuin) } : null, selectedLandmark !== null ? { id: selectedLandmark, keeper: view.landmarks.keeperAsSeen(selectedLandmark) } : null);
}

function cursorFor(s: GameState): string {
  if (placing) return 'cur-place';
  if (targetMode === 'amove' || targetMode === 'patrol') return 'cur-amove';
  if (targetMode === 'garrison') return 'cur-garrison';
  if (targetMode === 'sacrifice' || targetMode === 'curse') return 'cur-convert';
  if (targetMode === 'unload') return 'cur-garrison';
  if (targetMode === 'keg' || targetMode === 'torch' || targetMode === 'launch' || targetMode === 'sling') return 'cur-attack';
  if (!pointer.inside || boxing) return '';
  const units = selectedUnits(s);
  const pk: Pick | null = units.length ? orderPick(s, pointer.x, pointer.y) : view.pick(pointer.x, pointer.y);
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
    if (units.some((u) => u.type === 'citizen' || legionary(s, u)) && t.kind === 'building' && t.owner === viewer && (!t.built || t.hp < maxHp(s, t) || t.type === 'farm')) return 'cur-build';
    if (t.kind === 'building' && t.owner === viewer && chantedOver(s, t) && consecrates(s, viewer) && units.some((u) => u.type === 'priest' && !carriedBy(s, u))) return 'cur-gather';
    if (units.length && t.kind === 'building' && t.owner === viewer && t.built && BUILDINGS[t.type].garrison) return 'cur-garrison';
    if (t.kind === 'building' && t.type === 'temple' && t.owner === viewer && t.built && units.some((u) => u.type === 'priest' && carriedBy(s, u))) return 'cur-gather';
    if (t.kind === 'building' && t.type === 'market' && t.owner === viewer && t.built && units.some((u) => u.type === 'trader')) return 'cur-gather';
    if (t.kind === 'unit' && t.type === 'transport' && t.owner === viewer && units.some((u) => domainOf(u.type) === 'land')) return 'cur-garrison';
    return 'cur-select';
  }
  if (pk.kind === 'resource' && units.some((u) => u.type === 'citizen' || (u.type === 'fisher' && s.res[pk.tile] === R_FISH) || (legionary(s, u) && legionKind(s.res[pk.tile])))) return 'cur-gather';
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
      // Look in on each town in turn, circling slowly, with a chosen shot now and then (a dock at dusk, an army at a ford).
      attractT += dt;
      const shot = titleShot(s, Math.floor(attractT / SHOT_SECONDS));
      view.rig.focus(shot.x, shot.y);
      view.rig.frame(shot.distance);
      // Look from the town toward the middle of the map, so the far side is land and sky, not the map's edge,
      // swaying slowly to either side as a camera on a crane would; a chosen shot holds its framing, drifting less.
      const sway = shot.kind === 'town' ? 0.45 : 0.15;
      if (shot.lookX * shot.lookX + shot.lookY * shot.lookY > 4) view.rig.aim(Math.atan2(-shot.lookX, -shot.lookY) + Math.sin(attractT * 0.06) * sway);
      else view.rig.rotate(dt * 0.05);
      // A whole day in eight minutes, opening at the golden hour; a chosen shot eases the light to its own hour and back.
      titleClock = easeHour(titleClock, shot.hour, dt);
      view.titleHour = titleClock;
      // Low over the land, as a film opens, so the sky and the far woods frame the town.
      view.rig.cinematic = 0.36;
      captionTown(s.players[shot.who], shot.marching, shot.note);
    } else {
      view.titleHour = null;
      view.rig.cinematic = null;
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
          if (godOn) {
            topUp(s, viewer);
            rush(s, viewer);
          }
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
      ghost: placing && !lined(placing) && placeAt ? { type: placing, ...placeAt, turn: placing === 'gate' && gateTurned(s, placeAt.tx, placeAt.ty) } : null,
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
      if (mode === 'play' && !watching && !spectating) {
        tideTimer -= dt;
        if (tideTimer <= 0) {
          tideTimer = 0.5;
          for (const b of tide.read(s, viewer, 0.5)) {
            // A fight turning against you where you aren't looking: say so, and Space looks.
            if (tide.onScreen(s, view.rig.camera, b.x, b.y)) continue;
            lastAlert = { x: b.x, y: b.y };
            minimap.ping(b.x, b.y, '#ff5a3c', true);
            hud.toast(`A fight is turning against you: ${b.mine} of yours against ${b.theirs}. (Space to look)`, 'alert');
            play('tideTurns');
          }
        }
        tide.place(s, view.rig.camera);
      } else tide.clear();
      mapTimer -= dt;
      if (mapTimer <= 0) {
        mapTimer = 0.2;
        minimap.draw(s, viewer, mode === 'over' || !!watching?.all || (spectating && spectateAll), [...view.knownBuildings()], view.rig.footprint(), selection, scoutFlags.all, rivalLedger.keepsakes());
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
  /** Jump the title's film to a second of its loop (testing, screenshots). */
  titleAt(seconds: number) {
    attractT = seconds;
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
  /**
   * The Water Road (testing, #701): turn a player to the Age of Dykes and raise, finished, the dyke line the computer would plan by its
   * start, and a windmill behind it. Returns the size of the basin it shuts off, or 0 where there is none.
   */
  dykes(owner: number) {
    if (!game) return 0;
    const s = game;
    const p = s.players[owner];
    const plan = dykePlan(s, p.startX, p.startY, AI_DYKE.reach, AI_DYKE, wallLine);
    if (!plan) return 0;
    restat(s, p, () => {
      p.epoch = AGES.dykes.tier;
      p.age = 'dykes';
    });
    for (const t of plan.line) placeBuilding(s, owner, 'dyke', t % s.w, Math.floor(t / s.w), true);
    const spot = millSpotFor(s, owner, plan.basin, p.startX, p.startY);
    if (spot) placeBuilding(s, owner, 'windmill', spot.tx, spot.ty, true);
    const first = plan.basin[0];
    view.rig.focus(first % s.w, Math.floor(first / s.w));
    return plan.basin.length;
  },
  /**
   * The breach (testing, #701 s3): bring down the dyke of a player's that holds back the most polder, and watch the sea run back in.
   * Returns how many tiles it held back (0: none of its dykes holds any; pump some out first with `ages.dykes`).
   */
  breach(owner: number) {
    if (!game) return 0;
    const s = game;
    let best: Building | null = null;
    let most = 0;
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.type !== 'dyke' || e.owner !== owner || e.hp <= 0) continue;
      const n = heldBack(s, e);
      if (n > most) {
        most = n;
        best = e;
      }
    }
    if (!best) return 0;
    best.hp = 0;
    view.rig.focus(best.x, best.y);
    return most;
  },
  /** Point the camera at a spot (testing): a spring head, a dyke line, a fight. */
  look(x: number, y: number) {
    view.rig.focus(x, y);
  },
  /**
   * The Age of Rivers (testing, #701 s1): turn a player to the age and dig, finished, the channel the computer would plan from the water
   * nearest its start; the water runs down it over the next few seconds. Returns the channel's length, or 0 where there is none.
   */
  rivers(owner: number) {
    if (!game) return 0;
    const s = game;
    const p = s.players[owner];
    const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, (x, y) => !placeProblem(s, 'channel', x, y));
    restat(s, p, () => {
      p.epoch = AGES.rivers.tier;
      p.age = 'rivers';
    });
    if (!plan) return 0;
    for (const t of plan.tiles) placeBuilding(s, owner, 'channel', t % s.w, Math.floor(t / s.w), true);
    view.rig.focus(plan.from.x, plan.from.y);
    return plan.tiles.length;
  },
  /**
   * The Water Line (testing, #701 s4): turn a player to the age and open, finished, a sluice: in the middle of its dyke line if it has
   * one (`ages.dykes` first), else on the channel the computer would dig by its start (dug at once). Returns how many tiles its water
   * reaches, or 0 where there is nowhere to set one.
   */
  waterline(owner: number) {
    if (!game) return 0;
    const s = game;
    const p = s.players[owner];
    restat(s, p, () => {
      p.epoch = AGES.waterline.tier;
      p.age = 'waterline';
      p.walked = [...new Set([...(p.walked ?? []), 'dykes' as const, 'waterline' as const])];
    });
    const line = s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'dyke' && e.owner === owner && e.built && e.hp > 0 && s.terrain[e.ty * s.w + e.tx] === T_WATER);
    let at = -1;
    if (line.length) {
      // The dyke whose sluice would flood the most.
      let most = -1;
      for (const d of line) {
        const n = waterLine(s, d).length;
        if (n > most) {
          most = n;
          at = d.ty * s.w + d.tx;
        }
      }
      const d = s.byId.get(s.bldAt[at]) as Building;
      stampBuilding(s, d, false);
      s.byId.delete(d.id);
      s.ents = s.ents.filter((e) => e !== d);
    } else {
      const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, (x, y) => !placeProblem(s, 'channel', x, y));
      if (!plan) return 0;
      for (const t of plan.tiles) dig(s, t, owner);
      at = plan.tiles.reduce((a, t) => (waterLine(s, { tx: t % s.w, ty: Math.floor(t / s.w) }).length > waterLine(s, { tx: a % s.w, ty: Math.floor(a / s.w) }).length ? t : a));
    }
    const b = placeBuilding(s, owner, 'sluice', at % s.w, Math.floor(at / s.w), true);
    b.open = true;
    view.rig.focus(b.x, b.y);
    return waterLine(s, b).length;
  },
  /**
   * The Age of Tides (testing, #739): turn a player to the age (the tide wakes on the next tick), stock it, and raise, finished, a Tide
   * Mill where the computer would. Returns the mill's id, or 0 where there is no tidal ground near home. Look at it with the camera.
   */
  tides(owner: number) {
    if (!game) return 0;
    const s = game;
    const p = s.players[owner];
    restat(s, p, () => {
      p.epoch = AGES.tides.tier;
      p.age = 'tides';
    });
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    wakeTide(s);
    const spot = tideMillSpot(s, owner, p.startX, p.startY, AI_TIDES.reach, AI_TIDES.least, (x, y) => !placeProblem(s, 'tidemill', x, y, true, owner));
    if (!spot) return 0;
    view.rig.focus(spot.tx + 1, spot.ty + 1);
    return placeBuilding(s, owner, 'tidemill', spot.tx, spot.ty, true).id;
  },
  /**
   * Barrages (testing, #748): with the tide awake, find the first bay on the map a barrage would shut (scanning for a mill's spot, as the
   * computer looks by its own), and raise a Tide Mill there and the barrage's whole line, finished. Returns the pond's tidal tiles once
   * the line settles (0: no bay found). Look at it with the camera.
   */
  barrage(owner: number) {
    if (!game || !game.tidal) return 0;
    const s = game;
    for (let y = 4; y < s.h - 4; y += 6)
      for (let x = 4; x < s.w - 4; x += 6) {
        const plan = barragePlan(s, { tx: x, ty: y, size: 2 }, AI_BARRAGE, wallLine);
        if (!plan) continue;
        for (const t of plan.line) placeBuilding(s, owner, 'causeway', t % s.w, Math.floor(t / s.w), true);
        if (!placeProblem(s, 'tidemill', x, y, true, owner)) placeBuilding(s, owner, 'tidemill', x, y, true);
        view.rig.focus(x + 1, y + 1);
        return plan.pond;
      }
    return 0;
  },
  /** A finished line of wall, or of Thornwall (testing). */
  wall(owner: number, x0: number, y0: number, x1: number, y1: number, type: 'wall' | 'thornwall' = 'wall') {
    if (!game) return 0;
    let n = 0;
    for (const t of wallLine(x0, y0, x1, y1)) {
      if (placeProblem(game, type, t.x, t.y)) continue;
      placeBuilding(game, owner, type, t.x, t.y, true);
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

