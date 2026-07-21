import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PatchVsRefetch } from './PatchVsRefetch';

describe('<PatchVsRefetch>', () => {
  it('mounts and renders the order table and simulate-a-fill control', () => {
    render(<PatchVsRefetch />);
    expect(screen.getByRole('table', { name: /order history/i })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /simulate a fill/i }),
    ).toBeDefined();
  });
});
