'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib';

export function SelectMark({
  checked,
  visible,
  onToggle,
  className,
}: {
  checked: boolean;
  visible: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-select-mark
      data-checked={checked || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'border-input bg-background/90 flex size-5 cursor-pointer items-center justify-center rounded border transition-opacity',
        checked && 'border-primary bg-primary text-primary-foreground',
        visible || checked
          ? 'opacity-100'
          : 'opacity-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100',
        className,
      )}
    >
      {checked && <Check className="size-3.5" />}
    </span>
  );
}
