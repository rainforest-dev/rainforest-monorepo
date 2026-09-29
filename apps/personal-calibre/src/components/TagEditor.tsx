'use client';

import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rainforest-dev/rainforest-react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { FilterOptions } from '@/types/calibre';

interface Props {
  bookId: number;
  tagIds: Array<{ id: number; name: string }>;
  allTags: FilterOptions['tags'];
}

export function TagEditor({ bookId, tagIds, allTags }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputValue, setInputValue] = useState('');

  async function removeTag(tagId: number) {
    setBusy(true);
    try {
      await fetch(`/api/books/${bookId}/tags/${tagId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setOpen(false);
    setInputValue('');
    try {
      await fetch(`/api/books/${bookId}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const existingIds = new Set(tagIds.map((t) => t.id));
  const availableTags = allTags.filter((t) => !existingIds.has(t.id));
  const trimmed = inputValue.trim();
  const matchesExisting = allTags.some(
    (t) => t.name?.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tagIds.map((tag) => (
        <span
          key={tag.id}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium"
        >
          {tag.name}
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeTag(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="hover:bg-foreground/10 rounded-full p-0.5 disabled:opacity-50"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={busy}
          render={
            <Button variant="outline" size="xs" className="rounded-full" />
          }
        >
          <Plus aria-hidden />
          Add tag
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput
              name="tagSearch"
              aria-label="Search or create tag"
              placeholder="Search or create tag…"
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {trimmed ? `Create "${trimmed}"` : 'No tags found.'}
              </CommandEmpty>
              {availableTags.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.name ?? ''}
                  onSelect={() => void addTag(t.name ?? '')}
                >
                  {t.name}
                </CommandItem>
              ))}
              {trimmed && !matchesExisting && (
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => void addTag(trimmed)}
                >
                  Create &quot;{trimmed}&quot;
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
