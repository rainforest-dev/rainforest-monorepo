import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as lib from './index';

const root = join(__dirname, '..');
const componentsDir = join(__dirname, 'components');
const sourceFiles = readdirSync(componentsDir).map((f) =>
  join(componentsDir, f),
);
const storyFiles = readdirSync(join(root, 'stories'));

const componentNames = [
  'Alert',
  'Badge',
  'Button',
  'Card',
  'Checkbox',
  'Command',
  'Dialog',
  'DropdownMenu',
  'Input',
  'InputGroup',
  'Kbd',
  'Popover',
  'ScrollArea',
  'Select',
  'Separator',
  'Sheet',
  'Skeleton',
  'Switch',
  'Table',
  'Tabs',
  'Textarea',
  'Toaster',
  'ToggleGroup',
  'Tooltip',
];

describe('public surface', () => {
  it.each(componentNames)('exports %s from the single entry', (name) => {
    expect(lib).toHaveProperty(name);
  });

  it.each(componentNames)('%s has a story file', (name) => {
    expect(storyFiles).toContain(`${name}.stories.tsx`);
  });

  it('exports the variant recipes for server-side callers', () => {
    expect(typeof lib.buttonVariants).toBe('function');
    expect(typeof lib.badgeVariants).toBe('function');
    expect(typeof lib.toggleVariants).toBe('function');
    expect(typeof lib.sheetContentVariants).toBe('function');
    expect(typeof lib.cn).toBe('function');
  });
});

describe('source rules', () => {
  it.each(sourceFiles)('%s imports no framework-specific module', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(
      /from ['"](next(\/[^'"]*)?|next-themes|astro(\/[^'"]*)?|vue|@astrojs\/[^'"]*)['"]/,
    );
  });

  it.each(sourceFiles)('%s styles with semantic tokens only', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/\bdark:/);
    expect(src).not.toMatch(
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/,
    );
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
