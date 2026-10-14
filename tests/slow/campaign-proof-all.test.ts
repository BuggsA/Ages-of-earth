import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../src/sim/campaign';

/** Every chapter is in one of the proof files, so a new chapter can't slip past it. */
const IN_PROOF = ['first-fires', 'river-of-kings', 'the-wall', 'iron-and-gold', 'sea-lords', 'wings'];

describe('the campaign proof', () => {
  it('covers every chapter', () => {
    expect(SCENARIOS.map((c) => c.id).sort()).toEqual([...IN_PROOF].sort());
  });
});
