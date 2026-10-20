'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Button,
  ButtonGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import {
  GROUP_BYS,
  parseLibraryParams,
  SORT_BYS,
  type SortBy,
  STUDY_GROUP_BYS,
} from '@/lib';
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

const STUDY_GROUP_VALUES: readonly string[] = STUDY_GROUP_BYS;

const GROUP_VALUES = ['none', 'series', 'tag', 'author'] as const;
const GROUP_KEYS = {
  none: 'sort.groupNone',
  series: 'sort.series',
  tag: 'sort.tag',
  author: 'sort.author',
} as const;

const SORT_VALUES: readonly SortBy[] = [
  'title',
  'author',
  'added',
  'pubdate',
  'rating',
];

export function GroupSelect({ className }: { className?: string }) {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams, view } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const items = GROUP_VALUES.filter(
    (value) => view !== 'study' || STUDY_GROUP_VALUES.includes(value),
  ).map((value) => ({ value, label: t(GROUP_KEYS[value]) }));
  return (
    <Select
      items={items}
      value={params.groupBy ?? 'none'}
      onValueChange={(value) => {
        const next = GROUP_BYS.find((g) => g === value) ?? null;
        replaceParams({ groupBy: next });
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t('sort.group')}
        className={className}
      >
        <span className="text-muted-foreground text-xs">{t('sort.group')}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortControls() {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  const descending = params.sortDir === 'desc';
  const t = useLibraryT(CALIBRE_NAMESPACE);
  const sortItems = SORT_VALUES.map((value) => ({
    value,
    label: t(`sort.${value}`),
  }));
  return (
    <ButtonGroup aria-label={t('sort.label')}>
      <Select
        items={sortItems}
        value={params.sortBy}
        onValueChange={(value) => {
          const next = SORT_BYS.find((s) => s === value);
          if (next) replaceParams({ sortBy: next });
        }}
      >
        <SelectTrigger size="sm" aria-label={t('sort.label')}>
          <span className="text-muted-foreground text-xs">
            {t('sort.label')}
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t('sort.direction', {
          dir: t(descending ? 'sort.desc' : 'sort.asc'),
        })}
        onClick={() => replaceParams({ sortDir: descending ? 'asc' : 'desc' })}
      >
        {descending ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
      </Button>
    </ButtonGroup>
  );
}
