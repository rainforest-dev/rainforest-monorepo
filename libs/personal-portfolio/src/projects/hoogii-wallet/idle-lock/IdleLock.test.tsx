import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdleLock } from './IdleLock';

const originalMatchMedia = window.matchMedia;

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
}

describe('<IdleLock>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.useRealTimers();
  });

  it('mounts and renders the idle threshold slider', () => {
    render(<IdleLock />);
    expect(
      screen.getByRole('slider', { name: /idle threshold/i }),
    ).toBeDefined();
  });

  it('seeds the active status and progress bar on mount, and never auto-ticks under reduced motion', () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    render(<IdleLock />);
    expect(screen.getByRole('status').textContent).toBe('active');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '0',
    );
    vi.advanceTimersByTime(5000);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '0',
    );
  });
});
