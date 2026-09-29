import { type BrowserContext, expect, type Page } from '@playwright/test';

export const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3333';
export const PREFS_COOKIE = 'calibre-prefs';
export const FAULT_COOKIE = 'calibre-e2e-fault';

export async function gotoLibrary(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('[data-library-ready]')).toHaveCount(1);
  const isList = (url.split('?')[0] || '/') === '/';
  if (isList) {
    await expect(
      page.locator('[data-view-region][data-view-ready]'),
    ).toHaveCount(1);
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

export async function setPrefs(
  context: BrowserContext,
  prefs: { view?: string; panel?: boolean; renderer?: string },
): Promise<void> {
  const value = { view: 'shelf', panel: true, renderer: 'three-tsl', ...prefs };
  await context.addCookies([
    {
      name: PREFS_COOKIE,
      value: encodeURIComponent(JSON.stringify(value)),
      url: BASE_URL,
    },
  ]);
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
