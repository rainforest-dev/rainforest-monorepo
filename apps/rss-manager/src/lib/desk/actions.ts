import type { Source, Topic } from '@/lib/registry.types';

type SourceState = Pick<Source, 'status' | 'stale'>;
type TopicState = Pick<Topic, 'status'>;

export type SourceAction = 'activate' | 'retire';

export function canActivate(source: SourceState): boolean {
  return source.status === 'proposed' || source.status === 'retired';
}

export function canRetire(source: SourceState): boolean {
  return source.status !== 'retired' && source.stale?.type !== 'delivery-gap';
}

export function canResubscribe(source: SourceState): boolean {
  return source.status === 'active' && source.stale?.type === 'delivery-gap';
}

export function canActivateTopic(topic: TopicState): boolean {
  return topic.status === 'proposed' || topic.status === 'declined';
}

export function canDeclineTopic(topic: TopicState): boolean {
  return topic.status === 'proposed';
}

export const SOURCE_RULES: Record<
  SourceAction,
  (source: SourceState) => boolean
> = {
  activate: canActivate,
  retire: canRetire,
};

export const SOURCE_ACTION_LABEL: Record<SourceAction, string> = {
  activate: 'Activate',
  retire: 'Retire',
};

const PAST: Record<SourceAction, string> = {
  activate: 'Activated',
  retire: 'Retired',
};

const SCOPE: Record<SourceAction, string> = {
  activate: 'Activate applies to proposed and retired sources.',
  retire:
    'Retire applies to proposed, active and no-RSS sources without a delivery gap.',
};

export function applicableNames(
  sources: readonly Source[],
  selection: ReadonlySet<string>,
  action: SourceAction,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const source of sources) {
    if (!selection.has(source.name) || seen.has(source.name)) continue;
    seen.add(source.name);
    if (SOURCE_RULES[action](source)) names.push(source.name);
  }
  return names;
}

export function notApplicableNote(action: SourceAction): string {
  return `None of the selected sources can be ${PAST[action].toLowerCase()}. ${SCOPE[action]}`;
}

function sourcesLabel(names: readonly string[]): string {
  return names.length === 1 ? (names[0] ?? '') : `${names.length} sources`;
}

export function writeSummary(
  action: SourceAction,
  names: readonly string[],
): string {
  return `${PAST[action]} ${sourcesLabel(names)}`;
}

export function writeFailure(
  action: SourceAction,
  names: readonly string[],
): string {
  return `Couldn't ${action} ${sourcesLabel(names)}`;
}

export type PageCheck = 'none' | 'some' | 'all';

export function pageCheckState(
  selection: ReadonlySet<string>,
  names: readonly string[],
): PageCheck {
  const chosen = names.filter((name) => selection.has(name)).length;
  if (chosen === 0) return 'none';
  return chosen === names.length ? 'all' : 'some';
}

export function toggleName(
  selection: ReadonlySet<string>,
  name: string,
): Set<string> {
  const next = new Set(selection);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

export function withNames(
  selection: ReadonlySet<string>,
  names: readonly string[],
): Set<string> {
  return new Set([...selection, ...names]);
}

export function withoutNames(
  selection: ReadonlySet<string>,
  names: readonly string[],
): Set<string> {
  const drop = new Set(names);
  return new Set([...selection].filter((name) => !drop.has(name)));
}
