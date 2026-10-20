import { expect, type Locator, type Page, test } from '@playwright/test';
import Database from 'better-sqlite3';

import { DB_PATH } from './support/env';
import { callTool } from './support/mcp';
import { pagePhoto } from './support/page-photo';

/** Where a crop handle sits, as a share of the photo's width and height. */
async function handleAt(handle: Locator): Promise<{ x: number; y: number }> {
  const style = (await handle.getAttribute('style')) ?? '';
  const percent = (name: string) =>
    Number(new RegExp(`${name}:\\s*([\\d.]+)%`).exec(style)?.[1]) / 100;
  return { x: percent('left'), y: percent('top') };
}

/** Creates a notebook and opens it, as the page grid unless `layout` is the book. */
async function createNotebook(
  page: Page,
  name: string,
  layout: 'book' | 'pages' = 'pages',
): Promise<number> {
  await page.goto('/notebooks');
  await page.getByLabel('Notebook name').fill(name);
  // Enabled only once React has hydrated and seen the name.
  const create = page.getByRole('button', { name: 'Create' });
  await expect(create).toBeEnabled();
  await create.click();
  // A dev server compiles the notebook route on first visit.
  await expect(page).toHaveURL(/\/notebooks\/\d+$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const id = Number(/\/notebooks\/(\d+)$/.exec(page.url())?.[1]);
  // The layout is read once on load, so the grid has to be asked for before pages arrive.
  if (layout === 'pages') {
    await page.goto(`/notebooks/${id}?layout=pages`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  return id;
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

    // A single page downloads under the notebook's naming scheme.
    await pageTiles(page).first().click();
    const pageDialog = page.getByRole('dialog', { name: /^Page 1\b/ });
    const pageDownload = pageDialog.getByRole('link', {
      name: 'Download page',
    });
    await expect(pageDownload).toHaveAttribute(
      'download',
      `BuJo ${name} p001.jpg`,
    );
    await expect(pageDownload).toHaveAttribute(
      'href',
      /\/api\/notebooks\/pages\/\d+\/image$/,
    );
    await page.keyboard.press('Escape');
    await expect(pageDialog).toBeHidden();

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

  test('a page is replaced in place and the notebook renamed', async ({
    page,
  }) => {
    const name = `Replace Run ${Date.now()}`;
    await createNotebook(page, name);
    // Unlike the other tests' photos, so the cross-notebook dedupe lets it in.
    const photo = pagePhoto({ spread: true, degrees: 3 }).png;
    await page.locator('input[type="file"]').setInputFiles({
      name: 'first.png',
      mimeType: 'image/png',
      buffer: photo,
    });
    const crop = page.getByRole('dialog', { name: /Crop page/ });
    await crop.getByRole('button', { name: 'Skip crop' }).click();
    await expect(pageTiles(page)).toHaveCount(1);

    await pageTiles(page).first().click();
    const pageDialog = page.getByRole('dialog', { name: /^Page 1\b/ });
    await expect(pageDialog.getByText('Uploaded as first.png')).toBeVisible();
    // A retake of the same page would be skipped as a lookalike by Add pages.
    await pageDialog.locator('input[type="file"]').setInputFiles({
      name: 'retake.png',
      mimeType: 'image/png',
      buffer: photo,
    });
    await crop.getByRole('button', { name: 'Skip crop' }).click();
    await expect(pageDialog.getByText('Uploaded as retake.png')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pageTiles(page)).toHaveCount(1);

    const renamed = `${name} (renamed)`;
    page.once('dialog', (prompt) => void prompt.accept(renamed));
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible();
  });

  test('the book turns pages and follows the outline and page links', async ({
    page,
    request,
  }) => {
    const name = `Reader Run ${Date.now()}`;
    const notebookId = await createNotebook(page, name, 'book');
    // Written unlike the other tests' photos, so the cross-notebook dedupe lets it in.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'spread.png',
      mimeType: 'image/png',
      buffer: pagePhoto({ spread: true, degrees: 9, writing: 1 }).png,
    });
    const crop = page.getByRole('dialog', { name: /Crop page/ });
    await crop.getByRole('button', { name: 'Crop 2 pages' }).click();
    await expect(crop).toBeHidden();
    await expect(page.getByText('2 pages', { exact: true })).toBeVisible();

    const listed = await callTool(request, 'list_notebook_pages', {
      notebookId,
    });
    const ids = (
      JSON.parse(listed.content[0]?.text ?? '[]') as { id: number }[]
    ).map((p) => p.id);
    expect(ids).toHaveLength(2);
    const texts = [
      { transcription: 'Index\n- Reading list p. 2', pageDate: '2026-10-11' },
      { transcription: 'Reading list\nStarted 10/11', pageDate: '2026-10-12' },
    ];
    for (const [i, text] of texts.entries()) {
      const saved = await callTool(request, 'set_page_transcription', {
        pageId: ids[i],
        ...text,
      });
      expect(saved.isError).toBeFalsy();
    }
    await page.reload();

    const book = page.getByTestId('flip-book');
    const outline = page.getByRole('navigation', { name: 'Outline' });
    const text = page.getByRole('complementary', { name: 'Page text' });
    // The cover opens alone on the right.
    await expect(book).toHaveAttribute('data-spread', '0');
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(
      outline.getByRole('button', { name: /Index/ }),
    ).toHaveAttribute('aria-current', 'page');

    // A page reference opens the page it names, and the URL keeps it.
    await text.getByRole('button', { name: 'p. 2', exact: true }).click();
    await expect(book).toHaveAttribute('data-spread', '1');
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]page=${ids[1]}\\b`));
    await expect(text.getByText('Linked from')).toBeVisible();
    // A date opens the page dated that day.
    await text.getByRole('button', { name: '10/11', exact: true }).click();
    await expect(book).toHaveAttribute('data-spread', '0');

    // Turning by key and by button.
    await page.keyboard.press('ArrowRight');
    await expect(book).toHaveAttribute('data-spread', '1');
    await expect(
      page.getByRole('button', { name: 'Next page' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(book).toHaveAttribute('data-spread', '0');

    // The outline jumps too.
    await outline.getByRole('button', { name: /Reading list/ }).click();
    await expect(book).toHaveAttribute('data-spread', '1');

    // Pages lays the same pages out as a grid, and the choice survives a reload.
    await page
      .getByRole('group', { name: 'Layout' })
      .getByRole('button', { name: 'Pages' })
      .click();
    await expect(pageTiles(page)).toHaveCount(2);
    await page.reload();
    await expect(pageTiles(page)).toHaveCount(2);
    await expect(book).toBeHidden();

    // The calendar places each page on the date written on it and opens it in the book.
    await page.goto('/notebooks');
    await page
      .getByRole('navigation', { name: 'View' })
      .getByRole('link', { name: 'Calendar' })
      .click();
    await expect(page).toHaveURL(/view=calendar/);
    await page.goto('/notebooks?view=calendar&month=2026-10');
    await expect(
      page.getByRole('heading', { name: '2026 年 10 月' }),
    ).toBeVisible();
    const eleventh = page.locator('[data-date="2026-10-11"]');
    const ours = eleventh.getByRole('link', {
      name: `${name}, page 1, 2026-10-11`,
    });
    await expect(ours).toBeVisible();
    await expect(
      page
        .locator('[data-date="2026-10-12"]')
        .getByRole('link', { name: `${name}, page 2, 2026-10-12` }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Previous month' }).click();
    await expect(
      page.getByRole('heading', { name: '2026 年 9 月' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Next month' }).click();
    await ours.click();
    await expect(page).toHaveURL(
      new RegExp(`/notebooks/${notebookId}\\?page=${ids[0]}\\b`),
    );
    await expect(book).toHaveAttribute('data-spread', '0');

    // Search finds a page by its text and opens it in the book.
    await page.goto('/notebooks');
    await page
      .getByRole('search')
      .getByRole('searchbox', { name: 'Search notebook pages' })
      .fill('Started 10/11');
    await page
      .getByRole('search')
      .getByRole('button', { name: 'Search' })
      .click();
    await expect(page).toHaveURL(/[?&]q=Started/);
    const hit = page.getByRole('link', {
      name: new RegExp(`Reading list.*${name}`),
    });
    await expect(hit).toBeVisible();
    await expect(hit.locator('mark').first()).toHaveText(/started/i);
    await hit.click();
    await expect(page).toHaveURL(
      new RegExp(`/notebooks/${notebookId}\\?page=${ids[1]}\\b`),
    );
    await expect(book).toHaveAttribute('data-spread', '1');
  });
  test('the shelf selects notebooks, trashes them, restores and deletes one', async ({
    page,
  }) => {
    const stamp = Date.now();
    const names = [`Shelf One ${stamp}`, `Shelf Two ${stamp}`];
    for (const name of names) await createNotebook(page, name);

    await page.goto('/notebooks');
    await page.getByRole('button', { name: 'Select' }).click();
    for (const name of names) {
      await page.getByRole('checkbox', { name }).click();
    }
    const toolbar = page.getByRole('toolbar', { name: 'Selected notebooks' });
    await expect(toolbar.getByText('2 selected')).toBeVisible();

    await toolbar.getByRole('button', { name: 'Delete…' }).click();
    const remove = page.getByRole('dialog', { name: 'Remove 2 notebooks?' });
    await expect(
      remove.getByRole('radio', { name: /Move to Trash/ }),
    ).toBeChecked();
    await remove.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(remove).toBeHidden();
    for (const name of names) {
      await expect(page.getByRole('link', { name })).toHaveCount(0);
    }

    await page.getByRole('link', { name: 'Trash' }).click();
    await expect(page).toHaveURL(/shelf=trash/);
    await expect(page.getByRole('link', { name: names[0] })).toContainText(
      'deleted in 30 days',
    );
    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByRole('checkbox', { name: names[0] }).click();
    await toolbar.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByRole('link', { name: names[0] })).toHaveCount(0);

    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByRole('checkbox', { name: names[1] }).click();
    await toolbar.getByRole('button', { name: 'Delete now…' }).click();
    const purge = page.getByRole('dialog', { name: `Delete ${names[1]}?` });
    await expect(purge.getByText('cannot be undone')).toBeVisible();
    await purge.getByRole('button', { name: 'Delete now' }).click();
    await expect(page.getByRole('link', { name: names[1] })).toHaveCount(0);

    await page.getByRole('link', { name: 'All' }).click();
    await expect(page.getByRole('link', { name: names[0] })).toBeVisible();
    await expect(page.getByRole('link', { name: names[1] })).toHaveCount(0);
  });
  test('the shelf merges and archives a selection, and a visit purges expired Trash', async ({
    page,
  }) => {
    const stamp = Date.now();
    const keep = `Merge Keep ${stamp}`;
    const other = `Merge Other ${stamp}`;
    const old = `Expired ${stamp}`;
    await createNotebook(page, keep);
    const otherId = await createNotebook(page, other);
    const oldId = await createNotebook(page, old);

    await page.goto('/notebooks');
    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByRole('checkbox', { name: keep }).click();
    await page.getByRole('checkbox', { name: other }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Selected notebooks' });
    await toolbar.getByRole('button', { name: 'Merge…' }).click();
    const merge = page.getByRole('dialog', { name: 'Merge 2 notebooks' });
    await merge.getByRole('radio', { name: new RegExp(keep) }).check();
    await merge.getByRole('button', { name: 'Merge' }).click();
    await expect(merge).toBeHidden();
    await expect(page.getByRole('link', { name: other })).toHaveCount(0);
    expect(
      (await page.request.get(`/notebooks/api/notebooks/${otherId}`)).status(),
    ).toBe(404);

    await page.getByRole('button', { name: 'Select' }).click();
    await page.getByRole('checkbox', { name: keep }).click();
    await toolbar.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('link', { name: keep })).toContainText(
      'Archived',
    );

    // Trashed 31 days ago, so the next shelf visit deletes it for good.
    const trashed = await page.request.post('/notebooks/api/notebooks/bulk', {
      data: { action: 'trash', ids: [oldId] },
    });
    expect(trashed.ok()).toBe(true);
    const db = new Database(DB_PATH);
    db.prepare(
      "UPDATE notebooks SET trashed_at = datetime('now', '-31 days') WHERE id = ?",
    ).run(oldId);
    db.close();
    await page.goto('/notebooks?shelf=trash');
    await expect(page.getByRole('link', { name: old })).toHaveCount(0);
    expect(
      (await page.request.get(`/notebooks/api/notebooks/${oldId}`)).status(),
    ).toBe(404);
  });
  test('the to-do list shows open bullets and links each to its page', async ({
    page,
  }) => {
    const stamp = Date.now();
    const name = `Bujo ${stamp}`;
    const notebookId = await createNotebook(page, name);
    // Typed straight into the database: the list reads transcriptions, not images.
    const db = new Database(DB_PATH);
    const insert = db.prepare(
      `INSERT INTO notebook_pages
        (notebook_id, position, page_number, page_date, file_name, mime_type, bytes, content_hash, transcription)
       VALUES (?, ?, ?, ?, 'p.png', 'image/png', 1, ?, ?)`,
    );
    insert.run(
      notebookId,
      1,
      12,
      '2026-08-20',
      `a${stamp}`,
      `TEXT:\n• Renew card ${stamp}\n• Plan trip ${stamp}`,
    );
    const latest = insert.run(
      notebookId,
      2,
      54,
      '2026-10-14',
      `b${stamp}`,
      `TEXT:\n人 Renew card ${stamp}\n> Plan trip ${stamp}\n• Plan trip ${stamp}`,
    ).lastInsertRowid;
    db.close();

    await page.goto('/notebooks?view=tasks');
    const list = page.getByRole('region', { name: 'October 2026' });
    const item = list
      .getByRole('listitem')
      .filter({ hasText: `Plan trip ${stamp}` });
    await expect(item).toContainText('first written p. 12 · 2026-08-20');
    await expect(page.getByText(`Renew card ${stamp}`)).toHaveCount(0);

    await item
      .getByRole('link', { name: `${name} · p. 54 · 2026-10-14` })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/notebooks/${notebookId}\\?page=${latest}\\b`),
    );
  });
});
