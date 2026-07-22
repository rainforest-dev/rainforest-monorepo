import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveLedger } from './LiveLedger';

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

describe('<LiveLedger>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.useRealTimers();
  });

  it('mounts and renders the transaction ledger list', () => {
    render(<LiveLedger />);
    expect(
      screen.getByRole('list', { name: /transaction ledger/i }),
    ).toBeDefined();
  });

  it('seeds the ledger and marks the feed static, never appending a new row under reduced motion', () => {
    vi.useFakeTimers();
    mockReducedMotion(true);
    render(<LiveLedger />);
    expect(screen.getByText(/static \(reduced motion\)/i)).toBeDefined();
    const list = screen.getByRole('list', { name: /transaction ledger/i });
    expect(list.children.length).toBe(3);
    vi.advanceTimersByTime(6000);
    expect(list.children.length).toBe(3);
  });
});
