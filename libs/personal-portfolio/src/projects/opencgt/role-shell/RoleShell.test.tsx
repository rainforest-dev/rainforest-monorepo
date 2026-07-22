import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoleShell } from './RoleShell';

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

describe('<RoleShell>', () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('mounts on the Hospital role showing only its allowed nav items', () => {
    render(<RoleShell />);
    expect(screen.getByRole('button', { name: 'Patients' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Enrollment' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Materials' })).toBeNull();
  });

  it('re-skins the shell when the role toggle changes, with no reload', () => {
    render(<RoleShell />);
    fireEvent.click(screen.getByRole('button', { name: /manufacturer/i }));
    expect(screen.getByRole('button', { name: 'Materials' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Patients' })).toBeNull();
  });

  it('clicking a forbidden nav item starts the 404 rewrite instead of navigating', () => {
    render(<RoleShell />);
    // Manufacturer can't reach /patients — try it via the direct-link chip.
    fireEvent.click(screen.getByRole('button', { name: /manufacturer/i }));
    fireEvent.click(screen.getByRole('button', { name: '/patients ✕' }));
    expect(screen.getByText('GET /patients')).toBeDefined();
  });

  it('reveals the full 404 body immediately under reduced motion, skipping the two-beat rewrite', () => {
    mockReducedMotion(true);
    render(<RoleShell />);
    fireEvent.click(screen.getByRole('button', { name: /manufacturer/i }));
    fireEvent.click(screen.getByRole('button', { name: '/patients ✕' }));
    expect(screen.getByText('GET /patients')).toBeDefined();
    expect(screen.getByText(/rewrite\('\/not-found'\)/i)).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('This page could not be found.')).toBeDefined();
  });
});
