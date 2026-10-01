import { useEffect } from 'react';

import { holdOverlay } from '@/lib/client';

export function useOverlay(open: boolean) {
  useEffect(() => (open ? holdOverlay() : undefined), [open]);
}
