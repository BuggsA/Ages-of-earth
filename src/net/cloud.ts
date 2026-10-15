import { MAX_CLOUD_SAVE, MAX_SAVE_TITLE, newVaultKey, normalizeVaultKey, type CloudSlot } from './vault';

/** The browser's side of cloud saves (#290): this browser's save key and the calls to its vault. */

const KEY_STORE = 'ages-vault-key';

/** This browser's save key, made on first use. */
export function vaultKey(): string {
  try {
    const kept = normalizeVaultKey(localStorage.getItem(KEY_STORE) ?? '');
    if (kept) return kept;
    const key = newVaultKey();
    localStorage.setItem(KEY_STORE, key);
    return key;
  } catch {
    // Storage blocked: a key for this page only.
    return ((globalThis as unknown as { __vaultKey?: string }).__vaultKey ??= newVaultKey());
  }
}

/** Switch to another key (one copied from another device). False if it isn't a key. */
export function useVaultKey(text: string): boolean {
  const key = normalizeVaultKey(text);
  if (!key) return false;
  try {
    localStorage.setItem(KEY_STORE, key);
  } catch {
    (globalThis as unknown as { __vaultKey?: string }).__vaultKey = key;
  }
  return true;
}

async function gzip(text: string): Promise<ArrayBuffer> {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}

async function gunzip(bytes: ArrayBuffer): Promise<string> {
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

async function ask(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`/api/vault/${path}`, { cache: 'no-store', ...init });
  } catch {
    throw new Error('The server could not be reached.');
  }
  if (!res.ok) {
    let why = '';
    try {
      why = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* Not ours: a dev server or a preview without vaults. */
    }
    throw new Error(why || 'Cloud saves are not available here.');
  }
  return res;
}

export async function listCloud(key: string): Promise<(CloudSlot | null)[]> {
  const { slots } = (await (await ask(key)).json()) as { slots: (CloudSlot | null)[] };
  return slots;
}

export async function saveCloud(key: string, slot: number, title: string, text: string): Promise<void> {
  const body = await gzip(text);
  if (body.byteLength > MAX_CLOUD_SAVE) throw new Error('This match is too large to keep in the cloud.');
  await ask(`${key}/${slot}`, { method: 'PUT', body, headers: { 'content-type': 'application/octet-stream', 'x-save-title': encodeURIComponent(title.slice(0, MAX_SAVE_TITLE)) } });
}

export async function loadCloud(key: string, slot: number): Promise<string> {
  return gunzip(await (await ask(`${key}/${slot}`)).arrayBuffer());
}

export async function deleteCloud(key: string, slot: number): Promise<void> {
  await ask(`${key}/${slot}`, { method: 'DELETE' });
}
