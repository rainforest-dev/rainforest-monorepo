import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnvDeploy } from './EnvDeploy';

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

describe('<EnvDeploy>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts with four env tabs, a rendered values.yaml, and the real metrics', () => {
    render(<EnvDeploy />);
    for (const env of ['sandbox', 'uat', 'staging', 'prod']) {
      expect(screen.getByRole('button', { name: env })).toBeDefined();
    }
    expect(screen.getByText(/idle — pick an environment/i)).toBeDefined();
    expect(screen.getByText('$780k')).toBeDefined();
    expect(screen.getByText('21,494')).toBeDefined();
  });

  it('streams the full deploy log immediately under reduced motion', () => {
    mockReducedMotion(true);
    render(<EnvDeploy />);
    fireEvent.click(screen.getByRole('button', { name: /deploy to uat/i }));
    expect(screen.getByText(/helm upgrade pyke-swap/i)).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });
});
