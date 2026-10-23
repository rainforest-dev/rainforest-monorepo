import { describe, expect, test } from 'e2e';

// Read-only: nothing here changes data in the deployed library.
describe('the deployed library', { tags: ['live'] }, () => {
  test('the hall shows every collection', async ({ app, agent, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.assert(
      'the hall has signed wings for 書, 筆記本, 報架 and 知識庫, and each wing has bookcases with items',
      { vision: true },
    );
  });

  test('every collection keeps the same top bar', async ({ app, agent }) => {
    for (const path of ['/books', '/notebooks', '/rack', '/kb']) {
      await app.open(path);
      await agent.assert(
        'the top bar shows the library name, the switcher for 大廳 書 筆記本 報架 知識庫, a search box and a language button',
      );
    }
  });
});
