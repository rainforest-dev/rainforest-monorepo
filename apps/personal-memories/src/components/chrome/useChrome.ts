import { useEffect, useState } from 'react';

import { type Level, levelHrefs, type Place } from '../../lib/nav.ts';
import { useActiveDay } from '../useActiveDay.ts';
import { useOverlay } from '../useOverlay.ts';

export type DayCount = { date: string; total: number };

const DATA_APPBAR_READY = 'data-appbar-ready';

export function useChrome(place: Place, initial: Record<Level, string>) {
  const active = useActiveDay(place.level === 'day' ? place.date : undefined);
  const hrefs =
    place.level === 'day' && active
      ? levelHrefs({ level: 'day', date: active }, [])
      : initial;
  const [jumpOpen, setJumpOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [days, setDays] = useState<DayCount[] | 'error'>();

  useEffect(() => {
    const onJump = () => setJumpOpen(true);
    const onKeys = () => setKeysOpen(true);
    document.addEventListener('memories:open-jump', onJump);
    document.addEventListener('memories:open-shortcuts', onKeys);
    // A click before client:load hydration attaches these listeners lands on inert SSR markup and is dropped.
    document.documentElement.setAttribute(DATA_APPBAR_READY, '');
    return () => {
      document.removeEventListener('memories:open-jump', onJump);
      document.removeEventListener('memories:open-shortcuts', onKeys);
      document.documentElement.removeAttribute(DATA_APPBAR_READY);
    };
  }, []);

  useEffect(() => {
    if (!jumpOpen || Array.isArray(days)) return;
    let live = true;
    fetch('/days.json')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<DayCount[]>)
          : Promise.reject(new Error(String(r.status))),
      )
      .then(
        (list) => live && setDays(list),
        () => live && setDays('error'),
      );
    return () => {
      live = false;
    };
  }, [jumpOpen, days]);

  useOverlay(jumpOpen || keysOpen);
  return { hrefs, jumpOpen, setJumpOpen, keysOpen, setKeysOpen, days };
}
