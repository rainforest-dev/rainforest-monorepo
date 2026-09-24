import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton } from '../src';

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  args: { className: 'h-4 w-48' },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MonthCell: Story = {
  render: () => (
    <div className="flex w-40 flex-col gap-2">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  ),
};

export const ThumbGrid: Story = {
  render: () => (
    <div className="grid w-64 grid-cols-4 gap-1">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-sm" />
      ))}
    </div>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
