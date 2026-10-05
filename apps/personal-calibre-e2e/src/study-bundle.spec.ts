import { gzipSync } from 'node:zlib';

import { expect, type Page, test } from '@playwright/test';

import { setPrefs } from './support/library';

test.skip(
  process.env['CALIBRE_BUDGETS'] !== '1',
  'the bundle check runs with CALIBRE_BUDGETS=1 against next start',
);

const THREE_MARKERS = ['isWebGLRenderer', 'isWebGPURenderer'] as const;
const LAZY_STUDY_GZIP_BUDGET = 450 * 1024;

interface LoadedScript {
  url: string;
  markers: string[];
  gzipBytes: number;
}

async function loadScripts(page: Page, url: string): Promise<LoadedScript[]> {
  const pending: Promise<LoadedScript | null>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') return;
    pending.push(
      response
        .text()
        .then((body) => ({
          url: response.url(),
          markers: THREE_MARKERS.filter((marker) => body.includes(marker)),
          gzipBytes: gzipSync(body).length,
        }))
        .catch(() => null),
    );
  });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return (await Promise.all(pending)).filter(
    (script): script is LoadedScript => script !== null,
  );
}

function withThree(scripts: LoadedScript[]): string[] {
  return scripts.filter((s) => s.markers.length > 0).map((s) => s.url);
}

test.describe('Study bundle', () => {
  for (const url of [
    '/',
    '/books/1',
    '/read/1',
    '/?view=study&groupBy=series&renderer=css',
  ]) {
    test(`${url} loads nothing from three.js`, async ({ page }) => {
      const scripts = await loadScripts(page, url);
      expect(scripts.length).toBeGreaterThan(0);
      expect(withThree(scripts)).toEqual([]);
    });
  }

  test('/ with Study and css in the cookie loads nothing from three.js', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'study', renderer: 'css' });
    const scripts = await loadScripts(page, '/?groupBy=series');
    await expect(page.locator('[data-study-ready]')).toHaveAttribute(
      'data-renderer',
      'css',
    );
    expect(withThree(scripts)).toEqual([]);
  });

  test('the default three-tsl study loads three.js only after the Study region mounts', async ({
    page,
    request,
  }) => {
    const url = '/?view=study&groupBy=series';
    const html = await (await request.get(url)).text();
    const scripts = await loadScripts(page, url);
    await expect(page.locator('[data-study-canvas]')).toHaveAttribute(
      'data-renderer',
      'three-tsl',
    );

    const loaded = withThree(scripts);
    expect(loaded.length).toBeGreaterThan(0);
    for (const script of loaded) {
      expect(html).not.toContain(new URL(script).pathname);
    }
    const markers = new Set(scripts.flatMap((s) => s.markers));
    expect([...markers].sort()).toEqual([...THREE_MARKERS].sort());

    const lazy = scripts
      .filter((s) => !html.includes(new URL(s.url).pathname))
      .reduce((sum, s) => sum + s.gzipBytes, 0);
    console.log(`[budget] lazy Study JS ${(lazy / 1024).toFixed(1)} KB gzip`);
    expect(lazy).toBeLessThanOrEqual(LAZY_STUDY_GZIP_BUDGET);
  });
});
