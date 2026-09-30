'use client';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type * as React from 'react';
import { useSyncExternalStore } from 'react';
import { Toaster as Sonner, type ToasterProps as SonnerProps } from 'sonner';

export { toast } from 'sonner';

type Scheme = NonNullable<SonnerProps['theme']>;

function readScheme(): Scheme {
  const forced = document.documentElement.dataset['scheme'];
  return forced === 'light' || forced === 'dark' ? forced : 'system';
}

function subscribeScheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-scheme'],
  });
  return () => observer.disconnect();
}

export type ToasterProps = SonnerProps;

/** Mount once per app to show `toast()` messages. Follows `data-scheme` on `<html>`, else the OS. */
export function Toaster({ theme, ...props }: ToasterProps) {
  const scheme = useSyncExternalStore(
    subscribeScheme,
    readScheme,
    () => 'system' as const,
  );

  return (
    <Sonner
      theme={theme ?? scheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
