import { matchesAllTerms, whitespaceTerms } from '@rainforest-dev/search';

import type { Topic } from '@/lib/registry.types';

import { type DeskParams, TOPIC_STATUSES } from './params';
import { compareTopics } from './sort';

export type TopicFilters = Pick<DeskParams, 'tq' | 'tstatus'>;

export type TopicStatusCounts = Record<Topic['status'] | 'all', number>;

export function matchesTopicSearch(topic: Topic, q: string): boolean {
  return matchesAllTerms(
    [topic.name, topic.description, ...topic.tags],
    whitespaceTerms(q),
  );
}

export function filterTopics(
  topics: readonly Topic[],
  { tq, tstatus }: TopicFilters,
): Topic[] {
  return topics
    .filter(
      (t) =>
        matchesTopicSearch(t, tq) && (tstatus === null || t.status === tstatus),
    )
    .sort(compareTopics);
}

export function topicStatusCounts(
  topics: readonly Topic[],
  tq: string,
): TopicStatusCounts {
  const matched = topics.filter((t) => matchesTopicSearch(t, tq));
  const counts: TopicStatusCounts = {
    all: matched.length,
    proposed: 0,
    active: 0,
    declined: 0,
  };
  for (const status of TOPIC_STATUSES)
    counts[status] = matched.filter((t) => t.status === status).length;
  return counts;
}
