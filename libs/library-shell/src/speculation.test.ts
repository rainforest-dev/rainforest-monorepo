import { speculationRules, speculationRulesJson } from './speculation';

type Rule = ReturnType<typeof speculationRules>['prerender'][number];

/**
 * A tiny evaluator for the subset of the rule grammar the shell emits. `selector_matches` runs
 * against a real link in the DOM, so a selector that never matches the markup fails here.
 */
function matches(rule: Rule, href: string, markup?: string): boolean {
  document.body.innerHTML = markup ?? `<a href="${href}">book</a>`;
  const link = document.querySelector('a');
  if (!link) throw new Error('the markup needs a link');
  // URL-pattern subset: `*` is a wildcard and `\?` a literal `?`; every other character,
  // a backslash included, is literal.
  const toRegExp = (pattern: string) => {
    let source = '';
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '\\' && pattern[i + 1] === '?') {
        source += '\\?';
        i++;
      } else if (c === '*') source += '.*';
      else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${source}$`);
  };
  type Cond = Record<string, unknown>;
  const test = (cond: Cond): boolean => {
    if ('and' in cond) return (cond['and'] as Cond[]).every(test);
    if ('or' in cond) return (cond['or'] as Cond[]).some(test);
    if ('not' in cond) return !test(cond['not'] as Cond);
    if ('href_matches' in cond)
      return toRegExp(cond['href_matches'] as string).test(href);
    if ('selector_matches' in cond)
      return link.matches(cond['selector_matches'] as string);
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
    '/books/opds',
    '/books/opds/books',
    '/books/files/4/book.epub',
    '/books/read/4',
  ])('never prerenders %s', (href) => {
    expect(matches(rule, href)).toBe(false);
  });

  it.each([
    '<a href="/books" data-no-prerender>book</a>',
    '<nav data-no-prerender><span><a href="/books">book</a></span></nav>',
    '<a href="/books" rel="noopener nofollow">book</a>',
  ])('lets a link opt out: %s', (markup) => {
    expect(matches(rule, '/books', markup)).toBe(false);
  });

  it('keeps a plain link with other attributes', () => {
    expect(
      matches(
        rule,
        '/books',
        '<a href="/books" rel="noopener" data-x>book</a>',
      ),
    ).toBe(true);
  });

  it('serialises without a closing tag', () => {
    expect(speculationRulesJson()).not.toContain('<');
    expect(JSON.parse(speculationRulesJson())).toEqual(speculationRules());
  });
});
