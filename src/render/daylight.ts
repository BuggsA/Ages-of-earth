/**
 * The hours of the day: a match starts in the morning and the light drifts through noon, the golden
 * hour, sunset and a blue night, one whole day for every hour of play. It is drawn from the tick alone
 * (the seed picks the opening hour), so everyone in an online room, a save and a replay see the same
 * light, and the rules never know of it. Weather greys it afterwards (`weather.ts`).
 */

/** Seconds of play in one full day. */
export const DAY_SECONDS = 3600;

/** The hour (0–24) at a moment of play: opens between 07:30 and 10:30, by seed. */
export function hourAt(seed: number, seconds: number): number {
  const open = 7.5 + (Math.imul(seed | 0, 2654435761) >>> 0) % 4;
  return (open + (seconds / DAY_SECONDS) * 24) % 24;
}

/** The moon's phase for a match, from its seed: 0 is full, up to 0.9 a thin crescent. */
export function moonPhase(seed: number): number {
  return (((Math.imul(seed | 0, 2246822519) >>> 0) % 10) / 10) * 0.9 + 0;
}

/** One hour's light: colours as hex, strengths as multiples of a clear noon. */
interface Key {
  h: number;
  top: string;
  horizon: string;
  sunColor: string;
  /** Sun strength. */
  sun: number;
  /** Sky (hemisphere) strength. */
  sky: number;
  /** Ambient fill strength. */
  fill: number;
  /** 0 by day to 1 at night: the light comes from the moon, higher in the sky. */
  moon: number;
}

const KEYS: Key[] = [
  { h: 0, top: '#0c1a3c', horizon: '#1c2c54', sunColor: '#9db4ff', sun: 0.3, sky: 0.62, fill: 1.1, moon: 1 },
  { h: 5, top: '#16224a', horizon: '#3c3f69', sunColor: '#9db4ff', sun: 0.3, sky: 0.62, fill: 1.1, moon: 1 },
  { h: 6.5, top: '#6f8fc9', horizon: '#f2b48a', sunColor: '#ffb27a', sun: 0.95, sky: 0.9, fill: 1, moon: 0 },
  { h: 8, top: '#5aa7e0', horizon: '#cfe8f3', sunColor: '#fff3dc', sun: 1, sky: 1, fill: 1, moon: 0 },
  { h: 15, top: '#5aa7e0', horizon: '#cfe8f3', sunColor: '#fff3dc', sun: 1, sky: 1, fill: 1, moon: 0 },
  { h: 17.5, top: '#5b8fd0', horizon: '#f6c98b', sunColor: '#ffc27a', sun: 0.85, sky: 0.9, fill: 1, moon: 0 },
  { h: 19, top: '#54558f', horizon: '#f08a5d', sunColor: '#ff9a5a', sun: 0.6, sky: 0.7, fill: 1.05, moon: 0 },
  { h: 20.5, top: '#1e2a5a', horizon: '#6a4a7a', sunColor: '#a0a8ff', sun: 0.4, sky: 0.55, fill: 1.1, moon: 0.6 },
  { h: 22, top: '#0c1a3c', horizon: '#1c2c54', sunColor: '#9db4ff', sun: 0.3, sky: 0.62, fill: 1.1, moon: 1 },
  { h: 24, top: '#0c1a3c', horizon: '#1c2c54', sunColor: '#9db4ff', sun: 0.3, sky: 0.62, fill: 1.1, moon: 1 },
];

export interface Light {
  hour: number;
  top: string;
  horizon: string;
  sunColor: string;
  sun: number;
  sky: number;
  fill: number;
  /** 0 by day to 1 at night: the stars and the moon's disc show with it. */
  moon: number;
  /** Where the light comes from: a unit vector, +y up. */
  dir: [number, number, number];
}

function mixHex(a: string, b: string, k: number): string {
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i++) out += Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0');
  return out;
}

const smooth = (k: number) => k * k * (3 - 2 * k);

/** The light at an hour of the day. */
export function lightAt(hour: number): Light {
  const h = ((hour % 24) + 24) % 24;
  let i = 1;
  while (i < KEYS.length - 1 && KEYS[i].h <= h) i++;
  const a = KEYS[i - 1];
  const b = KEYS[i];
  const k = smooth((h - a.h) / (b.h - a.h));
  const num = (x: number, y: number) => x + (y - x) * k;
  // The sun's road over the sky, kept going all night so the light never jumps: it climbs from the
  // east at 06:00, sinks into the west at 18:00 and, below the horizon, a low moon takes its place.
  const t = (h - 6) / 12;
  const up = Math.max(0, Math.sin(Math.PI * t));
  const moon = num(a.moon, b.moon);
  const x = -Math.cos(Math.PI * t);
  const y = 0.24 + 0.46 * up + 0.2 * moon;
  const z = 0.36;
  const len = Math.sqrt(x * x + y * y + z * z);
  return {
    hour: h,
    top: mixHex(a.top, b.top, k),
    horizon: mixHex(a.horizon, b.horizon, k),
    sunColor: mixHex(a.sunColor, b.sunColor, k),
    sun: num(a.sun, b.sun),
    sky: num(a.sky, b.sky),
    fill: num(a.fill, b.fill),
    moon,
    dir: [x / len, y / len, z / len],
  };
}

/** The time on a clock, for a tooltip: "08:30". */
export function clockWords(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `?hour=19.5` in the address holds the clock still at an hour, for trying the light out. */
export function forcedHour(): number | null {
  if (typeof location === 'undefined') return null;
  const h = parseFloat(new URLSearchParams(location.search).get('hour') ?? '');
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : null;
}
