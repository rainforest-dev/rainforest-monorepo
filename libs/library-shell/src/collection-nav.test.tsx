import { render, screen, within } from '@testing-library/react';

import { CollectionNav, CollectionTabBar } from './collection-nav';

describe('CollectionNav', () => {
  it('links every collection and marks the current one', () => {
    render(<CollectionNav current="books" />);
    const nav = screen.getByRole('navigation', { name: '館藏' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/books',
      '/notebooks',
      '/rack',
      '/kb',
    ]);
    expect(
      within(nav)
        .getByRole('link', { name: '書' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(nav)
        .getByRole('link', { name: '大廳' })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('shows only the collections asked for, in that order', () => {
    render(<CollectionNav current="hall" collections={['kb', 'books']} />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      '知識庫',
      '書',
    ]);
  });

  it('lets an app render its own link for a collection', () => {
    render(
      <CollectionNav
        current="books"
        collections={['books', 'kb']}
        renderLink={({ children, ...props }, collection) => (
          <a
            {...props}
            data-router={collection.id === 'books' ? 'next' : undefined}
          >
            {children}
          </a>
        )}
      />,
    );
    expect(
      screen.getByRole('link', { name: '書' }).getAttribute('data-router'),
    ).toBe('next');
    expect(
      screen.getByRole('link', { name: '知識庫' }).hasAttribute('data-router'),
    ).toBe(false);
  });
});

describe('CollectionTabBar', () => {
  it('renders an icon and label per tab, phone only', () => {
    render(<CollectionTabBar current="kb" />);
    const nav = screen.getByRole('navigation');
    expect(nav.classList.contains('sm:hidden')).toBe(true);
    expect(nav.classList.contains('h-16')).toBe(true);
    const current = within(nav).getByRole('link', { name: '知識庫' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.querySelector('svg')?.hasAttribute('aria-hidden')).toBe(
      true,
    );
  });
});

describe('CollectionNav resume', () => {
  beforeEach(() => sessionStorage.clear());

  it('links other collections to where this tab left them', async () => {
    sessionStorage.setItem('library:return:books', '"/books?book=9"');
    sessionStorage.setItem('library:return:hall', '"/?tag=3"');
    render(
      <CollectionNav
        current="hall"
        resume
        collections={['hall', 'books', 'kb']}
      />,
    );
    const books = await screen.findByRole('link', { name: '書' });
    await vi.waitFor(() =>
      expect(books.getAttribute('href')).toBe('/books?book=9'),
    );
    expect(
      screen.getByRole('link', { name: '大廳' }).getAttribute('href'),
    ).toBe('/');
    expect(
      screen.getByRole('link', { name: '知識庫' }).getAttribute('href'),
    ).toBe('/kb');
  });
});
