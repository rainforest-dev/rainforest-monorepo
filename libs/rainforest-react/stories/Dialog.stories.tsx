import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../src';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  args: { defaultOpen: true },
  render: (args) => (
    <div className="min-h-64">
      <Dialog {...args}>
        <DialogTrigger render={<Button variant="outline" />}>
          Remove tag
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove “fantasy”?</DialogTitle>
            <DialogDescription>
              The tag is removed from 2 books. You can add it back later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ),
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = { args: { defaultOpen: false } };

export const Dark: Story = { globals: { scheme: 'dark' } };
