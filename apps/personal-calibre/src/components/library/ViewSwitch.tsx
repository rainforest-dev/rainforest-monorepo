'use client';

import {
  Kbd,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@rainforest-dev/rainforest-react';
import { LayoutGrid, Library, type LucideIcon, Rows3 } from 'lucide-react';

import { cn, ENABLED_VIEWS, isView, type View, VIEW_LABELS } from '@/lib';
import { useLibrary } from '@/providers';

const ITEMS: Array<{ view: View; tooltip: string; Icon: LucideIcon }> = [
  { view: 'shelf', tooltip: '書架 Shelf', Icon: LayoutGrid },
  { view: 'catalogue', tooltip: '目錄 Catalogue', Icon: Rows3 },
  { view: 'study', tooltip: '書房 Study', Icon: Library },
];

export function ViewSwitch({ className }: { className?: string }) {
  const { view, setView } = useLibrary();
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <ToggleGroup
        aria-label="View"
        variant="outline"
        size="sm"
        value={[view]}
        onValueChange={(values) => {
          const next: unknown = values[0];
          if (isView(next)) setView(next);
        }}
      >
        {ITEMS.filter((item) => ENABLED_VIEWS.includes(item.view)).map(
          ({ view: item, tooltip, Icon }) => (
            <Tooltip key={item}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={item}
                    aria-label={`${VIEW_LABELS[item]} view`}
                  />
                }
              >
                <Icon aria-hidden />
                <span className="hidden lg:inline">{VIEW_LABELS[item]}</span>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ),
        )}
      </ToggleGroup>
      <Kbd className="hidden lg:inline-flex">v</Kbd>
    </div>
  );
}
