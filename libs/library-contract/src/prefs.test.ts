import {
  DEFAULT_LIBRARY_PREFS,
  LIBRARY_LOCALE_HEADER,
  LIBRARY_PREFS_COOKIE,
  libraryLocaleOfRequest,
  parseLibraryPrefs,
  resolveLibraryLocale,
  routeLibraryLocale,
  serializeLibraryPrefs,
} from './prefs';

describe('library prefs cookie', () => {
  it('round-trips through the cookie value', () => {
    const prefs = {
      scheme: 'dark',
      renderer: 'three-tsl',
      locale: 'en',
    } as const;
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
      locale: null,
    });
  });

  it('fills fields an older cookie lacks', () => {
    expect(parseLibraryPrefs('{"scheme":"light"}')).toEqual({
      scheme: 'light',
      renderer: null,
      locale: null,
    });
  });
});

describe('resolveLibraryLocale', () => {
  it('prefers the locale the reader picked', () => {
    expect(
      resolveLibraryLocale(
        serializeLibraryPrefs({ ...DEFAULT_LIBRARY_PREFS, locale: 'en' }),
        'zh-TW',
      ),
    ).toBe('en');
  });

  it('follows the browser when the reader has not picked one', () => {
    expect(resolveLibraryLocale('{"scheme":"dark"}', 'en-US')).toBe('en');
    expect(resolveLibraryLocale(undefined, undefined)).toBe('zh');
  });

  it('ignores a locale the library does not speak', () => {
    expect(resolveLibraryLocale('{"locale":"fr"}', 'en')).toBe('en');
  });
});

describe('libraryLocaleOfRequest', () => {
  it('reads the prefs cookie out of a Cookie header', () => {
    const cookie = `a=1; ${LIBRARY_PREFS_COOKIE}=${serializeLibraryPrefs({ ...DEFAULT_LIBRARY_PREFS, locale: 'en' })}; b=2`;
    expect(
      libraryLocaleOfRequest(
        new Headers({ cookie, 'accept-language': 'zh-TW' }),
      ),
    ).toBe('en');
  });

  it('falls back to Accept-Language without the cookie', () => {
    expect(
      libraryLocaleOfRequest(
        new Headers({ cookie: 'a=1', 'accept-language': 'en-GB' }),
      ),
    ).toBe('en');
  });
});

describe('routeLibraryLocale', () => {
  const en = new Headers({ 'accept-language': 'en-US' });

  it.each([
    ['/', '/en'],
    ['/books/1', '/en/books/1'],
  ])('rewrites %s to the reader’s locale', (pathname, rewritten) => {
    expect(routeLibraryLocale(pathname, en)).toEqual({
      kind: 'rewrite',
      pathname: rewritten,
      locale: 'en',
    });
  });

  it.each([
    ['/zh', '/'],
    ['/en/', '/'],
    ['/zh/read/3', '/read/3'],
  ])('redirects %s to the unprefixed path', (pathname, target) => {
    expect(routeLibraryLocale(pathname, en)).toEqual({
      kind: 'redirect',
      pathname: target,
    });
  });

  it('leaves a path that only starts like a locale alone', () => {
    expect(routeLibraryLocale('/zhuyin', en)).toEqual({
      kind: 'rewrite',
      pathname: '/en/zhuyin',
      locale: 'en',
    });
  });

  it('passes its own rewrite through, and only for the locale it named', () => {
    const rewritten = new Headers({
      'accept-language': 'en-US',
      [LIBRARY_LOCALE_HEADER]: 'zh',
    });
    expect(routeLibraryLocale('/zh/books/1', rewritten)).toEqual({
      kind: 'next',
    });
    expect(routeLibraryLocale('/en/books/1', rewritten)).toEqual({
      kind: 'redirect',
      pathname: '/books/1',
    });
  });
});
