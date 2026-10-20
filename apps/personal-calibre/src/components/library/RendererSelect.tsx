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
import { CALIBRE_NAMESPACE } from '@/locales';
import { useLibrary } from '@/providers';

export function RendererSelect() {
  const { view, renderer, backend, setRenderer } = useLibrary();
  const t = useLibraryT(CALIBRE_NAMESPACE);
  if (view !== 'study' || ENABLED_RENDERERS.length < 2) return null;
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
      <SelectTrigger size="sm" aria-label={t('renderer.label')}>
        <span className="text-muted-foreground text-xs">
          {t('renderer.label')}
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
