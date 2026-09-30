import { useEffect } from 'react';

import { holdOverlay } from '../lib/client/overlays.ts';

export function useOverlay(open: boolean) {
  useEffect(() => (open ? holdOverlay() : undefined), [open]);
}
