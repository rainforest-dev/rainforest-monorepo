import { LIBRARY_PREFS_COOKIE } from '@rainforest-dev/library-contract';

/**
 * The attribute on `<html>` that says the left column is closed. CSS reads it through the
 * `sidebar-closed:` variant, so every app collapses its column the same way, before paint.
 */
export const SIDEBAR_ATTRIBUTE = 'data-library-sidebar';

/**
 * Sticky side column classes: below the bar and the section row, as tall as what is left of
 * the viewport. Each app adds its own colours and border.
 */
export const SIDE_COLUMN =
  'hidden lg:sticky lg:top-(--library-top) lg:block lg:h-[calc(100dvh-var(--library-top))] lg:overflow-y-auto';

/** The left column's own classes: a side column that the sidebar toggle hides. */
export const SIDEBAR_COLUMN = `${SIDE_COLUMN} lg:sidebar-closed:hidden`;

/**
 * The desktop grid of a page with a left column, from `lg` up. Every width comes from the
 * shell's tokens: `--library-sidebar` on the left, `--library-pane` for a detail pane on the
 * right, `--library-aside` for a narrower reading column. Without the left column the grid
 * drops its track, so the content takes the room.
 */
export const SIDEBAR_GRID = {
  main: 'lg:grid lg:grid-cols-[var(--library-sidebar)_minmax(0,1fr)] lg:sidebar-closed:grid-cols-[minmax(0,1fr)]',
  pane: 'lg:grid lg:grid-cols-[var(--library-sidebar)_minmax(0,1fr)_var(--library-pane)] lg:sidebar-closed:grid-cols-[minmax(0,1fr)_var(--library-pane)]',
  aside:
    'lg:grid lg:grid-cols-[var(--library-sidebar)_minmax(0,1fr)_var(--library-aside)] lg:sidebar-closed:grid-cols-[minmax(0,1fr)_var(--library-aside)]',
} as const;

/**
 * An inline script for `<head>` that applies the reader's choice before the first paint, so a
 * closed column never flashes open. Kept free of imports: it runs as plain text.
 */
export function sidebarScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${LIBRARY_PREFS_COOKIE}=([^;]*)/);if(!m)return;var p=JSON.parse(decodeURIComponent(m[1]));if(p&&p.sidebar===false)document.documentElement.setAttribute('${SIDEBAR_ATTRIBUTE}','closed');}catch(e){}})();`;
}
