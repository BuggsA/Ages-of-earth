import { describe, expect, it } from 'vitest';
import { AGES, GALLERY, KEG, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { kegStep, layKeg } from '../src/sim/powder';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building, Unit } from '../src/sim/types';

/** The Sappers' Mine Gallery (#727): a keg laid near your own is mined (no stamping it out), and a rival's gallery countermines kegs. */

function setup() {
  const s = createGame({ seed: 5, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 0;
  const a = s.players[0];
  a.epoch = AGES.sapper.tier;
  a.age = 'sapper';
  a.kegs = 3;
  const x = 30, y = 30;
  const carrier = spawnUnit(s, 0, 'infantry', x, y) as Unit;
  return { s, carrier, x, y };
}
const gal = (s: ReturnType<typeof setup>['s'], owner: number, tx: number, ty: number): Building => {
  const g = placeBuilding(s, owner, 'gallery', tx, ty, true);
  g.built = true;
  return g;
};

describe('the Mine Gallery (#727)', () => {
  it('a keg laid near its own gallery is mined and a rival on foot cannot stamp it out', () => {
    const { s, carrier, x, y } = setup();
    gal(s, 0, x + 2, y);
    layKeg(s, carrier);
    expect(s.kegs![0].mined).toBe(true);
    spawnUnit(s, 1, 'infantry', x + 0.3, y);
    for (let i = 0; i < secs(KEG.fuse) + 2; i++) kegStep(s), s.tick++;
    expect(s.kegs).toBeUndefined();
    expect(s.players[0].stats.blown).toBe(1);
  });

  it('a plain keg is stamped out by a rival who reaches it', () => {
    const { s, carrier, x, y } = setup();
    layKeg(s, carrier);
    expect(s.kegs![0].mined).toBeUndefined();
    spawnUnit(s, 1, 'infantry', x + 0.3, y);
    kegStep(s);
    expect(s.kegs).toBeUndefined();
    expect(s.players[0].stats.blown ?? 0).toBe(0);
  });

  it('a rival gallery within listening range countermines the keg, mined or not', () => {
    const { s, carrier, x, y } = setup();
    gal(s, 0, x + 2, y);
    s.players[1].age = 'sapper';
    s.players[1].epoch = AGES.sapper.tier;
    gal(s, 1, x, y + 4);
    layKeg(s, carrier);
    kegStep(s);
    expect(s.kegs).toBeUndefined();
    expect(s.events.some((e) => e.k === 'keg' && e.what === 'doused' && e.by === 1)).toBe(true);
  });

  it('a gallery out of its age sleeps unless kept', () => {
    const { s, carrier, x, y } = setup();
    const g = gal(s, 1, x, y + 4);
    s.players[1].age = 'stone';
    s.players[1].epoch = 0;
    layKeg(s, carrier);
    kegStep(s);
    expect(s.kegs).toBeDefined();
    g.keep = 'sapper';
    s.kegs = [{ ...s.kegs![0] }];
    kegStep(s);
    expect(s.kegs).toBeUndefined();
    expect(GALLERY.listen).toBeGreaterThan(0);
  });
});
