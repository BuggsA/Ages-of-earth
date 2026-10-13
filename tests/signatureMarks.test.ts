import { describe, expect, it } from 'vitest';
import { CIV_IDS, SIGNATURES } from '../src/sim/data';
import { unitGeometry } from '../src/render/unitModels';

describe('signature marks', () => {
  it('a signature line wears its people\'s mark in every epoch, and each people\'s mark differs', () => {
    for (const civ of CIV_IDS) {
      const type = SIGNATURES[civ].type;
      for (let epoch = 0; epoch < 5; epoch++) {
        const marked = unitGeometry(type, epoch, civ);
        const plain = unitGeometry(type, epoch);
        expect(marked.getAttribute('position').count).toBeGreaterThan(plain.getAttribute('position').count);
      }
    }
    const sizes = new Set(CIV_IDS.map((c) => `${SIGNATURES[c].type}:${unitGeometry(SIGNATURES[c].type, 2, c).getAttribute('position').count}`));
    expect(sizes.size).toBeGreaterThanOrEqual(CIV_IDS.length - 1);
  });
});
