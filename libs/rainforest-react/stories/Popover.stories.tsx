import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../src';

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  args: { defaultOpen: true },
  render: (args) => (
    <div className="min-h-56">
      <Popover {...args}>
        <PopoverTrigger render={<Button variant="outline" />}>
          Rename shelf
        </PopoverTrigger>
        <PopoverContent align="start">
          <PopoverHeader>
            <PopoverTitle>Shelf name</PopoverTitle>
            <PopoverDescription>
              Shown in the library sidebar.
            </PopoverDescription>
          </PopoverHeader>
          <Input defaultValue="To read" aria-label="Shelf name" />
        </PopoverContent>
      </Popover>
    </div>
  ),
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { scheme: 'dark' } };
