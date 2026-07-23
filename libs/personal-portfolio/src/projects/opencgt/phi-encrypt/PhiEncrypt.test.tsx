import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PhiEncrypt } from './PhiEncrypt';

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

describe('<PhiEncrypt>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts with the mock patient record and two orgs', () => {
    render(<PhiEncrypt />);
    expect(
      screen.getByDisplayValue('Jordan Avery'),
    ).toBeDefined();
    expect(screen.getByDisplayValue("St. Mary's Hospital")).toBeDefined();
    expect(screen.getByDisplayValue('Novacell Therapeutics')).toBeDefined();
  });

  it('encrypts (reduced motion resolves instantly) then opens as a phi org showing full fields', () => {
    mockReducedMotion(true);
    render(<PhiEncrypt />);
    fireEvent.click(screen.getByRole('button', { name: /encrypt & submit/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /open as st\. mary's hospital \(phi\)/i }),
    );
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Jordan Avery')).toBeDefined();
  });

  it('opening as a non-phi org redacts the identity fields', () => {
    mockReducedMotion(true);
    render(<PhiEncrypt />);
    fireEvent.click(screen.getByRole('button', { name: /encrypt & submit/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /open as novacell therapeutics \(non-phi\)/i,
      }),
    );
    expect(screen.getByText('REDACTED')).toBeDefined();
    expect(screen.queryByText('Jordan Avery')).toBeNull();
    // Non-phi fields still come through.
    expect(screen.getByText('CAR-T · CTL019')).toBeDefined();
  });
});
