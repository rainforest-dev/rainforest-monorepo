import { expect, test } from '@playwright/test';

import { waitForHydration } from './support/desk';
import { expectNoSideScroll, hideDevToolbar } from './support/phone';
import { resetVault } from './support/vault';

test.beforeEach(async ({ page }) => {
  resetVault();
  await hideDevToolbar(page);
});

test.describe('rack on phone', () => {
  test('collections move to a bottom tab bar, and nothing scrolls sideways', async ({
    page,
  }) => {
    await page.goto('/rack');
    await waitForHydration(page);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('navigation', { name: '館藏' })).toBeHidden();
    const tabs = page.getByRole('navigation', { name: '館藏' });
    await expect(tabs).toBeVisible();
    const box = await tabs.boundingBox();
    expect(box?.height).toBe(64);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(844);
    await expect(tabs.getByRole('link', { name: '報架' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectNoSideScroll(page);
  });

  test('cards stack one per row', async ({ page }) => {
    await page.goto('/rack');
    const cards = page.getByRole('listitem');
    const [first, second] = await Promise.all([
      cards.nth(0).boundingBox(),
      cards.nth(1).boundingBox(),
    ]);
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    expect(second.y).toBeGreaterThan(first.y + first.height - 1);
    expect(first.width).toBeGreaterThan(390 - 2 * 16 - 1);
  });
});
