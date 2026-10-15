import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/data';
import { claimWork } from '../src/sim/landmarks';
import { createGame, step } from '../src/sim/game';
import type { GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer holds what it keeps: it sends soldiers to a landmark of its own that rivals are pulling down. */

const game = (): GameState =>
  createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });

describe('the computer defends its landmarks', () => {
  it('sends its idle soldiers to a landmark of its own that a rival stands on alone', () => {
    const s = game();
    const ai = s.players[1];
    const m = s.landmarks![0];
    m.owner = ai.id;
    m.by = ai.id;
    m.claim = claimWork();
    // A rival raider sits on it; the computer has a band of soldiers at home.
    spawnUnit(s, 0, 'citizen', m.x + 0.5, m.y + 0.5);
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === ai.id)!;
    const band: Unit[] = [];
    for (let i = 0; i < 4; i++) band.push(spawnUnit(s, ai.id, 'infantry', home.x + 2 + i * 0.4, home.y + 3));
    for (let i = 0; i < 12 * TICK_HZ; i++) step(s);
    const gone = band.filter((u) => u.hp > 0 && (u.order.k === 'move' || u.order.k === 'attack') && Math.hypot(u.x - home.x, u.y - home.y) > 3);
    expect(gone.length).toBeGreaterThanOrEqual(3);
  }, 30000);
});

describe('the computer favours its own people\'s landmark kind', () => {
  it('sends its walker to its kin kind when another is a little nearer', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a, b] = s.landmarks!;
    a.kind = 'crag';
    b.kind = 'spring';
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 20; a.y = home.y;
    b.x = home.x + 26; b.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markWalker; i++) step(s);
    expect(s.ai[1]?.markWalker?.id).toBe(b.id);
  }, 30000);
});

describe('the computer recalls a lone walker', () => {
  it('turns its walker home when rival soldiers appear beside it on the road', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 30; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markWalker; i++) step(s);
    const w = s.ai[1]!.markWalker!;
    expect(w).toBeTruthy();
    const u = s.byId.get(w.unit) as Unit;
    // A rival soldier appears next to the walker, far from the landmark.
    const foe = spawnUnit(s, 0, 'infantry', u.x + 3, u.y);
    s.players[1].vis[Math.floor(foe.y) * s.w + Math.floor(foe.x)] = 1;
    for (let i = 0; i < 2 * TICK_HZ; i++) step(s);
    expect(s.ai[1]?.markWalker?.unit).not.toBe(u.id);
  }, 30000);
});

describe('the computer escorts its walker', () => {
  it('sends soldiers along to a far landmark', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 32; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    const band: Unit[] = [];
    for (let i = 0; i < 5; i++) band.push(spawnUnit(s, 1, 'infantry', home.x + 2 + i * 0.4, home.y + 3));
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markEscort; i++) step(s);
    expect(s.ai[1]?.markWalker).toBeTruthy();
    expect(s.ai[1]?.markEscort?.ids.length).toBe(2);
    for (let i = 0; i < 6 * TICK_HZ; i++) step(s);
    expect(band.filter((u) => Math.hypot(u.x - home.x, u.y - home.y) > 5).length).toBeGreaterThanOrEqual(2);
  }, 30000);
  it('lingers by the landmark for a while once it is won', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 32; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 5; i++) spawnUnit(s, 1, 'infantry', home.x + 2 + i * 0.4, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markEscort; i++) step(s);
    const e = s.ai[1]!.markEscort!;
    const target = s.landmarks!.find((m) => m.id === e.mark)!;
    // The claim is won: the walk ends, but the escort stays held for a while.
    target.owner = 1; target.by = 1; target.claim = claimWork();
    for (let i = 0; i < 3 * TICK_HZ; i++) step(s);
    expect(s.ai[1]?.markEscort?.until).toBeGreaterThan(s.tick);
    for (let i = 0; i < 25 * TICK_HZ; i++) step(s);
    // (A new walk to another landmark may start its own escort by then.)
    const later = s.ai[1]?.markEscort;
    expect(later?.mark === target.id && later.until).toBeFalsy();
  }, 60000);
  it('halts the walker while its escort trails far behind, and goes on once they close up', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x - 34; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 5; i++) spawnUnit(s, 1, 'infantry', home.x + 2 + i * 0.4, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markEscort; i++) step(s);
    const e = s.ai[1]!.markEscort!;
    const walker = s.byId.get(s.ai[1]!.markWalker!.unit) as Unit;
    const keep = (): void => { for (const id of e.ids) { const u = s.byId.get(id) as Unit; u.x = home.x; u.y = home.y + 3; u.order = { k: 'idle' }; } };
    // The escort is held at home, so the walker stops after about the lead.
    for (let i = 0; i < 10 * TICK_HZ; i++) { keep(); step(s); }
    expect(walker.order.k).toBe('idle');
    const stopped = walker.x;
    expect(home.x - stopped).toBeLessThan(22);
    for (let i = 0; i < 2 * TICK_HZ; i++) { keep(); step(s); }
    expect(walker.x).toBe(stopped);
    // The escort closes up: the walker sets out again.
    for (const id of e.ids) { const u = s.byId.get(id) as Unit; u.x = walker.x + 1; u.y = walker.y; }
    for (let i = 0; i < 3 * TICK_HZ; i++) { step(s); }
    expect(walker.x).toBeLessThan(stopped - 1);
  }, 60000);
  it('sends a fresh escort when the first one has fallen', () => {
    const s = game();
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1)!;
    const [a] = s.landmarks!;
    for (const m of s.landmarks!) { m.owner = -1; m.by = -1; m.claim = 0; }
    a.x = home.x + 32; a.y = home.y;
    for (let i = 0; i < 10; i++) spawnUnit(s, 1, 'citizen', home.x + 3 + i * 0.5, home.y + 3);
    for (let i = 0; i < 8; i++) spawnUnit(s, 1, 'infantry', home.x + 2 + i * 0.4, home.y + 3);
    for (let i = 0; i < 15 * TICK_HZ && !s.ai[1]?.markEscort; i++) step(s);
    const first = [...s.ai[1]!.markEscort!.ids];
    for (const id of first) (s.byId.get(id) as Unit).hp = 0;
    // The rest of the army waits idle at home.
    for (let i = 0; i < 3 * TICK_HZ; i++) {
      for (const u of s.ents) if (u.kind === 'unit' && u.owner === 1 && u.type === 'infantry' && u.hp > 0) { u.order = { k: 'idle' }; u.x = home.x + 2; u.y = home.y + 3; }
      step(s);
    }
    const next = s.ai[1]?.markEscort;
    expect(next?.ids.length).toBe(2);
    expect(next!.ids.some((id) => first.includes(id))).toBe(false);
  }, 60000);
});
