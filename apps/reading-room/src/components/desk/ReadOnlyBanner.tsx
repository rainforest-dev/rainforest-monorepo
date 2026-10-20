import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@rainforest-dev/rainforest-react';
import { LockIcon } from 'lucide-react';

import { READ_ONLY_NOTE } from '@/lib';

export function ReadOnlyBanner() {
  return (
    <Alert variant="warning" role="status">
      <LockIcon />
      <AlertTitle>Read-only vault</AlertTitle>
      <AlertDescription>
        {READ_ONLY_NOTE} Activate, Retire and Decline are turned off until it is
        mounted read-write.
      </AlertDescription>
    </Alert>
  );
}
