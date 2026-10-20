import { describe, expect, it } from 'vitest';

import { movedToLibrary } from './oldHost.js';

const at = (path: string) => new URL(`https://rss.rainforest.tools${path}`);

describe('movedToLibrary', () => {
  it.each([
    ['/', 'https://library.rainforest.tools/rack'],
    [
      '/?tab=topics',
      'https://library.rainforest.tools/rack/sources?tab=topics',
    ],
    ['/rack/sources', 'https://library.rainforest.tools/rack/sources'],
    [
      '/kb/pages/tech-react?x=1',
      'https://library.rainforest.tools/kb/pages/tech-react?x=1',
    ],
  ])('sends the page %s to the library', (path, to) => {
    expect(movedToLibrary('GET', at(path))).toBe(to);
  });

  it('keeps API calls and writes on the old hostname', () => {
    expect(movedToLibrary('GET', at('/rack/api/registry'))).toBeNull();
    expect(movedToLibrary('POST', at('/rack/sources'))).toBeNull();
  });

  it('leaves every other hostname alone', () => {
    expect(
      movedToLibrary('GET', new URL('https://library.rainforest.tools/rack')),
    ).toBeNull();
    expect(movedToLibrary('GET', new URL('http://localhost:4321/'))).toBeNull();
  });
});
