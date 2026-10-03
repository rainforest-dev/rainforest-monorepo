import { describe, expect, it } from 'vitest';

import type { Source, StaleType, Topic } from '@/lib/registry.types';

import {
  canActivate,
  canActivateTopic,
  canDeclineTopic,
  canResubscribe,
  canRetire,
} from './actions.js';

const STATUSES: Source['status'][] = [
  'active',
  'proposed',
  'no-rss',
  'retired',
];
const STALE: (StaleType | undefined)[] = [
  undefined,
  'feed-dead',
  'delivery-gap',
  'low-value',
  'unspecified',
];

const cases = STATUSES.flatMap((status) =>
  STALE.map((type) => ({
    status,
    type,
    source: {
      status,
      stale: type ? { type, note: '' } : undefined,
    } satisfies Pick<Source, 'status' | 'stale'>,
  })),
);

describe('source rules', () => {
  it.each(cases)('activate: $status, stale $type', ({ status, source }) => {
    expect(canActivate(source)).toBe(
      status === 'proposed' || status === 'retired',
    );
  });

  it.each(cases)('retire: $status, stale $type', ({ status, type, source }) => {
    expect(canRetire(source)).toBe(
      status !== 'retired' && type !== 'delivery-gap',
    );
  });

  it.each(cases)(
    're-subscribe: $status, stale $type',
    ({ status, type, source }) => {
      expect(canResubscribe(source)).toBe(
        status === 'active' && type === 'delivery-gap',
      );
    },
  );
});

describe('topic rules', () => {
  it.each<[Topic['status'], boolean, boolean]>([
    ['proposed', true, true],
    ['declined', true, false],
    ['active', false, false],
  ])('%s: activate %s, decline %s', (status, activate, decline) => {
    expect(canActivateTopic({ status })).toBe(activate);
    expect(canDeclineTopic({ status })).toBe(decline);
  });
});
