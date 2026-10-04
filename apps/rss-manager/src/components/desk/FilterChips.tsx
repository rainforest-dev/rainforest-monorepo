import { Badge, Button } from '@rainforest-dev/rainforest-react';
import { XIcon } from 'lucide-react';

import type { DeskPatch, FilterChip } from '@/lib/desk';

export interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (patch: DeskPatch) => void;
  onClear: () => void;
}

export function FilterChips({ chips, onRemove, onClear }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label="Active filters"
      className="flex items-center gap-1.5 max-lg:overflow-x-auto max-lg:pb-1 lg:flex-wrap"
    >
      {chips.map((chip) => (
        <li key={chip.key} className="min-w-0 max-lg:shrink-0">
          <Badge variant="muted" className="h-6 max-w-full gap-1 pr-0.5">
            <span className="truncate">{chip.label}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${chip.label}`}
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
          Clear all
        </Button>
      </li>
    </ul>
  );
}
