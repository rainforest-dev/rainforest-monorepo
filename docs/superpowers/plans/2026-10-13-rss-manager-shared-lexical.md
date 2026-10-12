# rss-manager shared lexical (shared search, Task 6)

Parent plan: `docs/superpowers/plans/2026-10-12-shared-search-library.md`, Task 6. Its Global
Constraints apply.

**Goal:** `matchesSearch` (sources) and `matchesTopicSearch` (topics) split the query with
`whitespaceTerms` and require every term to appear in some field via `matchesAllTerms`, both
from `@rainforest-dev/search`.

## Steps

- [ ] **1. Pin today's single-word behaviour.** In `apps/rss-manager/src/lib/desk/filters.test.ts`
      and `topics.test.ts`, add an `it.each` table of single-word queries with literal expected
      booleans: plain words, mixed case, URL fragments, tag paths, and punctuation edges
      (`c++`, `.net`, `&`, `/`, `-`). Run `pnpm nx test @rainforest-monorepo/rss-manager` against
      the unchanged functions; it must pass. Commit (`test(rss-manager): …`).
- [ ] **2. Depend on the library.** Add `"@rainforest-dev/search": "workspace:*"` to
      `apps/rss-manager/package.json`, `pnpm install`, `pnpm nx sync`.
- [ ] **3. Swap the matchers.** Both functions become
      `matchesAllTerms(fields, whitespaceTerms(q))`; an empty term list matches everything, which
      keeps the blank-query behaviour. Step 1's table stays green unchanged. Add the multi-word and
      full-width cases: `rust blog` matches "Rust Blog" and "Blog about Rust"; `ｒｕｓｔ` matches
      "Rust Blog"; a topic query whose words sit in different fields matches. Commit
      (`feat(rss-manager): …`).
- [ ] **4. e2e.** In `apps/rss-manager-e2e/src/filters.spec.ts` add a desk search whose words sit
      in different fields and in either order (`orchard infra` → Packet Orchard only, not Ink
      Orchard). Run `pnpm nx e2e rss-manager-e2e`.
- [ ] **5. Gates.** `pnpm format:check`;
      `pnpm nx run-many -t lint test typecheck build -p @rainforest-monorepo/rss-manager`;
      `pnpm nx smoke-artifact @rainforest-monorepo/rss-manager`.

## Acceptance → check

1. Single-word table identical before and after → step 1 test, green at both commits.
2. `rust blog` either order, full-width `ｒｕｓｔ` → step 3 Vitest cases.
3. Multi-word desk search → step 4 Playwright test.
4. run-many and smoke-artifact → step 5.
