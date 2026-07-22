import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FuzzySearch } from './FuzzySearch';

describe('<FuzzySearch>', () => {
  it('mounts and renders the search input', () => {
    render(<FuzzySearch />);
    expect(
      screen.getByRole('textbox', { name: /search assets/i }),
    ).toBeDefined();
  });
});
