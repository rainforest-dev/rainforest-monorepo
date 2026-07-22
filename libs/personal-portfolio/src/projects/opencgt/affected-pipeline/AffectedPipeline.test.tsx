import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AffectedPipeline } from './AffectedPipeline';

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

describe('<AffectedPipeline>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts idle with the checked-files list and the PR/push toggle', () => {
    render(<AffectedPipeline />);
    expect(
      screen.getByText('apps/web/middleware.ts'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'PR' })).toBeDefined();
    expect(screen.getByText(/idle — tick files/i)).toBeDefined();
  });

  it('running with nothing checked reports 0 affected projects (reduced motion resolves instantly)', () => {
    mockReducedMotion(true);
    render(<AffectedPipeline />);
    fireEvent.click(screen.getByRole('button', { name: /run pipeline/i }));
    expect(screen.getByText(/nothing affected/i)).toBeDefined();
  });

  it('checking a file and switching to push streams the deploy + e2e/k6 lines', () => {
    mockReducedMotion(true);
    render(<AffectedPipeline />);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'apps/web/middleware.ts',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'push → main' }));
    fireEvent.click(screen.getByRole('button', { name: /run pipeline/i }));
    expect(screen.getByText(/helm upgrade opencgt/i)).toBeDefined();
    expect(screen.getByText(/web-e2e:e2e/i)).toBeDefined();
  });
});
