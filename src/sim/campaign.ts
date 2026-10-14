import { EPOCHS, domainOf, secs } from './data';
import { NAVAL } from './grid';
import type { GameSetup } from './game';
import type { Building, BuildingType, Cost, GameState, Unit, UnitType } from './types';
import { RES } from './types';
import { setOrder } from './units';
import { exitSpot, spawnUnit } from './world';

/**
 * The campaign: six scenarios through the epochs, each a normal match with a story, a list of goals
 * and a few scripted events (raids on a timetable, caravans of help). The scenario runs inside the
 * simulation, so it is deterministic, saves with the match and replays the same.
 */

export type ObjectiveKind = 'epoch' | 'pop' | 'gather' | 'kills' | 'build' | 'units' | 'survive' | 'destroy' | 'wonder';

export interface Objective {
  kind: ObjectiveKind;
  text: string;
  /** The amount to reach (seconds for survive, an epoch index for epoch). */
  n: number;
  type?: BuildingType | UnitType;
  /** Not needed to win: a stretch goal that earns a star. */
  bonus?: boolean;
}

export interface Raid {
  /** Seconds into the match. */
  at: number;
  /** Which rival sends it (index into the setup's players). */
  from: number;
  units: [UnitType, number][];
  title: string;
  text: string;
}

export interface Gift {
  at: number;
  res: Cost;
  title: string;
  text: string;
}

export interface Scenario {
  id: string;
  title: string;
  place: string;
  brief: string;
  /** Said when the scenario is won. */
  epilogue: string;
  setup: GameSetup;
  objectives: Objective[];
  raids?: Raid[];
  gifts?: Gift[];
  /** Seconds to do it all in; running out loses. */
  limit?: number;
}

const you = { name: 'You', ai: null, team: 0 } as const;

export const SCENARIOS: Scenario[] = [
  {
    id: 'first-fires',
    title: 'The First Fires',
    place: 'Stone Age · the river valley',
    brief:
      'Winter is coming and the tribe is small. Gather food and wood, raise houses against the cold and grow the people. A rival tribe lives beyond the hills; they are watching, but they will not come for a while. Learn your trade, then reach for the Bronze Age.',
    epilogue: 'The tribe will see the spring. Smiths are already hammering out the first bronze.',
    setup: {
      seed: 4101,
      size: 'small',
      mapType: 'continental',
      peaceMinutes: 12,
      players: [{ ...you, civ: 'egyptians' }, { name: 'Hill Tribe', ai: 'easy', team: 1, civ: 'mongols' }],
    },
    objectives: [
      { kind: 'gather', n: 1800, text: 'Gather 1800 food, wood, stone and gold' },
      { kind: 'build', type: 'house', n: 3, text: 'Raise 3 houses' },
      { kind: 'pop', n: 20, text: 'Grow the tribe to 20 people' },
      { kind: 'epoch', n: 1, text: 'Reach the Bronze Age' },
      { kind: 'epoch', n: 1, bonus: true, text: 'Bonus: reach the Bronze Age within 12 minutes' },
    ],
  },
  {
    id: 'river-of-kings',
    title: 'River of Kings',
    place: 'Bronze Age · the Nile delta',
    brief:
      'Pharaoh wants a city worthy of the gods. Build a market and a temple, fill the granaries and grow to thirty people. Raiders from the desert will test you twice: have spearmen ready, and keep your citizens close to the Town Center.',
    epilogue: 'The temple bells ring over the delta. Caravans come from three kingdoms to trade at your market.',
    setup: {
      seed: 5202,
      size: 'small',
      mapType: 'plains',
      startEpoch: 1,
      players: [{ ...you, civ: 'egyptians' }, { name: 'Desert Raiders', ai: 'easy', team: 1, civ: 'mongols' }],
    },
    objectives: [
      { kind: 'build', type: 'market', n: 1, text: 'Build a Market' },
      { kind: 'build', type: 'temple', n: 1, text: 'Build a Temple' },
      { kind: 'pop', n: 30, text: 'Grow to 30 people' },
      { kind: 'survive', n: 540, text: 'Hold out for 9 minutes' },
      { kind: 'kills', n: 12, bonus: true, text: 'Bonus: defeat 12 enemy soldiers' },
    ],
    raids: [
      { at: 240, from: 1, units: [['infantry', 4]], title: 'Raiders!', text: 'Desert raiders cross the river from the east.' },
      { at: 420, from: 1, units: [['infantry', 4], ['ranged', 3]], title: 'A second band', text: 'Archers follow the spearmen. Hold the Town Center.' },
    ],
    gifts: [{ at: 120, res: { food: 200, wood: 200 }, title: 'A gift from the Pharaoh', text: 'Grain and timber arrive by river barge.' }],
  },
  {
    id: 'the-wall',
    title: 'The Wall',
    place: 'Middle Ages · the northern marches',
    brief:
      'Raiders pour out of the hills every few minutes. Wall your town, build towers, and train pikemen and archers to hold the gate. Survive fourteen minutes and the king’s army will arrive. The longbowmen of Britain are with you.',
    epilogue: 'The relief column arrives to find the wall unbroken and the field strewn with the fallen. The marches are safe.',
    setup: {
      seed: 6303,
      size: 'small',
      mapType: 'highlands',
      startEpoch: 2,
      players: [{ ...you, civ: 'britons' }, { name: 'Hill Clans', ai: 'normal', team: 1, civ: 'romans' }],
    },
    objectives: [
      { kind: 'build', type: 'wall', n: 10, text: 'Raise 10 sections of wall' },
      { kind: 'build', type: 'tower', n: 2, text: 'Raise 2 watch towers' },
      { kind: 'survive', n: 840, text: 'Hold out for 14 minutes' },
      { kind: 'kills', n: 40, bonus: true, text: 'Bonus: defeat 40 enemy soldiers' },
    ],
    raids: [
      { at: 180, from: 1, units: [['infantry', 5], ['ranged', 2]], title: 'First raid', text: 'Smoke on the northern ridge.' },
      { at: 360, from: 1, units: [['infantry', 5], ['cavalry', 3]], title: 'Horsemen!', text: 'Cavalry sweep out of the hills. Pikes to the front.' },
      { at: 540, from: 1, units: [['infantry', 6], ['ranged', 5], ['siege', 1]], title: 'A ram!', text: 'They bring a battering ram to the gate.' },
      { at: 720, from: 1, units: [['infantry', 8], ['cavalry', 4], ['ranged', 6]], title: 'The last assault', text: 'Every clan has sent its warriors. Hold!' },
    ],
    gifts: [{ at: 60, res: { stone: 300, wood: 200 }, title: 'Stone from the quarry', text: 'Masons deliver stone for the wall.' }],
  },
  {
    id: 'iron-and-gold',
    title: 'Iron and Gold',
    place: 'Middle Ages · the Roman frontier',
    brief:
      'The rival city sits on a mountain of gold, and the Senate wants it. Build an army that mixes legions, archers and cavalry, bring a ram for the walls and burn the rival town. Time is short: the Senate gives you twenty-five minutes.',
    epilogue: 'The eagles fly above the conquered city and the gold flows to Rome.',
    setup: {
      seed: 7404,
      size: 'medium',
      mapType: 'lakes',
      startEpoch: 2,
      players: [{ ...you, civ: 'romans' }, { name: 'The Gold King', ai: 'normal', team: 1, civ: 'greeks' }],
    },
    objectives: [
      { kind: 'units', type: 'siege', n: 1, text: 'Build a siege engine' },
      { kind: 'kills', n: 20, text: 'Defeat 20 enemy soldiers' },
      { kind: 'destroy', n: 0, text: 'Burn the rival Town Center' },
      { kind: 'epoch', n: 3, bonus: true, text: 'Bonus: reach the Gunpowder Age' },
    ],
    limit: 1500,
  },
  {
    id: 'sea-lords',
    title: 'Sea Lords',
    place: 'Gunpowder Age · the inland sea',
    brief:
      'The Admiralty needs control of the sea before the empire can grow. Build a dock, fish the shoals to feed your shipyards and raise a fleet of galleons. Then sink the rival fleet and burn their harbour. Mind the shore: their cannon reach far.',
    epilogue: 'The red ensign flies over every harbour on the inland sea.',
    setup: {
      seed: 8505,
      size: 'medium',
      mapType: 'sea',
      startEpoch: 3,
      players: [{ ...you, civ: 'britons' }, { name: 'The Armada', ai: 'normal', team: 1, civ: 'romans' }],
    },
    objectives: [
      { kind: 'build', type: 'dock', n: 1, text: 'Build a Dock' },
      { kind: 'units', type: 'warship', n: 5, text: 'Command 5 warships' },
      { kind: 'destroy', n: 0, text: 'Burn the rival Town Center' },
      { kind: 'units', type: 'transport', n: 1, bonus: true, text: 'Bonus: launch a transport ship' },
    ],
    raids: [{ at: 600, from: 1, units: [['warship', 3]], title: 'Sail ho!', text: 'Enemy galleons are standing in toward your harbour.' }],
    limit: 2400,
  },
  {
    id: 'wings',
    title: 'Wings over the Steppe',
    place: 'Industrial Age · the great war',
    brief:
      'Two empires lie between you and the sea: the Tsar’s, crumbling from within, and the Kaiser’s, at the height of its power. The old rules of war are ending. Race through the new technologies, build an airfield and a bomber wing, and break their towns from the air while your riflemen hold the line. Win within forty-five minutes.',
    epilogue: 'From the cockpit, the empire’s capital is a smudge of smoke on the plain. The age of the horse is over.',
    setup: {
      seed: 9606,
      size: 'large',
      mapType: 'continental',
      startEpoch: 4,
      players: [
        { ...you, civ: 'mongols' },
        { name: 'The Tsar', ai: 'easy', team: 1, civ: 'chinese' },
        { name: 'The Kaiser', ai: 'normal', team: 2, civ: 'britons' },
      ],
    },
    objectives: [
      { kind: 'build', type: 'airfield', n: 1, text: 'Build an Airfield' },
      { kind: 'units', type: 'bomber', n: 4, text: 'Command 4 bombers' },
      { kind: 'destroy', n: 0, text: 'Burn both rival Town Centers' },
      { kind: 'kills', n: 60, bonus: true, text: 'Bonus: defeat 60 enemy units' },
    ],
    raids: [{ at: 900, from: 1, units: [['infantry', 8], ['ranged', 8], ['cavalry', 4]], title: 'The Tsar marches', text: 'A great column approaches from the west.' }],
    limit: 2700,
  },
];

export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((c) => c.id === id);

/** The scenario's progress, kept in the match state. */
export interface ScenarioRun {
  id: string;
  /** One flag per objective: done. */
  done: boolean[];
  /** Raids and gifts already sent, by index. */
  raids: number;
  gifts: number;
  /** Set when the scenario is decided. */
  result: 'win' | 'lose' | null;
  /** Rivals whose Town Center has burned (for "Burn the rival Town Center"); absent in older saves. */
  burned?: number[];
}

export function startScenario(s: GameState, id: string): void {
  const sc = scenarioById(id);
  if (!sc) return;
  s.scenario = { id, done: sc.objectives.map(() => false), raids: 0, gifts: 0, result: null };
}

/** How far along an objective is: [now, goal]. */
export function progress(s: GameState, o: Objective, owner = 0): [number, number] {
  const p = s.players[owner];
  switch (o.kind) {
    case 'epoch':
      return [p.epoch, o.n];
    case 'pop':
      return [p.pop, o.n];
    case 'gather':
      return [p.stats.gathered, o.n];
    case 'kills':
      return [p.stats.kills, o.n];
    case 'survive':
      return [Math.floor(s.tick / 20), o.n];
    case 'build': {
      let n = 0;
      for (const e of s.ents) if (e.kind === 'building' && e.owner === owner && e.type === o.type && e.built && e.hp > 0) n++;
      return [n, o.n];
    }
    case 'units': {
      let n = 0;
      for (const e of s.ents) if (e.kind === 'unit' && e.owner === owner && e.type === o.type && e.hp > 0) n++;
      return [n, o.n];
    }
    case 'wonder': {
      const w = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'wonder' && e.built && e.hp > 0);
      return [w ? 1 : 0, 1];
    }
    case 'destroy': {
      // A rival town falls with its Town Center: burning it decides the chapter, with no hunt for the last house.
      // Once burned it counts, even if they raise another.
      const foes = s.players.filter((q) => q.team !== p.team);
      const fallen = foes.filter((q) => q.defeated || s.scenario?.burned?.includes(q.id) || !s.ents.some((e) => e.kind === 'building' && e.owner === q.id && e.type === 'towncenter' && e.built && e.hp > 0));
      return [fallen.length, foes.length];
    }
  }
}

/** Text for an objective with its progress, e.g. "Raise 3 houses (2/3)". */
export function describe(s: GameState, o: Objective): string {
  const [now, goal] = progress(s, o);
  switch (o.kind) {
    case 'epoch':
      return o.text;
    case 'survive': {
      const left = Math.max(0, goal - now);
      return `${o.text} (${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left)`;
    }
    case 'destroy':
    case 'wonder':
      return o.text;
    default:
      return `${o.text} (${Math.min(now, goal)}/${goal})`;
  }
}

/** Bonus goals with a deadline: the Bronze Age bonus in the first scenario must be met in time. */
function met(s: GameState, sc: Scenario, o: Objective): boolean {
  const [now, goal] = progress(s, o);
  if (now < goal) return false;
  if (sc.id === 'first-fires' && o.bonus && o.kind === 'epoch') return s.tick <= secs(12 * 60);
  return true;
}

function spawnRaid(s: GameState, r: Raid, target: Building | undefined): void {
  if (!target) return;
  const mine = (type: BuildingType) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === r.from && e.type === type && e.built && e.hp > 0);
  for (const [type, count] of r.units) {
    const water = domainOf(type) === 'water';
    const home = water ? mine('dock') : mine('towncenter');
    if (!home) continue;
    for (let i = 0; i < count; i++) {
      const spot = exitSpot(s, home, target.x, target.y, water ? NAVAL : undefined);
      const u: Unit = spawnUnit(s, r.from, type, spot.x + (i % 3) * 0.4, spot.y + Math.floor(i / 3) * 0.4);
      setOrder(u, { k: 'move', x: target.x, y: target.y, amove: true, started: false });
    }
  }
}

/** Ticks off the goals met by now. Also called once when the match ends some other way (a conquest), so the end screen shows what was done. */
export function markGoals(s: GameState): void {
  const run = s.scenario;
  const sc = run && scenarioById(run.id);
  if (!run || !sc) return;
  sc.objectives.forEach((o, i) => {
    if (run.done[i] || !met(s, sc, o)) return;
    run.done[i] = true;
    s.events.push({ k: 'objective', index: i });
  });
}

/** Runs every second: scripted events, objectives, and the verdict. */
export function scenarioStep(s: GameState): void {
  const run = s.scenario;
  if (!run || run.result) return;
  const sc = scenarioById(run.id);
  if (!sc) return;
  const me = s.players[0];
  const secsNow = s.tick / 20;
  const target = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter' && e.hp > 0);
  while (sc.raids && run.raids < sc.raids.length && secsNow >= sc.raids[run.raids].at) {
    const r = sc.raids[run.raids++];
    spawnRaid(s, r, target);
    s.events.push({ k: 'story', title: r.title, text: r.text, bad: true });
  }
  while (sc.gifts && run.gifts < sc.gifts.length && secsNow >= sc.gifts[run.gifts].at) {
    const g = sc.gifts[run.gifts++];
    for (const r of RES) me.res[r] += g.res[r] ?? 0;
    s.events.push({ k: 'story', title: g.title, text: g.text, bad: false });
  }
  for (const q of s.players) {
    if (q.team === me.team || run.burned?.includes(q.id)) continue;
    if (!s.ents.some((e) => e.kind === 'building' && e.owner === q.id && e.type === 'towncenter' && e.built && e.hp > 0)) (run.burned ??= []).push(q.id);
  }
  markGoals(s);
  if (me.defeated) {
    run.result = 'lose';
    return;
  }
  if (sc.limit && secsNow >= sc.limit && !sc.objectives.every((o, i) => o.bonus || run.done[i])) {
    run.result = 'lose';
    s.over = true;
    s.winner = s.players.find((p) => p.team !== me.team)?.team ?? -1;
    s.events.push({ k: 'over', winner: s.winner, how: 'time' });
    return;
  }
  if (sc.objectives.every((o, i) => o.bonus || run.done[i])) {
    run.result = 'win';
    s.over = true;
    s.winner = me.team;
    for (const p of s.players) if (p.team !== me.team) p.defeated = true;
    s.events.push({ k: 'over', winner: me.team, how: 'scenario' });
  }
}

/** Stars: 1 for winning, 2 with every bonus goal too, 3 if also quick (inside two thirds of the time limit) or with few losses. */
export function starsFor(s: GameState): number {
  const run = s.scenario;
  const sc = run && scenarioById(run.id);
  if (!run || !sc || run.result !== 'win') return 0;
  if (!sc.objectives.every((o, i) => !o.bonus || run.done[i])) return 1;
  const quick = sc.limit ? s.tick / 20 <= sc.limit * (2 / 3) : s.players[0].stats.losses <= 15;
  return quick ? 3 : 2;
}

export const epochName = (n: number) => EPOCHS[n]?.name ?? '';
