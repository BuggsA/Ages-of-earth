import type { AgeId } from '../../sim/types';
import type { AgeArt } from './types';
import { art as stone } from './stone';
import { art as bronze } from './bronze';
import { art as middle } from './middle';
import { art as gunpowder } from './gunpowder';
import { art as industrial } from './industrial';
import { art as atomic } from './atomic';
import { art as merchant } from './merchant';
import { art as iron } from './iron';
import { art as pilgrim } from './pilgrim';
import { art as fair } from './fair';
import { art as reclaimer } from './reclaimer';
import { art as sail } from './sail';
import { art as aeronaut } from './aeronaut';
import { art as lightning } from './lightning';
import { art as warband } from './warband';
import { art as steppe } from './steppe';
import { art as ironblood } from './ironblood';
import { art as totalwar } from './totalwar';
import { art as horde } from './horde';
import { art as silk } from './silk';
import { art as hemocraft } from './hemocraft';
import { art as bloodrite } from './bloodrite';
import { art as fission } from './fission';
import { art as fusion } from './fusion';
import { art as alchemy } from './alchemy';
import { art as sapper } from './sapper';
import { art as searaider } from './searaider';
import { art as missions } from './missions';
import { art as chariots } from './chariots';
import { art as megaliths } from './megaliths';
import { art as delvings } from './delvings';
import { art as golden } from './golden';
import { art as dykes } from './dykes';
import { art as wild } from './wild';
import { art as grove } from './grove';
import { art as rivers } from './rivers';
import { art as hive } from './hive';
import { art as waterline } from './waterline';
import { art as tides } from './tides';
import { art as wildwood } from './wildwood';
import { art as locks } from './locks';
import { art as floating } from './floating';
import { art as bloom } from './bloom';
import { art as beggars } from './beggars';
import { art as leviathans } from './leviathans';
import { art as mycelium } from './mycelium';
import { art as hunt } from './hunt';

export type { AgeArt } from './types';

/** Every age's art. Each age's file is its own: edit `./<age>.ts`, never this index. */
export const AGE_ART: Record<AgeId, AgeArt> = { stone, bronze, middle, gunpowder, industrial, atomic, merchant, iron, pilgrim, fair, reclaimer, sail, aeronaut, lightning, warband, steppe, ironblood, totalwar, horde, silk, hemocraft, bloodrite, fission, fusion, alchemy, sapper, searaider, missions, chariots, golden, dykes, wild, grove, rivers, hive, waterline, tides, wildwood, locks, floating, bloom, beggars, leviathans, mycelium, hunt, megaliths, delvings };

/** A drawing as the markup placed on a button: the 32 by 32 box, painted in the age's ink unless the drawing sets its own. */
export const drawing = (markup: string, size = 26): string => `<svg class="drawn" viewBox="0 0 32 32" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${markup}</svg>`;

/**
 * The hand-drawn glyph for a button, or null for the shared emoji. `tech:<id>` comes from the age the player is in;
 * `age:<id>` (the age-up button leading to that age) is that age's own emblem.
 */
export function drawnGlyph(age: AgeId, id: string | undefined): string | null {
  if (!id) return null;
  const markup = id.startsWith('age:') ? AGE_ART[id.slice(4) as AgeId]?.emblem : AGE_ART[age].glyphs?.[id];
  return markup ? drawing(markup) : null;
}
