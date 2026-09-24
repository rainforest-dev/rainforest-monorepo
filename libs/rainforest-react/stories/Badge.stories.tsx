import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../src';

const meta = {
  title: 'Display/Badge',
  component: Badge,
  args: { children: 'EPUB' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'success',
        'warning',
        'info',
        'muted',
        'outline',
        'ghost',
        'link',
      ],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Retired</Badge>
    </div>
  ),
};

export const Status: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">active</Badge>
      <Badge variant="info">proposed</Badge>
      <Badge variant="warning">stale</Badge>
      <Badge variant="muted">no-rss</Badge>
      <Badge variant="destructive">retired</Badge>
    </div>
  ),
};

export const Dark: Story = {
  globals: { scheme: 'dark' },
  render: Status.render,
};
