'use client';

import { type RefObject, useEffect, useState } from 'react';

import { cn } from '@/lib';

export interface FocusOverlayProps {
  ref: RefObject<HTMLDivElement | null>;
  listboxRef: RefObject<HTMLElement | null>;
}

function focusVisibleOption(listbox: HTMLElement): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLElement &&
    listbox.contains(active) &&
    active.getAttribute('role') === 'option' &&
    active.matches(':focus-visible')
  );
}

export function FocusOverlay({ ref, listboxRef }: FocusOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const listbox = listboxRef.current;
    if (!listbox) return;
    let frame = 0;
    const update = () => setVisible(focusVisibleOption(listbox));
    const onFocusOut = (event: FocusEvent) => {
      if (!listbox.contains(event.relatedTarget as Node | null)) {
        setVisible(false);
      }
    };
    const onKeyDown = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    listbox.addEventListener('focusin', update);
    listbox.addEventListener('focusout', onFocusOut);
    listbox.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      listbox.removeEventListener('focusin', update);
      listbox.removeEventListener('focusout', onFocusOut);
      listbox.removeEventListener('keydown', onKeyDown);
    };
  }, [listboxRef]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-focus-overlay
      data-visible={visible || undefined}
      style={{ display: 'none' }}
      className={cn(
        'outline-foreground pointer-events-none absolute left-0 top-0 rounded-[2px] outline-[2.5px] outline-offset-4',
        !visible && 'invisible',
      )}
    >
      <div className="bg-foreground absolute -bottom-2.5 -left-1 -right-1 h-1 rounded-[2px]" />
    </div>
  );
}
