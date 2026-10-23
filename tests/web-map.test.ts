import { describe, expect, it } from 'vitest';
import { AGES, ROADS, TRUNK } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { loadDiscovery, saveDiscovery, layout, observe, roadLabel, roadView, visibleAges, webMapHtml, ageView, roadKey, type Discovery } from '../src/ui/webMap';
import type { AgeId } from '../src/sim/types';

const none = (): Discovery => ({ entered: [], roads: [] });
const game = () => createGame({ seed: 5, size: 'small', startEpoch: 0, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('web map', () => {
  it('with nothing discovered shows only the trunk, greyed', () => {
    const d = none();
    expect(visibleAges(d)).toEqual(TRUNK);
    expect(TRUNK.every((a) => ageView(d, a) === 'grey')).toBe(true);
    expect(ROADS.filter((r) => roadView(d, r) !== 'hidden').every((r) => TRUNK.includes(r.to) && TRUNK.includes(r.from))).toBe(true);
    expect(webMapHtml(d)).not.toContain('Age of Fairs');
  });

  it('a known road shows its side age with a blurb; entering it shows it in full', () => {
    const d: Discovery = { entered: ['stone'], roads: ['bronze>merchant'] };
    expect(ageView(d, 'merchant')).toBe('known');
    expect(ageView(d, 'iron')).toBe('hidden');
    expect(webMapHtml(d)).toContain(AGES.merchant.blurb.slice(0, 20));
    d.entered.push('merchant');
    expect(ageView(d, 'merchant')).toBe('entered');
    const r = ROADS.find((x) => x.to === 'merchant')!;
    expect(roadLabel(r)).toMatch(/Market.*400 gold/);
  });

  it('observing a fresh game enters the first age and reports growth once', () => {
    const d = none();
    const s = game();
    expect(observe(d, s, 0)).toBe(true);
    expect(d.entered).toEqual(['stone']);
    expect(observe(d, s, 0)).toBe(false);
  });

  it('every age has a place on the map, and no two share one', () => {
    const pos = layout();
    const seen = new Set((Object.keys(AGES) as AgeId[]).map((a) => `${pos[a].x},${pos[a].y}`));
    expect(seen.size).toBe(Object.keys(AGES).length);
  });

  it('survives storage being off', () => {
    // Node has no localStorage: every read and write falls through its try/catch.
    expect(loadDiscovery()).toEqual(none());
    expect(() => saveDiscovery(none())).not.toThrow();
    expect(roadKey(ROADS[0])).toBe('stone>bronze');
    expect(visibleAges(none())).toHaveLength(6);
  });
});
