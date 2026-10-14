/** Spoiler-heavy developer tool. Does not change the map or play any turns. */
import { ATLAS_HELP, formatAtlasTable, parseAtlasArgs, scanAtlas } from './seed-atlas-core';

try {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(ATLAS_HELP);
  } else {
    const options = parseAtlasArgs(args);
    const rows = scanAtlas(options);
    if (options.json) console.log(JSON.stringify({ options, matched: rows.length, rows }, null, 2));
    else console.log(formatAtlasTable(rows, options));
  }
} catch (e) {
  console.error(`Seed Atlas: ${e instanceof Error ? e.message : String(e)}`);
  console.error('Run with --help for usage.');
  process.exitCode = 1;
}
