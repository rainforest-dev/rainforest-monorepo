import { expect, test } from '@playwright/test';
import { LIBRARY_PREFS_COOKIE } from '@rainforest-dev/library-contract';

import { SIDEBAR_ATTRIBUTE } from '../src/layout';
import type { WithColumn } from '../src/sidebar.story';

test.describe('SidebarToggle', () => {
  test('hides the column on every page and remembers it', async ({
    mount,
    page,
  }) => {
    const component = await mount('sidebar/WithColumn');
    const column = component.getByRole('complementary');
    await expect(column).toBeVisible();

    await component.getByRole('button', { name: 'Hide sidebar' }).click();
    await expect(column).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute(
      SIDEBAR_ATTRIBUTE,
      'closed',
    );
    const cookies = await page.context().cookies();
    expect(
      decodeURIComponent(
        cookies.find((c) => c.name === LIBRARY_PREFS_COOKIE)?.value ?? '',
      ),
    ).toContain('"sidebar":false');

    await component.getByRole('button', { name: 'Show sidebar' }).click();
    await expect(column).toBeVisible();
  });

  test('is not shown below lg', async ({ mount, page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    const component = await mount('sidebar/WithColumn');
    await expect(component.getByRole('button')).toBeHidden();
    await expect(component.getByRole('complementary')).toBeHidden();
  });

  test('is not shown on a page without a column', async ({ mount }) => {
    const component = await mount('sidebar/WithoutColumn');
    await expect(component.getByRole('button')).toBeHidden();
  });

  test('speaks the page locale', async ({ mount }) => {
    const component = await mount<typeof WithColumn>('sidebar/WithColumn', {
      locale: 'zh',
    });
    await expect(component.getByRole('button')).toHaveAccessibleName(
      '收起側欄',
    );
  });
});
