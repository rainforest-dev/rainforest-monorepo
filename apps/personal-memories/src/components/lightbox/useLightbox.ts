import { useCallback, useEffect, useRef, useState } from 'react';

import type { LightboxDetail } from '../../lib/client/events.ts';
import {
  DATA_LIGHTBOX_READY,
  type LightboxRequest,
  stepIndex,
} from '../../lib/lightbox.ts';
import { useOverlay } from '../useOverlay.ts';

export function useLightbox() {
  const [request, setRequest] = useState<LightboxRequest>();
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = (e: CustomEvent<LightboxDetail>) => {
      const { trigger: el, ...rest } = e.detail;
      trigger.current = el;
      setRequest(rest);
    };
    document.addEventListener('memories:lightbox', onOpen);
    document.documentElement.setAttribute(DATA_LIGHTBOX_READY, '');
    return () => {
      document.removeEventListener('memories:lightbox', onOpen);
      document.documentElement.removeAttribute(DATA_LIGHTBOX_READY);
    };
  }, []);
  useOverlay(request !== undefined);

  const step = useCallback(
    (delta: number) =>
      setRequest(
        (r) => r && { ...r, index: stepIndex(r.index, r.items.length, delta) },
      ),
    [],
  );
  const select = useCallback(
    (index: number) =>
      setRequest(
        (r) => r && { ...r, index: stepIndex(0, r.items.length, index) },
      ),
    [],
  );
  const close = useCallback(() => setRequest(undefined), []);
  return { request, trigger, step, select, close };
}
