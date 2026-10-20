import type { Translation } from '@rainforest-dev/library-shell';

import type { zh } from './zh';

export const en: Translation<typeof zh> = {
  meta: {
    title: 'Rainforest Library',
    description: 'Walk between the bookcases and browse every collection',
  },
  header: { name: 'Rainforest Library' },
  items_one: '{{count}} item',
  items_other: '{{count}} items',
  groupBy: {
    label: 'Sort bookcases',
    hint: 'Books fly to their new bookcase when you switch',
    tag: 'By topic',
    collection: 'By collection',
    series: 'By series',
    author: 'By author',
    month: 'By date',
  },
  bookcase: {
    none: {
      tag: 'Untagged',
      collection: 'Other',
      series: 'No series',
      author: 'No author',
      month: 'Undated',
    },
    other: 'Other',
  },
  hall: {
    region: 'Hall',
    list: 'Bookcases',
    browseList: 'Browse as a list',
    missing: '{{names}} could not load and is left off the shelves for now.',
    canvas:
      'The library hall. Walk with W A S D or the arrow keys, or click the floor or a bookcase to walk there.',
    enter3d: 'Enter the 3D hall',
    phone3dHint:
      'Phones skip 3D by default to save battery and memory. Once inside, tap the floor to walk.',
    no3d: 'This device cannot show 3D, so the CSS book wall is used instead',
  },
  empty: {
    failed: 'The hall could not get the collection list',
    missing: '{{names}} could not load, so the bookcases are still empty',
    none: 'No collection has anything to shelve yet',
    reload: 'Reload',
  },
  study: {
    region: '{{name}} bookcase',
    back: 'Back to the hall',
    pages: 'Bookcase pages',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pageOf: 'Page {{page}} of {{pageCount}} · {{size}} per page',
    renderer: 'Renderer',
    rendererShort: 'Renderer',
    wall: 'Book wall',
    continued: '{{name}} (continued)',
    shelf: '{{name}}, {{items}}',
    picked: 'Book in hand',
    inspect: 'Turn “{{title}}” over in 3D',
    details: 'View details',
    previousBook: 'Previous book',
    nextBook: 'Next book',
    no3dTitle: '3D rendering could not start',
    useCss: 'Use the CSS book wall',
  },
  inspect: {
    title: '“{{title}}” in 3D',
    help: 'Drag or use the arrow keys to turn it. Press Esc to close.',
    rotate: 'Turn “{{title}}”',
    close: 'Close the 3D view',
    front: 'Front cover',
    spine: 'Spine',
    back: 'Back cover',
    edge: 'Fore edge',
  },
};
