import { expect, type Locator, type Page } from '@playwright/test';

export type Tab = 'sources' | 'topics' | 'validate' | 'queue';

const READY: Record<Tab, (page: Page) => Locator> = {
  sources: (page) => page.getByRole('searchbox', { name: 'Filter sources' }),
  topics: (page) => page.getByRole('heading', { level: 3 }).first(),
  validate: (page) =>
    page.getByRole('textbox', { name: 'Feed URL to validate' }),
  queue: (page) => page.getByRole('heading', { level: 3 }).first(),
};

export async function gotoTab(page: Page, tab: Tab): Promise<void> {
  await page.goto(`/?tab=${tab}`);
  await expect(READY[tab](page)).toBeVisible();
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
