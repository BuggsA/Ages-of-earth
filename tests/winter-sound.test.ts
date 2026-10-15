import { describe, expect, it } from 'vitest';
import { voiceFits, type CreatureVoice } from '../src/render/ambience';

describe('the winter hush', () => {
  it('silences crickets, songbirds and frogs in winter, but not gulls', () => {
    const voices: [CreatureVoice, boolean][] = [['cricket', false], ['birdsong', false], ['frog', true], ['gull', true]];
    for (const [voice, water] of voices) {
      expect(voiceFits(voice, water, false, 3), voice).toBe(voice === 'gull');
      expect(voiceFits(voice, water, false, 1), `${voice} in summer`).toBe(true);
    }
  });
});
