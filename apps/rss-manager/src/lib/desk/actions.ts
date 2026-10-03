import type { Source, Topic } from '@/lib/registry.types';

type SourceState = Pick<Source, 'status' | 'stale'>;
type TopicState = Pick<Topic, 'status'>;

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
