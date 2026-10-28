import { fireEvent, render, screen, within } from '@testing-library/react';

import { LibraryBreadcrumb } from './breadcrumb';
import { SectionNav } from './section-nav';

describe('SectionNav', () => {
  it('marks the current page among link items', () => {
    render(
      <SectionNav
        label="Sections"
        current="sources"
        items={[
          { id: 'rack', label: 'Rack', href: '/rack' },
          { id: 'sources', label: 'Sources', href: '/rack/sources' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const sources = within(nav).getByRole('link', { name: 'Sources' });
    expect(sources.getAttribute('href')).toBe('/rack/sources');
    expect(sources.getAttribute('aria-current')).toBe('page');
    expect(
      within(nav)
        .getByRole('link', { name: 'Rack' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('switches an in-place view through onSelect', () => {
    const onSelect = vi.fn();
    render(
      <SectionNav
        label="Views"
        current="shelf"
        onSelect={onSelect}
        items={[
          { id: 'shelf', label: 'Shelf' },
          { id: 'study', label: 'Study' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Study' }));
    expect(onSelect).toHaveBeenCalledWith('study');
    expect(
      screen
        .getByRole('button', { name: 'Shelf' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('LibraryBreadcrumb', () => {
  it('leads from the collection front page through the trail to the page', () => {
    render(
      <LibraryBreadcrumb
        current="kb"
        trail={[{ label: 'Wiki', href: '/kb?source=wiki' }]}
        page="Loop engineering"
      />,
    );
    const nav = screen.getByRole('navigation', { name: '目前位置' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['知識庫', '/kb'],
      ['Wiki', '/kb?source=wiki'],
    ]);
    expect(
      within(nav).getByText('Loop engineering').getAttribute('aria-current'),
    ).toBe('page');
  });
});
