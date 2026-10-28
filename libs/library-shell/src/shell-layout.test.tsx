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
        paneOpen
        labels={{ pane: 'Book details' }}
      >
        list
      </ShellLayout>,
    );
    expect(columnsClass(container)).toContain(
      'lg:grid-cols-[var(--library-sidebar)_minmax(0,1fr)_var(--library-pane)]',
    );
    expect(screen.getByRole('complementary', { name: 'Filters' }).id).toBe(
      SHELL_IDS.sidebar,
    );
    expect(
      screen.getByRole('complementary', { name: 'Book details' }).textContent,
    ).toContain('pane');
    expect(screen.getByRole('main').id).toBe(SHELL_IDS.main);
  });

  it('leaves closing the filter column to the shared sidebar toggle', () => {
    const { container } = render(
      <ShellLayout header={header} isDesktop filters={<p>filters</p>}>
        list
      </ShellLayout>,
    );
    const aside = container.querySelector(`#${SHELL_IDS.sidebar}`);
    expect(aside?.className).toContain('lg:sidebar-closed:hidden');
    expect(columnsClass(container)).toContain(
      'lg:sidebar-closed:grid-cols-[minmax(0,1fr)]',
    );
  });

  it('drops the pane column until something is open', () => {
    const { container } = render(
      <ShellLayout
        header={header}
        isDesktop
        filters={<p>filters</p>}
        pane={<p>pane</p>}
      >
        list
      </ShellLayout>,
    );
    expect(screen.queryByText('pane')).toBeNull();
    expect(columnsClass(container)).toContain(
      'lg:grid-cols-[var(--library-sidebar)_minmax(0,1fr)]',
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
      >
        reader
      </ShellLayout>,
    );
    const main = screen.getByRole('main');
    expect(main.classList.contains('pt-6')).toBe(true);
    // Room below the content for the phone tab bar.
    expect(main.classList.contains('pb-24')).toBe(true);
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
