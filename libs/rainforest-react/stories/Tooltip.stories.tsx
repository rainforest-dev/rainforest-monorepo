import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import {
  Button,
  Kbd,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../src';

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  args: { defaultOpen: true },
  render: (args) => (
    <div className="flex min-h-32 items-end justify-center">
      <TooltipProvider>
        <Tooltip {...args}>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="前一天" />}
          >
            <ChevronLeftIcon />
          </TooltipTrigger>
          <TooltipContent>
            前一天 <Kbd>K</Kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sides: Story = {
  render: () => (
    <div className="grid min-h-64 grid-cols-2 place-items-center gap-y-16">
      <TooltipProvider>
        {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
          <Tooltip key={side} defaultOpen>
            <TooltipTrigger render={<Button variant="outline" size="sm" />}>
              {side}
            </TooltipTrigger>
            <TooltipContent side={side}>2025-11-01 · 18 則</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  ),
};

export const OnHover: Story = {
  args: { defaultOpen: false },
  render: (args) => (
    <div className="flex min-h-32 items-end justify-center gap-2">
      <TooltipProvider>
        <Tooltip {...args}>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="前一天" />}
          >
            <ChevronLeftIcon />
          </TooltipTrigger>
          <TooltipContent>前一天</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="後一天" />}
          >
            <ChevronRightIcon />
          </TooltipTrigger>
          <TooltipContent>後一天</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
