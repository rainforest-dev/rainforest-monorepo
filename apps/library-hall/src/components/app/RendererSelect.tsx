'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';

import {
  ENABLED_RENDERERS,
  RENDERER_LABELS,
  rendererLabel,
  RENDERERS,
} from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

export function RendererSelect() {
  const { renderer, backend, setRenderer } = useHall();
  const t = useLibraryT(HALL_NAMESPACE);
  if (ENABLED_RENDERERS.length < 2) return null;
  const items = ENABLED_RENDERERS.map((value) => ({
    value,
    label: RENDERER_LABELS[value],
  }));
  return (
    <Select
      items={items}
      value={renderer}
      onValueChange={(value) => {
        const next = RENDERERS.find((r) => r === value);
        if (next) setRenderer(next);
      }}
    >
      <SelectTrigger size="sm" aria-label={t('study.renderer')}>
        <span className="text-muted-foreground text-xs">
          {t('study.rendererShort')}
        </span>
        <SelectValue>{rendererLabel(renderer, backend)}</SelectValue>
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
