// Headless probe for #792: a wave against a computer's loaded Tide Gate on its way, marching straight in or answering it first.
// For each seed with a march under a gate: the wave's losses (dead, and health lost) over the next `minutes`, and how each answer went.
// npx tsx scripts/gate-probe.ts [seeds=16] [minutes=1.5]
import { gateAnswer } from '../src/sim/ai';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, TIDE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barragePlan, gateLoaded, gateOnWay, gateReach, isTidal, tideGateSpotIn, tideLevel } from '../src/sim/tides';
import type { AgeId, AiMemory, Building, GameState, Unit } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

const seeds = Number(process.argv[2] ?? 16);
const minutes = Number(process.argv[3] ?? 1.5);
type Pt = { x: number; y: number };
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
const mid = (s: GameState, t: number): Pt => ({ x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 });

/** Player 0 (a computer) with a loaded gate in a barrage; a march for player 1 under it. Null: none on this seed. */
function setup(seed: number): { s: GameState; gate: Building; from: Pt; to: Pt } | null {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  s.animals = [];
  enter(s, 0, 'tides');
  step(s);
  let plan = null;
  for (let y = 4; y < s.h - 4 && !plan; y += 12) for (let x = 4; x < s.w - 4 && !plan; x += 12) plan = barragePlan(s, { tx: x, ty: y, size: 2 }, AI_BARRAGE, wallLine);
  if (!plan) return null;
  for (const t of plan.line) placeBuilding(s, 0, 'causeway', t % s.w, Math.floor(t / s.w), true);
  for (let i = 0; i < secs(1); i++) step(s);
  const spot = tideGateSpotIn(s, plan.line, 0);
  if (!spot) return null;
  const gate = placeBuilding(s, 0, 'tidegate', spot.tx, spot.ty, true);
  for (let i = 0; i < secs(TIDE.period) * 2 && tideLevel(s) !== 0; i++) step(s);
  step(s);
  if (!gateLoaded(s, gate)) return null;
  const near = new Set<number>();
  for (const t of gateReach(s, gate)) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) near.add(t + dy * s.w + dx);
  const land = [...near].sort((a, b) => a - b).filter((i) => i > s.w && i < s.w * (s.h - 1) && !isTidal(s, i) && s.terrain[i] !== T_WATER && walkable(s, i % s.w, Math.floor(i / s.w), -1));
  for (let a = 0; a < land.length; a++)
    for (let b = land.length - 1; b > a; b--)
      if (gateOnWay(s, 1, s.players[1].team, mid(s, land[a]), mid(s, land[b]))) return { s, gate, from: mid(s, land[a]), to: mid(s, land[b]) };
  return null;
}

/** One trial: `answer` false marches straight in; true answers the gate first (as a Sapper people with `kegs`). */
function trial(seed: number, answer: boolean, kegs: number): { dead: number; hurt: number; how: string; scoured: number; held: number } | null {
  const g = setup(seed);
  if (!g) return null;
  const { s, from, to } = g;
  if (kegs) {
    enter(s, 1, 'sapper');
    s.players[1].kegs = kegs;
  }
  const wave: Unit[] = [];
  for (let i = 0; i < 10; i++) wave.push(spawnUnit(s, 1, 'infantry', from.x + (i % 3) * 0.3, from.y + Math.floor(i / 3) * 0.3));
  const full = wave.reduce((n, u) => n + u.hp, 0);
  const mem = { muster: from } as AiMemory;
  const issue = (c: Parameters<typeof applyCommand>[1]) => applyCommand(s, c);
  let marched = !answer;
  let how = 'none';
  let held = 0;
  let scoured = 0;
  if (marched) applyCommand(s, { t: 'move', p: 1, ids: wave.map((u) => u.id), x: to.x, y: to.y, amove: true });
  for (let i = 0; i < secs(minutes * 60); i++) {
    if (!marched) {
      const alive = wave.filter((u) => u.hp > 0);
      if (gateAnswer(s, s.players[1], mem, alive, to, issue)) {
        held++;
        if (mem.tide?.answer) how = how.includes(mem.tide.answer.how) ? how : how === 'none' ? mem.tide.answer.how : `${how}>${mem.tide.answer.how}`;
      } else {
        marched = true;
        applyCommand(s, { t: 'move', p: 1, ids: alive.map((u) => u.id), x: to.x, y: to.y, amove: true });
      }
    }
    step(s);
    for (const e of s.events) if (e.k === 'tideGate' && e.open && e.scour > 0) scoured += e.swept;
  }
  const dead = wave.filter((u) => u.hp <= 0 || !s.byId.has(u.id)).length;
  const left = wave.reduce((n, u) => n + (s.byId.has(u.id) ? Math.max(0, u.hp) : 0), 0);
  return { dead, hurt: full - left, how, scoured, held: Math.round(held / secs(1)) };
}

let n = 0;
const sum = { straight: { dead: 0, hurt: 0 }, answer: { dead: 0, hurt: 0 }, keg: { dead: 0, hurt: 0 } };
for (let seed = 1; seed <= seeds; seed++) {
  const a = trial(seed, false, 0);
  if (!a) {
    console.log(`seed ${seed}: no march under a gate`);
    continue;
  }
  const b = trial(seed, true, 0)!;
  const c = trial(seed, true, 3)!;
  n++;
  for (const [k, r] of [['straight', a], ['answer', b], ['keg', c]] as const) {
    sum[k].dead += r.dead;
    sum[k].hurt += r.hurt;
  }
  console.log(`seed ${seed}: straight dead ${a.dead} hurt ${Math.round(a.hurt)} swept ${a.scoured} | answer (${b.how}, held ${b.held}s) dead ${b.dead} hurt ${Math.round(b.hurt)} swept ${b.scoured} | sapper (${c.how}, held ${c.held}s) dead ${c.dead} hurt ${Math.round(c.hurt)} swept ${c.scoured}`);
}
console.log(`${n} seeds. Totals: straight dead ${sum.straight.dead} hurt ${Math.round(sum.straight.hurt)}; answer dead ${sum.answer.dead} hurt ${Math.round(sum.answer.hurt)}; sapper dead ${sum.keg.dead} hurt ${Math.round(sum.keg.hurt)}`);
