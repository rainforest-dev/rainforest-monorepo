import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(__dirname, '..', 'dist');
const read = (p: string) => readFileSync(join(dist, p), 'utf8');

describe('dist/styles.css', () => {
  const css = read('styles.css');

  it('carries the seed tokens and both scheme scopes', () => {
    expect(css).toContain('--seed:');
    expect(css).toContain('--shadcn-seed-override');
    expect(css).toMatch(/\[data-scheme=['"]?dark['"]?\]/);
    expect(css).toMatch(/\[data-scheme=['"]?light['"]?\]/);
    expect(css).toContain('prefers-color-scheme:dark');
  });

  it.each(['Inter Variable', 'Lora Variable', 'JetBrains Mono Variable'])(
    'ships an @font-face for %s',
    (family) => {
      expect(css).toMatch(
        new RegExp(`@font-face\\{[^}]*font-family:\\s*['"]?${family}`),
      );
    },
  );

  it('reaches nothing outside the package', () => {
    expect(css).not.toMatch(/@import/);
    expect(css).not.toMatch(/url\((?!['"]?data:)/);
  });

  it('includes the utilities the components use', () => {
    for (const cls of ['bg-primary', 'text-muted-foreground', 'rounded-4xl']) {
      expect(css).toContain(`.${cls}`);
    }
  });
});

describe('dist modules', () => {
  it('keeps "use client" on client components only', () => {
    expect(read('components/button.js')).toMatch(/^["']use client["'];/);
    expect(read('components/button-variants.js')).not.toMatch(/use client/);
    expect(read('components/badge-variants.js')).not.toMatch(/use client/);
    expect(read('index.js')).not.toMatch(/use client/);
  });

  it('ships the Tailwind partial for apps that compile their own CSS', () => {
    const partial = read('tailwind.css');
    expect(partial).toContain("@source './components'");
    expect(partial).toContain('@custom-variant data-open');
  });
});
