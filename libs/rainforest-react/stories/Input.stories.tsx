import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '../src';

const meta = {
  title: 'Forms/Input',
  component: Input,
  args: { placeholder: 'Search books...', 'aria-label': 'Search books' },
  render: (args) => <Input {...args} className="max-w-xs" />,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: 'Frank Herbert' } };

export const Invalid: Story = {
  args: { defaultValue: 'not a url', 'aria-invalid': true },
};

export const Disabled: Story = { args: { disabled: true } };

export const Dark: Story = { globals: { scheme: 'dark' } };
