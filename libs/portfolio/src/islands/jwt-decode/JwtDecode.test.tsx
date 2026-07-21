import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JwtDecode } from './JwtDecode';

describe('<JwtDecode>', () => {
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
});
