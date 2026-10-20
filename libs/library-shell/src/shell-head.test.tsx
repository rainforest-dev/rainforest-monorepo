import { renderToStaticMarkup } from 'react-dom/server';

import { ShellHead } from './shell-head';

describe('ShellHead', () => {
  it('links the shared font and stylesheet and adds the speculation rules', () => {
    const html = renderToStaticMarkup(<ShellHead />);
    expect(html).toContain(
      'href="/_shell/fonts/inter-latin-wght-normal.woff2"',
    );
    expect(html).toContain('href="/_shell/shell.css"');
    expect(html).toContain('<script type="speculationrules">{"prerender"');
  });

  it('can leave prerendering off', () => {
    expect(renderToStaticMarkup(<ShellHead prerender={false} />)).not.toContain(
      'speculationrules',
    );
  });
});
