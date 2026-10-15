import { readVaultKey } from './vault';

/**
 * The browser's side of cloud saves: the vault key this browser uses (kept in local storage, made on
 * the first cloud save), and sending a save up to its vault or fetching it back.
 */

const KEY = 'ages-vault';

/** This browser's vault key, or null if it has never saved to the cloud. */
export function vaultKey(): string | null {
  try {
    return readVaultKey(localStorage.getItem(KEY) ?? '');
  } catch {
    return null;
  }
}

/** Use this key from now on (one typed in from another device, or a fresh one). */
export function setVaultKey(key: string): void {
  try {
    localStorage.setItem(KEY, key);
  } catch {
    /* Not remembered past this page; the save still goes up. */
  }
}

async function freshKey(): Promise<string> {
  const res = await fetch('/api/vaults', { method: 'POST' });
  if (!res.ok) throw new Error(`The server said ${res.status}`);
  const body = (await res.json()) as { key: string };
  const key = readVaultKey(body.key ?? '');
  if (!key) throw new Error('The server sent no key');
  setVaultKey(key);
  return key;
}

/** Send a save (the same text the browser keeps) to this browser's vault, making one if needed. */
export async function cloudPut(save: string): Promise<{ key: string; at: number }> {
  const key = vaultKey() ?? (await freshKey());
  const res = await fetch(`/api/vaults/${key}`, { method: 'PUT', body: save, headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(res.status === 413 ? 'This match is too big for a cloud save' : `The server said ${res.status}`);
  const body = (await res.json()) as { at: number };
  return { key, at: body.at };
}

/** The save kept under a key, or null if there is none. */
export async function cloudGet(key: string): Promise<string | null> {
  const res = await fetch(`/api/vaults/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`The server said ${res.status}`);
  return res.text();
}
