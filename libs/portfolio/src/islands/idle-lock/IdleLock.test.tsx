import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IdleLock } from './IdleLock';

describe('<IdleLock>', () => {
  it('mounts and renders the idle threshold slider', () => {
    render(<IdleLock />);
    expect(
      screen.getByRole('slider', { name: /idle threshold/i }),
    ).toBeDefined();
  });
});
