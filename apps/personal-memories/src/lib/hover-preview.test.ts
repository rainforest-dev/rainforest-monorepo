import { describe, expect, it } from 'vitest';

import { movedBeyond } from './gestures.ts';
import {
  placePreview,
  PREVIEW_HIDE_MS,
  PREVIEW_MOVE_PX,
  showDelay,
} from './hover-preview.ts';

describe('showDelay', () => {
  it('waits 300 ms for a first hover and shows at once while moving between cells', () => {
    expect(showDelay(false)).toBe(300);
    expect(showDelay(true)).toBe(0);
    expect(PREVIEW_HIDE_MS).toBe(80);
  });
});

describe('long press tolerance', () => {
  it('cancels once the finger moves more than 8 px', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 5, y: 6 }, PREVIEW_MOVE_PX)).toBe(
      false,
    );
    expect(movedBeyond({ x: 0, y: 0 }, { x: 6, y: 6 }, PREVIEW_MOVE_PX)).toBe(
      true,
    );
  });
});

describe('placePreview', () => {
  const viewport = { width: 390, height: 844 };
  const size = { width: 224, height: 120 };
  const cell = (top: number, left: number, height = 24) => ({
    top,
    left,
    width: 24,
    height,
  });

  it('centres the preview above the cell with an 8 px gap', () => {
    expect(placePreview(cell(400, 150), size, viewport)).toEqual({
      top: 272,
      left: 50,
    });
  });

  it('drops below the cell when there is no room above', () => {
    expect(placePreview(cell(60, 150), size, viewport).top).toBe(92);
  });

  it('keeps 8 px inside the viewport at every edge', () => {
    expect(placePreview(cell(400, 0), size, viewport).left).toBe(8);
    expect(placePreview(cell(400, 380), size, viewport).left).toBe(158);
    expect(placePreview(cell(830, 150), size, viewport).top).toBe(702);
    expect(
      placePreview(cell(800, 150, 60), { width: 224, height: 900 }, viewport)
        .top,
    ).toBe(8);
  });
});
