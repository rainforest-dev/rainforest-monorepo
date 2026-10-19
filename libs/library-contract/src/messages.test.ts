import { libraryMessageSchema } from './messages';

describe('libraryMessageSchema', () => {
  it('accepts the known notices', () => {
    expect(
      libraryMessageSchema.parse({
        type: 'items-changed',
        collection: 'notebooks',
      }),
    ).toEqual({ type: 'items-changed', collection: 'notebooks' });
    expect(libraryMessageSchema.parse({ type: 'prefs-changed' })).toEqual({
      type: 'prefs-changed',
    });
  });

  it.each([
    { type: 'items-changed', collection: 'photos' },
    { type: 'reload' },
    'items-changed',
    null,
  ])('rejects %j', (message) => {
    expect(libraryMessageSchema.safeParse(message).success).toBe(false);
  });
});
