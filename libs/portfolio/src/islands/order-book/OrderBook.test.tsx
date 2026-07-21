import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OrderBook } from './OrderBook';

describe('<OrderBook>', () => {
  it('mounts and renders the shuffle control and mid price', () => {
    render(<OrderBook />);
    expect(
      screen.getByRole('button', { name: /shuffle the book/i }),
    ).toBeDefined();
    expect(screen.getByText('1.2431')).toBeDefined();
  });
});
