import { ToggleGroup, ToggleGroupItem } from '@rainforest-dev/rainforest-react';

import { SOURCES } from '../../lib/sources.ts';
import { useSourceFilter } from './useSourceFilter.ts';

export function SourceToggles({
  visible,
  onChange,
}: {
  visible: string[];
  onChange: (visible: string[]) => void;
}) {
  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      value={visible}
      onValueChange={(next) => onChange(next as string[])}
      aria-label="來源"
    >
      {SOURCES.map(({ source, label }) => (
        <ToggleGroupItem key={source} value={source}>
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function SourceFilter() {
  const { visible, change } = useSourceFilter();
  return <SourceToggles visible={visible} onChange={change} />;
}
