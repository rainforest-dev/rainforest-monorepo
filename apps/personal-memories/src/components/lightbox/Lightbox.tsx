import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  ScrollArea,
} from '@rainforest-dev/rainforest-react';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from 'lucide-react';
import { type RefObject, useEffect, useRef } from 'react';

import {
  type CoverControl,
  type LightboxItem,
  positionLabel,
  swipeDelta,
} from '../../lib/lightbox.ts';
import { thumbUrl } from '../../lib/stream.ts';
import { taipeiDate, taipeiTime } from '../../lib/weeks.ts';
import { LightboxImage } from './LightboxImage.tsx';

type Props = {
  items: readonly LightboxItem[] | undefined;
  index: number;
  cover: CoverControl;
  finalFocus: RefObject<HTMLElement | null>;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
  onToggleCover: () => void;
  onClose: () => void;
};

function CoverButton({
  state,
  onToggle,
}: {
  state: CoverControl;
  onToggle: () => void;
}) {
  if (state === 'hidden') return null;
  if (state === 'manual') {
    return (
      <Button variant="secondary" size="sm" aria-pressed onClick={onToggle}>
        <CheckIcon />
        已設為封面
      </Button>
    );
  }
  return (
    <>
      {state === 'auto' && <Badge variant="muted">目前的封面</Badge>}
      <Button
        variant="outline"
        size="sm"
        aria-pressed={false}
        disabled={state === 'loading'}
        onClick={onToggle}
      >
        設為封面
      </Button>
    </>
  );
}

export function Lightbox({
  items,
  index,
  cover,
  finalFocus,
  onStep,
  onSelect,
  onToggleCover,
  onClose,
}: Props) {
  const item = items?.[index];
  const count = items?.length ?? 0;
  const start = useRef<{ x: number; y: number }>(undefined);
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index, items]);

  return (
    <Dialog
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        finalFocus={finalFocus}
        className="gap-3 p-3 sm:max-w-5xl"
      >
        {item && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <DialogTitle className="text-meta tabular-nums">
                  {taipeiDate(item.at)} {taipeiTime(item.at)}
                </DialogTitle>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {positionLabel(index, count)}
                </span>
              </div>
              <CoverButton state={cover} onToggle={onToggleCover} />
              <DialogClose
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="關閉" />
                }
              >
                <XIcon />
              </DialogClose>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="上一張"
                disabled={index === 0}
                onClick={() => onStep(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <div
                className="touch-pan-y"
                onPointerDown={(e) => {
                  start.current = { x: e.clientX, y: e.clientY };
                }}
                onPointerUp={(e) => {
                  const from = start.current;
                  start.current = undefined;
                  const delta = from
                    ? swipeDelta(e.clientX - from.x, e.clientY - from.y)
                    : 0;
                  if (delta) onStep(delta);
                }}
              >
                <LightboxImage key={item.id} item={item} />
              </div>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="下一張"
                disabled={index >= count - 1}
                onClick={() => onStep(1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            {count > 1 && (
              <ScrollArea orientation="horizontal" className="w-full">
                <ol className="flex gap-2 p-1">
                  {items?.map((it, i) => (
                    <li key={it.id} className="shrink-0">
                      <button
                        ref={i === index ? active : undefined}
                        type="button"
                        aria-label={positionLabel(i, count)}
                        aria-current={i === index}
                        onClick={() => onSelect(i)}
                        className={`bg-muted focus-visible:ring-ring block size-14 overflow-hidden rounded-md outline-none focus-visible:ring-2 ${i === index ? 'ring-ring ring-2' : 'opacity-65'}`}
                      >
                        <img
                          src={thumbUrl(it.id, 0, 240)}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
