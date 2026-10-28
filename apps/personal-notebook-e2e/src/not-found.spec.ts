import { expect, test } from '@playwright/test';

// The strings below are English, whatever locale the suite runs in.
test.use({ locale: 'en-US' });

test.describe('a page the notebooks do not have', () => {
  test('shows the library’s not-found page under the bar, with a way back', async ({
    page,
  }) => {
    for (const path of ['/notebooks/999999', '/notebooks/no/such/page']) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { name: 'This page is not in the library' }),
      ).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Back to Notebooks' }),
      ).toHaveAttribute('href', '/notebooks');
    }
  });

  test('answers a path no page matches with 404', async ({ page }) => {
    expect((await page.goto('/notebooks/no/such/page'))?.status()).toBe(404);
  });
});

test('titles name the notebook, then Notebooks, then the library', async ({
  page,
  request,
}) => {
  await page.goto('/notebooks');
  await expect(page).toHaveTitle('Notebooks · Rainforest Library');
  const name = `Titled ${Date.now()}`;
  const res = await request.post('/notebooks/api/notebooks', {
    data: { name },
  });
  expect(res.status()).toBe(201);
  const { notebook } = (await res.json()) as { notebook: { id: number } };
  await page.goto(`/notebooks/${notebook.id}`);
  await expect(page).toHaveTitle(`${name} · Notebooks · Rainforest Library`);
});
