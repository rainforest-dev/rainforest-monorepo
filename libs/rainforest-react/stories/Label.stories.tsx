import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input, Label } from '../src';

const meta = {
  title: 'Forms/Label',
  component: Label,
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-2">
      <Label htmlFor="label-note">Note</Label>
      <Input id="label-note" />
    </div>
  ),
};

export const Dark: Story = {
  render: Default.render,
  globals: { scheme: 'dark' },
};
