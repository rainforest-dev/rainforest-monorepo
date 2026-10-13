import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');

describe('Vue components', () => {
  it('never import @rainforest-dev/search/node, which lint cannot see in .vue files', () => {
    const files = fg.sync('**/*.vue', { cwd: SRC });
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) =>
      /['"]@rainforest-dev\/search\/node['"]/.test(
        readFileSync(resolve(SRC, file), 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
