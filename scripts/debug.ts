import { createGame, step } from '../src/sim/game';
const s = createGame({ seed: 3, size: 'medium', players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'hard' }] });
for (let i = 0; i < 20 * 60 * 5.5; i++) step(s);
for (const p of s.players) {
  console.log(p.name, p.pop, p.cap, JSON.stringify(p.res));
  const bs = s.ents.filter((e) => e.owner === p.id && e.kind === 'building');
  console.log(bs.map((b: any) => `${b.type}@${b.tx},${b.ty} built=${b.built} prog=${b.progress.toFixed(2)} q=${b.queue.length} adv=${b.advance}`).join('\n'));
  const us = s.ents.filter((e) => e.owner === p.id && e.kind === 'unit') as any[];
  const jobs: Record<string, number> = {};
  for (const u of us) { const k = u.order.k + (u.order.res ? ':' + u.order.res : '') + (u.order.phase ? ':' + u.order.phase : ''); jobs[k] = (jobs[k] ?? 0) + 1; }
  console.log(jobs);
}
import { findSpot } from '../src/sim/ai';
import { placeProblem } from '../src/sim/grid';
const p = s.players[0];
const tc = s.ents.find((e: any) => e.owner === 0 && e.type === 'towncenter') as any;
console.log('spot', findSpot(s, 'house', tc.x, tc.y, 5, 16));
let ok = 0, probs: Record<string, number> = {};
for (let y = tc.y - 16; y < tc.y + 16; y++) for (let x = tc.x - 16; x < tc.x + 16; x++) { const pr = placeProblem(s, 'house', Math.floor(x), Math.floor(y)); probs[String(pr)] = (probs[String(pr)] ?? 0) + 1; }
console.log(probs);
