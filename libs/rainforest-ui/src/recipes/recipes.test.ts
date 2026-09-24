import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  alertVariants,
  badgeVariants,
  buttonVariants,
  cn,
  inputGroupAddonVariants,
  inputGroupButtonVariants,
  sheetContentVariants,
  tabsListVariants,
  toggleVariants,
} from './index.js';

const files = readdirSync(__dirname)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => join(__dirname, f));

describe('recipes', () => {
  it('resolve variant classes', () => {
    expect(buttonVariants({ variant: 'warning' })).toContain('bg-warning');
    expect(buttonVariants()).toContain('hover:bg-primary/90');
    expect(badgeVariants({ variant: 'success' })).toContain('bg-success/15');
    expect(alertVariants({ variant: 'info' })).toContain('text-info');
    expect(tabsListVariants({ variant: 'line' })).toContain('bg-transparent');
    expect(inputGroupAddonVariants({ align: 'inline-end' })).toContain(
      'order-last',
    );
    expect(inputGroupButtonVariants({ size: 'xs' })).toContain('h-6');
    expect(toggleVariants({ variant: 'outline' })).toContain('border-input');
    expect(sheetContentVariants({ side: 'bottom' })).toContain('rounded-t-xl');
  });

  it('merge conflicting Tailwind classes with the last one winning', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('treat the type-scale sizes as font sizes, not text colours', () => {
    expect(cn('text-meta', 'text-muted-foreground')).toBe(
      'text-meta text-muted-foreground',
    );
    expect(cn('text-sm', 'text-meta')).toBe('text-meta');
  });

  it.each(files)('%s stays framework-free', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /from ['"](react|react-dom|vue|next|astro|@base-ui\/[^'"]*)['"]/,
    );
  });

  it.each(files)('%s styles with semantic tokens only', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/\bdark:/);
    expect(src).not.toMatch(
      /\b(?:bg|text|border|ring)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|green|emerald|teal|sky|blue|indigo|violet|purple|pink|rose)-\d{2,3})\b/,
    );
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
