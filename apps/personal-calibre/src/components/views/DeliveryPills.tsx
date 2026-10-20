'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Badge } from '@rainforest-dev/rainforest-react';
import { Check } from 'lucide-react';

import { platformName } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import type { DeliveryPlatform } from '@/types';

export function DeliveryPills({
  keys,
  platforms,
}: {
  keys: readonly string[];
  platforms: readonly DeliveryPlatform[];
}) {
  const unique = [...new Set(keys)];
  const t = useLibraryT(CALIBRE_NAMESPACE);
  if (unique.length === 0) {
    return (
      <span
        role="img"
        aria-label={t('notDelivered')}
        className="text-muted-foreground"
      >
        —
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {unique.map((key) => (
        <Badge key={key} variant="success" className="text-foreground">
          <Check className="text-success" aria-hidden />
          {platformName(platforms, key)}
        </Badge>
      ))}
    </span>
  );
}
