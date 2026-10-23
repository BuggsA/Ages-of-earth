import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGES, ROADS } from '../src/sim/data';
import { roadProblem } from '../src/sim/ages';
import { createGame } from '../src/sim/game';
import { saveDiscovery, visibleAges } from '../src/ui/webMap';
import type { AgeId } from '../src/sim/types';

/** Shown, never gating (#555 s6, the owner 2026-10-22): the main menu's web remembers the ages a browser has reached, and nothing in a match reads it. */

describe('the web of reached ages only shows', () => {
  it('no rule reads the browser record, storage or the web map', () => {
    const files = readdirSync('src/sim').filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const text = readFileSync(`src/sim/${f}`, 'utf8');
      expect(text, f).not.toMatch(/localStorage|ages-web|webMap|loadDiscovery/);
    }
  });

  it('a road opens by the land and the town, whatever this browser has reached', () => {
    const problems = () => {
      const s = createGame({ seed: 5, size: 'small', startEpoch: 0, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
      return ROADS.map((r) => roadProblem(s, s.players[0], r));
    };
    const before = problems();
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveDiscovery({ entered: Object.keys(AGES) as AgeId[], roads: ROADS.map((r) => `${r.from}>${r.to}`) });
    expect(visibleAges({ entered: Object.keys(AGES) as AgeId[], roads: ROADS.map((r) => `${r.from}>${r.to}`) }).length).toBeGreaterThan(5);
    expect(problems()).toEqual(before);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
