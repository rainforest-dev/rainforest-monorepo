import { isLibraryLocale, negotiateLocale } from './locale';

describe('negotiateLocale', () => {
  it.each([
    [undefined, 'zh'],
    ['', 'zh'],
    ['fr-FR,fr;q=0.9', 'zh'],
    ['en-US,en;q=0.9', 'en'],
    ['zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7', 'zh'],
    ['zh-Hant-TW', 'zh'],
    ['zh-CN', 'zh'],
    ['fr;q=1, en;q=0.5, zh;q=0.8', 'zh'],
    ['en;q=0, zh;q=0.1', 'zh'],
    ['*', 'zh'],
    ['EN-gb', 'en'],
  ] as const)('reads %j as %s', (header, locale) => {
    expect(negotiateLocale(header)).toBe(locale);
  });
});

describe('isLibraryLocale', () => {
  it('accepts only the library locales', () => {
    expect(isLibraryLocale('zh')).toBe(true);
    expect(isLibraryLocale('en')).toBe(true);
    expect(isLibraryLocale('zh-TW')).toBe(false);
    expect(isLibraryLocale(null)).toBe(false);
  });
});
