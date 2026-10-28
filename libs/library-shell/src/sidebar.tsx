'use client';

import { Button, cn } from '@rainforest-dev/rainforest-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useLibraryT } from './i18n-provider';
import { SHELL_IDS } from './ids';
import { SIDEBAR_ATTRIBUTE } from './layout';
import { writeLibraryPrefs } from './prefs';

const CHANGE_EVENT = 'library-sidebar-change';

function readOpen(): boolean {
  return document.documentElement.getAttribute(SIDEBAR_ATTRIBUTE) !== 'closed';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Opens or closes the left column in every app on the hostname, and remembers it. */
export function setLibrarySidebar(open: boolean): void {
  if (open) document.documentElement.removeAttribute(SIDEBAR_ATTRIBUTE);
  else document.documentElement.setAttribute(SIDEBAR_ATTRIBUTE, 'closed');
  writeLibraryPrefs({ sidebar: open });
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Whether the left column is open, and a setter. Open on the server. */
export function useLibrarySidebar(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  return [open, setLibrarySidebar];
}

/**
 * The one button that opens and closes a collection's left column, from `lg` up. The library
 * bar always renders it first; CSS hides it on a page without the column.
 */
export function SidebarToggle({ className }: { className?: string }) {
  const [open, setOpen] = useLibrarySidebar();
  const t = useLibraryT();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      data-library-sidebar-toggle
      className={cn('hidden lg:inline-flex', className)}
      aria-label={open ? t('sidebar.hide') : t('sidebar.show')}
      aria-expanded={open}
      aria-controls={SHELL_IDS.sidebar}
      onClick={() => setOpen(!open)}
    >
      {open ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
    </Button>
  );
}
