import { Badge } from '@rainforest-dev/rainforest-react';

import { platformName } from '@/lib/platforms';
import type { DeliveryPlatform } from '@/types/delivery';

export function DeliveryPills({
  keys,
  platforms,
}: {
  keys: readonly string[];
  platforms: readonly DeliveryPlatform[];
}) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) {
    return (
      <span
        role="img"
        aria-label="Not delivered"
        className="text-muted-foreground"
      >
        —
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {unique.map((key) => (
        <Badge key={key} variant="success">
          {platformName(platforms, key)}
        </Badge>
      ))}
    </span>
  );
}
