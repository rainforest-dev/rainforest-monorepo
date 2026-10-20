'use client';

import { LoadError } from '@/components/library';

export default function PaneError({ retry }: { retry: () => void }) {
  return <LoadError variant="compact" onRetry={retry} />;
}
