import { createGame, step } from '../src/sim/game';
const s = createGame({ seed: 4, size: 'medium', players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'hard' }] });
for (let i = 0; i < 20 * 60 * 17; i++) step(s);
const occ = new Map<number, string>();
for (const e of s.ents) if (e.kind === 'unit') occ.set(Math.floor(e.y) * s.w + Math.floor(e.x), e.owner === 0 ? 'a' : 'b');
for (let y = 36; y < 62; y++) {
  let row = '';
  for (let x = 48; x < 78; x++) {
    const i = y * s.w + x;
    const t = s.terrain[i];
    row += occ.get(i) ?? (s.bldAt[i] ? 'B' : s.res[i] ? 'T' : t === 2 ? '~' : t === 3 ? '^' : '.');
  }
  console.log(String(y).padStart(3), row);
}
