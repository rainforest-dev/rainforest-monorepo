import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from '../src';

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  args: { 'aria-label': 'Show slippage' },
  argTypes: {
    size: { control: 'select', options: ['default', 'sm'] },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = { args: { defaultChecked: true } };

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2 text-sm">
      <Switch {...args} aria-labelledby="zap-label" defaultChecked />
      <span id="zap-label">Zap single-sided liquidity</span>
    </div>
  ),
};

export const Small: Story = { args: { size: 'sm', defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };

export const Dark: Story = {
  args: { defaultChecked: true },
  globals: { scheme: 'dark' },
};
