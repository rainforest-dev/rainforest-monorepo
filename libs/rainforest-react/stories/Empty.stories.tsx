import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchXIcon } from 'lucide-react';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../src';

const meta = {
  title: 'Feedback/Empty',
  component: Empty,
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No books match these filters.</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm">
          Clear filters
        </Button>
      </EmptyContent>
    </Empty>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>No reading queue has been generated yet.</EmptyTitle>
        <EmptyDescription>
          Run the <code className="text-primary">reading-queue</code> skill to
          build one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};

export const Dark: Story = {
  render: Default.render,
  globals: { scheme: 'dark' },
};
