import { describe, expect, it } from 'vitest';

import { accentChip, accentRule } from './accent-classes.ts';

describe('accent classes', () => {
  it('draws the rule in the solid chart colour', () => {
    expect(accentRule(2)).toBe('border-chart-2');
    expect(accentRule(4)).toBe('border-chart-4');
    expect(accentRule(undefined)).toBe('border-muted-foreground');
  });

  it('tints the chip and rings it in the same colour', () => {
    expect(accentChip(4).split(' ')).toEqual(
      expect.arrayContaining(['bg-chart-4/20', 'ring-chart-4', 'ring-inset']),
    );
    expect(accentChip(undefined).split(' ')).toEqual(
      expect.arrayContaining(['bg-muted', 'ring-border']),
    );
  });
});
