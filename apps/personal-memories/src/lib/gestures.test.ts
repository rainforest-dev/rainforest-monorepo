import { describe, expect, it } from 'vitest';

import {
  distance,
  isZoomOutPinch,
  movedBeyond,
  pinchRatio,
} from './gestures.ts';

describe('gestures', () => {
  it('cancels a long press once the finger moves more than 10 px', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(false);
    expect(movedBeyond({ x: 0, y: 0 }, { x: 8, y: 8 })).toBe(true);
  });

  it('zooms out when two fingers close to 75 % of their distance or less', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(isZoomOutPinch(pinchRatio(200, 150))).toBe(true);
    expect(isZoomOutPinch(pinchRatio(200, 170))).toBe(false);
    expect(isZoomOutPinch(pinchRatio(200, 260))).toBe(false);
    expect(pinchRatio(0, 50)).toBe(1);
  });
});
