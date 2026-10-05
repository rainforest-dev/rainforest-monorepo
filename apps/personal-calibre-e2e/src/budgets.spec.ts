import { expect, test } from '@playwright/test';

import { gotoLibrary, options } from './support/library';
import { gotoStudy, prepareRun, type StudyRun } from './support/study';

test.skip(
  process.env['CALIBRE_BUDGETS'] !== '1',
  'budgets run with CALIBRE_BUDGETS=1 against next start',
);

const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1] ?? Infinity;
const now = (page: import('@playwright/test').Page) =>
  page.evaluate(() => performance.now());

test.describe('budgets', () => {
  test('the RSC payload of / is at most 60 KB', async ({ request }) => {
    const res = await request.get('/', { headers: { RSC: '1' } });
    const bytes = (await res.body()).byteLength;
    console.log(`[budget] RSC payload ${(bytes / 1024).toFixed(1)} KB`);
    expect(bytes).toBeLessThanOrEqual(60 * 1024);
  });

  test('opening a book shows the pane within 200 ms p95', async ({ page }) => {
    await gotoLibrary(page);
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const option = options(page).nth(i);
      const id = await option.getAttribute('data-book-id');
      await option.focus();
      const start = await now(page);
      await page.keyboard.press('Enter');
      await page.locator(`[data-book-detail="${id}"]`).waitFor();
      times.push((await now(page)) - start);
    }
    console.log(`[budget] pane open p95 ${p95(times).toFixed(0)} ms`);
    expect(p95(times)).toBeLessThanOrEqual(200);
  });

  test('a page change focuses the first item within 300 ms p95', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const key = i % 2 === 0 ? ']' : '[';
      const target = i % 2 === 0 ? 'page=2' : '';
      const start = await now(page);
      await page.keyboard.press(key);
      await page.waitForFunction(
        (want) =>
          (want
            ? location.search.includes(want)
            : !location.search.includes('page=')) &&
          document.activeElement?.getAttribute('role') === 'option',
        target,
      );
      times.push((await now(page)) - start);
    }
    console.log(`[budget] page change p95 ${p95(times).toFixed(0)} ms`);
    expect(p95(times)).toBeLessThanOrEqual(300);
  });

  test('a view switch paints within 100 ms and makes no request', async ({
    page,
  }) => {
    await gotoLibrary(page);
    await options(page).first().focus();
    const requests: string[] = [];
    page.on('request', (r) => {
      if (['document', 'fetch', 'xhr'].includes(r.resourceType()))
        requests.push(r.url());
    });
    const start = await now(page);
    await page.keyboard.press('v');
    await page.getByRole('region', { name: 'Catalogue view' }).waitFor();
    const elapsed = (await now(page)) - start;
    console.log(`[budget] view switch ${elapsed.toFixed(0)} ms`);
    expect(elapsed).toBeLessThanOrEqual(100);
    expect(requests).toEqual([]);
  });

  test('every Study row has its atlas within 3 s of the first frame', async ({
    page,
  }) => {
    const run: StudyRun = { renderer: 'three-tsl', backend: 'webgl2' };
    await prepareRun(page, run);
    await page.setViewportSize({ width: 1100, height: 560 });
    await gotoStudy(page, run, 'debug=1&__pageSize=250');
    const timing = () =>
      page.evaluate(() => {
        const study = (
          window as Window & {
            __calibreStudy?: {
              firstFrameAt: number | null;
              info: () => {
                rows: number;
                atlasRows: number;
                lastAtlasAt: number | null;
              };
            };
          }
        ).__calibreStudy;
        const info = study?.info();
        return info && info.rows > 0 && info.atlasRows === info.rows
          ? (info.lastAtlasAt ?? Infinity) - (study?.firstFrameAt ?? Infinity)
          : null;
      });
    await expect.poll(timing, { timeout: 30_000 }).not.toBeNull();
    const elapsed = (await timing()) ?? Infinity;
    console.log(`[budget] all row atlases ${elapsed.toFixed(0)} ms`);
    expect(elapsed).toBeLessThanOrEqual(3_000);
  });
});
