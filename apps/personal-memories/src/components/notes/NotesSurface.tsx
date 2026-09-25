import {
  Button,
  ScrollArea,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@rainforest-dev/rainforest-react';
import type { ReactNode } from 'react';

import { useMediaQuery } from '../useMediaQuery.ts';
import { useOverlay } from '../useOverlay.ts';

const DESKTOP = '(min-width: 64rem)';
const PEEK = '156px';

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  title: string;
  date: ReactNode;
  status: ReactNode;
  peek: ReactNode;
  children: ReactNode;
};

export function NotesSurface({
  expanded,
  onExpandedChange,
  title,
  date,
  status,
  peek,
  children,
}: Props) {
  const desktop = useMediaQuery(DESKTOP);
  useOverlay(!desktop && expanded);

  if (desktop) {
    return (
      <aside
        aria-label="筆記"
        className="bg-sidebar border-sidebar-border hidden flex-col rounded-lg border lg:sticky lg:top-[calc(var(--app-bar-h)+1rem)] lg:flex lg:max-h-[calc(100vh-var(--app-bar-h)-2rem)] lg:self-start"
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-meta font-semibold">{title}</h2>
            {date}
          </div>
          {status}
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 pb-8 pt-3">{children}</div>
        </ScrollArea>
      </aside>
    );
  }

  return (
    <Sheet
      side="bottom"
      open
      onOpenChange={(next) => {
        if (!next) onExpandedChange(false);
      }}
      snapPoints={[PEEK, 1]}
      snapPoint={expanded ? 1 : PEEK}
      onSnapPointChange={(point) => onExpandedChange(point === 1)}
      modal={expanded}
      disablePointerDismissal
    >
      <SheetContent
        initialFocus={false}
        showOverlay={expanded}
        showCloseButton={expanded}
        closeLabel="關閉"
        className="bg-sidebar gap-0"
      >
        <SheetHeader
          className={`flex-row items-center justify-between gap-3 pb-2 pt-3 ${expanded ? 'pr-12' : ''}`}
        >
          <SheetTitle className="text-meta font-semibold">{title}</SheetTitle>
          {status}
        </SheetHeader>
        <SheetBody className="flex flex-col gap-2 pb-6">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={expanded}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? '收合筆記' : '展開筆記'}
          </Button>
          {expanded ? children : peek}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
