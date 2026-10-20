import type { LibraryT } from '@rainforest-dev/library-shell';

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

export function actionLabel(action: RegistryAction, t: LibraryT): string {
  return t(`action.label.${action}`);
}

/** The actions each kind explains the scope of when none of a selection qualifies. */
const SCOPED: Record<RegistryKind, readonly RegistryAction[]> = {
  sources: ['activate', 'retire'],
  topics: ['activate', 'decline'],
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
  t: LibraryT,
  kind: RegistryKind = 'sources',
): string {
  const none = t(`action.none.${kind}.${action}`);
  return SCOPED[kind].includes(action)
    ? t('action.noteJoin', {
        none,
        scope: t(`action.scope.${kind}.${action}`),
      })
    : none;
}

function itemsLabel(
  names: readonly string[],
  kind: RegistryKind,
  t: LibraryT,
): string {
  return names.length === 1
    ? (names[0] ?? '')
    : t(`action.count.${kind}`, { n: names.length });
}

export function writeSummary(
  action: RegistryAction,
  names: readonly string[],
  t: LibraryT,
  kind: RegistryKind = 'sources',
): string {
  return t(`action.done.${action}`, { items: itemsLabel(names, kind, t) });
}

export function writeFailure(
  action: RegistryAction,
  names: readonly string[],
  t: LibraryT,
  kind: RegistryKind = 'sources',
): string {
  return t(`action.failed.${action}`, { items: itemsLabel(names, kind, t) });
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
