import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AmmQuote } from './AmmQuote';

describe('<AmmQuote>', () => {
  it('mounts with a default quote and recomputes live as you type', () => {
    render(<AmmQuote />);
    const exactIn = screen.getByRole('button', { name: /exact in/i });
    expect(exactIn.getAttribute('aria-pressed')).toBe('true');

    const payInput = screen.getByLabelText(
      /you pay, in xch/i,
    ) as HTMLInputElement;
    expect(payInput.value).toBe('1000');

    const recvInput = screen.getByLabelText(
      /you receive, in husdc/i,
    ) as HTMLInputElement;
    // A receive amount was computed for the default 1000 XCH input.
    expect(recvInput.value).not.toBe('');

    fireEvent.change(payInput, { target: { value: '2000' } });
    expect(payInput.value).toBe('2000');
  });

  it('reveals the pure-function invariant when "show the math" is toggled', () => {
    render(<AmmQuote />);
    expect(screen.queryByText(/rA 82,000 XCH/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show the math/i }));
    expect(screen.getByText(/rA 82,000 XCH/)).toBeDefined();
  });
});
