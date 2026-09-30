import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, Spinner } from '../src';

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InButton: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button size="sm" disabled>
        <Spinner data-icon="inline-start" />
        Save
      </Button>
      <Button size="sm" variant="outline" disabled>
        <Spinner data-icon="inline-start" />
        ZIP
      </Button>
      <Button size="xs" disabled>
        <Spinner data-icon="inline-start" />
        Activate
      </Button>
    </div>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
