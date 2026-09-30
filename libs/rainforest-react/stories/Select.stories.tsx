import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../src';

const items = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'added', label: 'Date added' },
];

const meta = {
  title: 'Forms/Select',
  component: Select,
  args: { defaultValue: 'title', items },
  render: (args) => (
    <div className="min-h-56">
      <Select {...args}>
        <SelectTrigger className="w-44" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sort by</SelectLabel>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

export const Dark: Story = {
  args: { defaultOpen: true },
  globals: { scheme: 'dark' },
};
