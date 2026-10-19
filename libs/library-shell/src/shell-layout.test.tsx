import { render, screen } from '@testing-library/react';

import { SHELL_IDS } from './ids';
import { ShellHeader } from './shell-header';
import { ShellLayout } from './shell-layout';

const header = <ShellHeader>top</ShellHeader>;

function columnsClass(container: HTMLElement): string {
  return container.querySelector('main')?.parentElement?.className ?? '';
}

describe('ShellLayout on desktop', () => {
  it('shows filters, content and pane as three columns', () => {
    const { container } = render(
      <ShellLayout
        header={header}
        isDesktop
        filters={<p>filters</p>}
        pane={<p>pane</p>}
        filtersVisible
        paneOpen
        labels={{ pane: 'Book details' }}
      >
        list
      </ShellLayout>,
    );
    expect(columnsClass(container)).toContain(
      'lg:grid-cols-[248px_minmax(0,1fr)_420px]',
    );
    expect(screen.getByRole('complementary', { name: 'Filters' }).id).toBe(
      SHELL_IDS.filters,
    );
    expect(
      screen.getByRole('complementary', { name: 'Book details' }).textContent,
    ).toContain('pane');
    expect(screen.getByRole('main').id).toBe(SHELL_IDS.main);
  });

  it('keeps the hidden filter column in the DOM for aria-controls', () => {
    const { container } = render(
      <ShellLayout header={header} isDesktop filters={<p>filters</p>}>
        list
      </ShellLayout>,
    );
    const aside = container.querySelector(`#${SHELL_IDS.filters}`);
    expect(aside).not.toBeNull();
    expect(aside?.hasAttribute('hidden')).toBe(true);
    expect(columnsClass(container)).toContain('lg:grid-cols-1');
  });

  it('drops the pane column until something is open', () => {
    const { container } = render(
      <ShellLayout
        header={header}
        isDesktop
        filters={<p>filters</p>}
        pane={<p>pane</p>}
        filtersVisible
      >
        list
      </ShellLayout>,
    );
    expect(screen.queryByText('pane')).toBeNull();
    expect(columnsClass(container)).toContain(
      'lg:grid-cols-[248px_minmax(0,1fr)]',
    );
  });
});

describe('ShellLayout below lg', () => {
  it('moves filters and pane into sheets', () => {
    render(
      <ShellLayout
        header={header}
        isDesktop={false}
        filters={<p>filters</p>}
        pane={<p>pane</p>}
        filtersSheetOpen
        paneOpen
      >
        list
      </ShellLayout>,
    );
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByText('filters')).toBeTruthy();
    expect(screen.getByText('pane')).toBeTruthy();
  });

  it('reports a dismissed pane', async () => {
    const onPaneClose = vi.fn();
    render(
      <ShellLayout
        header={header}
        isDesktop={false}
        pane={<p>pane</p>}
        paneOpen
        onPaneClose={onPaneClose}
      >
        list
      </ShellLayout>,
    );
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.keyDown(screen.getByText('pane'), { key: 'Escape' });
    expect(onPaneClose).toHaveBeenCalled();
  });
});

describe('ShellLayout page mode', () => {
  it('renders one padded column and no side panels', () => {
    render(
      <ShellLayout
        header={header}
        mode="page"
        isDesktop
        filters={<p>filters</p>}
        filtersVisible
      >
        reader
      </ShellLayout>,
    );
    expect(screen.getByRole('main').classList.contains('py-6')).toBe(true);
    expect(screen.queryByText('filters')).toBeNull();
  });
});

describe('ShellHeader', () => {
  it('names itself for cross-document view transitions', () => {
    render(<ShellHeader>top</ShellHeader>);
    expect(screen.getByRole('banner').style.viewTransitionName).toBe(
      'library-shell-header',
    );
  });
});
