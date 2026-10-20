import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@rainforest-dev/rainforest-react';
import { LockIcon } from 'lucide-react';

import { ROOM_NAMESPACE } from '@/locales';

export function ReadOnlyBanner() {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Alert variant="warning" role="status">
      <LockIcon />
      <AlertTitle>{t('desk.readOnly.title')}</AlertTitle>
      <AlertDescription>
        {t('desk.readOnly.note')} {t('desk.readOnly.off')}
      </AlertDescription>
    </Alert>
  );
}
