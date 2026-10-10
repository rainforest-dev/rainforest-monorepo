import type { MarkerKind } from '@/lib';

export const KIND_BG: Record<MarkerKind, string> = {
  wfh: 'bg-info',
  leave: 'bg-warning',
};

export const KIND_BADGE: Record<MarkerKind, 'info' | 'warning'> = {
  wfh: 'info',
  leave: 'warning',
};
