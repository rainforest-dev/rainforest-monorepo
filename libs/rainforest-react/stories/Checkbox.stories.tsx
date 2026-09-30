import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from '../src';

const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  args: { 'aria-label': 'Slack' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const Indeterminate: Story = { args: { indeterminate: true } };

export const SourceFilter: Story = {
  render: () => (
    <fieldset className="flex gap-4 text-sm">
      <legend className="sr-only">來源</legend>
      {['LINE', 'Slack', '照片'].map((source) => (
        <label key={source} className="flex items-center gap-2">
          <Checkbox defaultChecked={source !== 'Slack'} />
          {source}
        </label>
      ))}
    </fieldset>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const Dark: Story = {
  args: { defaultChecked: true },
  globals: { scheme: 'dark' },
};
