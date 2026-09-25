import { useEffect, useState } from 'react';

import { dayInUrl } from '../lib/client/day-url.ts';

export function useActiveDay(initial: string | undefined) {
  const [date, setDate] = useState(initial);
  useEffect(() => {
    const onDay = (e: CustomEvent<{ date: string }>) => setDate(e.detail.date);
    document.addEventListener('memories:day', onDay);
    // day-stream.ts may replace the URL before this island hydrates, losing a memories:day fired earlier.
    setDate(dayInUrl() ?? initial);
    return () => document.removeEventListener('memories:day', onDay);
  }, [initial]);
  return date;
}
