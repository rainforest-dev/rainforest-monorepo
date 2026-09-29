'use client';

import {
  Button,
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@rainforest-dev/rainforest-react';
import { type ReactNode, useId, useState } from 'react';

import { cn } from '@/lib/utils';

const VISIBLE_OPTIONS = 8;

export interface FacetOption {
  value: string;
  label: string;
}

interface Props {
  title: string;
  allLabel: string;
  options: FacetOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  children?: ReactNode;
}

export function Facet({
  title,
  allLabel,
  options,
  value,
  onChange,
  children,
}: Props) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((o) => o.value === value);
  const visible = options.slice(0, VISIBLE_OPTIONS);
  const shown =
    selected && !visible.includes(selected) ? [...visible, selected] : visible;
  const filterLabel = `Filter ${title.toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3
        id={headingId}
        className="text-muted-foreground px-2 text-xs font-medium uppercase tracking-wide"
      >
        {title}
      </h3>
      {expanded ? (
        <Command label={title} className="h-auto rounded-md border p-0">
          <CommandInput placeholder={filterLabel} aria-label={filterLabel} />
          <CommandList>
            <CommandItem
              value="__all__"
              data-checked={value === null}
              onSelect={() => onChange(null)}
            >
              {allLabel}
            </CommandItem>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.value}`}
                data-checked={o.value === value}
                onSelect={() => onChange(o.value)}
              >
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      ) : (
        <ul className="flex flex-col">
          <li>
            <FacetButton
              label={allLabel}
              pressed={value === null}
              onClick={() => onChange(null)}
            />
          </li>
          {shown.map((o) => (
            <li key={o.value}>
              <FacetButton
                label={o.label}
                pressed={o.value === value}
                onClick={() => onChange(o.value === value ? null : o.value)}
              />
              {o.value === value && children}
            </li>
          ))}
        </ul>
      )}
      {options.length > VISIBLE_OPTIONS && (
        <Button
          variant="link"
          size="xs"
          className="text-foreground self-start"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : `Show all ${options.length}`}
        </Button>
      )}
    </section>
  );
}

function FacetButton({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'hover:bg-sidebar-accent w-full truncate rounded-md px-2 py-1 text-left text-sm',
        pressed &&
          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
      )}
    >
      {label}
    </button>
  );
}
