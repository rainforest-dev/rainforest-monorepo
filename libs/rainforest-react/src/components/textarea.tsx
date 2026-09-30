import * as React from 'react';

import { cn } from '../lib/cn';

/** A multi-line text field that grows with its content. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'field-sizing-content border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 flex min-h-16 w-full rounded-lg border bg-transparent px-2.5 py-2 text-base outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

export type TextareaProps = React.ComponentProps<typeof Textarea>;
