import { createGame, step } from '../src/sim/game';
const s = createGame({ seed: 4, size: 'medium', players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'hard' }] });
for (let i = 0; i < 20 * 60 * 17; i++) step(s);
for (const p of s.players) {
  const us = s.ents.filter((e) => e.owner === p.id && e.kind === 'unit' && e.type !== 'citizen') as any[];
  const jobs: Record<string, number> = {};
  for (const u of us) { const k = u.order.k + (u.order.amove ? ':amove' : '') + (u.path ? ':path' : '') + (u.wantPath ? ':want' : '') + ':miss' + u.miss; jobs[k] = (jobs[k] ?? 0) + 1; }
  console.log(p.name, p.startX, p.startY, jobs);
  const xs = us.map((u) => `${u.x.toFixed(0)},${u.y.toFixed(0)}`);
  console.log(xs.slice(0, 30).join(' '));
}
