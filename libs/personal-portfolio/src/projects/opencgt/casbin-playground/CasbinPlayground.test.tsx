import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CasbinPlayground } from './CasbinPlayground';

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

describe('<CasbinPlayground>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts with the default request composed and the policy table visible', () => {
    render(<CasbinPlayground />);
    expect(screen.getByRole('button', { name: /enforce/i })).toBeDefined();
    // Two policy rows share the /patients/* object (read + write).
    expect(screen.getAllByText('/patients/*')).toHaveLength(2);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reveals a verdict after clicking Enforce (reduced motion resolves it immediately)', () => {
    mockReducedMotion(true);
    render(<CasbinPlayground />);
    fireEvent.click(screen.getByRole('button', { name: /enforce/i }));
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('ALLOW')).toBeDefined();
  });

  it('editing a policy row hides the stale verdict until re-enforced', () => {
    mockReducedMotion(true);
    render(<CasbinPlayground />);
    fireEvent.click(screen.getByRole('button', { name: /enforce/i }));
    expect(screen.getByRole('status')).toBeDefined();

    const rowSelect = screen.getByRole('combobox', {
      name: /policy action for manufacturer_admin \/shipments\/\*/i,
    });
    fireEvent.change(rowSelect, { target: { value: '*' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
