/** Local camera bookmarks: views only, never commands, saves, or lockstep state. */
export interface CameraPoint { x: number; z: number }

export type BookmarkShortcut = { action: 'save' | 'recall'; slot: number };

/**
 * Physical digit codes survive Shift changing 1–4 into !@#$.
 * Ordinary 1–9 still belong to control groups; Ctrl+1–9 still assign them.
 */
export function bookmarkShortcut(
  e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): BookmarkShortcut | null {
  if (!e.shiftKey || e.metaKey || e.altKey) return null;
  const m = /^Digit([1-4])$/.exec(e.code);
  if (!m) return null;
  return { action: e.ctrlKey ? 'save' : 'recall', slot: Number(m[1]) };
}

/** Four slots, reset for each new match; copies prevent callers from moving saved views. */
export class CameraBookmarks {
  private readonly slots = new Map<number, CameraPoint>();

  save(slot: number, point: CameraPoint): void {
    if (slot < 1 || slot > 4) return;
    this.slots.set(slot, { x: point.x, z: point.z });
  }

  recall(slot: number): CameraPoint | undefined {
    const point = this.slots.get(slot);
    return point ? { ...point } : undefined;
  }

  reset(): void {
    this.slots.clear();
  }
}
