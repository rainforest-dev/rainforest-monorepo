import { expect, type Locator, type Page, test } from '@playwright/test';

import { pagePhoto } from './support/page-photo';

/** Where a crop handle sits, as a share of the photo's width and height. */
async function handleAt(handle: Locator): Promise<{ x: number; y: number }> {
  const style = (await handle.getAttribute('style')) ?? '';
  const percent = (name: string) =>
    Number(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(style)?.[1]) / 100;
  return { x: percent('left'), y: percent('top') };
}

async function createNotebook(page: Page, name: string): Promise<void> {
  await page.goto('/notebooks');
  await page.getByLabel('Notebook name').fill(name);
  // Enabled only once React has hydrated and seen the name.
  const create = page.getByRole('button', { name: 'Create' });
  await expect(create).toBeEnabled();
  await create.click();
  // A dev server compiles the notebook route on first visit.
  await expect(page).toHaveURL(/\/notebooks\/\d+$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

const pageTiles = (page: Page) =>
  page.getByRole('button', { name: /^Page \d+/ });

test.describe('notebooks', () => {
  test('a cropped spread becomes two pages, exports as a PDF and archives', async ({
    page,
  }) => {
    const name = `Crop Run ${Date.now()}`;
    await createNotebook(page, name);

    const photo = pagePhoto({ spread: true });
    await page.locator('input[type="file"]').setInputFiles({
      name: 'spread.png',
      mimeType: 'image/png',
      buffer: photo.png,
    });

    const dialog = page.getByRole('dialog', { name: /Crop page/ });
    await expect(dialog).toBeVisible();
    // Detection lands on the paper's corners, and a landscape outline opens as a spread.
    const labels = [
      'Top-left corner',
      'Top-right corner',
      'Bottom-right corner',
      'Bottom-left corner',
    ];
    for (const [i, label] of labels.entries()) {
      const at = await handleAt(dialog.getByRole('button', { name: label }));
      expect(Math.abs(at.x - photo.corners[i].x / photo.width)).toBeLessThan(
        0.02,
      );
      expect(Math.abs(at.y - photo.corners[i].y / photo.height)).toBeLessThan(
        0.02,
      );
    }
    await expect(dialog.getByRole('switch')).toBeChecked();
    await expect(
      dialog.getByRole('button', { name: 'Seam, top end' }),
    ).toBeVisible();

    // A corner follows the pointer.
    const topLeft = dialog.getByRole('button', { name: 'Top-left corner' });
    const before = await handleAt(topLeft);
    const box = await topLeft.boundingBox();
    if (!box) throw new Error('no handle box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 30,
      box.y + box.height / 2 + 20,
      {
        steps: 5,
      },
    );
    await page.mouse.up();
    const after = await handleAt(topLeft);
    expect(after.x).toBeGreaterThan(before.x + 0.01);
    expect(after.y).toBeGreaterThan(before.y + 0.01);
    await dialog.getByRole('button', { name: 'Reset' }).click();
    expect(await handleAt(topLeft)).toEqual(before);

    await dialog.getByRole('button', { name: 'Crop 2 pages' }).click();
    await expect(dialog).toBeHidden();
    await expect(pageTiles(page)).toHaveCount(2);
    await expect(page.getByText('2 pages', { exact: true })).toBeVisible();
    await expect(page.getByText('Added 2 pages')).toBeVisible();

    // Each half is a portrait page, about half the spread wide.
    const sizes = await pageTiles(page)
      .locator('img')
      .evaluateAll(async (images) =>
        Promise.all(
          (images as HTMLImageElement[]).map(async (img) => {
            await img.decode();
            return [img.naturalWidth, img.naturalHeight];
          }),
        ),
      );
    for (const [w, h] of sizes) {
      expect(h).toBeGreaterThan(w);
      expect(w).toBeGreaterThan(photo.width * 0.3);
    }

    // Skip crop keeps the original as it is.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'single.png',
      mimeType: 'image/png',
      buffer: pagePhoto({ spread: false }).png,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('switch')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Skip crop' }).click();
    await expect(pageTiles(page)).toHaveCount(3);

    const pdfHref = await page
      .getByRole('link', { name: 'Download PDF' })
      .getAttribute('href');
    expect(pdfHref).toMatch(/\/api\/notebooks\/\d+\/pdf$/);
    const pdf = await page.request.get(pdfHref ?? '');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    const body = (await pdf.body()).toString('latin1');
    expect(body.startsWith('%PDF-1.4')).toBe(true);
    expect(body).toContain('/Count 3');

    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText(/Archived \d{4}-\d{2}-\d{2}/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  });

  test('cancelling the crop step uploads nothing', async ({ page }) => {
    await createNotebook(page, `Cancel Run ${Date.now()}`);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'spread.png',
      mimeType: 'image/png',
      buffer: pagePhoto().png,
    });
    const dialog = page.getByRole('dialog', { name: /Crop page/ });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add pages' })).toBeEnabled();
    await expect(pageTiles(page)).toHaveCount(0);
  });
});
