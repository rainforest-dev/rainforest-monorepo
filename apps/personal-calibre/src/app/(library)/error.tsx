'use client';

import { LoadError } from '@/components/library';

export default function LibraryError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <LoadError variant="page" digest={error.digest} onRetry={unstable_retry} />
  );
}
