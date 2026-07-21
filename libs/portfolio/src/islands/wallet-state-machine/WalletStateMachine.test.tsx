import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WalletStateMachine } from './WalletStateMachine';

describe('<WalletStateMachine>', () => {
  it('mounts and renders the connect-wallet entry point and stage diagram', () => {
    render(<WalletStateMachine />);
    expect(
      screen.getByRole('button', { name: /connect wallet/i }),
    ).toBeDefined();
    expect(screen.getAllByText('Unspecified').length).toBeGreaterThan(0);
    expect(screen.getByText('Connected')).toBeDefined();
  });
});
