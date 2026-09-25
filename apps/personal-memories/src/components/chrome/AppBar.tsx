import { TooltipProvider } from '@rainforest-dev/rainforest-react';

import { stepDay } from '../../lib/client/step-day.ts';
import type { Level, Place } from '../../lib/nav.ts';
import { DateJump } from './DateJump.tsx';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';
import { TopBar } from './TopBar.tsx';
import { useChrome } from './useChrome.ts';

type Props = { place: Place; hrefs: Record<Level, string> };

const go = (date: string, nearest: boolean) =>
  location.assign(`/day/${date}${nearest ? '?nearest=1' : ''}`);

export function AppBar({ place, hrefs }: Props) {
  const chrome = useChrome(place, hrefs);
  return (
    <TooltipProvider>
      <TopBar
        level={place.level}
        hrefs={chrome.hrefs}
        onJump={() => chrome.setJumpOpen(true)}
        onKeys={() => chrome.setKeysOpen(true)}
        onStep={place.level === 'day' ? stepDay : undefined}
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
  );
}
