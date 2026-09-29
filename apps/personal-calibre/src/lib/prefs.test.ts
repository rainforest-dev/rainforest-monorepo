import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFS,
  nextView,
  parsePrefs,
  PREFS_COOKIE,
  resolveRenderer,
  resolveView,
  serializePrefs,
} from './prefs';

describe('parsePrefs', () => {
  it('defaults when the cookie is missing or not JSON', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{not json')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('"shelf"')).toEqual(DEFAULT_PREFS);
  });

  it('defaults the renderer to three-tsl', () => {
    expect(DEFAULT_PREFS).toEqual({
      view: 'shelf',
      panel: true,
      renderer: 'three-tsl',
    });
  });

  it('keeps good fields and replaces bad ones', () => {
    expect(
      parsePrefs('{"view":"attic","panel":false,"renderer":"webgl9"}'),
    ).toEqual({
      view: 'shelf',
      panel: false,
      renderer: 'three-tsl',
    });
  });

  it('reads an encoded cookie value', () => {
    const raw = encodeURIComponent(
      JSON.stringify({ view: 'catalogue', panel: false, renderer: 'css' }),
    );
    expect(parsePrefs(raw)).toEqual({
      view: 'catalogue',
      panel: false,
      renderer: 'css',
    });
  });

  it('defaults on a JSON array, encoded or not', () => {
    expect(parsePrefs('[1,2,3]')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(encodeURIComponent('[1,2,3]'))).toEqual(DEFAULT_PREFS);
  });

  it('defaults on a JSON number', () => {
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS);
  });

  it('defaults on a nested garbage object', () => {
    expect(
      parsePrefs('{"view":{"nested":true},"panel":[1],"renderer":{}}'),
    ).toEqual(DEFAULT_PREFS);
  });
});

describe('resolveView', () => {
  it('lets ?view= override the cookie', () => {
    expect(resolveView('shelf', 'catalogue')).toBe('catalogue');
    expect(resolveView('catalogue', null)).toBe('catalogue');
    expect(resolveView('catalogue', 'nope')).toBe('catalogue');
  });

  it('falls back when a view is not enabled yet', () => {
    expect(resolveView('study', null)).toBe('shelf');
    expect(resolveView('catalogue', 'study')).toBe('catalogue');
    expect(resolveView('study', null, ['shelf', 'catalogue', 'study'])).toBe(
      'study',
    );
  });
});

describe('resolveRenderer', () => {
  it('lets ?renderer= override the cookie', () => {
    expect(resolveRenderer('three-tsl', 'css')).toBe('css');
    expect(resolveRenderer('css', null)).toBe('css');
    expect(resolveRenderer('three-glsl', 'bogus')).toBe('three-glsl');
  });
});

describe('nextView', () => {
  it('cycles the enabled views', () => {
    expect(nextView('shelf')).toBe('catalogue');
    expect(nextView('catalogue')).toBe('shelf');
    expect(nextView('catalogue', ['shelf', 'catalogue', 'study'])).toBe(
      'study',
    );
    expect(nextView('study', ['shelf', 'catalogue', 'study'])).toBe('shelf');
  });
});

describe('serializePrefs', () => {
  it('writes a one-year Lax cookie on /', () => {
    const cookie = serializePrefs({
      view: 'catalogue',
      panel: false,
      renderer: 'three-tsl',
    });
    expect(cookie.startsWith(`${PREFS_COOKIE}=`)).toBe(true);
    expect(cookie).toContain('; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(
      parsePrefs(cookie.split(';')[0]?.slice(PREFS_COOKIE.length + 1)),
    ).toEqual({
      view: 'catalogue',
      panel: false,
      renderer: 'three-tsl',
    });
  });
});
