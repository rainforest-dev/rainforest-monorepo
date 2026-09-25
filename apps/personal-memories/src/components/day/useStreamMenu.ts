import { useEffect, useState } from 'react';

import type { LongPressDetail } from '../../lib/client/events.ts';
import { useOverlay } from '../useOverlay.ts';

export function useStreamMenu() {
  const [menu, setMenu] = useState<LongPressDetail>();
  useEffect(() => {
    const onPress = (e: CustomEvent<LongPressDetail>) => setMenu(e.detail);
    document.addEventListener('memories:longpress', onPress);
    return () => document.removeEventListener('memories:longpress', onPress);
  }, []);
  useOverlay(menu !== undefined);
  return {
    at: menu && { x: menu.x, y: menu.y },
    close: () => setMenu(undefined),
    annotate: () => {
      if (menu)
        document.dispatchEvent(
          new CustomEvent('memories:annotate', { detail: menu.anchor }),
        );
    },
    copy: () => {
      if (menu)
        void navigator.clipboard?.writeText(menu.text).catch(() => undefined);
    },
  };
}
