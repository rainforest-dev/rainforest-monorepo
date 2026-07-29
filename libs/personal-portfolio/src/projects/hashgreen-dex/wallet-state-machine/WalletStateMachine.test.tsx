import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WalletStateMachine } from './WalletStateMachine';

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

describe('<WalletStateMachine>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts and renders the connect-wallet entry point and stage diagram', () => {
    render(<WalletStateMachine />);
    expect(
      screen.getByRole('button', { name: /connect wallet/i }),
    ).toBeDefined();
    expect(screen.getAllByText('Unspecified').length).toBeGreaterThan(0);
    expect(screen.getByText('Connected')).toBeDefined();
  });

  it('pairs and connects almost immediately under reduced motion, skipping the pairing delay', async () => {
    mockReducedMotion(true);
    render(<WalletStateMachine />);
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.click(screen.getByRole('button', { name: /goby/i }));
    expect(await screen.findByText('xch1c8d…44fa')).toBeDefined();
  });
});
