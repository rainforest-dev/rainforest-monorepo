import { useEffect, useState } from 'react';

export function useActiveDay(initial: string | undefined) {
  const [date, setDate] = useState(initial);
  useEffect(() => {
    const onDay = (e: CustomEvent<{ date: string }>) => setDate(e.detail.date);
    document.addEventListener('memories:day', onDay);
    return () => document.removeEventListener('memories:day', onDay);
  }, []);
  return date;
}
