import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { placeOf } from './nav.ts';
import {
  REVEAL_STYLE_ID,
  revealKey,
  revealScript,
  revealStyle,
} from './reveal.ts';
import { morphKey } from './zoom.ts';

const deps = { placeOf, morphKey };
const ORIGIN = 'http://127.0.0.1:3024';

describe('revealKey', () => {
  it('names the day you left when you land on its month or the year, and the month row from a month', () => {
    expect(
      revealKey(`${ORIGIN}/day/2025-11-03`, `${ORIGIN}/month/2025-11`, deps),
    ).toBe('day-2025-11-03');
    expect(revealKey(`${ORIGIN}/day/2025-11-03`, `${ORIGIN}/`, deps)).toBe(
      'day-2025-11-03',
    );
    expect(revealKey(`${ORIGIN}/month/2025-11`, `${ORIGIN}/`, deps)).toBe(
      'month-2025-11',
    );
    expect(revealKey(`${ORIGIN}/`, `${ORIGIN}/month/2025-11`, deps)).toBe(
      'month-2025-11',
    );
  });

  it('reads the path only, ignoring a query and a hash', () => {
    expect(
      revealKey(
        `${ORIGIN}/day/2025-11-03?nearest=1#ev-1`,
        `${ORIGIN}/month/2025-11`,
        deps,
      ),
    ).toBe('day-2025-11-03');
  });

  it('names nothing for another month, another origin, a missing or a malformed URL', () => {
    expect(
      revealKey(`${ORIGIN}/day/2025-10-31`, `${ORIGIN}/month/2025-11`, deps),
    ).toBeUndefined();
    expect(
      revealKey('https://elsewhere.example/day/2025-11-03', `${ORIGIN}/`, deps),
    ).toBeUndefined();
    expect(revealKey(undefined, `${ORIGIN}/`, deps)).toBeUndefined();
    expect(revealKey('not a url', `${ORIGIN}/`, deps)).toBeUndefined();
  });
});

describe('revealStyle', () => {
  it('silences every morph name, then names only the key', () => {
    expect(revealStyle(undefined)).toBe(
      '[data-morph]{view-transition-name:none!important}',
    );
    expect(revealStyle('day-2025-11-03')).toBe(
      '[data-morph]{view-transition-name:none!important}' +
        '[data-morph="day-2025-11-03"]{view-transition-name:day-2025-11-03!important}',
    );
  });
});

describe('revealScript', () => {
  type Styled = { id: string; textContent: string };
  const run = ({
    from,
    here,
    transition = true,
    reduced = false,
    navigationApi = true,
  }: {
    from?: string;
    here: string;
    transition?: boolean;
    reduced?: boolean;
    navigationApi?: boolean;
  }) => {
    const listeners: Record<string, (event: unknown) => void> = {};
    const head: Styled[] = [];
    const context: Record<string, unknown> = {
      URL,
      Promise,
      location: { href: here },
      matchMedia: () => ({ matches: reduced }),
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners[type] = fn;
      },
      document: {
        readyState: 'complete',
        head: { append: (el: Styled) => head.push(el) },
        createElement: (): Styled => ({ id: '', textContent: '' }),
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => undefined,
      },
    };
    if (navigationApi)
      context['navigation'] = {
        activation: { from: from ? { url: from } : null },
      };
    runInNewContext(revealScript(), context);
    listeners['pagereveal']?.({
      viewTransition: transition
        ? { finished: new Promise(() => undefined) }
        : null,
    });
    return head;
  };

  it('runs on its own in an empty global scope and names the day you came back from', () => {
    expect(
      run({
        from: `${ORIGIN}/day/2025-11-03`,
        here: `${ORIGIN}/month/2025-11`,
      }),
    ).toEqual([
      { id: REVEAL_STYLE_ID, textContent: revealStyle('day-2025-11-03') },
    ]);
  });

  it('silences stale names when the Navigation API names nothing', () => {
    expect(run({ here: `${ORIGIN}/month/2025-11` })).toEqual([
      { id: REVEAL_STYLE_ID, textContent: revealStyle(undefined) },
    ]);
  });

  it('adds nothing without a transition, under reduced motion, or without the Navigation API', () => {
    const from = `${ORIGIN}/day/2025-11-03`;
    const here = `${ORIGIN}/month/2025-11`;
    expect(run({ from, here, transition: false })).toEqual([]);
    expect(run({ from, here, reduced: true })).toEqual([]);
    expect(run({ from, here, navigationApi: false })).toEqual([]);
  });
});
