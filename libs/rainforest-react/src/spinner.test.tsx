import { render, screen } from '@testing-library/react';

import { Button, Spinner } from './index';

describe('Spinner', () => {
  it('is a status named Loading that spins', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.getAttribute('data-slot')).toBe('spinner');
    expect(spinner.getAttribute('class')).toContain('animate-spin');
    expect(spinner.getAttribute('class')).toContain(
      'motion-reduce:animate-none',
    );
  });

  it('takes a caller label and size', () => {
    render(<Spinner aria-label="Saving" className="size-6" />);
    const spinner = screen.getByRole('status', { name: 'Saving' });
    expect(spinner.getAttribute('class')).toContain('size-6');
    expect(spinner.getAttribute('class')).not.toContain('size-4');
  });

  it('sits before the label inside a disabled Button', () => {
    render(
      <Button disabled>
        <Spinner data-icon="inline-start" />
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(
      button.querySelector('[data-slot="spinner"]')?.getAttribute('data-icon'),
    ).toBe('inline-start');
  });
});
