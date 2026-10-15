import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_LEVELS } from '../src/sim/data';
import type { Difficulty } from '../src/sim/types';

// Four honest difficulties (#256, #258): the ids keep their behaviour, the names moved down a step.
const ORDER: Difficulty[] = ['gentle', 'easy', 'normal', 'hard'];

describe('difficulty tiers', () => {
  it('are named Easy, Normal, Hard and Expert, gentlest first', () => {
    expect(ORDER.map((l) => AI_LEVELS[l].label)).toEqual(['Easy', 'Normal', 'Hard', 'Expert']);
  });

  it('press harder at every step: more gathering, a bigger town, an earlier and bigger first wave', () => {
    for (let i = 1; i < ORDER.length; i++) {
      const a = AI_LEVELS[ORDER[i - 1]];
      const b = AI_LEVELS[ORDER[i]];
      expect(b.gather).toBeGreaterThan(a.gather);
      expect(b.citizens).toBeGreaterThan(a.citizens);
      expect(b.firstAttack).toBeLessThan(a.firstAttack);
      expect(b.wave).toBeGreaterThanOrEqual(a.wave);
    }
  });

  it('keep the gentlest free of tricks and slow to strike, so a first game reaches the Bronze Age', () => {
    const g = AI_LEVELS.gentle;
    expect(g.clever).toBe(false);
    expect(g.towers).toBe(0);
    expect(g.firstAttack).toBeGreaterThanOrEqual(15 * 60);
  });

  it('start a new game on the one called Normal, and offer all four on the title screen', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const picker = html.slice(html.indexOf('<select id="opt-diff">'), html.indexOf('</select>', html.indexOf('<select id="opt-diff">')));
    const values = [...picker.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    expect(values).toEqual(ORDER);
    expect(picker).toMatch(/<option value="easy" selected>Normal<\/option>/);
  });
});
