import { describe, expect, it } from 'vitest';

import { BOOK_TOOL_DEFINITIONS, bookTools } from './tools';

describe('BOOK_TOOL_DEFINITIONS', () => {
  it('lists the same tools as bookTools and refuses to run them', async () => {
    const forwardOnly = () => {
      throw new Error('unused');
    };
    const tools = bookTools(
      new Proxy({} as Parameters<typeof bookTools>[0], {
        get: () => forwardOnly,
      }),
    );
    expect(BOOK_TOOL_DEFINITIONS.map((t) => t.name)).toEqual(
      tools.map((t) => t.name),
    );
    await expect(
      Promise.resolve().then(() =>
        BOOK_TOOL_DEFINITIONS[1]?.run({ bookId: 1 }, {}),
      ),
    ).rejects.toThrow(/only forward/);
  });
});
