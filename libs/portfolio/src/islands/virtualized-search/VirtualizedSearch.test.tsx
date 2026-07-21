import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualizedSearch } from './VirtualizedSearch';

describe('<VirtualizedSearch>', () => {
  it('mounts and renders the market search input with a mounted-rows counter', () => {
    render(<VirtualizedSearch />);
    expect(
      screen.getByRole('textbox', { name: /search markets/i }),
    ).toBeDefined();
    expect(screen.getByRole('list', { name: /markets/i })).toBeDefined();
    expect(screen.getByText(/rows mounted/i)).toBeDefined();
  });
});
