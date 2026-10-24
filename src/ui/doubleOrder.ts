/**
 * Double-click as a second right-click. A left click remembers which of your units were selected before it; a second click
 * soon after, on the same spot, gives those units the right-click order there. A double-click on one of your own units still
 * picks every unit of its kind on screen, so that case is left to the click itself.
 */
export const DOUBLE_ORDER = { ms: 350, px: 8 };

export interface Tap {
  at: number;
  x: number;
  y: number;
  /** Your units (or building) selected before this click. */
  before: number[];
}

export const NO_TAP: Tap = { at: -Infinity, x: 0, y: 0, before: [] };

/** The units a second click orders, or null when it is a plain click: too late, too far, nothing was selected, or your own unit. */
export function doubleOrder(prev: Tap, at: number, x: number, y: number, onOwnUnit: boolean): number[] | null {
  if (onOwnUnit || !prev.before.length) return null;
  if (at - prev.at >= DOUBLE_ORDER.ms) return null;
  if (Math.hypot(x - prev.x, y - prev.y) > DOUBLE_ORDER.px) return null;
  return prev.before;
}
