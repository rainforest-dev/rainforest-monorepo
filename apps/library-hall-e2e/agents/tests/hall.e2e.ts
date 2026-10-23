import { describe, expect, test } from 'e2e';

describe('the hall', { tags: ['hall'] }, () => {
  test('has a wing for every collection', async ({ app, agent, screen }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.assert(
      'the hall shows four signed wings, for 書, 筆記本, 報架 and 知識庫, each with at least one bookcase',
      { vision: true },
    );
  });

  test('moves the bookcases when the grouping changes', async ({
    app,
    agent,
    screen,
  }) => {
    await app.open('/');
    await expect(screen.getByRole('button', '視角向右轉')).toBeVisible();
    await agent.act('group the bookcases by collection (依館藏)');
    await agent.waitFor('there is exactly one bookcase per collection', {
      vision: true,
    });
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

  test('opens a bookcase and comes back', async ({ app, agent, screen }) => {
    await app.open('/');
    // The list of bookcases on a desktop is for the keyboard and screen readers only, and
    // 以清單瀏覽 leaves the hall for the books collection, so open the bookcase in the room.
    await agent.act(
      'in the 3D room, click the bookcase labelled "sea" to open it (if it is out of view, turn the view first)',
    );
    await expect(screen.getByRole('button', '回到大廳')).toBeVisible();
    await agent.assert(
      'the bookcase holds The Salt Archive and Northbound Ferry',
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
