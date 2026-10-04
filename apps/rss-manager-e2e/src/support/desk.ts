import { expect, type Locator, type Page } from '@playwright/test';

export type Tab = 'sources' | 'topics' | 'queue';

const READY: Record<Tab, (page: Page) => Locator> = {
  sources: (page) => page.getByRole('searchbox', { name: 'Search sources' }),
  topics: (page) => page.getByRole('searchbox', { name: 'Search topics' }),
  queue: (page) => page.getByRole('grid', { name: 'Reading queue' }),
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

export const SOURCES_PAGE_SIZE = 30;

export async function gotoSources(page: Page, search = ''): Promise<void> {
  await page.goto(`/${search}`);
  await waitForHydration(page);
}

export const sourceRows = (page: Page): Locator => page.locator('tbody tr');

export const sourceRow = (page: Page, name: string): Locator =>
  sourceRows(page).filter({ has: page.getByText(name, { exact: true }) });

export const sourceNames = (page: Page): Locator =>
  sourceRows(page).locator('[data-source-open]');

export const sourceSearch = (page: Page): Locator =>
  page.getByRole('searchbox', { name: 'Search sources' });

export const sourceCount = (page: Page): Locator =>
  page.getByRole('main').getByText(/^\d+( of \d+)? sources$/);

export const filterPanel = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Filters' });

export const facetOption = (
  page: Page,
  group: string,
  label: string,
): Locator =>
  filterPanel(page)
    .getByRole('group', { name: group })
    .getByRole('checkbox', {
      name: new RegExp(`^${escapeRegExp(label)} \\d+$`),
    });

export async function expectFacet(
  page: Page,
  group: string,
  label: string,
  count: number,
  checked = false,
): Promise<void> {
  const box = facetOption(page, group, label);
  await expect(box).toHaveAccessibleName(`${label} ${count}`);
  await expect(box).toHaveAttribute('aria-checked', String(checked));
}

export const chips = (page: Page): Locator =>
  page.getByRole('list', { name: 'Active filters' });

export const pager = (page: Page): Locator =>
  page.getByRole('navigation', { name: 'Pages' });

export const detailPane = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Source details' });

export async function openSource(page: Page, name: string): Promise<Locator> {
  await sourceRow(page, name).getByRole('button', { name }).click();
  const pane = detailPane(page);
  await expect(pane.getByRole('heading', { level: 2, name })).toBeVisible();
  return pane;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const topicsGrid = (page: Page): Locator =>
  page.getByRole('grid', { name: 'Topics' });

export const topicRows = (page: Page): Locator =>
  topicsGrid(page).locator('tbody tr');

export const topicRow = (page: Page, name: string): Locator =>
  topicRows(page).filter({ has: page.getByText(name, { exact: true }) });

export const topicSearch = (page: Page): Locator =>
  page.getByRole('searchbox', { name: 'Search topics' });

export const topicStatus = (page: Page): Locator =>
  page.getByRole('group', { name: 'Topic status' });

export const topicStatusButton = (page: Page, label: string): Locator =>
  topicStatus(page).getByRole('button', {
    name: new RegExp(`^${escapeRegExp(label)} \\d+$`),
  });

export const READ_ONLY_NOTE =
  'The vault is mounted read-only, so the registry cannot be edited from here.';

export const READ_ONLY_BANNER = `${READ_ONLY_NOTE} Activate, Retire and Decline are turned off until it is mounted read-write.`;

export const toasts = (page: Page): Locator =>
  page.locator('[data-sonner-toast]');

export const bulkToolbar = (page: Page): Locator =>
  page.getByRole('toolbar', { name: 'Bulk actions' });

export const bulkButton = (
  page: Page,
  action: 'Activate' | 'Retire' | 'Decline',
): Locator =>
  bulkToolbar(page)
    .getByRole('group', { name: 'Apply to selected' })
    .getByRole('button', { name: new RegExp(`${action} \\d+$`) });

export const selectedCount = (page: Page): Locator =>
  bulkToolbar(page).getByText(/^\d+ selected$/);

export async function startSelecting(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: /^Select all (on this page|shown)$/ }),
  ).toBeVisible();
}

export const rowCheckbox = (page: Page, name: string): Locator =>
  page.getByRole('checkbox', { name: `Select ${name}`, exact: true });

export function sectionOf(markdown: string, name: string): string | null {
  let section: string | null = null;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim();
    else if (line.includes(`**${name}**`)) return section;
  }
  return null;
}

export const READER_FEEDS_URL = 'https://read.readwise.io/feed/subscriptions';

export const queueGrid = (page: Page): Locator =>
  page.getByRole('grid', { name: 'Reading queue' });

export const queueRows = (page: Page): Locator =>
  queueGrid(page).locator('tbody tr');

export const queueTitles = (page: Page): Locator =>
  queueRows(page).locator('td:nth-child(3) a');

export const queueHeader = (page: Page, name: string): Locator =>
  queueGrid(page).getByRole('columnheader', { name, exact: true });

export const tierFilter = (page: Page): Locator =>
  page.getByRole('group', { name: 'Tier' });

export const tierButton = (page: Page, label: string): Locator =>
  tierFilter(page).getByRole('button', {
    name: new RegExp(`^${escapeRegExp(label)}(:|$)`),
  });
