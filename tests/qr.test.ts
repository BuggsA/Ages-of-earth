import { describe, expect, it } from 'vitest';
import { qrSvg } from '../src/ui/qr';

describe('qrSvg', () => {
  it('draws a scannable-size square for a save-key link', () => {
    const svg = qrSvg('https://example.com/#vault=ABCDEFGHJKLMNPQRSTUV');
    expect(svg.startsWith('<svg')).toBe(true);
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
    expect(box[1]).toBe(box[2]);
    expect(Number(box[1])).toBeGreaterThanOrEqual(21 + 8);
    expect(svg).toContain('<path');
  });
  it('is the same every time', () => {
    expect(qrSvg('abc')).toBe(qrSvg('abc'));
  });
});
