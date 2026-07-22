import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JwtDecode } from './JwtDecode';

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

describe('<JwtDecode>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts with the persona picker and an opaque access token', () => {
    render(<JwtDecode />);
    expect(
      screen.getByRole('button', { name: /st\. mary's hospital/i }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeDefined();
    expect(screen.getByText(/access_token \(opaque\)/i)).toBeDefined();
  });

  it('starts the hop animation on login and decodes afterward', () => {
    render(<JwtDecode />);
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDefined();
  });

  it('switching persona resets the login flow back to idle', () => {
    render(<JwtDecode />);
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /novacell therapeutics/i }),
    );
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeDefined();
    expect(screen.getByText(/access_token \(opaque\)/i)).toBeDefined();
  });

  it('decodes immediately on login under reduced motion, skipping the hop animation', () => {
    mockReducedMotion(true);
    render(<JwtDecode />);
    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(screen.getByText(/decoded payload/i)).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });
});
