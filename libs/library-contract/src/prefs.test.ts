import {
  DEFAULT_LIBRARY_PREFS,
  parseLibraryPrefs,
  serializeLibraryPrefs,
} from './prefs';

describe('library prefs cookie', () => {
  it('round-trips through the cookie value', () => {
    const prefs = { scheme: 'dark', renderer: 'three-tsl' } as const;
    expect(parseLibraryPrefs(serializeLibraryPrefs(prefs))).toEqual(prefs);
  });

  it.each([undefined, '', 'not json', '%E0%A4%A', '[]', 'null'])(
    'falls back to defaults for %s',
    (raw) => {
      expect(parseLibraryPrefs(raw)).toEqual(DEFAULT_LIBRARY_PREFS);
    },
  );

  it('keeps the valid fields of a partly bad cookie', () => {
    expect(parseLibraryPrefs('{"scheme":"sepia","renderer":"css"}')).toEqual({
      scheme: 'system',
      renderer: 'css',
    });
  });

  it('fills fields an older cookie lacks', () => {
    expect(parseLibraryPrefs('{"scheme":"light"}')).toEqual({
      scheme: 'light',
      renderer: null,
    });
  });
});
