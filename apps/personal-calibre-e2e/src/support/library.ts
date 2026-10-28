import { type BrowserContext, expect, type Page } from '@playwright/test';

import { PORT } from './port';

export const BASE_URL = process.env['BASE_URL'] ?? `http://localhost:${PORT}`;
/** Where the app is mounted, its next.config `basePath`. */
export const BASE_PATH = '/books';

/** An in-app path (`/`, `/?book=1`, `/read/1`) as the URL the app answers at. */
export function appPath(path: string): string {
  if (path === '/') return BASE_PATH;
  return path.startsWith('/?')
    ? `${BASE_PATH}${path.slice(1)}`
    : `${BASE_PATH}${path}`;
}
export const PREFS_COOKIE = 'calibre-prefs';
export const FAULT_COOKIE = 'calibre-e2e-fault';

export async function gotoLibrary(page: Page, url = '/'): Promise<void> {
  await page.goto(appPath(url));
  await expect(page.locator('[data-library-ready]')).toHaveCount(1);
  const isList = (url.split('?')[0] || '/') === '/';
  if (isList) {
    await expect(
      page
        .locator('[data-view-region][data-view-ready], [data-load-error]')
        .first(),
    ).toBeVisible();
  }
}

export async function readPrefs(
  context: BrowserContext,
): Promise<Record<string, unknown> | null> {
  const cookie = (await context.cookies()).find((c) => c.name === PREFS_COOKIE);
  return cookie
    ? (JSON.parse(decodeURIComponent(cookie.value)) as Record<string, unknown>)
    : null;
}

/** The library-wide prefs cookie every app shares, such as whether the sidebar is open. */
export async function readLibraryPrefs(
  context: BrowserContext,
): Promise<Record<string, unknown> | null> {
  const cookie = (await context.cookies()).find(
    (c) => c.name === 'library-prefs',
  );
  return cookie
    ? (JSON.parse(decodeURIComponent(cookie.value)) as Record<string, unknown>)
    : null;
}

export async function setPrefs(
  context: BrowserContext,
  prefs: { view?: string; renderer?: string },
): Promise<void> {
  const value = { view: 'shelf', renderer: 'three-tsl', ...prefs };
  await context.addCookies([
    {
      name: PREFS_COOKIE,
      value: encodeURIComponent(JSON.stringify(value)),
      url: BASE_URL,
    },
  ]);
}

/**
 * The shared bar's own tab for this collection: back to the catalogue with no filters, in the
 * same app. The library's name next to it goes to the hall instead.
 */
export function booksTab(page: Page) {
  return page
    .getByRole('navigation', { name: 'Collections' })
    .getByRole('link', { name: 'Books', exact: true });
}

export function options(page: Page) {
  return page.getByRole('listbox', { name: 'Books' }).getByRole('option');
}

export function pane(page: Page) {
  return page.getByRole('complementary', { name: 'Book details' });
}

export async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}
