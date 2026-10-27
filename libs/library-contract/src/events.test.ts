import {
  cityOfAddress,
  daysBetween,
  eventShelf,
  type EventSubscriptions,
  eventSubscriptionsFromCookieHeader,
  type LibraryEvent,
  libraryEventSchema,
  matchesSubscriptions,
  matchEventTopics,
  parseEventSubscriptions,
  serializeEventSubscriptions,
  shelveEvents,
  taipeiDay,
} from './events';

const event = (over: Partial<LibraryEvent> = {}): LibraryEvent => ({
  id: 'moc:1',
  source: 'moc',
  kind: 'exhibition',
  title: '昆蟲特展',
  start: '2026-10-01',
  end: '2026-12-31',
  cities: ['臺北市'],
  topics: ['science'],
  ...over,
});

describe('libraryEventSchema', () => {
  it('accepts a well-formed event', () => {
    expect(libraryEventSchema.parse(event())).toEqual(event());
  });

  it('rejects a link that is not http(s)', () => {
    expect(
      libraryEventSchema.safeParse(event({ url: 'javascript:alert(1)' }))
        .success,
    ).toBe(false);
  });

  it('rejects a day that is not YYYY-MM-DD', () => {
    expect(
      libraryEventSchema.safeParse(event({ start: '2026/10/01' })).success,
    ).toBe(false);
  });
});

describe('matchEventTopics', () => {
  it('finds every topic the text mentions', () => {
    expect(matchEventTopics('無肉市集與環境手作工作坊')).toEqual([
      'handmade',
      'environment',
      'vegetarian',
    ]);
  });

  it('finds nothing in unrelated text', () => {
    expect(matchEventTopics('音樂會')).toEqual([]);
  });
});

describe('cityOfAddress', () => {
  it.each([
    ['臺中市40453 臺中市北區館前路一號', '臺中市'],
    ['台北市中正區', '臺北市'],
    ['40453 臺中市北區', '臺中市'],
    ['中山區南京東路', null],
  ])('reads %s as %s', (address, city) => {
    expect(cityOfAddress(address)).toBe(city);
  });
});

describe('subscriptions', () => {
  const subs: EventSubscriptions = {
    cities: ['臺南市'],
    topics: ['handmade'],
    sources: [],
  };

  it('round-trips through the cookie', () => {
    const header = `a=1; library-events=${serializeEventSubscriptions(subs)}`;
    expect(
      parseEventSubscriptions(eventSubscriptionsFromCookieHeader(header)),
    ).toEqual(subs);
  });

  it('falls back to everything on a broken cookie', () => {
    expect(parseEventSubscriptions('%7Bnot json')).toEqual({
      cities: [],
      topics: [],
      sources: [],
    });
  });

  it('keeps the valid fields of a partly broken cookie', () => {
    expect(
      parseEventSubscriptions(
        JSON.stringify({ cities: ['臺南市'], sources: 3 }),
      ),
    ).toEqual({ cities: ['臺南市'], topics: [], sources: [] });
  });

  it('matches on any picked city and any picked topic', () => {
    expect(
      matchesSubscriptions(
        event({ cities: ['臺南市'], topics: ['handmade'] }),
        subs,
      ),
    ).toBe(true);
    expect(matchesSubscriptions(event({ cities: ['臺南市'] }), subs)).toBe(
      false,
    );
    expect(matchesSubscriptions(event({ topics: ['handmade'] }), subs)).toBe(
      false,
    );
  });

  it('matches everything when nothing is picked', () => {
    expect(
      matchesSubscriptions(event(), { cities: [], topics: [], sources: [] }),
    ).toBe(true);
  });
});

describe('shelves', () => {
  const today = '2026-10-27';

  it('counts days between two days', () => {
    expect(daysBetween('2026-10-27', '2026-11-03')).toBe(7);
  });

  it.each([
    [{ start: '2026-10-01', end: '2026-12-31' }, 'now'],
    [{ start: '2026-10-01', end: '2026-11-02' }, 'ending'],
    [{ start: '2026-10-01', end: '2026-11-03' }, 'now'],
    [{ start: '2026-10-01', end: '2026-10-26' }, null],
    [{ start: '2026-11-10', end: '2026-12-31' }, 'soon'],
    [{ start: '2027-02-01', end: '2027-03-01' }, null],
  ] as const)('shelves %o on %s', (dates, shelf) => {
    expect(eventShelf({ kind: 'exhibition', ...dates }, today)).toBe(shelf);
  });

  it('puts markets in the next two weeks on the market shelf', () => {
    expect(
      eventShelf(
        { kind: 'market', start: '2026-11-07', end: '2026-11-08' },
        today,
      ),
    ).toBe('market');
    expect(
      eventShelf(
        { kind: 'market', start: '2026-12-07', end: '2026-12-08' },
        today,
      ),
    ).toBeNull();
  });

  it('orders each shelf by what ends or opens first', () => {
    const shelves = shelveEvents(
      [
        event({ id: 'a', end: '2026-12-31' }),
        event({ id: 'b', end: '2026-11-30' }),
        event({ id: 'c', start: '2026-12-01', end: '2026-12-31' }),
        event({ id: 'd', start: '2026-11-15', end: '2026-12-31' }),
      ],
      today,
    );
    expect(shelves.now.map((e) => e.id)).toEqual(['b', 'a']);
    expect(shelves.soon.map((e) => e.id)).toEqual(['d', 'c']);
  });

  it('reads today in Taipei', () => {
    expect(taipeiDay(new Date('2026-10-27T17:00:00Z'))).toBe('2026-10-28');
  });
});
