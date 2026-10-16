import { describe, expect, it } from 'vitest';

import { pageSnippet } from './snippet';

const show = (parts: ReturnType<typeof pageSnippet>) =>
  parts.map((p) => (p.match ? `[${p.text}]` : p.text)).join('');

describe('pageSnippet', () => {
  it('marks every term inside the window, ignoring case', () => {
    expect(show(pageSnippet('Walk the dog\nthen WALK home', ['walk']))).toBe(
      '[Walk] the dog then [WALK] home',
    );
  });

  it('starts near the first match and marks the cut ends', () => {
    const text = `${'a'.repeat(100)} 牙醫 ${'b'.repeat(300)}`;
    const shown = show(pageSnippet(text, ['牙醫']));
    expect(shown.startsWith('…')).toBe(true);
    expect(shown.endsWith('…')).toBe(true);
    expect(shown).toContain('[牙醫]');
    expect(shown.indexOf('[牙醫]')).toBeLessThan(50);
  });

  it('shows the start of the text when nothing matches', () => {
    expect(show(pageSnippet('Index\n- Reading list', ['meaning']))).toBe(
      'Index - Reading list',
    );
  });

  it('prefers the earliest of several terms', () => {
    expect(
      show(pageSnippet('tea then coffee then tea', ['coffee', 'tea'])),
    ).toBe('[tea] then [coffee] then [tea]');
  });
});
