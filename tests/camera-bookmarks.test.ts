import { describe, expect, it } from 'vitest';
import { CameraBookmarks, bookmarkShortcut } from '../src/ui/cameraBookmarks';

function key(code: string, ctrlKey = false, shiftKey = true) {
  return { code, ctrlKey, shiftKey, metaKey: false, altKey: false };
}

describe('camera bookmarks', () => {
  it('uses Shift with the physical 1–4 keys, leaving control groups alone', () => {
    expect(bookmarkShortcut(key('Digit1'))).toEqual({ action: 'recall', slot: 1 });
    expect(bookmarkShortcut(key('Digit4', true))).toEqual({ action: 'save', slot: 4 });
    expect(bookmarkShortcut(key('Digit2', false, false))).toBeNull();
    expect(bookmarkShortcut(key('Digit2', true, false))).toBeNull();
    expect(bookmarkShortcut(key('Digit5'))).toBeNull();
    expect(bookmarkShortcut(key('Numpad1'))).toBeNull();
    expect(bookmarkShortcut({ ...key('Digit1'), metaKey: true })).toBeNull();
    expect(bookmarkShortcut({ ...key('Digit1'), altKey: true })).toBeNull();
  });

  it('overwrites a slot without altering other views, and resets between matches', () => {
    const marks = new CameraBookmarks();
    expect(marks.recall(1)).toBeUndefined();
    marks.save(1, { x: 12, z: 22 });
    marks.save(2, { x: 38, z: 44 });
    marks.save(1, { x: 17, z: 28 });
    expect(marks.recall(1)).toEqual({ x: 17, z: 28 });
    expect(marks.recall(2)).toEqual({ x: 38, z: 44 });
    marks.reset();
    expect(marks.recall(1)).toBeUndefined();
    expect(marks.recall(2)).toBeUndefined();
  });

  it('stores independent copies instead of references to the live camera', () => {
    const marks = new CameraBookmarks();
    const point = { x: 5, z: 6 };
    marks.save(1, point);
    point.x = 99;
    expect(marks.recall(1)).toEqual({ x: 5, z: 6 });
    const recalled = marks.recall(1)!;
    recalled.z = 99;
    expect(marks.recall(1)).toEqual({ x: 5, z: 6 });
    marks.save(5, point);
    expect(marks.recall(5)).toBeUndefined();
  });
});
