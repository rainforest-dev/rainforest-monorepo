import { speculationRules, speculationRulesJson } from './speculation';

type Rule = ReturnType<typeof speculationRules>['prerender'][number];

/** A tiny evaluator for the subset of the rule grammar the shell emits. */
function matches(rule: Rule, href: string, attrs: string[] = []): boolean {
  const toRegExp = (pattern: string) =>
    new RegExp(
      `^${pattern
        .replace(/\\\?/g, '§Q§')
        .replace(/[.+^${}()|[\]]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/§Q§/g, '\\?')}$`,
    );
  type Cond = Record<string, unknown>;
  const test = (cond: Cond): boolean => {
    if ('and' in cond) return (cond['and'] as Cond[]).every(test);
    if ('or' in cond) return (cond['or'] as Cond[]).some(test);
    if ('not' in cond) return !test(cond['not'] as Cond);
    if ('href_matches' in cond)
      return toRegExp(cond['href_matches'] as string).test(href);
    if ('selector_matches' in cond)
      return attrs.some((a) =>
        (cond['selector_matches'] as string).includes(a),
      );
    throw new Error(`unexpected condition ${JSON.stringify(cond)}`);
  };
  return test(rule.where as Cond);
}

describe('speculationRules', () => {
  const [rule] = speculationRules().prerender;

  it('prerenders on hover, not eagerly', () => {
    expect(rule.eagerness).toBe('moderate');
  });

  it.each([
    '/',
    '/?tag=frontend',
    '/books',
    '/books?book=4',
    '/books/42',
    '/notebooks/3',
    '/rack',
    '/kb/pages/tech-react',
  ])('prerenders the read page %s', (href) => {
    expect(matches(rule, href)).toBe(true);
  });

  it.each([
    '/hall-next',
    '/hall-next/x',
    '/api/hall-items',
    '/books/api/deliveries',
    '/opds/catalog',
    '/books/files/4/book.epub',
    '/read/4',
  ])('never prerenders %s', (href) => {
    expect(matches(rule, href)).toBe(false);
  });

  it('lets a link opt out', () => {
    expect(matches(rule, '/books', ['[data-no-prerender]'])).toBe(false);
    expect(matches(rule, '/books', ['[rel~=nofollow]'])).toBe(false);
  });

  it('serialises without a closing tag', () => {
    expect(speculationRulesJson()).not.toContain('<');
    expect(JSON.parse(speculationRulesJson())).toEqual(speculationRules());
  });
});
