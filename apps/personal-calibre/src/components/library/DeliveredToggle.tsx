'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { ToggleGroup, ToggleGroupItem } from '@rainforest-dev/rainforest-react';

import { CALIBRE_NAMESPACE } from '@/locales';

export function DeliveredToggle({
  delivered,
  onChange,
}: {
  delivered: boolean;
  onChange: (delivered: boolean) => void;
}) {
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <ToggleGroup
      aria-label={t('filters.deliveryStatus')}
      variant="outline"
      size="sm"
      className="my-1 ml-2"
      value={[delivered ? 'on' : 'not-on']}
      onValueChange={(values) => {
        if (values[0] === 'on') onChange(true);
        if (values[0] === 'not-on') onChange(false);
      }}
    >
      <ToggleGroupItem value="on">{t('filters.onToggle')}</ToggleGroupItem>
      <ToggleGroupItem value="not-on">
        {t('filters.notOnToggle')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
