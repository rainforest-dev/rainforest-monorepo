import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { CircleXIcon } from 'lucide-react';

export interface LoadErrorProps {
  what: string;
  error: string;
  retrying: boolean;
  onRetry: () => void;
}

export function LoadError({ what, error, retrying, onRetry }: LoadErrorProps) {
  return (
    <Alert variant="destructive">
      <CircleXIcon />
      <AlertTitle>Couldn't read the {what}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 [&_p:not(:last-child)]:mb-0">
        <p>Nothing was changed. Retry after the vault finishes syncing.</p>
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
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
