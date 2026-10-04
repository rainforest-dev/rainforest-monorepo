import { expect, type Locator, type Page } from '@playwright/test';

import { waitForHydration } from './desk';

export const PHONE_HEIGHT = 844;

// Astro's dev toolbar sits over the bottom edge at 390 and takes the taps meant for the floating bar and the Sheet footers.
export async function hideDevToolbar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.head.append(style);
    });
  });
}

export async function gotoPhone(page: Page, search = ''): Promise<void> {
  await page.goto(`/${search}`);
  await waitForHydration(page);
}

export const itemList = (page: Page, name: string): Locator =>
  page.getByRole('list', { name, exact: true });

export const sourceItems = (page: Page): Locator =>
  itemList(page, 'Sources').getByRole('listitem');

export const sourceItem = (page: Page, name: string): Locator =>
  sourceItems(page).filter({ has: page.getByText(name, { exact: true }) });

export const sourceItemButton = (page: Page, name: string): Locator =>
  sourceItem(page, name).getByRole('button', { name, exact: true });

export const topicItems = (page: Page): Locator =>
  itemList(page, 'Topics').getByRole('listitem');

export const topicItem = (page: Page, name: string): Locator =>
  topicItems(page).filter({ has: page.getByText(name, { exact: true }) });

export const queueItems = (page: Page): Locator =>
  itemList(page, 'Reading queue').getByRole('listitem');

export const filtersButton = (page: Page): Locator =>
  page.getByRole('button', { name: /^Filters/ });

export const filterSheet = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Filters' });

export const sheetFacet = (page: Page, group: string, label: string): Locator =>
  filterSheet(page)
    .getByRole('group', { name: group })
    .getByRole('checkbox', { name: new RegExp(`^${label} \\d+$`) });

export const detailSheet = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Source details' });

export async function openFilterSheet(page: Page): Promise<Locator> {
  await filtersButton(page).click();
  const sheet = filterSheet(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function expectNoSideScroll(page: Page): Promise<void> {
  expect(
    await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: window.innerWidth,
    })),
  ).toEqual({ scroll: 390, width: 390 });
}
