import { Suspense } from 'react';

import { HallApp } from '@/components/app';
import { HallSkeleton } from '@/components/hall';

/**
 * Static on purpose: a dynamic page is sent `no-store`, which keeps it out of the bfcache, and
 * the way back from a book to the hall should be instant. The shelves arrive from `/api/items`.
 */
export default function HallPage() {
  return (
    <Suspense fallback={<HallSkeleton />}>
      <HallApp />
    </Suspense>
  );
}
