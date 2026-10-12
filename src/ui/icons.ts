import type { Cost, Res } from '../sim/types';
import { RES } from '../sim/types';

/** Small drawn icons for the resources and population, as inline SVG. */

const ICONS: Record<Res | 'pop', string> = {
  food: '<svg viewBox="0 0 24 24" width="SIZE" height="SIZE"><path d="M12 21c-5 0-8-3-8-7 0-3 2-6 5-6 1.2 0 2.2.4 3 1 .8-.6 1.8-1 3-1 3 0 5 3 5 6 0 4-3 7-8 7z" fill="#e86f4f" stroke="#7a2a1a" stroke-width="1.2"/><path d="M12 9c0-3 1-5 3-6" stroke="#4f8a35" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="9" cy="12" rx="1.6" ry="2.4" fill="#ffb8a0" opacity=".7"/></svg>',
  wood: '<svg viewBox="0 0 24 24" width="SIZE" height="SIZE"><rect x="3" y="7" width="18" height="6" rx="3" fill="#b8834e" stroke="#5a3a1e" stroke-width="1.2"/><rect x="3" y="13" width="18" height="6" rx="3" fill="#a87442" stroke="#5a3a1e" stroke-width="1.2"/><ellipse cx="19" cy="10" rx="2" ry="3" fill="#e8c898" stroke="#5a3a1e"/><ellipse cx="19" cy="16" rx="2" ry="3" fill="#e8c898" stroke="#5a3a1e"/></svg>',
  stone: '<svg viewBox="0 0 24 24" width="SIZE" height="SIZE"><path d="M4 17l3-8 6-3 6 4 1 7-5 3H8z" fill="#b9b4aa" stroke="#4a4740" stroke-width="1.2"/><path d="M7 9l5 3 7-2M12 12l-1 8" stroke="#8a857c" stroke-width="1" fill="none"/></svg>',
  gold: '<svg viewBox="0 0 24 24" width="SIZE" height="SIZE"><ellipse cx="12" cy="16" rx="8" ry="3.5" fill="#c8961e" stroke="#5a4108" stroke-width="1.2"/><ellipse cx="12" cy="13" rx="8" ry="3.5" fill="#f2c440" stroke="#5a4108" stroke-width="1.2"/><ellipse cx="12" cy="10" rx="8" ry="3.5" fill="#ffd96a" stroke="#5a4108" stroke-width="1.2"/></svg>',
  pop: '<svg viewBox="0 0 24 24" width="SIZE" height="SIZE"><circle cx="9" cy="8" r="3.2" fill="#e8dfc6"/><path d="M3 20c0-4 2.7-7 6-7s6 3 6 7z" fill="#e8dfc6"/><circle cx="16.5" cy="9" r="2.6" fill="#b9ae95"/><path d="M13 20c.3-3.5 1.6-6 3.5-6S21 16.5 21 20z" fill="#b9ae95"/></svg>',
};

export function icon(name: Res | 'pop', size = 18): string {
  return ICONS[name].replace(/SIZE/g, String(size));
}

/** A cost as icons and numbers; parts the player can't pay are marked short. */
export function costHtml(cost: Cost, have?: Record<Res, number>): string {
  return RES.filter((r) => cost[r])
    .map((r) => `<span class="${have && have[r] < (cost[r] ?? 0) ? 'short' : ''}">${icon(r, 15)}${cost[r]}</span>`)
    .join('');
}
