import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../src';

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info'],
    },
  },
  render: (args) => (
    <Alert {...args} className="max-w-md">
      <InfoIcon />
      <AlertTitle>Registry is read-only</AlertTitle>
      <AlertDescription>
        The vault is mounted read-only, so edits are disabled.
      </AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Status: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Alert variant="success">
        <CircleCheckIcon />
        <AlertTitle>Valid RSS feed</AlertTitle>
        <AlertDescription>Title: Astro Blog · 20 items found</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Registry file is read-only</AlertTitle>
      </Alert>
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>3 sources proposed this week</AlertTitle>
      </Alert>
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Feed could not be parsed</AlertTitle>
        <AlertDescription>Server error: 502</AlertDescription>
      </Alert>
    </div>
  ),
};

export const Dark: Story = {
  globals: { scheme: 'dark' },
  render: Status.render,
};
