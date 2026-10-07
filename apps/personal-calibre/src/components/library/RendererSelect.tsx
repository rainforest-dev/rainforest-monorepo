'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rainforest-dev/rainforest-react';

import {
  ENABLED_RENDERERS,
  type Renderer,
  RENDERER_LABELS,
  rendererLabel,
  RENDERERS,
} from '@/lib';
import { useLibrary } from '@/providers';

export function RendererSelect() {
  const { view, renderer, backend, setRenderer } = useLibrary();
  if (view !== 'study' || ENABLED_RENDERERS.length < 2) return null;
  const shown: readonly Renderer[] = ENABLED_RENDERERS.includes(renderer)
    ? ENABLED_RENDERERS
    : [...ENABLED_RENDERERS, renderer];
  const items = shown.map((value) => ({
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
      <SelectTrigger size="sm" aria-label="Renderer">
        <span className="text-muted-foreground text-xs">Renderer</span>
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
