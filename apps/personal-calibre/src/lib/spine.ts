const SPINE_CLASSES = [
  'bg-[color:color-mix(in_oklch,var(--chart-1)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-2)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-3)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-4)_45%,var(--muted))]',
  'bg-[color:color-mix(in_oklch,var(--chart-5)_45%,var(--muted))]',
] as const;

export function spineClass(id: number): string {
  return SPINE_CLASSES[id % SPINE_CLASSES.length] ?? SPINE_CLASSES[0];
}
