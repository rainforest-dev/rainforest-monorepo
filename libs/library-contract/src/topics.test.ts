import { mapTopic, mapTopicGroups, parseTopicMap, topicKey } from './topics';

const MAP = `---
type: system-doc
---

# Topic Map

| 主題 | 標籤 |
| --- | --- |
| 前端 | \`domain/frontend\` \`tech/react\` |
| [[Design\\|設計]] | \`藝術設計\` \`COMPUTERS / Web / Design\` |
| 海 | \`sea\` \`tech/react\` |
| A note with no tags | here |
`;

describe('parseTopicMap', () => {
  const map = parseTopicMap(MAP);

  it('maps each listed tag, and the topic itself, to the topic', () => {
    expect(map.get('domain/frontend')).toBe('前端');
    expect(map.get('前端')).toBe('前端');
    expect(map.get(topicKey('COMPUTERS / Web / Design'))).toBe('設計');
  });

  it('skips rows without a code span, the header among them', () => {
    expect(map.has('主題')).toBe(false);
    expect(map.has(topicKey('A note with no tags'))).toBe(false);
  });

  it('gives a tag listed twice to the first topic', () => {
    expect(map.get('tech/react')).toBe('前端');
  });

  it('is empty for a file with no table', () => {
    expect(parseTopicMap('# Nothing yet').size).toBe(0);
  });
});

describe('mapTopic', () => {
  const map = parseTopicMap(MAP);

  it('ignores case, width and spacing', () => {
    expect(mapTopic(' computers /  web / design ', map)).toBe('設計');
    expect(mapTopic('ＳＥＡ', map)).toBe('海');
  });

  it('keeps a tag the map does not list', () => {
    expect(mapTopic('winter', map)).toBe('winter');
  });
});

describe('mapTopicGroups', () => {
  const map = parseTopicMap(MAP);

  it('renames topics under both prefixes and leaves other groups alone', () => {
    expect(
      mapTopicGroups(
        ['topic:藝術設計', 'tag:sea', 'creator:sea', 'month:2026-08'],
        map,
      ),
    ).toEqual(['topic:設計', 'tag:海', 'creator:sea', 'month:2026-08']);
  });

  it('keeps one group where two tags land on the same topic, in the first place', () => {
    expect(
      mapTopicGroups(
        ['topic:winter', 'topic:tech/react', 'topic:domain/frontend'],
        map,
      ),
    ).toEqual(['topic:winter', 'topic:前端']);
  });

  it('returns the groups as they are with an empty map', () => {
    const groups = ['topic:sea', 'topic:sea'];
    expect(mapTopicGroups(groups, new Map())).toEqual(groups);
  });
});
