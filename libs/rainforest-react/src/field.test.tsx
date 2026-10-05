import { render, screen } from '@testing-library/react';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Label,
} from './index';

describe('Label', () => {
  it('names the control its htmlFor points at', () => {
    render(
      <>
        <Label htmlFor="note">Note</Label>
        <Input id="note" />
      </>,
    );
    expect(screen.getByLabelText('Note').tagName).toBe('INPUT');
  });
});

describe('Field', () => {
  it('groups a label, its control and a description', () => {
    render(
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ref">Reference URL</FieldLabel>
          <Input id="ref" />
          <FieldDescription>Optional.</FieldDescription>
        </Field>
      </FieldGroup>,
    );
    const input = screen.getByLabelText('Reference URL');
    const field = input.closest('[data-slot="field"]') as HTMLElement;
    expect(field.getAttribute('role')).toBe('group');
    expect(field.dataset['orientation']).toBe('vertical');
    expect(field.closest('[data-slot="field-group"]')).not.toBeNull();
    expect(screen.getByText('Reference URL').dataset['slot']).toBe(
      'field-label',
    );
  });

  it('shows an explicit error as an alert', () => {
    render(
      <Field data-invalid>
        <FieldError id="ref-error">
          Reference URL must start with http:// or https://
        </FieldError>
      </Field>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.id).toBe('ref-error');
    expect(alert.textContent).toBe(
      'Reference URL must start with http:// or https://',
    );
  });

  it('shows one message for duplicate errors and a list for several', () => {
    const { rerender } = render(
      <FieldError
        errors={[{ message: 'Required' }, { message: 'Required' }]}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Required');
    rerender(
      <FieldError
        errors={[{ message: 'Required' }, { message: 'Too long' }]}
      />,
    );
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Required', 'Too long']);
  });

  it('renders nothing without errors or children', () => {
    const { container } = render(<FieldError errors={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
