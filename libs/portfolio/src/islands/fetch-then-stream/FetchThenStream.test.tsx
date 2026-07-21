import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FetchThenStream } from './FetchThenStream';

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

describe('<FetchThenStream>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts and renders the live toggle and market select', () => {
    render(<FetchThenStream />);
    expect(
      screen.getByRole('switch', { name: /toggle live subscription/i }),
    ).toBeDefined();
    expect(screen.getByLabelText(/market/i)).toBeDefined();
    expect(screen.getByText(/idle — flip live to subscribe/i)).toBeDefined();
  });

  it('renders seeded trades on mount even when the user prefers reduced motion', () => {
    mockReducedMotion(true);
    render(<FetchThenStream />);
    expect(screen.getByRole('list', { name: /trade tape/i })).toBeDefined();
    expect(screen.getAllByText(/buy|sell/i).length).toBeGreaterThan(0);
  });
});
