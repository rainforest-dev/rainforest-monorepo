import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfferState } from './OfferState';

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

describe('<OfferState>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts with the wallet picker and PENDING status', () => {
    render(<OfferState />);
    expect(screen.getByText(/offerStatusEnum\.PENDING/)).toBeDefined();
    expect(screen.getByRole('button', { name: /goby/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /hoogii/i })).toBeDefined();
  });

  it('steps connect -> review -> approve into the signing stage', () => {
    render(<OfferState />);
    fireEvent.click(screen.getByRole('button', { name: /hoogii/i }));
    fireEvent.click(screen.getByRole('button', { name: /review swap/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve & sign/i }));
    expect(screen.getByText(/assembling offer/i)).toBeDefined();
  });

  it('walks connect -> review -> approve straight to on-chain under reduced motion, skipping the signing/tracking delays', async () => {
    mockReducedMotion(true);
    render(<OfferState />);
    fireEvent.click(screen.getByRole('button', { name: /hoogii/i }));
    fireEvent.click(screen.getByRole('button', { name: /review swap/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve & sign/i }));
    expect(await screen.findByText(/settled on-chain/i)).toBeDefined();
    expect(screen.getByText(/offerStatusEnum\.ON_CHAIN/)).toBeDefined();
  });
});
