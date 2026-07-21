import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleShell } from './RoleShell';

describe('<RoleShell>', () => {
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
});
