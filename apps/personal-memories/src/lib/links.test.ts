import { describe, expect, it } from 'vitest';

import { asLinkPreview, firstLink, linkSegments, previewUrl } from './links.ts';

const link = (href: string, text = href) => ({ kind: 'link', href, text });
const text = (value: string) => ({ kind: 'text', text: value });

describe('linkSegments', () => {
  it('returns plain text untouched', () => {
    expect(linkSegments('今天好熱')).toEqual([text('今天好熱')]);
    expect(linkSegments('')).toEqual([]);
  });

  it('splits a bare URL out of surrounding text', () => {
    expect(linkSegments('see https://example.com/a?b=1#c now')).toEqual([
      text('see '),
      link('https://example.com/a?b=1#c'),
      text(' now'),
    ]);
  });

  it('ends a URL where Chinese text starts', () => {
    expect(linkSegments('看這個https://example.com/x很好笑')).toEqual([
      text('看這個'),
      link('https://example.com/x'),
      text('很好笑'),
    ]);
  });

  it('leaves full-width punctuation out of the URL', () => {
    expect(
      linkSegments('網址（https://example.com/a）。還有「http://b.tw」，'),
    ).toEqual([
      text('網址（'),
      link('https://example.com/a'),
      text('）。還有「'),
      link('http://b.tw'),
      text('」，'),
    ]);
  });

  it('trims trailing ASCII punctuation', () => {
    expect(linkSegments('go to https://example.com/path.')).toEqual([
      text('go to '),
      link('https://example.com/path'),
      text('.'),
    ]);
    expect(linkSegments('really? https://example.com/!?')).toEqual([
      text('really? '),
      link('https://example.com/'),
      text('!?'),
    ]);
  });

  it('keeps balanced parentheses but drops an unmatched closing one', () => {
    expect(
      linkSegments('(https://en.wikipedia.org/wiki/Foo_(bar))')[1],
    ).toEqual(link('https://en.wikipedia.org/wiki/Foo_(bar)'));
    expect(linkSegments('(see https://example.com/a)')).toEqual([
      text('(see '),
      link('https://example.com/a'),
      text(')'),
    ]);
  });

  it('renders Slack links with their label', () => {
    expect(
      linkSegments('read <https://example.com/a?x=1&amp;y=2|這篇文章> ok'),
    ).toEqual([
      text('read '),
      link('https://example.com/a?x=1&y=2', '這篇文章'),
      text(' ok'),
    ]);
  });

  it('renders unlabelled Slack links as the URL', () => {
    expect(linkSegments('<https://example.com/>')).toEqual([
      link('https://example.com/'),
    ]);
    expect(linkSegments('<https://example.com/| >')).toEqual([
      link('https://example.com/'),
    ]);
  });

  it('leaves non-http Slack references as text', () => {
    expect(linkSegments('<mailto:a@b.c|mail> <#C123|general>')).toEqual([
      text('<mailto:a@b.c|mail> <#C123|general>'),
    ]);
  });

  it('does not linkify other schemes or a bare scheme', () => {
    expect(linkSegments('javascript:alert(1) http:// ftp://x.y')).toEqual([
      text('javascript:alert(1) http:// ftp://x.y'),
    ]);
  });

  it('handles several links in one message', () => {
    expect(
      linkSegments('a https://a.com b <https://b.com|B>\nhttps://c.com'),
    ).toEqual([
      text('a '),
      link('https://a.com'),
      text(' b '),
      link('https://b.com', 'B'),
      text('\n'),
      link('https://c.com'),
    ]);
  });
});

describe('firstLink', () => {
  it('returns the first link href or undefined', () => {
    expect(firstLink('x <https://b.com|B> https://a.com')).toBe(
      'https://b.com',
    );
    expect(firstLink('no links')).toBeUndefined();
  });
});

describe('previewUrl', () => {
  it('encodes the target as a query parameter', () => {
    expect(previewUrl('https://a.com/?x=1&y=2')).toBe(
      '/link-preview.json?url=https%3A%2F%2Fa.com%2F%3Fx%3D1%26y%3D2',
    );
  });
});

describe('asLinkPreview', () => {
  it('accepts a preview with a title', () => {
    expect(
      asLinkPreview({
        url: 'https://a.com/',
        title: 'A',
        description: 'd',
        image: 'https://a.com/i.png',
        siteName: 'Site',
        extra: 1,
      }),
    ).toEqual({
      url: 'https://a.com/',
      title: 'A',
      description: 'd',
      image: 'https://a.com/i.png',
      siteName: 'Site',
    });
  });

  it('rejects anything without a usable url and title', () => {
    expect(asLinkPreview(null)).toBeUndefined();
    expect(asLinkPreview('x')).toBeUndefined();
    expect(asLinkPreview({ url: 'https://a.com/' })).toBeUndefined();
    expect(
      asLinkPreview({ url: 'https://a.com/', title: ' ' }),
    ).toBeUndefined();
    expect(asLinkPreview({ url: 'javascript:1', title: 'x' })).toBeUndefined();
  });

  it('drops a non-http image', () => {
    expect(
      asLinkPreview({
        url: 'https://a.com/',
        title: 'A',
        image: 'javascript:alert(1)',
      }),
    ).toEqual({ url: 'https://a.com/', title: 'A' });
  });
});
