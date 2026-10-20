'use client';

import {
  HTML_LANG,
  type LibraryLocale,
} from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import { Languages } from 'lucide-react';

import { useLibraryLocale, useLibraryT } from './i18n-provider';
import { writeLibraryPrefs } from './prefs';
import { announce } from './shared-state';

/** Each locale's name, written in that locale, as the switch shows it. */
const NAMES: Record<LibraryLocale, string> = { zh: '中文', en: 'EN' };
const OTHER: Record<LibraryLocale, LibraryLocale> = { zh: 'en', en: 'zh' };

/**
 * Switches the whole library to the other language. The pick goes in the shared prefs cookie,
 * so every app renders in it from the next request; this page reloads, other tabs follow.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLibraryLocale();
  const t = useLibraryT();
  const target = OTHER[locale];
  return (
    <button
      type="button"
      data-slot="locale-switch"
      title={t('locale.switchTo')}
      aria-label={t('locale.switchTo')}
      onClick={() => {
        writeLibraryPrefs({ locale: target });
        announce({ type: 'prefs-changed' });
        window.location.reload();
      }}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm outline-offset-1 focus-visible:outline-2',
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      <span lang={HTML_LANG[target]}>{NAMES[target]}</span>
    </button>
  );
}
