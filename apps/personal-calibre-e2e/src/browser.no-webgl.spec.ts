import { expect, test } from '@playwright/test';

import { gotoLibrary } from './support/library';
import { hasWebGpu, prepareRun } from './support/study';

test.describe('no-webgl project', () => {
  test('offers neither WebGL nor WebGPU', async ({ page }) => {
    await prepareRun(page, { renderer: 'three-tsl', backend: 'webgl2' });
    await gotoLibrary(page);
    const contexts = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      return {
        webgl2: canvas.getContext('webgl2') !== null,
        webgl: document.createElement('canvas').getContext('webgl') !== null,
      };
    });
    expect(contexts).toEqual({ webgl2: false, webgl: false });
    expect(await hasWebGpu(page)).toBe(false);
  });
});
