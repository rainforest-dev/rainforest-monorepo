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
  RENDERER_LABELS,
  rendererLabel,
  RENDERERS,
} from '@/lib';
import { useHall } from '@/providers';

export function RendererSelect() {
  const { renderer, backend, setRenderer } = useHall();
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
      <SelectTrigger size="sm" aria-label="繪製方式">
        <span className="text-muted-foreground text-xs">繪製</span>
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
