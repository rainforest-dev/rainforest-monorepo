import { describe, expect, test } from 'e2e';

describe('the hall', { tags: ['hall'] }, () => {
  test('stands every collection in one topic wing and counts what has no topic', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await expect(screen.getByRole('button', '依主題')).toBeVisible();
    await agent.assert(
      'the hall shows one signed wing named 主題, and its sign says 2 件沒有主題',
      { vision: true },
    );
  });

  test('gives each collection its own wing by collection', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.act('group the bookcases by collection (依館藏)');
    await agent.waitFor(
      'the hall shows four signed wings, for 書, 筆記本, 報架 and 知識庫, with exactly one bookcase each',
      { vision: true },
    );
  });

  test('shelves by date in every collection', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.act('group the bookcases by date (依時間)');
    await agent.waitFor(
      'the bookcases are labelled with months such as 2026-10 and 2026-07, and the 筆記本 wing has its own month bookcases',
      { vision: true },
    );
  });

  test('turns the view', async ({ app, agent, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.act('turn the view to the right');
    await agent.assert(
      'the room is seen from a different angle than straight down the entrance',
      { vision: true },
    );
  });

  test('opens a topic bookcase that holds several collections, and comes back', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    // The list of bookcases on a desktop is for the keyboard and screen readers only, and
    // 以清單瀏覽 leaves the hall for the books collection, so open the bookcase in the room.
    await agent.act(
      'in the 3D room, click the bookcase labelled "sea" to open it (if it is out of view, turn the view first)',
    );
    await expect(screen.getByRole('button', '回到大廳')).toBeVisible();
    // The Study draws its books in 3D, so the titles are in pixels, and they arrive after the
    // bookcase opens. Tide Tables is a knowledge base page on the same topic as the books.
    await agent.waitFor(
      'the bookcase holds The Salt Archive, Northbound Ferry and Tide Tables',
      { vision: true },
    );
    await agent.act('go back to the hall');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
  });

  test('searches every collection at once', async ({ app, agent }) => {
    await app.open('/');
    await agent.act('search the whole library for "tide"');
    await agent.waitFor(
      'the results include the book Copper Tides and the knowledge base page Tide Tables',
    );
  });
});
