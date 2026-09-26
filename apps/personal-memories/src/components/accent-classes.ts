import type { Accent } from '../lib/stream.ts';

const RULE: Record<Accent, string> = {
  1: 'border-chart-1',
  2: 'border-chart-2',
  3: 'border-chart-3',
  4: 'border-chart-4',
  5: 'border-chart-5',
};

const CHIP: Record<Accent, string> = {
  1: 'bg-chart-1/20 ring-chart-1',
  2: 'bg-chart-2/20 ring-chart-2',
  3: 'bg-chart-3/20 ring-chart-3',
  4: 'bg-chart-4/20 ring-chart-4',
  5: 'bg-chart-5/20 ring-chart-5',
};

export const accentRule = (accent: Accent | undefined) =>
  accent ? RULE[accent] : 'border-muted-foreground';

export const accentChip = (accent: Accent | undefined) =>
  `ring-[1.5px] ring-inset ${accent ? CHIP[accent] : 'bg-muted ring-border'}`;
