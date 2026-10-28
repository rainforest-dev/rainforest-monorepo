import { LIBRARY_PREFS_COOKIE } from '@rainforest-dev/library-contract';
import { fireEvent, render, screen } from '@testing-library/react';

import { LibraryI18nProvider } from './i18n-provider';
import { SIDEBAR_ATTRIBUTE, sidebarScript } from './layout';
import { SidebarToggle } from './sidebar';

function clearCookie() {
  document.cookie = `${LIBRARY_PREFS_COOKIE}=; Path=/; Max-Age=0`;
}

afterEach(() => {
  document.documentElement.removeAttribute(SIDEBAR_ATTRIBUTE);
  clearCookie();
});

describe('SidebarToggle', () => {
  it('closes the column on every page and remembers it', () => {
    render(
      <LibraryI18nProvider locale="en" resources={{}}>
        <SidebarToggle />
      </LibraryI18nProvider>,
    );
    const button = screen.getByRole('button', { name: 'Hide sidebar' });
    expect(button.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(button);
    expect(document.documentElement.getAttribute(SIDEBAR_ATTRIBUTE)).toBe(
      'closed',
    );
    expect(decodeURIComponent(document.cookie)).toContain('"sidebar":false');
    const reopen = screen.getByRole('button', { name: 'Show sidebar' });
    expect(reopen.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(reopen);
    expect(document.documentElement.hasAttribute(SIDEBAR_ATTRIBUTE)).toBe(
      false,
    );
  });
});

describe('sidebarScript', () => {
  it('applies a closed column from the cookie', () => {
    document.cookie = `${LIBRARY_PREFS_COOKIE}=${encodeURIComponent('{"sidebar":false}')}; Path=/`;
    new Function(sidebarScript())();
    expect(document.documentElement.getAttribute(SIDEBAR_ATTRIBUTE)).toBe(
      'closed',
    );
  });

  it('leaves the column open without a cookie', () => {
    new Function(sidebarScript())();
    expect(document.documentElement.hasAttribute(SIDEBAR_ATTRIBUTE)).toBe(
      false,
    );
  });
});
