'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOptions } from '@/types/calibre';

interface Props {
  filters: FilterOptions;
}

export function FilterPanel({ filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.replace(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        placeholder="Search books..."
        defaultValue={searchParams.get('q') ?? ''}
        className="w-48"
        onChange={(e) => {
          const val = e.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (val) {
            params.set('q', val);
          } else {
            params.delete('q');
          }
          params.delete('page');
          router.replace(`/?${params.toString()}`);
        }}
      />

      <Select
        value={searchParams.get('author') ?? 'all'}
        onValueChange={(v) => updateParam('author', v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Author" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All authors</SelectItem>
          {filters.authors.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>
              {a.name ?? a.sort}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('tag') ?? 'all'}
        onValueChange={(v) => updateParam('tag', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {filters.tags.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('series') ?? 'all'}
        onValueChange={(v) => updateParam('series', v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Series" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All series</SelectItem>
          {filters.series.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
