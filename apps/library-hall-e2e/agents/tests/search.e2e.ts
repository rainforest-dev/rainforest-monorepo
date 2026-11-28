import { describe, expect, test } from 'e2e';

const box = '搜尋整座圖書館';

describe('searching the library', { tags: ['search'] }, () => {
  test('says so when nothing matches', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByRole('combobox', box).fill('zzz');

    await expect(screen.getByText('找不到符合的項目')).toBeVisible();
    await expect(screen.getByRole('option')).toHaveCount(0);
  });

  test('merges books and notebooks into one result list', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    await agent.act('search the whole library for {query}', {
      params: { query: 'an' },
    });

    await expect(screen.getByRole('option')).toHaveCount(2);
    await expect(
      screen.getByRole('option').filter({ hasText: 'Lantern Weather' }),
    ).toHaveCount(1);
    await expect(
      screen.getByRole('option').filter({ hasText: 'Garden Plans' }),
    ).toHaveCount(1);
  });

  test('switches the hall to English', async ({ app, agent, screen }) => {
    await app.open('/');
    await agent.act('switch the language of the library to English');

    await expect(screen.getByRole('link', 'Rainforest Library')).toBeVisible();
    await agent.assert(
      'the top bar shows the library name in English and a button to switch back to Chinese',
    );
  });
});
