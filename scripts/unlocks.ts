/**
 * What each age unlocks (`docs/engagement.md`, "Building up your town"): per main-road epoch, the buildings, kinds of
 * unit and technologies that first open there, and how many unit lines only change form; then, per side age, what is its
 * own (buildings, technologies, hires), what it bans, its keepsake, and the numbers it moves. Counts what `data.ts`
 * holds; mechanics coded elsewhere (a town on wagons, taming, the water layer) don't show, so read it beside the ages.
 *   npx tsx scripts/unlocks.ts
 */
import { AGES, BUILDINGS, EPOCHS, TECHS, UNITS } from '../src/sim/data';

const list = (xs: string[]) => `${xs.length}${xs.length ? ` (${xs.join(', ')})` : ''}`;

console.log('Main road');
for (let t = 0; t < EPOCHS.length; t++) {
  const blds = Object.entries(BUILDINGS).filter(([, b]) => b.epoch === t && !b.ages && !b.only).map(([k]) => k);
  const techs = Object.entries(TECHS).filter(([, x]) => x.epoch === t && !x.only && !x.walked && !x.legacy).map(([k]) => k);
  const fresh: string[] = [];
  let reformed = 0;
  for (const [k, line] of Object.entries(UNITS)) {
    if (!line[t]) continue;
    if (line.findIndex((u) => u) === t) fresh.push(k);
    else if (line[t] !== line[t - 1]) reformed++;
  }
  console.log(`  ${EPOCHS[t].name}: buildings ${list(blds)}; kinds of unit ${list(fresh)}; technologies ${techs.length}; unit lines reformed ${reformed}`);
}

console.log('Side ages');
for (const [id, a] of Object.entries(AGES)) {
  if (EPOCHS.some((e, t) => t === a.tier && e.name === a.name)) continue;
  const blds = Object.entries(BUILDINGS).filter(([, b]) => b.ages?.includes(id as never)).map(([k]) => k);
  const techs = Object.entries(TECHS).filter(([, x]) => x.only === id).map(([k]) => k);
  const shared = a.keepsake && !BUILDINGS[a.keepsake.building].ages ? ' (shared)' : '';
  const nums = Object.keys({ ...(a.add ?? {}), ...(a.mul ?? {}) });
  console.log(
    `  ${a.name} (tier ${a.tier}): own buildings ${list(blds)}; technologies ${list(techs)}; hires ${a.hire ? a.hire.units.join('/') : '-'}; ` +
      `bans ${a.no ? a.no.units.join('/') : '-'}; keepsake ${a.keepsake ? a.keepsake.building + shared : '-'}; numbers ${nums.join(', ') || '-'}`,
  );
}
