import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `AGENTS.md` §4: the rules never touch rendering, so they run headless (tests, `scripts/sim.ts`,
 * the Worker's checks); and they are deterministic, so online play, saves and replays agree.
 * `tests/sim.test.ts` bans the floating-point functions; this guards the rest of the boundary.
 */
const dir = join(__dirname, '../src/sim');
const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
const code = (f: string) => readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('the rules stand alone', () => {
  it('import only each other: no renderer, UI, sound, Three.js or any package', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      for (const m of code(f).matchAll(/^\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/gm)) {
        expect(m[1] ?? m[2], `${f} imports ${m[1] ?? m[2]}`).toMatch(/^\.\/[\w-]+$/);
      }
    }
  });

  it('read no clock, timer, browser global or machine-dependent randomness', () => {
    const banned = ['new Date', 'Date(', 'crypto', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'localStorage', 'window.', 'document.', 'navigator.', 'Math.cbrt', 'Math.sinh', 'Math.cosh', 'Math.tanh', 'Math.expm1', 'Math.log1p'];
    for (const f of files) {
      const c = code(f);
      for (const bad of banned) expect(c.includes(bad), `${f} uses ${bad}`).toBe(false);
    }
  });
});
