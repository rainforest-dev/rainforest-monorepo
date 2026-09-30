import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '../src';

const meta = {
  title: 'Forms/Field',
  component: Field,
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeliveryForm: Story = {
  render: () => (
    <form className="flex w-72 flex-col gap-3">
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="field-ref">Reference URL</FieldLabel>
          <Input id="field-ref" type="url" />
        </Field>
        <Field>
          <FieldLabel htmlFor="field-note">Note</FieldLabel>
          <Input id="field-note" />
        </Field>
      </FieldGroup>
      <Button type="submit" size="sm">
        Save
      </Button>
    </form>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field data-invalid className="w-72">
      <FieldLabel htmlFor="field-bad-ref">Reference URL</FieldLabel>
      <Input
        id="field-bad-ref"
        type="url"
        defaultValue="ftp://shelf.example"
        aria-invalid
        aria-describedby="field-bad-ref-error"
      />
      <FieldError id="field-bad-ref-error">
        Reference URL must start with http:// or https://
      </FieldError>
    </Field>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Field orientation="horizontal" className="w-72">
      <Checkbox id="field-daily" defaultChecked />
      <FieldContent>
        <FieldLabel htmlFor="field-daily">Daily digest</FieldLabel>
        <FieldDescription>One email each morning.</FieldDescription>
      </FieldContent>
    </Field>
  ),
};

export const Dark: Story = {
  render: DeliveryForm.render,
  globals: { scheme: 'dark' },
};
