import { CODE_CHARS } from './protocol';

/**
 * Cloud saves (#290). A player's saves live on the server in a vault: one Durable Object per save key.
 * The save key is a 20-letter secret the browser makes the first time (100 bits drawn from the room
 * codes' unmistakable letters), so there are no accounts and no passwords: whoever knows the key can
 * open the vault, and copying it to another device carries the saves there.
 *
 *   GET    /api/vault/KEY        the slots: [{ at, title, bytes } | null, …]
 *   PUT    /api/vault/KEY/N      store slot N (gzipped save text; the title in the x-save-title header)
 *   GET    /api/vault/KEY/N      read slot N back (gzipped)
 *   DELETE /api/vault/KEY/N      empty slot N
 *   GET    /api/vault/KEY/progress   the campaign's best stars: { chapterId: 0–3, … }
 *   PUT    /api/vault/KEY/progress   merge stars in (the best of old and new wins; stars never go down)
 *
 * The Worker checks the key's shape, the slot and the size before any vault is touched.
 */

export const VAULT_KEY_LENGTH = 20;
export const VAULT_SLOTS = 3;
/** Largest stored save, gzipped. A large four-player match at 25 minutes is about 150 KB. */
export const MAX_CLOUD_SAVE = 1_500_000;
export const MAX_SAVE_TITLE = 80;
/** A vault nobody has opened or saved to for this long is emptied, so forgotten keys don't keep data forever. */
export const VAULT_KEEP_DAYS = 365;

export interface CloudSlot {
  /** When it was saved (ms since 1970, the server's clock). */
  at: number;
  title: string;
  bytes: number;
}

export function validVaultKey(key: string): boolean {
  if (key.length !== VAULT_KEY_LENGTH) return false;
  for (const ch of key) if (!CODE_CHARS.includes(ch)) return false;
  return true;
}

/** A key as typed or pasted (any case, dashes, spaces) to its plain form; '' if it isn't one. */
export function normalizeVaultKey(text: string): string {
  const key = text.toUpperCase().replace(/[\s-]/g, '');
  return validVaultKey(key) ? key : '';
}

/** ABCD-EFGH-JKLM-NPQR-STUV: easier to read out and copy by hand. */
export function formatVaultKey(key: string): string {
  return key.match(/.{1,4}/g)?.join('-') ?? key;
}

export function newVaultKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(VAULT_KEY_LENGTH));
  // 256 is a multiple of the 32 letters, so every letter is equally likely.
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export function validSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= VAULT_SLOTS;
}

/** Most chapters a stored progress may name, and the longest chapter id. */
export const MAX_PROGRESS_CHAPTERS = 32;
/** Largest progress body, in bytes. */
export const MAX_PROGRESS_BODY = 4096;
const CHAPTER_ID = /^[a-z0-9_-]{1,40}$/;

/** Campaign progress (chapter id → best stars) cleaned of anything that isn't one: unknown shapes become {}. */
export function cleanProgress(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, n] of Object.entries(raw)) {
    if (Object.keys(out).length >= MAX_PROGRESS_CHAPTERS) break;
    if (CHAPTER_ID.test(id) && typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 3) out[id] = n;
  }
  return out;
}

/** The best of two progresses, chapter by chapter. */
export function mergeProgress(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = cleanProgress(a);
  for (const [id, n] of Object.entries(cleanProgress(b))) if (n > (out[id] ?? 0)) out[id] = n;
  return out;
}
