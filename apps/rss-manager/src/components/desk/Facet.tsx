import { Button, Checkbox } from '@rainforest-dev/rainforest-react';
import { useState } from 'react';

import type { FacetOption } from '@/lib/desk';

export interface FacetProps {
  title: string;
  options: FacetOption[];
  limit?: number;
  onToggle: (value: string) => void;
}

export function Facet({ title, options, limit, onToggle }: FacetProps) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = limit !== undefined && options.length > limit;
  const shown =
    collapsible && !expanded
      ? options.filter((o, i) => i < limit || o.selected)
      : options;

  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="text-muted-foreground mb-1 px-2 text-xs font-medium uppercase tracking-wide">
        {title}
      </legend>
      <ul className="flex flex-col">
        {shown.map((option) => (
          <li key={option.value}>
            <label className="hover:bg-sidebar-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm">
              <Checkbox
                checked={option.selected}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {option.count}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {collapsible && (
        <Button
          variant="link"
          size="xs"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </Button>
      )}
    </fieldset>
  );
}
