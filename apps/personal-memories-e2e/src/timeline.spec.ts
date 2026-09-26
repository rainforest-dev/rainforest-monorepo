import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, type Locator, type Page, test } from '@playwright/test';

const NOTES = path.join(__dirname, '..', 'test-output', 'notes');
const noteFile = (date: string) =>
  path.join(NOTES, date.slice(0, 4), `${date}.md`);

const waitForLightboxReady = (page: Page) =>
  expect(page.locator('html[data-lightbox-ready]')).toHaveCount(1);

const waitForAppBarReady = (page: Page) =>
  expect(page.locator('html[data-appbar-ready]')).toHaveCount(1);

const readNote = (date: string) =>
  existsSync(noteFile(date)) ? readFileSync(noteFile(date), 'utf8') : '';

const stripCover = (date: string) => {
  const file = noteFile(date);
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  const stripped = text.replace(/^cover: .*\n/m, '');
  if (stripped !== text) writeFileSync(file, stripped);
};

test.describe.configure({ mode: 'serial' });

test('home is a heatmap of the fixture days', async ({ page }) => {
  await page.goto('/');
  const days = page.locator('a[data-date]');
  await expect(days).toHaveCount(4);
  await expect(page.locator('a[data-date="2025-11-01"]')).toHaveAttribute(
    'href',
    '/day/2025-11-01',
  );
});

test('the served CSS keeps both the anchored preview and its fallback', async ({
  page,
}) => {
  await page.goto('/');
  const rules = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .filter(
        (rule): rule is CSSSupportsRule => rule instanceof CSSSupportsRule,
      )
      .map((rule) => ({ condition: rule.conditionText, text: rule.cssText })),
  );
  const anchored = rules.find((r) => r.condition === '(position-area: top)');
  const fallback = rules.find(
    (r) => r.condition === 'not (position-area: top)',
  );
  expect(anchored?.text).toMatch(/position: fixed/);
  expect(anchored?.text).toMatch(/position-area: top;/);
  expect(fallback?.text).toMatch(/position: absolute/);
  expect(fallback?.text).toMatch(/bottom: calc\(100% \+ 0\.5rem\)/);
  expect(fallback?.text).toMatch(/left: 50%/);
  expect(fallback?.text).toMatch(/translate: -50%( 0)?;/);
});

test('a heat cell previews its day above it on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  const cell = page.locator('a[data-date="2025-11-03"]');
  const preview = cell.locator('[data-preview]');
  await expect(preview).toBeHidden();
  await cell.hover();
  await expect(preview).toBeVisible();
  await expect(preview).toBeInViewport({ ratio: 1 });
  await expect(preview).toContainText('2025-11-03（週一）');
  await expect(preview).toContainText('「New week, new plans」');
  const [c, p] = await Promise.all([cell.boundingBox(), preview.boundingBox()]);
  expect(p && c && p.y + p.height <= c.y).toBe(true);

  await page.mouse.move(0, 0);
  await expect(preview).toBeHidden();
  await page.locator('a[data-date="2025-11-02"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
});

test('the month calendar shows each day with its cover or a line', async ({
  page,
}) => {
  const response = await page.goto('/month/2025-11');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '2025 年 11 月',
  );
  const cell = (date: string) => page.locator(`a[data-date="${date}"]:visible`);
  await expect(cell('2025-11-01').locator('img')).toHaveAttribute(
    'src',
    /AAAAAAAA-0000-0000-0000-000000000001/,
  );
  await expect(cell('2025-11-03')).toContainText('「New week, new plans」');
  await expect(page.locator('[data-date="2025-11-05"]:visible')).toHaveText(
    '5',
  );
  await cell('2025-11-03').click();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);

  expect((await page.goto('/month/1999-01'))?.status()).toBe(404);
  await expect(
    page.getByRole('link', { name: '2025-10-31（週五）' }),
  ).toBeVisible();
});

test('old week links redirect to their first day', async ({ page }) => {
  await page.goto('/week/2025-W44');
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const response = await page.goto('/day/1999-01-01');
  expect(response?.status()).toBe(404);
});

test('a day shows messages and photos in order, with the source filter', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.getByRole('heading')).toHaveText('2025-11-01（週六）');
  // content-visibility:auto defers layout until the section is in view.
  await expect(day).toContainText('照片 7 張');
  await expect(day.locator('[data-author-cell]').first()).toContainText(
    'Alice 🌷',
  );
  // content-visibility:auto blanks innerText pre-render; textContent needs no layout.
  const texts = await day
    .locator('[data-event-id]')
    .evaluateAll((els) => els.map((el) => el.textContent ?? ''));
  const indexOf = (needle: string) =>
    texts.findIndex((t) => t.includes(needle));
  expect(indexOf('Morning @Alice')).toBeLessThan(indexOf('Lunch plan'));

  const photo = day.getByRole('img', { name: 'Weekend, Food' });
  await expect(photo).toBeVisible();
  // toBeVisible() checks layout, not decode; poll past a cold /thumb encode.
  await expect
    .poll(
      () =>
        photo.evaluate((img: HTMLImageElement) =>
          img.complete ? img.naturalWidth : 0,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  const filterReady = () =>
    page
      .locator('astro-island[component-url*="SourceFilter"]:not([ssr])')
      .waitFor({ state: 'attached' });
  await filterReady();
  const toggle = page.getByRole('button', { name: '照片', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(photo).toBeHidden();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await filterReady();
  await toggle.click();
});

test('a photo run longer than 5 leads with a large tile and hides the rest behind +N', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const burst = page.locator('#day-2025-11-01 [data-burst]').first();
  const tiles = burst.locator(':scope > li[data-event-id]');
  await expect(tiles).toHaveCount(7);
  await expect(burst.locator('li[data-overflow]')).toHaveCount(2);
  await expect(burst.locator('[data-more] [data-scrim]')).toHaveText('+3');
  const [hero, small] = await Promise.all([
    tiles.nth(0).boundingBox(),
    tiles.nth(1).boundingBox(),
  ]);
  expect(hero && small && hero.width > small.width * 1.8).toBe(true);
  expect(hero && small && hero.height > small.height * 1.8).toBe(true);
});

test('the hero tile requests a larger responsive image than the small tiles', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const tiles = page
    .locator('#day-2025-11-01 [data-burst]')
    .first()
    .locator(':scope > li[data-event-id]');
  const [heroSizes, smallSizes] = await Promise.all([
    tiles.nth(0).locator('img').getAttribute('sizes'),
    tiles.nth(1).locator('img').getAttribute('sizes'),
  ]);
  expect(heroSizes).not.toBe(smallSizes);
});

test('a link to a photo past the fifth still shows it', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const tiles = page
    .locator('#day-2025-11-01 [data-burst]')
    .first()
    .locator(':scope > li[data-event-id]');
  const id = await tiles.nth(5).getAttribute('data-event-id');
  await page.goto(`/day/2025-11-01#ev-${id}`);
  await expect(tiles.nth(5)).toBeVisible();
  await expect(
    page.locator('#day-2025-11-01 [data-burst] [data-scrim]').first(),
  ).toBeHidden();
});

test('rows line up in one column whoever wrote them', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  const left = (author: string) =>
    day
      .locator(`[data-event-id][data-author="${author}"] [data-row-body]`)
      .first()
      .evaluate((el) => el.getBoundingClientRect().left);
  expect(await left('Bob')).toBe(await left('Alice 🌷'));
});

test('each run keeps one unbroken 3px rule', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  const pairs = await page.locator('#day-2025-11-01').evaluate((day) => {
    let checked = 0;
    for (const run of day.querySelectorAll('li[data-accent]')) {
      const bodies = [...run.querySelectorAll<HTMLElement>('[data-row-body]')];
      for (const body of bodies)
        if (getComputedStyle(body).borderLeftWidth !== '3px') return -1;
      for (let i = 1; i < bodies.length; i++) {
        const gap =
          bodies[i].getBoundingClientRect().top -
          bodies[i - 1].getBoundingClientRect().bottom;
        if (Math.abs(gap) > 0.5) return -1;
        checked++;
      }
    }
    return checked;
  });
  expect(pairs).toBeGreaterThan(0);
});

test('the author shows once per run, in its column on desktop and inline on a phone', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.locator('[data-author-key]')).toContainText('Bob');
  await expect(day.locator('[data-author-key]')).toContainText('Alice 🌷');
  const run = day
    .locator('li[data-accent]')
    .filter({ has: page.locator('[data-event-id] + [data-event-id]') })
    .first();
  const rows = run.locator('[data-event-id]');
  await expect(rows.nth(0).locator('[data-author-cell]')).toBeVisible();
  await expect(rows.nth(1).locator('[data-author-cell]')).toHaveCount(0);
  await expect(rows.nth(0).locator('[data-author-inline]')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rows.nth(0).locator('[data-author-cell]')).toBeHidden();
  await expect(rows.nth(0).locator('[data-author-inline]')).toBeVisible();
  await expect(rows.nth(1).locator('[data-author-inline]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('each message row has an accessible name', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await expect(
    page.getByRole('listitem', { name: 'Bob，00:07：Yes, reading.' }),
  ).toBeVisible();
});

test('the author key is named and each 眉批 button names its message', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const day = page.locator('#day-2025-11-01');
  await expect(day.getByRole('list', { name: '作者' })).toBeVisible();
  const row = day.getByRole('listitem', { name: 'Bob，00:07：Yes, reading.' });
  await expect(
    row.getByRole('button', { name: '眉批' }),
  ).toHaveAccessibleDescription('Yes, reading.');
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-annotate][aria-describedby]')].map(
      (b) => b.getAttribute('aria-describedby') ?? '',
    ),
  );
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids)
    expect(await page.locator(`[id="${id}"]`).count()).toBe(1);

  const burstIds = await day
    .locator('[data-burst] [data-annotate]')
    .evaluateAll((buttons) =>
      buttons.map((b) => b.getAttribute('aria-describedby')),
    );
  expect(burstIds.length).toBeGreaterThan(0);
  expect(burstIds.every(Boolean)).toBe(true);
  expect(new Set(burstIds).size).toBe(burstIds.length);
});

test('the date jump input asks for digits without autocorrect', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toHaveAttribute('spellcheck', 'false');
});

test('follow-on times and the 眉批 button appear on hover or focus, beside the text', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const second = page
    .locator(
      '#day-2025-11-01 li[data-accent] [data-event-id] + [data-event-id]',
    )
    .first();
  const first = page
    .locator('#day-2025-11-01 li[data-accent] [data-event-id]')
    .first();
  const time = second.locator('time');
  const pill = second.locator('[data-annotate]');
  await expect(first.locator('time')).toHaveCSS('opacity', '1');
  await expect(time).toHaveCSS('opacity', '0');
  await expect(pill).toHaveCSS('opacity', '0');

  await second.hover();
  await expect(time).toHaveCSS('opacity', '1');
  await expect(pill).toHaveCSS('opacity', '1');
  const [p, text] = await Promise.all([
    pill.boundingBox(),
    second.locator('[data-row-body] p').first().boundingBox(),
  ]);
  expect(p && text && p.x >= text.x + text.width).toBe(true);

  await page.mouse.move(0, 0);
  await expect(time).toHaveCSS('opacity', '0');
  await second.focus();
  await expect(time).toHaveCSS('opacity', '1');
  await expect(pill).toHaveCSS('opacity', '1');
});

test('each person keeps one fixed accent on every day', async ({ page }) => {
  const accentOf = (date: string, author: string) =>
    page
      .locator(`#day-${date} li[data-accent]`, {
        has: page.locator(`[data-author="${author}"]`),
      })
      .first()
      .getAttribute('data-accent');
  await page.goto('/day/2025-11-01');
  expect(await accentOf('2025-11-01', 'Bob')).toBe('2');
  expect(await accentOf('2025-11-01', 'Alice 🌷')).toBe('1');
  await page.goto('/day/2025-10-31');
  expect(await accentOf('2025-10-31', 'Bob')).toBe('2');
  expect(await accentOf('2025-10-31', 'Alice')).toBe('4');
  const colours = await page
    .locator(
      '#day-2025-10-31 [data-event-id][data-author="Bob"] [data-row-body]',
    )
    .first()
    .evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--chart-2)';
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { rule: getComputedStyle(el).borderLeftColor, expected };
    });
  expect(colours.rule).toBe(colours.expected);
});

test('a thumbnail request returns a webp image', async ({ request }) => {
  const response = await request.get(
    '/thumb/AAAAAAAA-0000-0000-0000-000000000001?w=480',
  );
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/webp');
});

test('scrolling loads neighbouring days and follows the URL', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await expect(page.locator('#day-2025-11-01')).toBeAttached();
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page.locator('#day-2025-11-03').scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
});

test('a day note and an annotation are saved to the vault folder', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await panel.getByLabel('當天的回憶').fill('那天下雨。');
  await expect(panel).toContainText('已儲存');

  const message = page.locator('[data-event-id]', { hasText: 'Lunch plan' });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：/)
    .last()
    .fill('後來那家店關了');
  await expect(panel).toContainText('已儲存');
  await expect(message).toHaveAttribute('data-annotated', '');

  const text = readFileSync(noteFile('2025-11-01'), 'utf8');
  expect(text).toContain('那天下雨。');
  expect(text).toContain('## 眉批');
  expect(text).toContain('後來那家店關了');

  await page.reload();
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('那天下雨。');
});

test('an edit made in Obsidian meanwhile raises a conflict', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('那天下雨。');
  const file = noteFile('2025-11-01');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace('那天下雨。', 'Obsidian 改的'),
  );

  await panel.getByLabel('當天的回憶').fill('app 改的');
  await expect(panel).toContainText('有衝突');
  const obsidianCard = panel.locator('[data-slot="card"]', {
    has: page.getByRole('heading', { name: 'Obsidian 的版本' }),
  });
  await obsidianCard.getByRole('button', { name: '保留這個版本' }).click();
  await expect(panel.getByLabel('當天的回憶')).toHaveValue('Obsidian 改的');
});

test('the +N tile opens the whole burst, and 設為封面 is saved', async ({
  page,
}) => {
  stripCover('2025-11-01');
  await page.goto('/day/2025-11-01');
  await waitForLightboxReady(page);
  const moreLink = page.locator('#day-2025-11-01 [data-burst] [data-more] a');
  await expect(moreLink).toHaveAccessibleName('還有 3 張照片');
  await moreLink.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('照片 · 5 / 7');
  await expect(
    dialog.getByRole('button', { name: '設為封面', exact: true }),
  ).toBeFocused();
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('照片 · 7 / 7');
  await expect(dialog.getByRole('button', { name: '下一張' })).toBeDisabled();

  await dialog.getByRole('button', { name: '照片 · 1 / 7' }).click();
  await expect(dialog.getByText('目前的封面')).toBeVisible();
  await dialog.getByRole('button', { name: '照片 · 3 / 7' }).click();
  await dialog.getByRole('button', { name: '設為封面', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '已設為封面' }),
  ).toBeVisible();
  await expect
    .poll(() => readNote('2025-11-01'), { timeout: 15_000 })
    .toMatch(/^cover: DDDDDDDD-0000-0000-0000-000000000004$/m);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-01$/);
  await page.goto('/month/2025-11');
  await expect(
    page.locator('a[data-date="2025-11-01"]:visible img'),
  ).toHaveAttribute('src', /DDDDDDDD-0000-0000-0000-000000000004/);
});

test('a video in a burst plays and cannot be set as cover', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForLightboxReady(page);
  await page
    .locator('#day-2025-11-02 [data-burst] a[data-lightbox]')
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('video')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '設為封面', exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: '已設為封面', exact: true }),
  ).toHaveCount(0);
});

test('arrow keys seek a focused video instead of changing the photo', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForLightboxReady(page);
  await page
    .locator('#day-2025-11-02 [data-burst] a[data-lightbox]')
    .first()
    .evaluate((trigger) => {
      const at = '2025-11-02T20:50:00+08:00';
      const items = [
        {
          id: '99999999-0000-0000-0000-000000000009',
          at,
          alt: '',
          video: true,
        },
        {
          id: 'DDDDDDDD-0000-0000-0000-000000000004',
          at,
          alt: '',
          video: false,
        },
      ];
      document.dispatchEvent(
        new CustomEvent('memories:lightbox', {
          detail: { trigger, date: '2025-11-02', items, index: 0 },
        }),
      );
    });
  const dialog = page.getByRole('dialog');
  const video = dialog.locator('video');
  await expect(dialog).toContainText('照片 · 1 / 2');
  await video.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(video).toBeFocused();
  await expect(dialog).toContainText('照片 · 1 / 2');
  await dialog.getByRole('button', { name: '下一張' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('照片 · 2 / 2');
});

test('media supports HTTP range requests for video playback', async ({
  request,
}) => {
  const response = await request.get(
    '/media/99999999-0000-0000-0000-000000000009',
    { headers: { Range: 'bytes=0-9' } },
  );
  expect(response.status()).toBe(206);
  expect(response.headers()['content-range']).toMatch(/^bytes 0-9\/\d+$/);
  expect(response.headers()['accept-ranges']).toBe('bytes');
  expect(response.headers()['content-length']).toBe('10');
});

test('a note typed just before scrolling stays on its own day', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const panel = page.getByRole('complementary', { name: '筆記' });
  const body = panel.getByLabel('當天的回憶');
  await expect(body).toBeEnabled();
  await body.fill('十一月二日的筆記');

  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(panel).toContainText('2025-11-03（週一）');
  await expect(body).toHaveValue('');

  const read = (date: string) =>
    existsSync(noteFile(date)) ? readFileSync(noteFile(date), 'utf8') : '';
  await expect.poll(() => read('2025-11-02')).toContain('十一月二日的筆記');
  expect(read('2025-11-03')).not.toContain('十一月二日的筆記');
});

test('the hour strip jumps to an hour and follows the scroll', async ({
  page,
}) => {
  await page.goto('/day/2025-10-31');
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip).toBeVisible();
  await strip.getByRole('link', { name: '15 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 81', { exact: true }),
  ).toBeInViewport();
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '15',
  );
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 101' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '17',
  );
});

test('the hour strip works on a day loaded while scrolling', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const strip = page.locator('#day-2025-10-31 [data-hour-strip]');
  await expect(strip.locator('[aria-current="time"]')).toHaveAttribute(
    'data-hour',
    '10',
  );
  await strip.getByRole('link', { name: '08 點，10 則' }).click();
  await expect(
    page.getByText('Busy message 11', { exact: true }),
  ).toBeInViewport();
});

test('the month scrubber marks the month in view and jumps to another', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  const rail = page.getByRole('navigation', { name: '月份' });
  await expect(rail.locator('[aria-current="date"]')).toHaveAttribute(
    'data-month',
    '2025-11',
  );
  await expect(rail).toContainText('2025');
  await rail.getByRole('link', { name: /10 月/ }).click();
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  await expect(rail.locator('[aria-current="date"]')).toHaveAttribute(
    'data-month',
    '2025-10',
  );
});

test.describe('an annotation signed through Access', () => {
  test.use({
    extraHTTPHeaders: {
      'Cf-Access-Authenticated-User-Email': 'alice@example.com',
    },
  });

  test('carries the signed-in author', async ({ page }) => {
    await page.goto('/day/2025-11-02');
    const panel = page.getByRole('complementary', { name: '筆記' });
    await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
    const message = page.locator('[data-event-id]', {
      hasText: 'Thread reply',
    });
    await message.hover();
    await message.getByRole('button', { name: '眉批' }).click();
    await panel
      .getByLabel(/^眉批：/)
      .last()
      .fill('Alice 寫的眉批');
    await expect(panel).toContainText('已儲存');
    await expect
      .poll(() => readFileSync(noteFile('2025-11-02'), 'utf8'))
      .toMatch(/ src:slack by:Alice %%$/m);
    await expect(panel.getByText('Alice', { exact: true })).toBeVisible();
    await expect(panel.getByPlaceholder('你的名字')).toHaveCount(0);
  });

  test('resolving a conflict does not re-prompt a signed-in user for a name', async ({
    page,
  }) => {
    await page.goto('/day/2025-10-31');
    const panel = page.getByRole('complementary', { name: '筆記' });
    await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
    await panel.getByLabel('當天的回憶').fill('Alice 的版本');
    await expect(panel).toContainText('已儲存');

    const file = noteFile('2025-10-31');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('Alice 的版本', 'Obsidian 改的'),
    );
    await panel.getByLabel('當天的回憶').fill('app 又改了');
    await expect(panel).toContainText('有衝突');
    const obsidianCard = panel.locator('[data-slot="card"]', {
      has: page.getByRole('heading', { name: 'Obsidian 的版本' }),
    });
    await obsidianCard.getByRole('button', { name: '保留這個版本' }).click();
    await expect(panel.getByLabel('當天的回憶')).toHaveValue('Obsidian 改的');
    await expect(panel.getByPlaceholder('你的名字')).toHaveCount(0);
  });
});

test('without an identity, the name set once in the panel signs 眉批', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
  await panel.getByPlaceholder('你的名字').fill('Bob');
  await panel.getByPlaceholder('你的名字').press('Enter');
  const message = page.locator('[data-event-id]', { hasText: 'Coffee first' });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：/)
    .last()
    .fill('Bob 的眉批');
  await expect(panel).toContainText('已儲存');
  await expect
    .poll(() => readFileSync(noteFile('2025-11-03'), 'utf8'))
    .toMatch(/ by:Bob %%$/m);
});

test('a brand-new annotation keeps its established author across a second save, even if the viewer identity changes meanwhile', async ({
  page,
  context,
}) => {
  await context.setExtraHTTPHeaders({
    'Cf-Access-Authenticated-User-Email': 'alice@example.com',
  });
  await page.goto('/day/2025-10-31');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();

  const message = page.locator('[data-event-id]', {
    hasText: 'Busy message 90',
  });
  await message.hover();
  await message.getByRole('button', { name: '眉批' }).click();
  const textarea = panel.getByLabel(/^眉批：/).last();
  await textarea.fill('第一次寫的');
  await expect(panel).toContainText('已儲存');
  await expect
    .poll(() => readFileSync(noteFile('2025-10-31'), 'utf8'))
    .toMatch(/ by:Alice %%$/m);

  await context.setExtraHTTPHeaders({
    'Cf-Access-Authenticated-User-Email': 'bob@example.com',
  });
  await textarea.fill('第一次寫的，補充一些');
  await expect(panel).toContainText('已儲存');
  expect(readFileSync(noteFile('2025-10-31'), 'utf8')).toMatch(
    / by:Alice %%$/m,
  );
});

test('the date jump opens a typed day, or the nearest one', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  await input.fill('2025-11-0');
  await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(3);
  await input.fill('2025/11/2');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-02/);

  await page.getByRole('button', { name: '跳至日期' }).first().click();
  await page
    .getByRole('dialog')
    .getByPlaceholder('YYYY-MM-DD')
    .fill('2025-11-20');
  await expect(page.getByRole('dialog')).toContainText(
    '沒有這一天，按 Enter 跳到最近的 2025-11-03',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    '沒有這一天，已跳到最近的 2025-11-03（週一）',
  );
});

test('the keyboard button opens the shortcuts overlay', async ({ page }) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '鍵盤快速鍵' }).click();
  const dialog = page.getByRole('dialog', { name: '鍵盤快速鍵' });
  await expect(dialog.getByRole('heading')).toHaveText([
    '鍵盤快速鍵',
    '全部畫面',
    '年',
    '日',
    '照片',
  ]);
  for (const label of ['看所有快速鍵', '在日子間移動', '寫回憶'])
    await expect(dialog).toContainText(label);
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(dialog).toBeHidden();
});

test('the 年/月/日 tabs follow the day in view', async ({ page }) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);
  const monthTab = page.getByRole('tab', { name: '月' });
  await expect(monthTab).toHaveAttribute('href', '/month/2025-10');
  await expect(monthTab).toBeInViewport();
  await monthTab.click();
  await expect(page).toHaveURL(/\/month\/2025-10$/);
});

test('the ‹ › links point at the neighbours of the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  const prev = page.getByRole('link', { name: '前一天' });
  const next = page.getByRole('link', { name: '後一天' });
  await expect(prev).toHaveAttribute('href', '/day/2025-11-01');
  await expect(next).toHaveAttribute('href', '/day/2025-11-03');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  const day = page.locator('[data-day="2025-11-03"]');
  await expect(day).toBeAttached();
  await expect(day).not.toHaveAttribute('data-next', /./);
  await day.scrollIntoViewIfNeeded();
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await expect(prev).toHaveAttribute('href', '/day/2025-11-02');
  await expect(next).toHaveCount(0);
  await expect(page.getByRole('button', { name: '後一天' })).toBeVisible();
});

test('the sticky day header and month scrubber sit below the app bar', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const style = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const { top, maxHeight } = getComputedStyle(el);
        return { top, maxHeight };
      });
  expect((await style('[data-day="2025-11-01"] > header')).top).toBe('56px');
  const viewport = page.viewportSize()?.height ?? 0;
  expect(await style('aside:has(+ [data-stream])')).toEqual({
    top: '72px',
    maxHeight: `${viewport - 88}px`,
  });
});

test('the date jump ignores an Enter fired mid-IME composition', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.getByRole('button', { name: '跳至日期' }).first().click();
  const input = page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD');
  // An exact match selects through cmdk's own Enter, not this onKeyDown guard.
  await input.fill('2025-11-20');
  await expect(page.getByRole('dialog')).toContainText(
    '沒有這一天，按 Enter 跳到最近的 2025-11-03',
  );
  await input.dispatchEvent('keydown', {
    key: 'Enter',
    keyCode: 229,
    isComposing: true,
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/day\/2025-11-03/);
});

test('keys: j and k, n, ? and /, and Escape only when nothing else claims it', async ({
  page,
}) => {
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  await page.keyboard.press('j');
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await waitForAppBarReady(page);
  await page.keyboard.press('k');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await waitForAppBarReady(page);

  const memory = page.getByLabel('當天的回憶');
  const before = await memory.inputValue();
  await page.keyboard.press('n');
  await expect(memory).toBeFocused();
  await page.keyboard.type('jk');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(memory).toHaveValue(`${before}jk`);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await memory.evaluate((el) => (el as HTMLElement).blur());

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: '鍵盤快速鍵' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('/');
  await expect(
    page.getByRole('dialog').getByPlaceholder('YYYY-MM-DD'),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await waitForAppBarReady(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await waitForAppBarReady(page);

  await page.locator('a[data-date="2025-11-01"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('a[data-date="2025-11-02"]')).toBeFocused();
});

test('Escape collapses an expanded phone note sheet before it zooms out', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/day/2025-11-02');
  await waitForAppBarReady(page);
  const collapsed = page.getByRole('button', { name: '展開筆記' });
  await collapsed.click();
  const expanded = page.getByRole('button', { name: '收合筆記' });
  await expect(expanded).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(collapsed).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-11$/);
});

test('zooming out after scrolling into a different month lands on the day in view', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  await waitForAppBarReady(page);
  await expect(page.locator('#day-2025-10-31')).toBeAttached();
  await page
    .locator('[data-event-id]', { hasText: 'Busy message 31' })
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-10-31$/);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/month\/2025-10$/);
  await waitForAppBarReady(page);
  await expect(page.getByRole('tablist', { name: '縮放' })).toBeInViewport();

  const cell = page.locator('a[data-date="2025-10-31"]:visible');
  await expect(cell).toHaveAttribute(
    'style',
    /view-transition-name: day-2025-10-31/,
  );
  await expect(cell).toBeFocused();

  await cell.click();
  await expect(
    page.locator('#day-2025-10-31 [data-morph="day-2025-10-31"]'),
  ).toHaveAttribute('style', /view-transition-name: day-2025-10-31/);
});

test('under reduced motion no element morphs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/month/2025-11');
  await page.locator('a[data-date="2025-11-01"]:visible').click();
  const name = await page
    .locator('#day-2025-11-01 [data-morph="day-2025-11-01"]')
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toBe('none');
});

test('a transient view-transition name is cleared once the transition finishes, and the app bar keeps its own', async ({
  page,
}) => {
  await page.goto('/');
  await waitForAppBarReady(page);
  await page.locator('a[data-morph="month-2025-11"]:visible').click();
  await expect(page).toHaveURL(/\/month\/2025-11$/);
  await waitForAppBarReady(page);

  const monthSection = page.locator('section[data-morph="month-2025-11"]');
  await expect
    .poll(() =>
      monthSection.evaluate((el) => getComputedStyle(el).viewTransitionName),
    )
    .toBe('none');

  const headerName = await page
    .locator('header')
    .first()
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(headerName).toBe('app-bar');
});

test('a morph name on an element parsed after the page is revealed is cleared too', async ({
  page,
}) => {
  await page.route('**/__slow.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  await page.route('**/month/2025-11', async (route) => {
    const response = await route.fetch();
    const late =
      '<script src="/__slow.js"></script>' +
      '<div id="late-morph" data-morph style="view-transition-name: late"></div>';
    await route.fulfill({
      response,
      body: (await response.text()).replace('</body>', `${late}</body>`),
    });
  });
  await page.addInitScript(() => {
    window.addEventListener('pagereveal', () => {
      document.documentElement.dataset['revealedWhile'] = document.readyState;
    });
  });
  await page.goto('/month/2025-11');
  await expect(page.locator('html')).toHaveAttribute(
    'data-revealed-while',
    'loading',
  );
  await expect
    .poll(() =>
      page
        .locator('#late-morph')
        .evaluate((el) => getComputedStyle(el).viewTransitionName),
    )
    .toBe('none');
});

test.describe('on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the notes sheet peeks, expands, and Escape returns it to the peek', async ({
    page,
  }) => {
    await page.goto('/day/2025-11-02');
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await expect(sheet).toContainText('已儲存');
    await expect(sheet.getByLabel('當天的回憶')).toHaveCount(0);
    await sheet.getByRole('button', { name: '展開筆記' }).click();
    await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet.getByLabel('當天的回憶')).toHaveCount(0);
    await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  });

  test('rapid Tab presses stay inside the expanded sheet', async ({ page }) => {
    await page.goto('/day/2025-11-02');
    await waitForAppBarReady(page);
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await sheet.getByRole('button', { name: '展開筆記' }).click();
    await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
    const url = page.url();
    await page.evaluate(() => {
      const w = window as Window & { leaks?: number };
      w.leaks = 0;
      document.addEventListener('focusin', (e) => {
        if ((e.target as Element).closest('main')) w.leaks = (w.leaks ?? 0) + 1;
      });
    });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab', { delay: 0 });
      expect(
        await page.evaluate(
          () => (window as Window & { leaks?: number }).leaks,
        ),
      ).toBe(0);
    }
    expect(page.url()).toBe(url);
  });

  test('closing the expanded sheet returns focus to its toggle', async ({
    page,
  }) => {
    await page.goto('/day/2025-11-02');
    await waitForAppBarReady(page);
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await sheet.getByRole('button', { name: '展開筆記' }).click();
    await sheet.getByRole('button', { name: '關閉' }).click();
    await expect(sheet.getByLabel('當天的回憶')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: '展開筆記' })).toBeFocused();
  });

  test('a note opened on desktop keeps the page inert after shrinking to a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/day/2025-11-02');
    await waitForAppBarReady(page);
    const memory = page
      .getByRole('complementary', { name: '筆記' })
      .getByLabel('當天的回憶');
    await expect(async () => {
      await page.evaluate(() =>
        document.dispatchEvent(new Event('memories:focus-note')),
      );
      await expect(memory).toBeFocused({ timeout: 500 });
    }).toPass();
    await page.setViewportSize({ width: 390, height: 844 });
    const sheet = page.getByRole('dialog', { name: '這一天的回憶' });
    await expect(sheet.getByLabel('當天的回憶')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => (document.querySelector('body > main') as HTMLElement).inert,
        ),
      )
      .toBe(true);
  });
});

test('a long press on a message opens 眉批 and 複製', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  await page
    .locator('astro-island[component-url*="StreamMenu"]:not([ssr])')
    .waitFor({ state: 'attached' });
  const row = page.locator('[data-event-id]', { hasText: 'Coffee first' });
  const box = await row.boundingBox();
  await row.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    clientX: (box?.x ?? 0) + 20,
    clientY: (box?.y ?? 0) + 10,
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['眉批', '複製']);
  await menu.getByRole('menuitem', { name: '眉批' }).click();
  await expect(
    page
      .getByRole('complementary', { name: '筆記' })
      .getByLabel(/^眉批：Coffee first/),
  ).toBeFocused();
});

test('the next day shows skeleton rows while it loads', async ({ page }) => {
  let requests = 0;
  await page.route('**/day/2025-11-03/partial', async (route) => {
    requests += 1;
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto('/day/2025-11-02');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-load="next"] [data-skeleton]'),
  ).toBeVisible();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await expect(page.locator('[data-load="next"] [data-skeleton]')).toBeHidden();
  expect(requests).toBe(1);
});

test.describe('touch gestures on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  const touch = async (page: Page) => {
    const cdp = await page.context().newCDPSession(page);
    return (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      touchPoints: { x: number; y: number; id: number }[],
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  };

  const centreOf = async (page: Page, target: Locator) => {
    await page.waitForLoadState('networkidle');
    let at: { x: number; y: number } | undefined;
    await expect
      .poll(async () => {
        at = await target.evaluate((el) => {
          el.scrollIntoView({ block: 'center' });
          const box = el.getBoundingClientRect();
          const point = { x: box.x + 24, y: box.y + box.height / 2 };
          return el.contains(document.elementFromPoint(point.x, point.y))
            ? point
            : undefined;
        });
        return at;
      })
      .toBeDefined();
    if (!at) throw new Error('the target cannot be hit');
    return at;
  };

  const ready = async (page: Page, date: string) => {
    await page.goto(`/day/${date}`);
    await waitForAppBarReady(page);
    await page
      .locator('astro-island[component-url*="StreamMenu"]:not([ssr])')
      .waitFor({ state: 'attached' });
  };

  test('holding a message opens the menu and the release neither closes it nor clicks', async ({
    page,
  }) => {
    await ready(page, '2025-11-01');
    await waitForLightboxReady(page);
    const send = await touch(page);
    const at = await centreOf(
      page,
      page.locator('#day-2025-11-01 [data-burst] > li[data-event-id]').first(),
    );
    await send('touchStart', [{ ...at, id: 1 }]);
    await page.waitForTimeout(700);
    await send('touchEnd', []);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await page.waitForTimeout(300);
    await expect(menu).toBeVisible();
    await expect(
      page.getByRole('dialog').filter({ hasText: '照片 · ' }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/day\/2025-11-01$/);
    await expect(page.locator('html[data-overlays]')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/\/day\/2025-11-01$/);

    await page.touchscreen.tap(at.x, at.y);
    await expect(
      page.getByRole('dialog').filter({ hasText: '照片 · ' }),
    ).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('複製 in the long-press menu copies the message text', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ready(page, '2025-11-03');
    const send = await touch(page);
    const at = await centreOf(
      page,
      page.locator('[data-event-id]', { hasText: 'Coffee first' }),
    );
    await send('touchStart', [{ ...at, id: 1 }]);
    await page.waitForTimeout(700);
    await send('touchEnd', []);
    const copy = page.getByRole('menuitem', { name: '複製' });
    await expect(copy).toBeVisible();
    const box = await copy.boundingBox();
    await page.touchscreen.tap(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('Coffee first');
    await expect(page.locator('html[data-overlays]')).toHaveCount(0);
  });

  test('a finger that moves or lifts early does not open the menu', async ({
    page,
  }) => {
    await ready(page, '2025-11-03');
    const send = await touch(page);
    const at = await centreOf(
      page,
      page.locator('[data-event-id]', { hasText: 'Coffee first' }),
    );
    await send('touchStart', [{ ...at, id: 1 }]);
    await send('touchMove', [{ x: at.x, y: at.y + 30, id: 1 }]);
    await page.waitForTimeout(700);
    await send('touchEnd', []);
    await send('touchStart', [{ ...at, id: 1 }]);
    await page.waitForTimeout(150);
    await send('touchEnd', []);
    await page.waitForTimeout(500);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('pinching two fingers together zooms out to the month', async ({
    page,
  }) => {
    await ready(page, '2025-11-03');
    const send = await touch(page);
    const at = await centreOf(
      page,
      page.locator('[data-event-id]', { hasText: 'Coffee first' }),
    );
    const pinch = async (from: number, to: number) => {
      const pair = (d: number) => [
        { x: 195 - d / 2, y: at.y, id: 1 },
        { x: 195 + d / 2, y: at.y, id: 2 },
      ];
      await send('touchStart', pair(from));
      for (const d of [from - (from - to) / 2, to])
        await send('touchMove', pair(d));
      await send('touchEnd', []);
    };

    await page.evaluate(() =>
      document.documentElement.setAttribute('data-overlays', '1'),
    );
    await pinch(200, 100);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/day\/2025-11-03$/);
    await page.evaluate(() =>
      document.documentElement.removeAttribute('data-overlays'),
    );

    await pinch(200, 170);
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/day\/2025-11-03$/);

    await pinch(200, 100);
    await expect(page).toHaveURL(/\/month\/2025-11$/);
  });
});

test('a failed next day keeps its notice until the reader scrolls again', async ({
  page,
}) => {
  let requests = 0;
  let fail = true;
  await page.route('**/day/2025-11-03/partial', async (route) => {
    requests += 1;
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.goto('/day/2025-11-02');
  await page.waitForLoadState('networkidle');
  const notice = page.locator('[data-load="next"] [data-failed]');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(notice).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(notice).toBeVisible();
  await expect(page.locator('[data-load="next"] [data-skeleton]')).toBeHidden();
  expect(requests).toBe(1);

  fail = false;
  await page.mouse.wheel(0, 40);
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  await expect(notice).toBeHidden();
  expect(requests).toBe(2);
});

test('a hidden source stays hidden from the first paint', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('memories:hidden-sources', '["photo"]'),
  );
  await page.goto('/day/2025-11-01', { waitUntil: 'domcontentloaded' });
  const early = await page.evaluate(() => {
    const photo = document.querySelector(
      '#day-2025-11-01 [data-source="photo"]',
    );
    return {
      hidden: document.documentElement.hasAttribute('data-hide-photo'),
      display: photo && getComputedStyle(photo).display,
    };
  });
  expect(early).toEqual({ hidden: true, display: 'none' });

  await page
    .locator('astro-island[component-url*="SourceFilter"]:not([ssr])')
    .waitFor({ state: 'attached' });
  const toggle = page.getByRole('button', { name: '照片', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'LINE', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html[data-hide-photo]')).toHaveCount(1);
  await toggle.click();
  await expect(page.locator('html[data-hide-photo]')).toHaveCount(0);
});

test('眉批 show under their message, clamped, on the panel day and on days loaded by scrolling', async ({
  page,
}) => {
  await page.goto('/day/2025-11-03');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
  const row = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'Coffee first',
  });
  await row.hover();
  await row.getByRole('button', { name: '眉批' }).click();
  await panel.getByLabel('眉批：Coffee first').fill('第一行\n第二行\n第三行');
  await expect(panel).toContainText('已儲存');
  const note = row.locator('[data-note]');
  await expect(note).toBeVisible();
  await expect(note).toContainText('第一行');
  await expect(note.getByRole('img', { name: '已有眉批' })).toBeVisible();
  await expect(note.locator('[data-note-by]')).toHaveText(' · Bob');
  await expect(note.locator('[data-note-by]')).toBeVisible();
  const clamp = note.locator('.line-clamp-2');
  expect(
    await clamp.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
  ).toBe(true);
  await expect(row.locator('p').first()).toHaveText('Coffee first');

  await page.goto('/day/2025-11-02');
  await page.locator('[data-load="next"]').scrollIntoViewIfNeeded();
  await expect(page.locator('#day-2025-11-03')).toBeAttached();
  const scrolled = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'Coffee first',
  });
  await expect(scrolled).toHaveAttribute('data-annotated', '');
  await expect(scrolled.locator('[data-note]')).toContainText('第一行');
  await page
    .locator('#day-2025-11-03')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-03$/);
  await page
    .locator('#day-2025-11-02')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page).toHaveURL(/\/day\/2025-11-02$/);
  await expect(scrolled).toHaveAttribute('data-annotated', '');
  await expect(scrolled.locator('[data-note]')).toContainText('第一行');
});

test('a message without 眉批 shows no inline note', async ({ page }) => {
  await page.goto('/day/2025-11-03');
  const row = page.locator('#day-2025-11-03 [data-event-id]', {
    hasText: 'New week, new plans',
  });
  await expect(row).not.toHaveAttribute('data-annotated', '');
  await expect(row.locator('[data-note]')).toBeHidden();
  await expect(row.getByRole('img', { name: '已有眉批' })).toHaveCount(0);
});

const noteDom = (page: Page, date: string) =>
  page.evaluate(async (day) => {
    const html = await (await fetch(`/day/${day}`)).text();
    const served = new DOMParser().parseFromString(html, 'text/html');
    const rows = (root: ParentNode) =>
      [...root.querySelectorAll(`#day-${day} [data-event-id]`)].map((li) => [
        li.id,
        li.hasAttribute('data-annotated'),
        li.querySelector('[data-note]')?.outerHTML ?? null,
      ]);
    return { live: rows(document), served: rows(served) };
  }, date);

test('the server and the panel repaint render the same inline 眉批', async ({
  page,
}) => {
  await page.goto('/day/2025-11-01');
  const panel = page.getByRole('complementary', { name: '筆記' });
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
  const lunch = page.locator('#day-2025-11-01 [data-event-id]', {
    hasText: 'Lunch plan',
  });
  await expect(lunch.locator('[data-note-body]')).toHaveText('後來那家店關了');
  await expect(lunch.locator('[data-note-by]')).toHaveText('');
  const hydrated = await noteDom(page, '2025-11-01');
  expect(hydrated.live.some(([, annotated]) => annotated)).toBe(true);
  expect(hydrated.live).toEqual(hydrated.served);

  const row = page.locator('#day-2025-11-01 [data-event-id]', {
    hasText: 'Sounds good',
  });
  await row.hover();
  await row.getByRole('button', { name: '眉批' }).click();
  await panel
    .getByLabel(/^眉批：Sounds good$/)
    .fill('  <b>好</b> & "那家"\n第二行  ');
  await expect(panel).toContainText('已儲存');
  await expect(row).toHaveAttribute('data-annotated', '');
  const painted = await noteDom(page, '2025-11-01');
  expect(painted.live).toEqual(painted.served);

  await page.goto('/day/2025-11-03');
  await expect(panel.getByLabel('當天的回憶')).toBeEnabled();
  const signed = await noteDom(page, '2025-11-03');
  expect(signed.live.some(([, a]) => a)).toBe(true);
  expect(signed.live).toEqual(signed.served);
});
