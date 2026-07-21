import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveLedger } from './LiveLedger';

describe('<LiveLedger>', () => {
  it('mounts and renders the transaction ledger list', () => {
    render(<LiveLedger />);
    expect(screen.getByRole('list', { name: /transaction ledger/i })).toBeDefined();
  });
});
