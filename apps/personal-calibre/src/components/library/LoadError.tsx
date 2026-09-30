'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '@rainforest-dev/rainforest-react';
import { RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export function LoadError({
  variant,
  digest,
  onRetry,
}: {
  variant: 'page' | 'compact';
  digest?: string;
  onRetry: () => void;
}) {
  const compact = variant === 'compact';
  return (
    <Alert
      variant="destructive"
      data-load-error=""
      className={cn(compact ? 'm-4 w-auto' : 'my-6')}
    >
      <TriangleAlert aria-hidden />
      <AlertTitle>
        {compact ? "Couldn't load this book" : "Couldn't load the library"}
      </AlertTitle>
      {!compact && (
        <AlertDescription>
          <p>
            The book list request failed. Your filters and selection are kept,
            so a retry picks up where you were.
          </p>
          {digest && <p className="font-mono text-xs">{digest}</p>}
        </AlertDescription>
      )}
      <div className="col-start-2 mt-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          Retry
        </Button>
      </div>
    </Alert>
  );
}
