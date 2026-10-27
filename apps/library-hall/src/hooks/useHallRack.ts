'use client';

import { useEffect, useState } from 'react';

import { type HallRack } from '@/lib';

/**
 * The magazine rack's tiers from `/api/events`, read once when the hall opens: events change by
 * the day, not while a reader walks about. `null` until it arrives, or when it cannot be had.
 */
export function useHallRack(): HallRack | null {
  const [rack, setRack] = useState<HallRack | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const body = (await response.json()) as { rack?: HallRack };
        if (live && body.rack) setRack(body.rack);
      } catch {
        // An empty rack until the next visit.
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return rack;
}
