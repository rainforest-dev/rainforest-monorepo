import { useLibraryT } from '@rainforest-dev/library-shell';
import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import type { DeskPatch, FilterChip } from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

export interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (patch: DeskPatch) => void;
  onClear: () => void;
}

export function FilterChips({ chips, onRemove, onClear }: FilterChipsProps) {
  const t = useLibraryT(ROOM_NAMESPACE);
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label={t('desk.filters.active')}
      className="flex items-center gap-1.5 max-lg:overflow-x-auto max-lg:pb-1 lg:flex-wrap"
    >
      {chips.map((chip) => (
        <li key={chip.key} className="min-w-0 max-lg:shrink-0">
          <Badge variant="muted" className="h-6 max-w-full gap-1 pr-0.5">
            <span className="truncate">{chip.label}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t('desk.filters.remove', { label: chip.label })}
              className="size-5 rounded-full"
              onClick={() => onRemove(chip.patch)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </Badge>
        </li>
      ))}
      <li className="max-lg:shrink-0">
        <Button variant="link" size="xs" onClick={onClear}>
          {t('desk.filters.clearAll')}
        </Button>
      </li>
    </ul>
  );
}
