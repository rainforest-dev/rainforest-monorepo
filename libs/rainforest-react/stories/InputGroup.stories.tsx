import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchIcon, XIcon } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '../src';

const meta = {
  title: 'Forms/InputGroup',
  component: InputGroup,
  render: (args) => (
    <InputGroup {...args} className="max-w-sm">
      <InputGroupInput placeholder="Search tags..." aria-label="Search tags" />
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Clear">
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithText: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="example.com/rss.xml" aria-label="Feed" />
    </InputGroup>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
