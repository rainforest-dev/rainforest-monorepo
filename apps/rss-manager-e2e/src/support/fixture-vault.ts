import { FEED_ORIGIN } from './feed-server';

export type SourceStatus = 'active' | 'proposed' | 'no-rss' | 'retired';
export type TopicStatus = 'active' | 'proposed' | 'declined';

type SourceSection =
  | 'Active Sources'
  | 'Needs Verification'
  | 'Proposed Sources'
  | 'No RSS Found'
  | 'Retired';

export interface FixtureSource {
  name: string;
  section: SourceSection;
  category: string;
  checked: boolean;
  status: SourceStatus;
  tags: string[];
  url: string;
  staleComment?: string;
  proposedDate?: string;
  urlLine: string;
  extraLines: string[];
}

export interface FixtureTopic {
  name: string;
  status: TopicStatus;
  tags: string[];
  description: string;
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const feedUrl = (name: string, file = 'rss.xml'): string =>
  `${FEED_ORIGIN}/${slug(name)}/${file}`;

interface ActiveSeed {
  name: string;
  tags: string[];
  stale?: string;
  unchecked?: boolean;
  file?: string;
}

const ACTIVE: Record<string, ActiveSeed[]> = {
  'Frontend & Web': [
    { name: 'Lantern Notes', tags: ['domain/frontend', 'tech/css'] },
    { name: 'Pixel Harbor', tags: ['domain/frontend'] },
    { name: 'Grid & Gutter', tags: ['domain/frontend', 'tech/css'] },
    {
      name: 'Signal Garden',
      tags: ['domain/frontend', 'tech/react'],
      stale: 'feed-dead | 404 since 2026-08-02',
    },
    { name: 'Component Weather', tags: ['tech/react'], file: 'feed/' },
    { name: 'Mosswork CSS', tags: ['tech/css'] },
    { name: 'Velvet DOM', tags: ['domain/frontend'], file: 'atom.xml' },
  ],
  'Systems & Infrastructure': [
    { name: 'Quiet Kernel', tags: ['domain/infra'] },
    {
      name: 'Ferry Ops',
      tags: ['domain/infra', 'devops'],
      stale: 'delivery-gap | feed has 12 new items, Reader shows none',
    },
    { name: 'Rack and Ruin', tags: ['devops'] },
    { name: 'Packet Orchard', tags: ['domain/infra', 'tech/network'] },
    { name: 'Slow Disk Diaries', tags: ['domain/infra'] },
    { name: 'Harbor Metrics', tags: ['devops', 'tech/observability'] },
  ],
  'AI & Research': [
    { name: 'Model Garden', tags: ['domain/ai'] },
    {
      name: 'Token Tides',
      tags: ['domain/ai'],
      stale: 'low-value | mostly reposted press releases',
    },
    { name: 'Gradient Postcards', tags: ['domain/ai', 'tech/python'] },
    { name: 'Latent Lighthouse', tags: ['domain/ai'] },
    { name: 'Small Weights', tags: ['domain/ai', 'tech/python'] },
    {
      name: 'Prompt Almanac',
      tags: ['domain/ai'],
      stale: 'no posts since the spring',
    },
  ],
  Design: [
    { name: 'Kerning Club', tags: ['domain/design'] },
    { name: 'Swatch Weekly', tags: ['domain/design'] },
    { name: 'Margin Notes Studio', tags: ['domain/design'] },
    { name: 'Folio & Frame', tags: ['domain/design'], stale: 'low-value |' },
    { name: 'Ink Orchard', tags: ['domain/design', 'tech/css'] },
    { name: 'Plain Shapes', tags: ['domain/design'] },
  ],
  'Tech News & Industry': [
    { name: 'Wire Almanac', tags: ['domain/news'] },
    {
      name: 'Dispatch Nine',
      tags: ['domain/news'],
      stale: 'delivery-gap | last delivered 2026-07-14',
    },
    { name: 'Byte Ledger', tags: ['domain/news'] },
    { name: 'Morning Compile', tags: ['domain/news', 'domain/frontend'] },
    { name: 'Tidepool Tech', tags: ['domain/news'] },
    { name: 'The Long Changelog', tags: ['domain/news', 'devops'] },
  ],
  'Writing & Craft': [
    { name: 'Paper Lanterns', tags: ['domain/writing'] },
    { name: 'Bits & Pieces Weekly', tags: ['domain/writing'] },
    { name: 'Slow Reader Club', tags: ['domain/writing'] },
    { name: 'Owl Street Essays', tags: ['domain/writing'], unchecked: true },
  ],
};

const NEEDS_VERIFICATION = [
  'Copper Kettle Dev',
  'Night Shift Logs',
  'Atlas of Small Tools',
  'Lumen & Lattice',
  'Quarry Notes',
];

const PROPOSED: Array<[string, string, string]> = [
  ['Birch Compiler', 'tech/rust', 'Developer tooling'],
  ['Fable Stack', 'tech/react', 'Web platform & CSS'],
  ['Orbit Weekly', 'domain/news', 'Developer tooling'],
  ['Cinder Blog', 'tech/css', 'Web platform & CSS'],
  ['Northwind Patterns', 'domain/design', 'Type & layout'],
  ['Hollow Tree Data', 'tech/python', 'Small language models'],
  ['Saffron UI', 'domain/frontend', 'Web platform & CSS'],
  ['Glacier Notes', 'domain/infra', 'Edge infrastructure'],
  ['Meadow Systems', 'devops', 'Edge infrastructure'],
  ['Tin Roof Radio', 'domain/ai', 'Small language models'],
  ['Marble Index', 'domain/design', 'Type & layout'],
  ['Kite & Key', 'tech/rust', 'Developer tooling'],
  ['Driftwood Dev', 'domain/frontend', 'Web platform & CSS'],
  ['Lattice Letters', 'domain/writing', 'Type & layout'],
];

const NO_RSS = [
  'Paperweight Changelog',
  'Studio Halcyon',
  'Rookery Labs',
  'Cobalt Release Notes',
  'Fernway Docs',
  'Glasshouse Journal',
];

const RETIRED: Array<[string, string?]> = [
  ['Old Lamp Review'],
  ['Faded Signals', 'feed-dead | domain expired'],
  ['Dust Jacket'],
  ['Hollow Bell'],
  ['Rust & Rain'],
  ['Echo Valley'],
  ['Paper Moon Dev', 'low-value | off-topic since the redesign'],
  ['Static Bloom'],
  ['Ember Index'],
  ['Last Train Notes'],
];

const proposedDate = (i: number): string =>
  `2026-09-${String(10 + i).padStart(2, '0')}`;

function buildSources(): FixtureSource[] {
  const sources: FixtureSource[] = [];

  for (const [category, seeds] of Object.entries(ACTIVE)) {
    for (const seed of seeds) {
      const url = feedUrl(seed.name, seed.file);
      sources.push({
        name: seed.name,
        section: 'Active Sources',
        category,
        checked: !seed.unchecked,
        status: seed.unchecked ? 'proposed' : 'active',
        tags: seed.tags,
        url,
        staleComment: seed.stale,
        urlLine: url,
        extraLines: [],
      });
    }
  }

  NEEDS_VERIFICATION.forEach((name, i) => {
    const url = feedUrl(name);
    sources.push({
      name,
      section: 'Needs Verification',
      category: '',
      checked: false,
      status: 'proposed',
      tags: ['domain/frontend'],
      url,
      proposedDate: proposedDate(i),
      urlLine: `${url} · _${proposedDate(i)}_ · feed returned HTML once`,
      extraLines: [],
    });
  });

  PROPOSED.forEach(([name, tag, topic], i) => {
    const url = feedUrl(name);
    sources.push({
      name,
      section: 'Proposed Sources',
      category: '',
      checked: false,
      status: 'proposed',
      tags: [tag],
      url,
      proposedDate: proposedDate(i),
      urlLine: `${url} · for topic: ${topic} · _${proposedDate(i)}_ · proposed by rss-discover`,
      extraLines: [`**What**: A made-up blog about ${topic.toLowerCase()}.`],
    });
  });

  NO_RSS.forEach((name, i) => {
    const url = `${FEED_ORIGIN}/${slug(name)}`;
    sources.push({
      name,
      section: 'No RSS Found',
      category: '',
      checked: false,
      status: 'no-rss',
      tags: ['domain/news'],
      url,
      proposedDate: proposedDate(i),
      urlLine:
        i === 0
          ? `${url} · _${proposedDate(i)}_`
          : `website: ${url} · _${proposedDate(i)}_`,
      extraLines: [],
    });
  });

  for (const [name, stale] of RETIRED) {
    const url = feedUrl(name);
    sources.push({
      name,
      section: 'Retired',
      category: '',
      checked: false,
      status: 'retired',
      tags: ['domain/news'],
      url,
      staleComment: stale,
      urlLine: url,
      extraLines: [],
    });
  }

  return sources;
}

export const SOURCES: readonly FixtureSource[] = buildSources();

export const TOPICS: readonly FixtureTopic[] = [
  {
    name: 'Web platform & CSS',
    status: 'active',
    tags: ['domain/frontend', 'tech/css'],
    description: 'New CSS, browser APIs and layout',
  },
  {
    name: 'Edge infrastructure',
    status: 'active',
    tags: ['domain/infra'],
    description: 'Small servers, CDNs and the network between them',
  },
  {
    name: 'Small language models',
    status: 'active',
    tags: ['domain/ai'],
    description: 'Models that run on a laptop',
  },
  {
    name: 'Type & layout',
    status: 'active',
    tags: ['domain/design'],
    description: 'Typography and page layout',
  },
  {
    name: 'Developer tooling',
    status: 'active',
    tags: ['devops', 'tech/rust'],
    description: 'Build tools, linters and editors',
  },
  {
    name: 'Home lab networking',
    status: 'proposed',
    tags: ['domain/infra', 'tech/network'],
    description: `VLANs, DNS and routers at home · _${proposedDate(1)}_ · proposed by rss-discover`,
  },
  {
    name: 'Data visualisation',
    status: 'proposed',
    tags: ['domain/design'],
    description: `Charts that explain something · _${proposedDate(2)}_ · proposed by rss-discover`,
  },
  {
    name: 'Accessibility audits',
    status: 'proposed',
    tags: ['domain/frontend'],
    description: `Testing with assistive tech · _${proposedDate(3)}_ · proposed by rss-discover`,
  },
  {
    name: 'Local-first apps',
    status: 'proposed',
    tags: ['domain/frontend'],
    description: `Sync engines and offline data · _${proposedDate(4)}_ · proposed by rss-discover`,
  },
  {
    name: 'Crypto markets',
    status: 'declined',
    tags: ['domain/news'],
    description: 'Price news',
  },
  {
    name: 'Celebrity tech',
    status: 'declined',
    tags: ['domain/news'],
    description: 'Founder gossip',
  },
  {
    name: 'Gaming hardware',
    status: 'declined',
    tags: ['domain/news'],
    description: 'GPU launch coverage',
  },
];

function sourceEntry(source: FixtureSource): string[] {
  const tags = source.tags.map((t) => `#${t}`).join(' ');
  const stale = source.staleComment
    ? ` <!-- stale: ${source.staleComment} -->`
    : '';
  return [
    `- [${source.checked ? 'x' : ' '}] **${source.name}** ${tags}${stale}`,
    `  ${source.urlLine}`,
    ...source.extraLines.map((line) => `  ${line}`),
    '',
  ];
}

export function sourceRegistryMarkdown(): string {
  const lines = [
    '---',
    'type: source-registry',
    'updated: 2026-09-30',
    '---',
    '',
    '# RSS Source Registry',
    '',
  ];
  const sections: SourceSection[] = [
    'Active Sources',
    'Needs Verification',
    'Proposed Sources',
    'No RSS Found',
    'Retired',
  ];
  for (const section of sections) {
    lines.push(`## ${section}`, '');
    let category = '';
    for (const source of SOURCES.filter((s) => s.section === section)) {
      if (source.category && source.category !== category) {
        category = source.category;
        lines.push(`### ${category}`, '');
      }
      lines.push(...sourceEntry(source));
    }
  }
  return lines.join('\n');
}

const TOPIC_SECTIONS: Record<TopicStatus, string> = {
  active: 'Active',
  proposed: 'Proposed',
  declined: 'Declined',
};

export function topicRegistryMarkdown(): string {
  const lines = [
    '---',
    'type: topic-registry',
    'updated: 2026-09-30',
    '---',
    '',
    '# RSS Topic Registry',
    '',
  ];
  for (const status of ['active', 'proposed', 'declined'] as const) {
    lines.push(`## ${TOPIC_SECTIONS[status]}`, '');
    for (const topic of TOPICS.filter((t) => t.status === status)) {
      const tags = topic.tags.map((t) => `#${t}`).join(' ');
      lines.push(
        `- [${status === 'active' ? 'x' : ' '}] **${topic.name}** ${tags}`,
        `  ${topic.description}`,
        '',
      );
    }
  }
  return lines.join('\n');
}

const QUEUE_TITLES: Array<[number, string, number, number, number, number]> = [
  [1, 'Half-Read Notes on Container Queries', 18, 4, 0.4, 6],
  [1, 'A Long Walk Through Cascade Layers', 32, 20, 0.15, 9],
  [2, 'Field Guide to Edge Caches', 12, 30, 0, 2],
  [2, 'What a Tiny Model Remembers', 25, 9, 0, 3],
  [2, 'Notes from a Router Rebuild', 7, 60, 0, 1],
  [3, 'Small Typesetting Mistakes', 6, 90, 0, 1],
  [3, 'Plain-Text Build Graphs', 14, 45, 0, 0],
  [4, 'Another Look at Grid Gaps', 9, 3, 0, 22],
  [4, 'Quarterly Gadget Roundup', 40, 12, 0, 30],
  [4, 'Designing Calm Dashboards', 11, 15, 0, 18],
];

const STALE_ITEMS: Array<
  [string, string, 'time-sensitive' | 'evergreen' | 'unknown']
> = [
  ['done-unfiled', 'Finished Essay on Margins', 'evergreen'],
  ['expired', 'Conference Schedule for Last Spring', 'time-sensitive'],
  ['off-stack', 'Intro to a Framework You Dropped', 'evergreen'],
  ['deferred-dead', 'Saved for Later, Never Opened', 'unknown'],
  ['duplicate', 'Field Guide to Edge Caches (copy)', 'evergreen'],
];

export function readingQueueJson(): string {
  const queue = QUEUE_TITLES.map(
    ([tier, title, minutes, days, progress, wiki], i) => ({
      rank: i + 1,
      tier,
      id: `e2e-${String(i + 1).padStart(4, '0')}`,
      title,
      readerUrl: `${FEED_ORIGIN}/read/e2e-${i + 1}`,
      sourceUrl: `${FEED_ORIGIN}/articles/${slug(title)}`,
      siteName: 'example.test',
      tags: ['domain/frontend'],
      why: `fixture reason ${i + 1}`,
      sort: {
        profileRank: tier,
        wikiSources: wiki,
        readingMinutes: minutes,
        savedDaysAgo: days,
        progress,
      },
      decay: i % 3 === 0 ? 'time-sensitive' : 'evergreen',
    }),
  );
  const stale = STALE_ITEMS.map(([reason, title, decay], i) => ({
    id: `e2e-stale-${i + 1}`,
    title,
    reason,
    why: `fixture stale reason ${i + 1}`,
    decay,
    savedAt: `2025-0${i + 1}-15`,
    readerUrl: `${FEED_ORIGIN}/read/e2e-stale-${i + 1}`,
  }));
  return `${JSON.stringify(
    {
      generated: '2026-09-30',
      cutoffMonths: 12,
      counts: {
        scanned: queue.length + stale.length + 3,
        queued: queue.length,
        stale: stale.length,
        backlog: 3,
      },
      queue,
      stale,
    },
    null,
    2,
  )}\n`;
}

export const QUEUE = { titles: QUEUE_TITLES, staleCount: STALE_ITEMS.length };
