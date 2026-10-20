import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { CircleXIcon } from 'lucide-react';

import { ROOM_NAMESPACE } from '@/locales';

export interface LoadErrorProps {
  what: string;
  error: string;
  retrying: boolean;
  onRetry: () => void;
}

export function LoadError({ what, error, retrying, onRetry }: LoadErrorProps) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Alert variant="destructive">
      <CircleXIcon />
      <AlertTitle>{t('desk.loadError.title', { what })}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 [&_p:not(:last-child)]:mb-0">
        <p>{t('desk.loadError.hint')}</p>
        <code className="bg-muted text-foreground break-all rounded px-1.5 py-0.5 font-mono text-xs">
          {error}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying && <Spinner data-icon="inline-start" />}
          {t('desk.retry')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
