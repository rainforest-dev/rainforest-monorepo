import { TooltipProvider } from '@rainforest-dev/rainforest-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeToggle } from '@/components/orbs/ThemeToggle.tsx';
import type { Level, Place } from '@/lib';
import { stepDay } from '@/lib/client';

import { DateJump } from './DateJump.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { TopBar } from './TopBar.tsx';
import { type StepHrefs, useChrome } from './useChrome.ts';

type Props = {
  place: Place;
  hrefs: Record<Level, string>;
  step?: StepHrefs | undefined;
  insideOut?: boolean;
};

const queryClient = new QueryClient();

const go = (date: string, nearest: boolean) =>
  location.assign(`/day/${date}${nearest ? '?nearest=1' : ''}`);

export function AppBar({ place, hrefs, step, insideOut = false }: Props) {
  const chrome = useChrome(place, hrefs, step);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TopBar
          level={place.level}
          hrefs={chrome.hrefs}
          back={chrome.back}
          onJump={() => chrome.setJumpOpen(true)}
          onKeys={() => chrome.setKeysOpen(true)}
          onStep={place.level === 'day' ? stepDay : undefined}
          stepHrefs={chrome.step}
          trailing={insideOut ? <ThemeToggle /> : undefined}
        />
        <DateJump
          open={chrome.jumpOpen}
          onOpenChange={chrome.setJumpOpen}
          days={chrome.days}
          onGo={go}
        />
        <ShortcutsDialog
          open={chrome.keysOpen}
          onOpenChange={chrome.setKeysOpen}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
