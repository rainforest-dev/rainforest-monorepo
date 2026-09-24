import type { Meta, StoryObj } from '@storybook/react-vite';

import { Separator } from '../src';

const meta = {
  title: 'Display/Separator',
  component: Separator,
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-3 text-sm">
      <p className="font-medium">這一天的回憶</p>
      <Separator {...args} />
      <p className="text-muted-foreground">眉批</p>
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>LINE</span>
      <Separator {...args} />
      <span>Slack</span>
      <Separator {...args} />
      <span>照片</span>
    </div>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
