import { expect, type Page, test } from '@playwright/test';

/** The 3D hall keeps its bookcases in a screen-reader list; enter one through it. */
async function enterBookcase(page: Page, key: string) {
  await page.locator(`[data-hall-case="${key}"]`).focus();
  await page.keyboard.press('Enter');
}

test.describe('a bookcase', () => {
  test('opens in the study and goes back to the hall', async ({ page }) => {
    await page.goto('/?renderer=css');
    await enterBookcase(page, 'tag-sea');
    await expect(page).toHaveURL(/case=tag-sea/);
    await expect(page.locator('[role="option"]')).toHaveCount(3);

    await page.locator('[data-hall-back]').click();
    await expect(page).not.toHaveURL(/case=/);
    await expect(page.locator('[data-hall-mode]')).toBeAttached();

    // The study was a history entry, so the browser's Back left it too.
    await page.goForward();
    await expect(page).toHaveURL(/case=tag-sea/);
    await page.goBack();
    await expect(page).not.toHaveURL(/case=/);
  });

  test('links a pulled book to its collection, with the cover named for the morph', async ({
    page,
  }) => {
    await page.goto('/?case=tag-winter&renderer=css');
    await page.locator('[role="option"]').first().click();
    const link = page.getByRole('link', { name: '查看詳細' });
    await expect(link).toHaveAttribute('href', /^\/books\?book=\d+$/);
    const href = (await link.getAttribute('href')) ?? '';
    const id = href.split('=')[1];
    const names = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('*')]
        .map((el) => getComputedStyle(el).viewTransitionName)
        .filter((name) => name.startsWith('book-')),
    );
    expect(names).toEqual([`book-${id}`]);
  });
});
