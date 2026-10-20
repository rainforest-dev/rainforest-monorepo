import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@rainforest-dev/rainforest-react';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';

import type { FeedResult } from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

export function ValidateResult({ result }: { result: FeedResult }) {
  const t = useLibraryT(ROOM_NAMESPACE);
  if (!result.valid)
    return (
      <Alert variant="destructive">
        <CircleXIcon />
        <AlertTitle>{result.error}</AlertTitle>
      </Alert>
    );

  return (
    <Alert variant="success">
      <CircleCheckIcon />
      <AlertTitle>
        {t('desk.validate.valid', {
          format: result.format?.toUpperCase() ?? '',
        })}
      </AlertTitle>
      <AlertDescription className="[&_p:not(:last-child)]:mb-0">
        {result.title && (
          <p>{t('desk.validate.title', { title: result.title })}</p>
        )}
        {result.itemCount !== undefined && (
          <p>{t('desk.validate.items', { count: result.itemCount })}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
