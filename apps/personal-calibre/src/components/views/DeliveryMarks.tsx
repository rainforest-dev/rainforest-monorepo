import { Check } from 'lucide-react';

import { platformAbbr, platformName } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import type { DeliveryPlatform } from '@/types/delivery';

export function DeliveryMarks({
  keys,
  platforms,
  className,
}: {
  keys: readonly string[];
  platforms: readonly DeliveryPlatform[];
  className?: string;
}) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return null;
  return (
    <span className={cn('flex flex-col items-end gap-1', className)}>
      {unique.map((key) => {
        const label = `On ${platformName(platforms, key)}`;
        return (
          <span
            key={key}
            role="img"
            aria-label={label}
            title={label}
            className="bg-background/90 text-foreground inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase leading-none"
          >
            <Check className="text-success size-3" aria-hidden />
            {platformAbbr(key)}
          </span>
        );
      })}
    </span>
  );
}
