'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '@rainforest-dev/rainforest-react';
import { RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';

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
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <Alert
      variant="destructive"
      data-load-error=""
      className={cn(compact ? 'm-4 w-auto' : 'my-6')}
    >
      <TriangleAlert aria-hidden />
      <AlertTitle>
        {compact ? t('loadError.book') : t('loadError.library')}
      </AlertTitle>
      {!compact && (
        <AlertDescription>
          <p>{t('loadError.detail')}</p>
          {digest && <p className="font-mono text-xs">{digest}</p>}
        </AlertDescription>
      )}
      <div className="col-start-2 mt-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          {t('loadError.retry')}
        </Button>
      </div>
    </Alert>
  );
}
