import { LIBRARY_PREFS_COOKIE } from '@rainforest-dev/library-contract';
import { fireEvent, render, screen } from '@testing-library/react';

import { CollectionNav } from './collection-nav';
import { createLibraryI18n, libraryT } from './i18n';
import { LibraryI18nProvider, useLibraryT } from './i18n-provider';
import { LocaleSwitch } from './locale-switch';
import { readLibraryPrefs, writeLibraryPrefs } from './prefs';

const RESOURCES = {
  zh: { demo: { greet: '你好，{{name}}', books_other: '{{count}} 本書' } },
  en: {
    demo: {
      greet: 'Hello, {{name}}',
      books_one: '{{count}} book',
      books_other: '{{count}} books',
    },
  },
};

function Greeting() {
  const t = useLibraryT('demo');
  return <p>{t('greet', { name: 'Mara' })}</p>;
}

afterEach(() => {
  document.cookie = `${LIBRARY_PREFS_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

describe('createLibraryI18n', () => {
  it('translates synchronously, with interpolation and plurals', () => {
    const t = libraryT('en', RESOURCES, 'demo');
    expect(t('greet', { name: 'Mara' })).toBe('Hello, Mara');
    expect(t('books', { count: 1 })).toBe('1 book');
    expect(t('books', { count: 3 })).toBe('3 books');
    expect(libraryT('zh', RESOURCES, 'demo')('books', { count: 3 })).toBe(
      '3 本書',
    );
  });

  it('always carries the shell namespace', () => {
    expect(createLibraryI18n('en').t('search.loading')).toBe('Searching…');
    expect(createLibraryI18n('zh', RESOURCES).t('search.loading')).toBe(
      '搜尋中…',
    );
  });
});

describe('LibraryI18nProvider', () => {
  it('renders the app and the shell in the given locale', () => {
    render(
      <LibraryI18nProvider locale="en" resources={RESOURCES}>
        <Greeting />
        <CollectionNav current="hall" />
      </LibraryI18nProvider>,
    );
    expect(screen.getByText('Hello, Mara')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Collections' });
    expect(nav.textContent).toContain('Knowledge');
  });

  it('falls back to Chinese without a provider', () => {
    render(<CollectionNav current="hall" />);
    expect(screen.getByRole('navigation', { name: '館藏' })).toBeTruthy();
  });
});

describe('LocaleSwitch', () => {
  it('writes the other locale into the shared cookie and reloads', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <LibraryI18nProvider locale="zh" resources={RESOURCES}>
        <LocaleSwitch />
      </LibraryI18nProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '切換成英文' }));
    expect(readLibraryPrefs().locale).toBe('en');
    expect(reload).toHaveBeenCalled();
  });
});

describe('LibraryI18nProvider on a restored page', () => {
  function restore() {
    const event = new Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    window.dispatchEvent(event);
  }

  it.each([
    ['reloads', 'en', 1],
    ['keeps the page', 'zh', 0],
  ] as const)(
    '%s when the cookie picks %s over a zh page',
    (_, picked, reloads) => {
      const reload = vi.fn();
      vi.stubGlobal('location', { ...window.location, reload });
      render(
        <LibraryI18nProvider locale="zh" resources={RESOURCES}>
          <Greeting />
        </LibraryI18nProvider>,
      );
      writeLibraryPrefs({ locale: picked });
      restore();
      expect(reload).toHaveBeenCalledTimes(reloads);
    },
  );
});
