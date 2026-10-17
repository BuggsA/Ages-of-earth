import { describe, expect, it } from 'vitest';
import { AGES, CIVS, HOMELANDS, TRUNK, VERB_GAPS, WAYS } from '../src/sim/data';
import type { AgeId, CivId } from '../src/sim/types';

// The verbs rubric (docs/verbs.md, #506): every branch says what the player now does and what it shuts.
interface Stated { verb?: string; door?: string }

const says = (what: string, e: Stated) => {
  expect(e.verb?.trim(), `${what} needs a verb`).toBeTruthy();
  expect(e.door?.trim(), `${what} needs a door`).toBeTruthy();
  // "After taking it, I now ___": a verb, never a number.
  expect(e.verb, `${what}'s verb is a number`).not.toMatch(/[0-9%]/);
};

describe('the verbs rubric in the data', () => {
  it('every side age states its verb and door, unless it is a known gap', () => {
    for (const id of Object.keys(AGES) as AgeId[]) {
      if (TRUNK.includes(id)) continue;
      if (VERB_GAPS.ages[id]) expect(AGES[id].verb, `${id} has a verb now: strike it from VERB_GAPS`).toBeUndefined();
      else says(id, AGES[id]);
    }
  });

  it('every Way and homeland states its verb and door', () => {
    for (const [id, w] of Object.entries(WAYS)) says(id, w);
    for (const [id, h] of Object.entries(HOMELANDS)) says(id, h);
  });

  it('every people states its verb and door, unless it is a known gap', () => {
    for (const id of Object.keys(CIVS) as CivId[]) {
      if (VERB_GAPS.civs[id]) expect(CIVS[id].verb, `${id} has a verb now: strike it from VERB_GAPS`).toBeUndefined();
      else says(id, CIVS[id]);
    }
  });
});
