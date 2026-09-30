import type { Meta, StoryObj } from '@storybook/react-vite';

import { ToggleGroup, ToggleGroupItem } from '../src';

const meta = {
  title: 'Forms/ToggleGroup',
  component: ToggleGroup,
  args: {
    multiple: true,
    defaultValue: ['line', 'slack', 'photo'],
    'aria-label': '來源',
  },
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="line">LINE</ToggleGroupItem>
      <ToggleGroupItem value="slack">Slack</ToggleGroupItem>
      <ToggleGroupItem value="photo">照片</ToggleGroupItem>
    </ToggleGroup>
  ),
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: 'outline', defaultValue: ['line', 'photo'] },
};

export const Single: Story = {
  args: {
    multiple: false,
    variant: 'outline',
    size: 'sm',
    defaultValue: ['day'],
    'aria-label': '縮放',
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <ToggleGroupItem value="year">年</ToggleGroupItem>
      <ToggleGroupItem value="month">月</ToggleGroupItem>
      <ToggleGroupItem value="day">日</ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Disabled: Story = { args: { disabled: true } };

export const Dark: Story = {
  args: { variant: 'outline' },
  globals: { scheme: 'dark' },
};
