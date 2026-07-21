import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OfferState } from './OfferState';

describe('<OfferState>', () => {
  it('mounts with the wallet picker and PENDING status', () => {
    render(<OfferState />);
    expect(screen.getByText(/offerStatusEnum\.PENDING/)).toBeDefined();
    expect(screen.getByRole('button', { name: /goby/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /hoogii/i })).toBeDefined();
  });

  it('steps connect -> review -> approve into the signing stage', () => {
    render(<OfferState />);
    fireEvent.click(screen.getByRole('button', { name: /hoogii/i }));
    fireEvent.click(screen.getByRole('button', { name: /review swap/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve & sign/i }));
    expect(screen.getByText(/assembling offer/i)).toBeDefined();
  });
});
