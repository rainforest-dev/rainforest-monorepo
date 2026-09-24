import { type ReactNode, useRef } from 'react';

import type { SaveStatus } from './useNoteDraft.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peek: ReactNode;
  children: ReactNode;
};

const DRAG_PX = 24;

type Chip = { label: string; mark: 'check' | 'pulse' | 'warn' };

export const CHIPS: Record<SaveStatus, Chip> = {
  saved: { label: '已儲存', mark: 'check' },
  dirty: { label: '儲存中…', mark: 'pulse' },
  saving: { label: '儲存中…', mark: 'pulse' },
  error: { label: '未儲存', mark: 'warn' },
  conflict: { label: '有衝突', mark: 'warn' },
};
export const LOAD_FAILED: Chip = {
  label: '載入失敗，捲動時會再試',
  mark: 'warn',
};

export function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
      {chip.mark === 'check' ? (
        <svg
          aria-hidden
          className="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <span
          className={`size-1.5 rounded-full ${chip.mark === 'warn' ? 'bg-warning' : 'bg-muted-foreground/60 animate-pulse motion-reduce:animate-none'}`}
        />
      )}
      {chip.label}
    </span>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="bg-muted text-muted-foreground text-meta flex items-start gap-2 rounded-lg px-3 py-2.5 leading-[1.55]">
      <svg
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function BottomSheet({ open, onOpenChange, peek, children }: Props) {
  const startY = useRef(0);
  const dragged = useRef(false);

  return (
    <aside
      aria-label="筆記"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) onOpenChange(false);
      }}
      className={`bg-sidebar border-sidebar-border fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl border-t shadow-lg transition-[top] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:duration-150 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-4 lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:rounded-lg lg:border lg:shadow-none ${open ? 'top-[88px]' : 'top-[calc(100dvh-156px)]'}`}
    >
      <button
        type="button"
        aria-label={open ? '收合筆記' : '展開筆記'}
        aria-expanded={open}
        className="focus-visible:ring-ring flex h-6 shrink-0 touch-none items-center justify-center rounded-t-xl focus-visible:outline-none focus-visible:ring-2 lg:hidden"
        onPointerDown={(e) => {
          startY.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const dy = e.clientY - startY.current;
          dragged.current = Math.abs(dy) > DRAG_PX;
          if (dragged.current) onOpenChange(dy < 0);
        }}
        onClick={() => {
          if (!dragged.current) onOpenChange(!open);
          dragged.current = false;
        }}
      >
        <span className="bg-muted-foreground/30 h-1 w-9 rounded-full" />
      </button>
      {!open && (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className="focus-visible:ring-ring flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-5 pb-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset lg:hidden"
        >
          {peek}
        </button>
      )}
      <div
        className={`${open ? 'flex' : 'hidden lg:flex'} min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-1 lg:px-6 lg:pb-8 lg:pt-5`}
      >
        {children}
      </div>
    </aside>
  );
}
