import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FetchThenStream } from './FetchThenStream';

describe('<FetchThenStream>', () => {
  it('mounts and renders the live toggle and market select', () => {
    render(<FetchThenStream />);
    expect(
      screen.getByRole('switch', { name: /toggle live subscription/i }),
    ).toBeDefined();
    expect(screen.getByLabelText(/market/i)).toBeDefined();
    expect(screen.getByText(/idle — flip live to subscribe/i)).toBeDefined();
  });
});
