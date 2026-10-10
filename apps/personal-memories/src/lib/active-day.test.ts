import { describe, expect, it } from 'vitest';

import { activeDayAt } from './active-day.ts';

const H = 1000;
const days = (...tops: [string, number][]) =>
  tops.map(([date, top]) => ({ date, top }));

describe('activeDayAt', () => {
  it('has no day without sections', () => {
    expect(activeDayAt([], H, 0)).toBeUndefined();
  });

  it('takes the last day above 40% of the viewport mid-page', () => {
    const view = days(['a', -800], ['b', 300], ['c', 900]);
    expect(activeDayAt(view, H, 5000)).toBe('b');
  });

  it('falls back to the first day when none has reached the line', () => {
    expect(activeDayAt(days(['a', 500], ['b', 1200]), H, 5000)).toBe('a');
  });

  it('takes the last day at the very bottom', () => {
    const view = days(['a', -200], ['b', 600], ['c', 950]);
    expect(activeDayAt(view, H, 0)).toBe('c');
  });

  it('gives a short day before the last its turn on the way to the bottom', () => {
    const view = days(['a', -300], ['b', 450], ['c', 850]);
    expect(activeDayAt(view, H, 200)).toBe('b');
  });
});
