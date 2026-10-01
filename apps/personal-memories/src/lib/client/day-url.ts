import { placeOf } from '@/lib/nav.ts';

export function dayInUrl(): string | undefined {
  const place = placeOf(location.pathname);
  return place?.level === 'day' ? place.date : undefined;
}
