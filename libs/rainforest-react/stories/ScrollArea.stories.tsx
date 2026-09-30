import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScrollArea } from '../src';

const chart = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

const meta = {
  title: 'Display/ScrollArea',
  component: ScrollArea,
  args: { className: 'h-48 w-64 rounded-lg border' },
  render: (args) => (
    <ScrollArea {...args}>
      <ul className="flex flex-col p-3 text-sm">
        {Array.from({ length: 18 }, (_, i) => {
          const month = ((i + 10) % 12) + 1;
          const year = 2025 + Math.floor((i + 10) / 12);
          return (
            <li key={i} className="py-1.5 tabular-nums">
              {year}-{String(month).padStart(2, '0')}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  ),
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filmstrip: Story = {
  args: { orientation: 'horizontal', className: 'w-96 rounded-lg' },
  render: (args) => (
    <ScrollArea {...args}>
      <div className="flex gap-2 p-2">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className={`size-16 shrink-0 rounded-md ${chart[i % chart.length]} ${i === 3 ? 'ring-ring ring-2' : ''}`}
          />
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
