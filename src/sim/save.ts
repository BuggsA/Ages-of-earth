import type { GameState } from './types';

/**
 * A match written to text and read back: typed arrays become base64, the id lookup is rebuilt. Caches
 * that live beside the state (distance fields, the unit grid, worked-out stats) are made afresh on
 * the first tick after loading.
 */

const TYPED = { Uint8Array, Int8Array, Int32Array, Float32Array } as const;
type TypedName = keyof typeof TYPED;

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s, (key, value) => {
    if (key === 'byId' || key === 'events') return undefined;
    for (const name of Object.keys(TYPED) as TypedName[]) {
      if (value instanceof TYPED[name]) {
        const v = value as InstanceType<(typeof TYPED)[TypedName]>;
        return { $typed: name, b64: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
      }
    }
    return value;
  });
}

export function deserialize(text: string): GameState {
  const s = JSON.parse(text, (_key, value) => {
    if (value && typeof value === 'object' && typeof value.$typed === 'string' && value.$typed in TYPED) {
      const bytes = fromB64(value.b64);
      const Ctor = TYPED[value.$typed as TypedName];
      return new Ctor(bytes.buffer as ArrayBuffer, 0, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
    }
    return value;
  }) as GameState;
  s.byId = new Map(s.ents.map((e) => [e.id, e]));
  s.events = [];
  return s;
}
