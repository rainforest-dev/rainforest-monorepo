'use client';

import { LoadError } from '@/components/library/LoadError';

export default function PaneError({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return <LoadError variant="compact" onRetry={unstable_retry} />;
}
