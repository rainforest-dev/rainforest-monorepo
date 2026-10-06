'use client';

import { Badge } from '@rainforest-dev/rainforest-react';
import { useSearchParams } from 'next/navigation';

import { backendLabel, isDebug } from '@/lib';
import { useLibrary } from '@/providers';

export function BackendBadge() {
  const debug = isDebug(useSearchParams());
  const { view, renderer, backend } = useLibrary();
  if (!debug || view !== 'study') return null;
  return (
    <Badge
      variant="outline"
      className="block max-w-full truncate font-mono"
      data-backend-badge=""
    >
      {backendLabel(renderer, backend)}
    </Badge>
  );
}
