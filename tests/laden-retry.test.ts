import { describe, expect, it } from 'vitest';
import { audit } from '../scripts/idle-audit';

/**
 * A person's citizen jammed on the way home with a full basket keeps its load and tries again (#344). Before, it
 * gave up after a few failed tries and stood idle until ordered: 10 and 15 such citizens in these two 12-minute matches.
 */
describe('a laden citizen does not give up on the road home (#344)', () => {
  for (const seed of [1, 4]) {
    it(`seed ${seed}: at most two are left idle with a load`, () => {
      expect(audit(seed, 12, 'medium').laden).toBeLessThanOrEqual(2);
    });
  }
});
