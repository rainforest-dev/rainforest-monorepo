import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RelayGate } from './RelayGate';

describe('<RelayGate>', () => {
  it('mounts and renders the sign-request button', () => {
    render(<RelayGate />);
    expect(
      screen.getByRole('button', { name: /dApp requests signing/i }),
    ).toBeDefined();
  });
});
