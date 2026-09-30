import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';

import { Button, toast, Toaster } from '../src';

function ToastDemo() {
  useEffect(() => {
    toast.success('Sent 3 books to Readwise Reader');
  }, []);
  return (
    <div className="min-h-40">
      <Button
        variant="outline"
        onClick={() => toast('Tag “fantasy” added to Dune')}
      >
        Show toast
      </Button>
      <Toaster position="top-center" expand />
    </div>
  );
}

const meta = {
  title: 'Feedback/Toaster',
  component: Toaster,
  render: () => <ToastDemo />,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { scheme: 'dark' } };
