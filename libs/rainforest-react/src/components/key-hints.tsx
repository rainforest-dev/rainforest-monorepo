import type * as React from 'react';

import { cn } from '../lib/cn';
import { Kbd, KbdGroup } from './kbd';

interface KeyHint {
  keys: readonly string[];
  label: string;
}

interface KeyHintsProps extends React.ComponentProps<'div'> {
  hints: readonly KeyHint[];
}

/** A row of keyboard hints: each hint's keys in a KbdGroup, then its label. */
function KeyHints({ hints, className, ...props }: KeyHintsProps) {
  return (
    <div
      data-slot="key-hints"
      data-key-hints
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs',
        className,
      )}
      {...props}
    >
      {hints.map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1">
          <KbdGroup>
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          {hint.label}
        </span>
      ))}
    </div>
  );
}

export { KeyHints };

export type { KeyHint, KeyHintsProps };
