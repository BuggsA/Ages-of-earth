import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
const s = createGame({ seed: 7, size: 'small', players: [{ name: 'You', ai: null }, { name: 'Rival', ai: null }] });
const tc = s.ents.find((e: any) => e.owner === 0 && e.type === 'towncenter') as any;
console.log('place', placeProblem(s, 'farm', tc.tx - 4, tc.ty + 5), tc.tx, tc.ty);
const u = s.ents.find((e: any) => e.owner === 0 && e.kind === 'unit') as any;
step(s, [{ t: 'build', p: 0, ids: [u.id], type: 'farm', tx: tc.tx - 4, ty: tc.ty + 5 }]);
console.log(s.events);
for (let i = 0; i < 20 * 40; i++) { step(s); if (i % 100 === 0) console.log(i, u.order, u.x.toFixed(2), u.y.toFixed(2), u.act, u.miss, u.path); }
