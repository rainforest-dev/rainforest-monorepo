import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../src';

const authors = [
  'Isaac Asimov',
  'James Clear',
  'Frank Herbert',
  'Daniel Kahneman',
  'J.R.R. Tolkien',
];

const meta = {
  title: 'Overlays/Command',
  component: Command,
  render: (args) => (
    <Command {...args} className="ring-foreground/10 max-w-xs ring-1">
      <CommandInput placeholder="Search author…" />
      <CommandList>
        <CommandEmpty>No author found.</CommandEmpty>
        <CommandGroup heading="Filter">
          <CommandItem data-checked="true">All Authors</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Authors">
          {authors.map((a) => (
            <CommandItem key={a} value={a}>
              {a}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  ),
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { scheme: 'dark' } };
