import { render, screen, within } from '@testing-library/react';

import { LibraryBar } from './library-bar';
import { SectionNav } from './section-nav';

describe('LibraryBar', () => {
  it('leads with the library, then the switcher, the search and the language', () => {
    render(
      <LibraryBar current="notebooks">
        <button type="button">own control</button>
      </LibraryBar>,
    );
    const bar = screen.getByRole('banner');
    const home = within(bar).getByRole('link', { name: 'Rainforest 圖書館' });
    expect(home.getAttribute('href')).toBe('/');
    const navs = screen.getAllByRole('navigation', { name: '館藏' });
    // The bar's switcher and the phone tab bar.
    expect(navs).toHaveLength(2);
    for (const nav of navs)
      expect(
        within(nav)
          .getByRole('link', { name: '筆記本' })
          .getAttribute('aria-current'),
      ).toBe('page');
    expect(
      within(bar).getByRole('button', { name: 'own control' }),
    ).toBeTruthy();
    expect(within(bar).getByRole('combobox')).toBeTruthy();
  });

  it('keeps the library-wide search and puts the sections under the bar', () => {
    render(
      <LibraryBar
        current="books"
        sections={
          <SectionNav
            label="Views"
            items={[{ id: 'shelf', label: 'Shelf' }]}
            current="shelf"
          >
            <input type="search" aria-label="Search books" />
          </SectionNav>
        }
      />,
    );
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('combobox')).toBeTruthy();
    const views = screen.getByRole('navigation', { name: 'Views' });
    expect(bar.contains(views)).toBe(false);
    expect(
      within(views)
        .getByRole('button', { name: 'Shelf' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(bar).queryByRole('searchbox')).toBeNull();
  });

  it('names only its own collection on an old hostname', () => {
    render(<LibraryBar current="rack" collections={false} />);
    expect(
      screen.getByRole('link', { name: '報架' }).getAttribute('href'),
    ).toBe('/rack');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
