import { expect, type Page, test } from '@playwright/test';

/** Answers the hall's merged search with `body`, and records each query asked. */
async function answerSearch(page: Page, body: unknown, status = 200) {
  const queries: string[] = [];
  await page.route('**/api/search?*', (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
    return route.fulfill({ status, json: body });
  });
  return queries;
}

test.describe('ShellSearch', () => {
  test('lists every collection’s hits as links and names a silent collection', async ({
    mount,
    page,
  }) => {
    const queries = await answerSearch(page, {
      results: [
        {
          kind: 'book',
          id: '1',
          title: 'Harbour Ledger',
          subtitle: 'Mara Ostrand',
          href: '/books?book=1',
        },
        {
          kind: 'notebook',
          id: 'page-4',
          title: '2026-A5 · p. 4',
          snippet: 'harbour walk',
          href: '/notebooks/2?page=4',
        },
      ],
      sources: [
        { collection: 'books', ok: true, count: 1 },
        { collection: 'notebooks', ok: true, count: 1 },
        { collection: 'kb', ok: false, count: 0 },
      ],
    });
    const component = await mount('shell-search/Default');
    await component.getByRole('combobox').fill('harbour');
    const list = component.getByRole('listbox', { name: '搜尋結果' });
    await expect(list.getByRole('link')).toHaveCount(2);
    await expect(list.getByRole('link').first()).toHaveAttribute(
      'href',
      '/books?book=1',
    );
    await expect(list.getByRole('link').nth(1)).toHaveAttribute(
      'href',
      '/notebooks/2?page=4',
    );
    await expect(component.getByText(/知識庫暫時沒有回應/)).toBeVisible();
    // Typing one word sends one query: the box waits for a pause before it asks.
    expect(queries).toEqual(['harbour']);
  });

  test('moves through the hits with the arrow keys', async ({
    mount,
    page,
  }) => {
    await answerSearch(page, {
      results: [
        { kind: 'kb', id: 'a', title: 'A', href: '/kb/a' },
        { kind: 'kb', id: 'b', title: 'B', href: '/kb/b' },
      ],
      sources: [{ collection: 'kb', ok: true, count: 2 }],
    });
    const component = await mount('shell-search/Default');
    const input = component.getByRole('combobox');
    await input.fill('x');
    const options = component.getByRole('option');
    await expect(options).toHaveCount(2);
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    const second = await options.nth(1).getAttribute('id');
    await expect(input).toHaveAttribute('aria-activedescendant', second ?? '');
  });

  test('opens the active hit on Enter', async ({ mount, page }) => {
    await answerSearch(page, {
      results: [{ kind: 'kb', id: 'a', title: 'A', href: '/kb/a' }],
      sources: [{ collection: 'kb', ok: true, count: 1 }],
    });
    await page.route('**/kb/a', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>KB A</h1>' }),
    );
    const component = await mount('shell-search/Default');
    const input = component.getByRole('combobox');
    await input.fill('a');
    await expect(component.getByRole('option')).toHaveCount(1);
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/kb\/a$/);
  });

  test('keeps the last hits on screen while the next query loads', async ({
    mount,
    page,
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/search?*', async (route) => {
      const q = new URL(route.request().url()).searchParams.get('q');
      if (q === 'dune')
        return route.fulfill({
          json: {
            results: [{ kind: 'kb', id: 'a', title: 'Dune', href: '/kb/a' }],
            sources: [{ collection: 'kb', ok: true, count: 1 }],
          },
        });
      await held;
      return route.fulfill({ json: { results: [], sources: [] } });
    });
    const component = await mount('shell-search/Default');
    const input = component.getByRole('combobox');
    await input.fill('dune');
    await expect(component.getByRole('option')).toHaveCount(1);
    await input.fill('dunes');
    await expect(component.getByText('搜尋中…')).toBeVisible();
    await expect(component.getByRole('option')).toHaveCount(1);
    release();
    await expect(component.getByText('找不到符合的項目')).toBeVisible();
    await expect(component.getByRole('option')).toHaveCount(0);
  });

  test('says so when the search fails', async ({ mount, page }) => {
    await answerSearch(page, {}, 502);
    const component = await mount('shell-search/Default');
    await component.getByRole('combobox').fill('x');
    await expect(component.getByText('搜尋暫時無法使用')).toBeVisible();
  });
});
