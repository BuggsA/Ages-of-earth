import { vi } from 'vitest';

// Map generation is a pure function of its arguments and the slowest part of most tests' setup: dozens
// of files build the same few worlds (seed 7, small, two players) once per test. Remember each world the
// first time and hand every caller its own deep copy, so a test that digs, builds or floods can never
// change the world another test is given. Saves and replays are untouched: only `generateMap` is wrapped.
vi.mock('../../src/sim/mapgen', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/sim/mapgen')>();
  const cache = new Map<string, ReturnType<typeof real.generateMap>>();
  return {
    ...real,
    generateMap: (...args: Parameters<typeof real.generateMap>) => {
      const key = JSON.stringify(args);
      let map = cache.get(key);
      if (!map) cache.set(key, (map = real.generateMap(...args)));
      return structuredClone(map);
    },
  };
});
