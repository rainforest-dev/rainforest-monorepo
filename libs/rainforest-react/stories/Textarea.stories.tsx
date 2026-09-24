import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from '../src';

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  args: {
    placeholder: 'Write a note about this book...',
    'aria-label': 'Note',
  },
  render: (args) => <Textarea {...args} className="max-w-md" />,
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue:
      'Re-read the appendix on the ecology of Arrakis before the sequel.',
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const Dark: Story = { globals: { scheme: 'dark' } };
