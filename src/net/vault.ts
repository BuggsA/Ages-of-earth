import { CODE_CHARS } from './protocol';

/**
 * Cloud saves: a match kept on the server under a vault key, so it can be carried on in another
 * browser or on another device. There are no accounts: the key is the only thing that opens a vault,
 * so it is long (16 letters, about 80 bits) and drawn from the room codes' unmistakable letters.
 */

export const VAULT_KEY_LENGTH = 16;
/** The largest save a vault keeps, in characters (a four-player large map is about 1 MB). */
export const MAX_CLOUD_SAVE = 6 * 1024 * 1024;
/** A vault nobody has opened or written for this long is emptied. */
export const VAULT_KEEP_DAYS = 180;

export function validVaultKey(key: string): boolean {
  if (key.length !== VAULT_KEY_LENGTH) return false;
  for (const ch of key) if (!CODE_CHARS.includes(ch)) return false;
  return true;
}

/** A key as typed by a person (any case, spaces or dashes) made plain, or null if it isn't one. */
export function readVaultKey(typed: string): string | null {
  const key = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return validVaultKey(key) ? key : null;
}

/** ABCD-EFGH-JKLM-NPQR: easier to read out and copy by hand. */
export function showVaultKey(key: string): string {
  return key.match(/.{1,4}/g)?.join('-') ?? key;
}
