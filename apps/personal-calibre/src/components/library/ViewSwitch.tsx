'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Kbd,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { LayoutGrid, Library, type LucideIcon, Rows3 } from 'lucide-react';

import { cn, ENABLED_VIEWS, isView, type View } from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

const ITEMS: Array<{ view: View; Icon: LucideIcon }> = [
  { view: 'shelf', Icon: LayoutGrid },
  { view: 'catalogue', Icon: Rows3 },
  { view: 'study', Icon: Library },
];

export function ViewSwitch({ className }: { className?: string }) {
  const { view, setView } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <ToggleGroup
        aria-label={t('view.label')}
        variant="outline"
        size="sm"
        value={[view]}
        onValueChange={(values) => {
          const next: unknown = values[0];
          if (isView(next)) setView(next);
        }}
      >
        {ITEMS.filter((item) => ENABLED_VIEWS.includes(item.view)).map(
          ({ view: item, Icon }) => (
            <Tooltip key={item}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={item}
                    aria-label={t('view.region', { name: t(`view.${item}`) })}
                  />
                }
              >
                <Icon aria-hidden />
                <span className="hidden lg:inline">{t(`view.${item}`)}</span>
              </TooltipTrigger>
              <TooltipContent>{t(`view.tooltip.${item}`)}</TooltipContent>
            </Tooltip>
          ),
        )}
      </ToggleGroup>
      <Kbd className="hidden lg:inline-flex">v</Kbd>
    </div>
  );
}
