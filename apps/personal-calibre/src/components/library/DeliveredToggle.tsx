'use client';

import { ToggleGroup, ToggleGroupItem } from '@rainforest-dev/rainforest-react';

export function DeliveredToggle({
  delivered,
  onChange,
}: {
  delivered: boolean;
  onChange: (delivered: boolean) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Delivery status"
      variant="outline"
      size="sm"
      className="my-1 ml-2"
      value={[delivered ? 'on' : 'not-on']}
      onValueChange={(values) => {
        if (values[0] === 'on') onChange(true);
        if (values[0] === 'not-on') onChange(false);
      }}
    >
      <ToggleGroupItem value="on">On</ToggleGroupItem>
      <ToggleGroupItem value="not-on">Not on</ToggleGroupItem>
    </ToggleGroup>
  );
}
