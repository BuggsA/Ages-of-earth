/**
 * How much there is to tame (the Age of the Wild): for each town on each seed, the wild wolves, boars and mammoths within `R` tiles at
 * the start, and the nearest of each kind. `npx tsx scripts/tame-probe.ts [seeds] [R]`
 */
import { createGame } from '../src/sim/game';
import type { HomelandId, MapSize, MapType } from '../src/sim/types';

const seeds = Number(process.argv[2] ?? 16);
const R = Number(process.argv[3] ?? 35);
const kinds = ['wolf', 'boar', 'mammoth'] as const;
const rows: string[] = [];
let lacking = 0;
let towns = 0;
for (const size of ['small', 'medium'] as MapSize[]) {
  for (const mapType of ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'] as MapType[]) {
    for (const homeland of ['glade', 'shore', 'herds', 'wood'] as HomelandId[]) {
      const tally = { wolf: 0, boar: 0, mammoth: 0 };
      let lack = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        let s;
        try { s = createGame({ seed, size, mapType, homeland, players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'normal' }] }); } catch { continue; }
        for (const p of s.players) {
          const tc = s.ents.find((e) => e.kind === 'building' && e.owner === p.id && e.type === 'towncenter');
          if (!tc) continue;
          towns++;
          for (const k of kinds) {
            const n = s.animals.filter((a) => a.kind === k && a.owner === undefined && (a.x - tc.x) ** 2 + (a.y - tc.y) ** 2 <= R * R).length;
            tally[k] += n;
            if (!n) { lack++; lacking++; }
          }
        }
      }
      rows.push(`${size} ${mapType} ${homeland}: per town wolf ${(tally.wolf / seeds / 2).toFixed(1)} boar ${(tally.boar / seeds / 2).toFixed(1)} mammoth ${(tally.mammoth / seeds / 2).toFixed(1)}; kinds missing ${lack}`);
    }
  }
}
console.log(rows.join('\n'));
console.log(`towns ${towns}, kind-missing cases ${lacking}`);
