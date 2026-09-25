import { Badge } from '@rainforest-dev/rainforest-react';
import { CheckIcon } from 'lucide-react';

import type { SaveStatus } from './useNoteDraft.ts';

export type Chip = { label: string; mark: 'check' | 'pulse' | 'warn' };

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

export function StatusBadge({ chip }: { chip: Chip }) {
  return (
    <Badge
      variant={chip.mark === 'warn' ? 'warning' : 'muted'}
      className="shrink-0"
    >
      {chip.mark === 'check' && <CheckIcon aria-hidden />}
      {chip.mark === 'pulse' && (
        <span
          aria-hidden
          className="bg-muted-foreground size-1.5 animate-pulse rounded-full motion-reduce:animate-none"
        />
      )}
      {chip.label}
    </Badge>
  );
}
