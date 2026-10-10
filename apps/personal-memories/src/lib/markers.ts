export type MarkerKind = 'wfh' | 'leave';
export type MarkerPart = 'full' | 'am' | 'pm';

export type DayMarker = {
  date: string;
  person: string;
  kind: MarkerKind;
  part: MarkerPart;
  event: string;
};

export type MarkerView = {
  person: string;
  name: string;
  owner: boolean;
  kind: MarkerKind;
  part: MarkerPart;
  event: string;
  postedOn?: string;
};

export type MarkerBar = {
  person: string;
  segments: { kind: MarkerKind; part: MarkerPart }[];
};

type Named = { id: string; name: string };

export const KIND_LABEL: Record<MarkerKind, string> = {
  wfh: 'WFH',
  leave: '請假',
};

export const PART_LABEL: Record<MarkerPart, string> = {
  full: '全天',
  am: '上午',
  pm: '下午',
};

const PART_ORDER: Record<MarkerPart, number> = { full: 0, am: 0, pm: 1 };

export const markerLabel = (m: { kind: MarkerKind; part: MarkerPart }) =>
  `${KIND_LABEL[m.kind]}・${PART_LABEL[m.part]}`;

export function markerViews(
  markers: readonly DayMarker[],
  people: readonly Named[],
  owners: ReadonlySet<string>,
  postedOn: (eventId: string) => string | undefined,
): MarkerView[] {
  const rank = new Map(people.map((p, i) => [p.id, i]));
  const rankOf = (id: string) => rank.get(id) ?? people.length;
  return markers
    .map((m) => {
      const name = people.find((p) => p.id === m.person)?.name ?? m.person;
      const posted = postedOn(m.event);
      return {
        person: m.person,
        name,
        owner: owners.has(name),
        kind: m.kind,
        part: m.part,
        event: m.event,
        ...(posted ? { postedOn: posted } : {}),
      };
    })
    .sort(
      (a, b) =>
        Number(b.owner) - Number(a.owner) ||
        rankOf(a.person) - rankOf(b.person) ||
        PART_ORDER[a.part] - PART_ORDER[b.part],
    );
}

export function markerViewsByDate(
  byDate: ReadonlyMap<string, readonly DayMarker[]>,
  people: readonly Named[],
  owners: ReadonlySet<string>,
  postedOn: (eventId: string) => string | undefined,
): Map<string, MarkerView[]> {
  return new Map(
    [...byDate].map(([date, list]) => [
      date,
      markerViews(list, people, owners, postedOn),
    ]),
  );
}

export function markerBars(views: readonly MarkerView[]): MarkerBar[] {
  const bars = new Map<string, MarkerBar>();
  for (const v of views) {
    const bar = bars.get(v.person) ?? { person: v.person, segments: [] };
    bar.segments.push({ kind: v.kind, part: v.part });
    bars.set(v.person, bar);
  }
  return [...bars.values()];
}

export function markerSummary(views: readonly MarkerView[]): string {
  const labels = new Map<string, string[]>();
  for (const v of views)
    labels.set(v.name, [...(labels.get(v.name) ?? []), markerLabel(v)]);
  return [...labels]
    .map(([name, list]) => `${name} ${list.join('、')}`)
    .join('，');
}

export const dominantKind = (
  views: readonly MarkerView[],
): MarkerKind | undefined =>
  views.some((v) => v.kind === 'leave')
    ? 'leave'
    : views.length > 0
      ? 'wfh'
      : undefined;

export function dayDetail(
  total: number,
  noted: boolean,
  views: readonly MarkerView[] = [],
): string {
  return [`${total} 則`, noted && '已寫回憶', markerSummary(views)]
    .filter(Boolean)
    .join(' · ');
}
