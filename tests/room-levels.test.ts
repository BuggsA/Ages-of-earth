import { describe, expect, it, vi } from 'vitest';
import { AI_LEVELS } from '../src/sim/data';

const lists = await vi.importActual<{ ROOM_LEVELS: string[] }>('../worker/lists');

describe('the levels a room accepts (#256)', () => {
  it('are exactly the game\'s four, so the gentlest Easy is offered online too', () => {
    expect([...lists.ROOM_LEVELS].sort()).toEqual(Object.keys(AI_LEVELS).sort());
    expect(lists.ROOM_LEVELS[0]).toBe('gentle');
    expect(AI_LEVELS.gentle.label).toBe('Easy');
  });
});
