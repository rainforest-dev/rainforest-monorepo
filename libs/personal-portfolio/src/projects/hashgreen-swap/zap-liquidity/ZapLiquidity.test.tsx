import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ZapLiquidity } from './ZapLiquidity';

describe('<ZapLiquidity>', () => {
  it('mounts in balanced mode with add_liquidity and a live LP figure', () => {
    render(<ZapLiquidity />);
    expect(screen.getByText('add_liquidity')).toBeDefined();
    expect(screen.getByLabelText(/deposit amount, in xch/i)).toBeDefined();
    expect(screen.getByLabelText(/deposit amount, in husdc/i)).toBeDefined();
  });

  it('morphs to a single input and add_liquidity_zap when Zap is toggled on', () => {
    render(<ZapLiquidity />);
    fireEvent.click(
      screen.getByRole('switch', { name: /zap · single-sided deposit/i }),
    );
    expect(screen.getByText('add_liquidity_zap')).toBeDefined();
    expect(screen.queryByLabelText(/deposit amount, in husdc/i)).toBeNull();
  });
});
