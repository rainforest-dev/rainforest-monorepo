'use client';

import { EVENTS_PAGE_HREF } from '@rainforest-dev/library-contract';
import { useLibraryT } from '@rainforest-dev/library-shell';

import { type HallRack, type RackTier } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';

/** Each tier's colour, the same on the 3D rack and on this card. */
export const RACK_TIER_TOKEN: Record<
  RackTier['shelf'],
  'chart-1' | 'chart-2' | 'chart-3' | 'chart-5'
> = {
  ending: 'chart-5',
  now: 'chart-2',
  market: 'chart-1',
  soon: 'chart-3',
};

/** The magazine rack without 3D: a link to the reading room's rack page, with each tier's count. */
export function RackCard({ rack }: { rack: HallRack | null }) {
  const t = useLibraryT(HALL_NAMESPACE);
  const tiers = rack?.tiers.filter((tier) => tier.count > 0) ?? [];
  return (
    <section data-hall-rack aria-label={t('rack.name')}>
      <h2 className="text-muted-foreground mb-2 text-sm font-semibold">
        {t('rack.name')}
      </h2>
      <a
        href={EVENTS_PAGE_HREF}
        className="bg-card hover:bg-muted focus-visible:ring-ring flex flex-col gap-2 rounded-lg border p-3 outline-none focus-visible:ring-2"
      >
        <span className="text-sm font-medium">
          {t('rack.open')}
          {rack && (
            <span className="text-muted-foreground ms-2 font-normal">
              {t('rack.count', { count: rack.total })}
            </span>
          )}
        </span>
        {tiers.length > 0 ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {tiers.map((tier) => (
              <span key={tier.shelf} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{
                    background: `var(--${RACK_TIER_TOKEN[tier.shelf]})`,
                  }}
                />
                {t(`rack.shelf.${tier.shelf}`)} {tier.count}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            {rack ? t('rack.empty') : t('rack.hint')}
          </span>
        )}
      </a>
    </section>
  );
}
