'use client';

import { LoadError } from '@/components/library';

export default function LibraryError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <LoadError variant="page" digest={error.digest} onRetry={retry} />;
}
