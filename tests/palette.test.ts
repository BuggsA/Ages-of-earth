import { describe, expect, it } from 'vitest';
import { PLAYER_COLORS } from '../src/sim/data';

/** The team colours hold the art palette (docs/art.md): saturated, and far enough apart in hue to tell at a glance. */
function hsv(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0 };
}

describe('team colours', () => {
  it('are saturated', () => {
    for (const c of PLAYER_COLORS) expect(hsv(c).s, c).toBeGreaterThanOrEqual(0.55);
  });
  it('are 20° apart in hue', () => {
    for (let i = 0; i < PLAYER_COLORS.length; i++)
      for (let j = i + 1; j < PLAYER_COLORS.length; j++) {
        const d = Math.abs(hsv(PLAYER_COLORS[i]).h - hsv(PLAYER_COLORS[j]).h);
        expect(Math.min(d, 360 - d), `${PLAYER_COLORS[i]} ${PLAYER_COLORS[j]}`).toBeGreaterThanOrEqual(20);
      }
  });
});
