import { expect, type Locator, type Page } from '@playwright/test';

export type Tab = 'sources' | 'topics' | 'queue';

const READY: Record<Tab, (page: Page) => Locator> = {
  sources: (page) => page.getByRole('searchbox', { name: 'Filter sources' }),
  topics: (page) => page.getByRole('heading', { level: 3 }).first(),
  queue: (page) => page.getByRole('heading', { level: 3 }).first(),
};

const TAB_LABEL: Record<Tab, string> = {
  sources: 'Sources',
  topics: 'Topics',
  queue: 'Queue',
};

export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

export async function gotoTab(page: Page, tab: Tab): Promise<void> {
  await page.goto(tab === 'sources' ? '/' : `/?tab=${tab}`);
  await waitForHydration(page);
  await expect(READY[tab](page)).toBeVisible();
}

export const tabSkeleton = (page: Page): Locator =>
  page.locator('[aria-busy="true"][aria-label="Loading"]');

export const deskTab = (page: Page, tab: Tab): Locator =>
  page.getByRole('tab', { name: new RegExp(`^${TAB_LABEL[tab]}\\b`) });

export const validateTrigger = (page: Page): Locator =>
  page.getByRole('button', { name: 'Validate URL' });

export const validatePopover = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Validate a feed' });

export async function openValidate(page: Page): Promise<Locator> {
  await validateTrigger(page).click();
  const popover = validatePopover(page);
  await expect(popover).toBeVisible();
  return popover;
}

export const sourceRows = (page: Page): Locator => page.locator('tbody tr');

export const sourceRow = (page: Page, name: string): Locator =>
  sourceRows(page).filter({ has: page.getByText(name, { exact: true }) });

export const topicCard = (page: Page, name: string): Locator =>
  page
    .locator('div.rounded-lg')
    .filter({ has: page.getByText(name, { exact: true }) });

export const READ_ONLY_NOTE =
  'The vault is mounted read-only, so the registry cannot be edited from here.';

export const READ_ONLY_BANNER = `${READ_ONLY_NOTE} Activate, Retire and Decline are turned off until it is mounted read-write.`;
