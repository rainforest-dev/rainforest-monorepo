import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@rainforest-dev/rainforest-react';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';

import type { FeedResult } from '@/lib/desk';

export function ValidateResult({ result }: { result: FeedResult }) {
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
      <AlertTitle>Valid {result.format?.toUpperCase()} feed</AlertTitle>
      <AlertDescription className="[&_p:not(:last-child)]:mb-0">
        {result.title && <p>Title: {result.title}</p>}
        {result.itemCount !== undefined && (
          <p>
            {result.itemCount} item{result.itemCount !== 1 ? 's' : ''} found
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
