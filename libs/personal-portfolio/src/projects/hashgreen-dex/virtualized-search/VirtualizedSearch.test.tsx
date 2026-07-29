import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { VirtualizedSearch } from './VirtualizedSearch';

describe('<VirtualizedSearch>', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('mounts and renders the market search input with a mounted-rows counter', () => {
    render(<VirtualizedSearch />);
    expect(
      screen.getByRole('textbox', { name: /search markets/i }),
    ).toBeDefined();
    expect(screen.getByRole('list', { name: /markets/i })).toBeDefined();
    expect(screen.getByText(/rows mounted/i)).toBeDefined();
  });

  it('renders All/Favorites tabs and a star toggle per row', () => {
    render(<VirtualizedSearch />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /^all$/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /favorites/i })).toBeDefined();
    expect(
      screen.getAllByRole('button', { name: /add .+ to favorites/i }).length,
    ).toBeGreaterThan(0);
  });
});
