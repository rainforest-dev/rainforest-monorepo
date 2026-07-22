import type { JSX } from 'react';

import { cx } from './ui';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — rendered as aria-label; the visible text label sits beside it. */
  label?: string;
  className?: string;
}

/**
 * A real toggle switch: a rounded track with a sliding knob. Replaces the
 * stretched native checkboxes (`h-5 w-9`) the islands used for binary mode
 * toggles — those rendered as an ambiguous wide checkbox rather than an on/off
 * switch, which read as broken. Genuine multi-select options (relay-gate's
 * conditions, affected-pipeline's changed files) stay as checkboxes; only
 * on/off mode toggles use this.
 */
export function Switch({
  checked,
  onChange,
  label,
  className,
}: SwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export default Switch;
