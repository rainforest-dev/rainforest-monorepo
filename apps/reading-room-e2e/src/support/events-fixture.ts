/**
 * Fictional exhibitions and markets for the magazine rack, dated around today so every shelf
 * has something whatever day the suite runs. Served by the feed server in the shapes of the
 * Ministry of Culture and Taipei Travel APIs.
 */
const DAY_MS = 86_400_000;
/** The feed server's origin; `feed-server.ts` imports this file, so it is spelled out here. */
const ORIGIN = 'http://127.0.0.1:3033';
/** A poster the ministry gives, and the event page whose og:image the room reads. */
export const EVENT_POSTER = `${ORIGIN}/events/poster.svg`;
export const EVENT_PAGE = `${ORIGIN}/events/page.html`;
export const EVENT_PAGE_IMAGE = `${ORIGIN}/events/page-cover.png`;

/** A day `offset` days from today in Taipei, in the ministry's `YYYY/MM/DD`. */
function day(offset: number, sep = '/'): string {
  return new Date(Date.now() + 8 * 3_600_000 + offset * DAY_MS)
    .toISOString()
    .slice(0, 10)
    .replaceAll('-', sep);
}

const moc = (
  uid: string,
  title: string,
  start: number,
  end: number,
  location: string,
  description = '',
  extra: { imageUrl?: string; sourceWebPromote?: string } = {},
) => ({
  UID: uid,
  title,
  showInfo: [
    {
      time: `${day(start)} 10:00:00`,
      location,
      locationName: 'Lantern Hall',
      price: 'Free',
      endTime: `${day(end)} 17:00:00`,
    },
  ],
  descriptionFilterHtml: description,
  sourceWebPromote: '',
  startDate: day(start),
  endDate: day(end),
  ...extra,
});

export const EVENT_TITLES = {
  ending: 'Paper Lantern Retrospective',
  now: 'Moss and Stone Garden Show',
  soon: 'Clockwork Toy Parade',
  market: 'Sunday Makers 市集',
  tainan: 'Harbour Kite Exhibition',
} as const;

export const MOC_EVENTS = [
  moc('e2e-ending', EVENT_TITLES.ending, -30, 3, '臺北市中正區'),
  moc(
    'e2e-now',
    EVENT_TITLES.now,
    -10,
    40,
    '新北市汐止區',
    '生態與環境的展覽',
    {
      imageUrl: EVENT_POSTER,
    },
  ),
  moc('e2e-soon', EVENT_TITLES.soon, 12, 50, '臺北市信義區', '玩具與模型', {
    sourceWebPromote: EVENT_PAGE,
  }),
  moc('e2e-tainan', EVENT_TITLES.tainan, -5, 30, '臺南市安平區'),
];

export const TAIPEI_EVENTS = {
  total: 1,
  data: [
    {
      id: 7001,
      title: EVENT_TITLES.market,
      description: '手作與無肉小吃',
      begin: `${day(4, '-')} 10:00:00 +08:00`,
      end: `${day(5, '-')} 18:00:00 +08:00`,
      address: '臺北市大同區',
      url: `${ORIGIN}/events/sunday-makers`,
    },
  ],
};
