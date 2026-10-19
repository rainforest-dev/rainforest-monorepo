import { COLLECTIONS } from '@rainforest-dev/library-contract';

/**
 * Paths under a collection that write, stream or download. They are never prerendered, even
 * though they sit under a read-only mount.
 */
export const NO_PRERENDER_PATHS = [
  '/api/*',
  '/*/api/*',
  '/hall-next',
  '/hall-next/*',
  '/opds',
  '/opds/*',
  '/files/*',
  '/*/files/*',
] as const;

function readPatterns(): string[] {
  return COLLECTIONS.flatMap(({ basePath }) =>
    basePath === '/'
      ? ['/', '/\\?*']
      : [basePath, `${basePath}\\?*`, `${basePath}/*`],
  );
}

/**
 * Speculation Rules that prerender the collection pages a reader is about to open. `moderate`
 * starts on a 200 ms hover or on pointerdown, and Chrome keeps at most two such prerenders,
 * dropping the oldest. A link can opt out with `data-no-prerender` or `rel="nofollow"`.
 */
export function speculationRules() {
  return {
    prerender: [
      {
        where: {
          and: [
            { or: readPatterns().map((href) => ({ href_matches: href })) },
            ...NO_PRERENDER_PATHS.map((href) => ({
              not: { href_matches: href },
            })),
            {
              not: {
                selector_matches: '[data-no-prerender], [data-no-prerender] *',
              },
            },
            { not: { selector_matches: '[rel~=nofollow]' } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };
}

/** The rules as script text, for `<script type="speculationrules">` in Astro or plain HTML. */
export function speculationRulesJson(): string {
  // `<` cannot occur in the patterns, but escaping keeps the script inert if one ever does.
  return JSON.stringify(speculationRules()).replace(/</g, '\\u003c');
}
