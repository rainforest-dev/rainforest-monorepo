'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const availableTags = allTags.filter((t) => t.id !== null && !existingIds.has(t.id));
  const matchesExisting = allTags.some(
    (t) => t.name?.toLowerCase() === inputValue.toLowerCase(),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tagIds.map((tag) => (
        <span
          key={tag.id}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        >
          {tag.name}
          <button
            type="button"
            disabled={busy}
            onClick={() => removeTag(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="hover:text-destructive disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={busy}
          className="border-input text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-2.5 py-0.5 text-xs disabled:opacity-50"
        >
          + Add tag
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag…"
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandEmpty>
              {inputValue.trim() ? (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm"
                  onClick={() => addTag(inputValue)}
                >
                  Create &quot;{inputValue.trim()}&quot;
                </button>
              ) : (
                'No tags found.'
              )}
            </CommandEmpty>
            <CommandList>
              {availableTags.map((t) => (
                <CommandItem key={t.id} value={t.name ?? ''} onSelect={() => addTag(t.name ?? '')}>
                  {t.name}
                </CommandItem>
              ))}
              {inputValue.trim() && !matchesExisting && (
                <CommandItem
                  value={`__create__${inputValue}`}
                  onSelect={() => addTag(inputValue)}
                >
                  Create &quot;{inputValue.trim()}&quot;
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
