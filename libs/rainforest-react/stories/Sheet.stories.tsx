import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  Badge,
  Button,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Textarea,
} from '../src';

const meta = {
  title: 'Overlays/Sheet',
  component: Sheet,
  args: { defaultOpen: true, side: 'right' },
  argTypes: {
    side: { control: 'select', options: ['right', 'left', 'bottom'] },
  },
  render: (args) => (
    <div className="min-h-96">
      <Sheet {...args}>
        <SheetTrigger render={<Button variant="outline" />}>
          Open notes
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>這一天的回憶</SheetTitle>
            <SheetDescription>Markdown · 自動儲存</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Textarea
              aria-label="這一天的回憶"
              placeholder="這一天想起了什麼？"
              className="min-h-40"
            />
          </SheetBody>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  ),
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Left: Story = { args: { side: 'left' } };

export const Bottom: Story = { args: { side: 'bottom' } };

export const Closed: Story = { args: { defaultOpen: false } };

const PEEK = '156px';

function PeekSheet() {
  const [snap, setSnap] = useState<string | number | null>(PEEK);
  const expanded = snap === 1;
  return (
    <div className="min-h-screen">
      <Sheet
        side="bottom"
        open
        onOpenChange={(next) => {
          if (!next) setSnap(PEEK);
        }}
        snapPoints={[PEEK, 1]}
        snapPoint={snap}
        onSnapPointChange={setSnap}
        modal={expanded}
        disablePointerDismissal
      >
        <SheetContent
          showOverlay={expanded}
          showCloseButton={false}
          className="bg-sidebar"
        >
          <SheetHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>這一天的回憶</SheetTitle>
              <Badge variant="muted">已儲存</Badge>
            </div>
            <SheetDescription>3 則眉批</SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-3 pb-6">
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={expanded}
              onClick={() => setSnap(expanded ? PEEK : 1)}
            >
              {expanded ? '收合筆記' : '展開筆記'}
            </Button>
            <Textarea
              aria-label="這一天的回憶"
              placeholder="這一天想起了什麼？"
              className="min-h-40"
            />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const BottomPeek: Story = { render: () => <PeekSheet /> };

export const Dark: Story = { globals: { scheme: 'dark' } };
