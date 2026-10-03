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

export type TopicAction = 'activate' | 'decline';
export type RegistryAction = SourceAction | TopicAction;
export type RegistryKind = 'sources' | 'topics';

export const SOURCE_RULES: Record<
  SourceAction,
  (source: SourceState) => boolean
> = {
  activate: canActivate,
  retire: canRetire,
};

export const TOPIC_RULES: Record<TopicAction, (topic: TopicState) => boolean> =
  {
    activate: canActivateTopic,
    decline: canDeclineTopic,
  };

export const ACTION_LABEL: Record<RegistryAction, string> = {
  activate: 'Activate',
  retire: 'Retire',
  decline: 'Decline',
};

export const SOURCE_ACTION_LABEL: Record<SourceAction, string> = ACTION_LABEL;

const PAST: Record<RegistryAction, string> = {
  activate: 'Activated',
  retire: 'Retired',
  decline: 'Declined',
};

const SCOPE: Record<RegistryKind, Partial<Record<RegistryAction, string>>> = {
  sources: {
    activate: 'Activate applies to proposed and retired sources.',
    retire:
      'Retire applies to proposed, active and no-RSS sources without a delivery gap.',
  },
  topics: {
    activate: 'Activate applies to proposed and declined topics.',
    decline: 'Decline applies to proposed topics.',
  },
};

function selectedWhere<T extends { name: string }>(
  items: readonly T[],
  selection: ReadonlySet<string>,
  applies: (item: T) => boolean,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of items) {
    if (!selection.has(item.name) || seen.has(item.name)) continue;
    seen.add(item.name);
    if (applies(item)) names.push(item.name);
  }
  return names;
}

export function applicableNames(
  sources: readonly Source[],
  selection: ReadonlySet<string>,
  action: SourceAction,
): string[] {
  return selectedWhere(sources, selection, SOURCE_RULES[action]);
}

export function applicableTopicNames(
  topics: readonly Topic[],
  selection: ReadonlySet<string>,
  action: TopicAction,
): string[] {
  return selectedWhere(topics, selection, TOPIC_RULES[action]);
}

export function notApplicableNote(
  action: RegistryAction,
  kind: RegistryKind = 'sources',
): string {
  const scope = SCOPE[kind][action];
  const none = `None of the selected ${kind} can be ${PAST[action].toLowerCase()}.`;
  return scope ? `${none} ${scope}` : none;
}

function itemsLabel(names: readonly string[], kind: RegistryKind): string {
  return names.length === 1 ? (names[0] ?? '') : `${names.length} ${kind}`;
}

export function writeSummary(
  action: RegistryAction,
  names: readonly string[],
  kind: RegistryKind = 'sources',
): string {
  return `${PAST[action]} ${itemsLabel(names, kind)}`;
}

export function writeFailure(
  action: RegistryAction,
  names: readonly string[],
  kind: RegistryKind = 'sources',
): string {
  return `Couldn't ${action} ${itemsLabel(names, kind)}`;
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
