import { expect, test } from '@playwright/test';

import { gotoTab, topicCard } from './support/desk';
import { TOPICS, type TopicStatus } from './support/fixture-vault';
import { readVault, resetVault, TOPICS_FILE } from './support/vault';

test.beforeEach(() => resetVault());

const countOf = (status: TopicStatus): number =>
  TOPICS.filter((t) => t.status === status).length;

function sectionOf(markdown: string, name: string): string | undefined {
  let section: string | undefined;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim();
    if (line.includes(`**${name}**`)) return section;
  }
  return undefined;
}

test.describe('topics', () => {
  test('groups topics by status', async ({ page }) => {
    await gotoTab(page, 'topics');
    for (const status of ['active', 'proposed', 'declined'] as const) {
      await expect(
        page.getByRole('heading', {
          level: 3,
          name: `${status} (${countOf(status)})`,
        }),
      ).toBeVisible();
    }
    await expect(
      topicCard(page, 'Home lab networking').getByRole('button', {
        name: 'Activate',
      }),
    ).toBeVisible();
    await expect(
      topicCard(page, 'Web platform & CSS').getByRole('button'),
    ).toHaveCount(0);
  });

  test('Activate moves a proposed topic to Active', async ({ page }) => {
    await gotoTab(page, 'topics');
    const name = 'Home lab networking';
    await topicCard(page, name)
      .getByRole('button', { name: 'Activate' })
      .click();

    await expect(
      page.getByRole('heading', {
        level: 3,
        name: `active (${countOf('active') + 1})`,
      }),
    ).toBeVisible();
    await expect(topicCard(page, name).getByRole('button')).toHaveCount(0);

    const markdown = readVault(TOPICS_FILE);
    expect(sectionOf(markdown, name)).toBe('Active');
    expect(markdown).toContain(`- [x] **${name}**`);
  });

  test('Decline moves a proposed topic to Declined', async ({ page }) => {
    await gotoTab(page, 'topics');
    const name = 'Data visualisation';
    await topicCard(page, name)
      .getByRole('button', { name: 'Decline' })
      .click();

    await expect(
      page.getByRole('heading', {
        level: 3,
        name: `declined (${countOf('declined') + 1})`,
      }),
    ).toBeVisible();

    const markdown = readVault(TOPICS_FILE);
    expect(sectionOf(markdown, name)).toBe('Declined');
    expect(markdown).toContain(`- [ ] **${name}**`);
  });
});
