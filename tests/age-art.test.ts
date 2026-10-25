import { describe, expect, it } from 'vitest';
import { AGES, TECHS } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';
import { AGE_ART, drawnGlyph } from '../src/ui/ageArt';

const ids = Object.keys(AGES) as AgeId[];
const drawings = (id: AgeId): Array<[string, string]> => [
  ...(AGE_ART[id].emblem ? [[`${id} emblem`, AGE_ART[id].emblem!] as [string, string]] : []),
  ...Object.entries(AGE_ART[id].glyphs ?? {}).map(([k, v]) => [`${id} ${k}`, v] as [string, string]),
];

// Hand-made art for each age, one file an age (`docs/age-art.md`): it must be safe markup in its own box, and no two ages'
// emblems may be the same drawing.
describe('the age art files', () => {
  it('has a file for every age', () => {
    expect(Object.keys(AGE_ART).sort()).toEqual([...ids].sort());
  });

  it('keeps every drawing to bare, inert SVG shapes', () => {
    for (const id of ids)
      for (const [what, markup] of drawings(id)) {
        expect(markup, what).not.toMatch(/<svg|<script|<foreignObject|<image|<style|\son\w+=|javascript:|href=/i);
        expect(markup.length, what).toBeLessThan(3000);
        expect(markup.trim(), what).not.toBe('');
      }
  });

  it('names real technologies, and gives no two ages the same emblem', () => {
    const seen = new Map<string, AgeId>();
    for (const id of ids) {
      for (const k of Object.keys(AGE_ART[id].glyphs ?? {})) {
        expect(k, `${id} ${k}`).toMatch(/^tech:/);
        expect(TECHS[k.slice(5) as keyof typeof TECHS], `${id} ${k}`).toBeDefined();
      }
      const e = AGE_ART[id].emblem?.replace(/\s+/g, '');
      if (!e) continue;
      expect(seen.get(e), `${id} repeats ${seen.get(e)}`).toBeUndefined();
      seen.set(e, id);
    }
  });

  it('finds a drawn glyph for a button, the emblem of the age it leads to, or none', () => {
    expect(drawnGlyph('stone', undefined)).toBeNull();
    expect(drawnGlyph('stone', 'tech:nothing-here')).toBeNull();
    for (const id of ids) if (AGE_ART[id].emblem) expect(drawnGlyph('stone', `age:${id}`)).toContain('<svg');
  });
});
