# Reading Queue — Design

**Date:** 2026-08-11
**Status:** approved
**Scope:** a `reading-queue` skill in the Obsidian vault that ranks unread Readwise
documents against personal context, plus a Reading Queue tab in `apps/rss-manager`
that renders the result.

---

## Problem

`rss-manager` and the two RSS skills model **supply** — is the feed still publishing?
Nothing models **consumption**. Two measurements taken 2026-08-11 make the cost concrete.

**The feeds are blind to most of the stack.** The profile MCP (`libs/personal-data`,
served by `personal-website`) lists 13 technologies. Active RSS topics cover 2 of them.

| Technology                   | Wiki page             | Status     | Sources | Active topic? |
| ---------------------------- | --------------------- | ---------- | ------- | ------------- |
| react                        | `tech-react.md`       | mature     | 39      | yes           |
| nx                           | `tech-nx.md`          | mature     | 13      | yes           |
| **nextjs**                   | `tech-nextjs.md`      | **mature** | **13**  | **no**        |
| typescript                   | `tech-typescript.md`  | growing    | 5       | no            |
| python                       | `tech-python.md`      | growing    | 5       | no            |
| playwright                   | `tech-playwright.md`  | growing    | 4       | no            |
| tailwindcss                  | `tech-tailwindcss.md` | growing    | 3       | no            |
| vue, flutter, terraform, mui | growing               | growing    | 2 each  | no            |
| swift, github-actions        | stub                  | stub       | 1 each  | no            |

Next.js is tagged `prioritized` in the profile, has a mature 13-source wiki page, and
no topic feeds it.

**The queue has no exit condition.**

|               | Total   | Never opened  | Opened, unfinished |
| ------------- | ------- | ------------- | ------------------ |
| Inbox (`new`) | 245     | 146 (60%)     | 99                 |
| Later         | 79      | **79 (100%)** | 0                  |
| **Unread**    | **324** | **225 (69%)** | 99                 |

Every item in Later has never been opened. Moving something to Later is the act of
deciding not to read it.

---

## Non-goals

- **No writes to Readwise.** Not documents, not tags, not locations. The skill reads
  Reader and writes only to the vault.
- **No saved Filtered View in Reader.** The Readwise API has no endpoint to create one.
  The ordered view is the rss-manager tab.
- **No scheduled run.** Interactive invocation only; no entry in
  `ai-resources/scheduled-tasks/`, no `sync-scheduled-skills.py` change.
- **Not the typed stale-reason fix.** Tracked separately — see Follow-up work.

---

## Architecture

The skill does all joining; the app does all rendering. The split follows capability:
the skill has MCP access to Readwise, the profile, and the wiki; the app has none and
does not gain any.

```
reading-queue skill  (interactive, on demand)
  reads  → Readwise Reader MCP        (read-only)
           profile MCP                (13 technologies)
           notes/wiki/pages/*.md      (wiki_status + ## Sources counts)
           _system/RSS-*-Registry.md  (active topic coverage)
  writes → _system/reading-queue.json         ← the only write

rss-manager
  reads  → registryFilePath('reading-queue.json')
  renders→ "Queue" tab, sortable, each row linking to read.readwise.io
```

Three consequences make this cheap:

- **No remount.** `VAULT_PATH` already points at `_system/`. `reading-queue.json` lands
  beside the registries; `registryFilePath()` works unchanged.
- **No new credentials in the app.** No Readwise token, no profile MCP, no network at
  page render. The app stays a pure file reader.
- **No round-trip hazard.** Unlike the registries, this file is generated wholesale and
  never hand-edited, so there is no line-splicing surgery over human edits.

### Why JSON

Precedent is `_system/tag-graph.json` — also skill-generated, machine-read, regenerated
whole. Markdown would force a second fragile parser in rss-manager for a file no human
edits. Obsidian legibility carries no weight because the rss-manager tab is the view.

### Artifact shape

```json
{
  "generated": "2026-08-11",
  "cutoffMonths": 12,
  "counts": { "scanned": 324, "queued": 20, "stale": 128 },
  "queue": [
    {
      "rank": 1,
      "tier": 2,
      "id": "example-doc-id",
      "title": "Widget Framework 4.2 Release Notes",
      "readerUrl": "https://read.readwise.io/read/example-doc-id",
      "sourceUrl": "https://example.com/widget-4-2",
      "siteName": "example.com",
      "tags": ["tech/widget"],
      "why": "profile-prioritized · mature wiki page · no active topic feeding it",
      "sort": {
        "profileRank": 0,
        "wikiSources": 13,
        "readingMinutes": 9,
        "savedDaysAgo": 8,
        "progress": 0.067
      }
    }
  ],
  "stale": [
    {
      "id": "01kv…",
      "title": "…",
      "reason": "never-opened-stale",
      "savedAt": "2024-01-02",
      "readerUrl": "https://read.readwise.io/read/01kv…"
    }
  ]
}
```

`why` is a pre-rendered human sentence; `sort` carries the raw inputs. The skill knows
why it ranked something because it just did the join — reconstructing that in the UI
would drift the first time scoring changes. `readerUrl` is the document's `url` field
from the Reader API (verified: `https://read.readwise.io/read/<id>`); `sourceUrl` is
its `source_url`.

`profileRank`: `prioritized` = 0, `listed` = 1, absent = 2.

---

## Staleness rules

Different staleness reasons have opposite remedies, so they must not collapse into one
flag. Stale items and queue candidates are disjoint sets.

| Type                 | Rule                                                  | Remedy                                                          |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `done-unfiled`       | `progress ≥ 0.65`, still in new/later                 | Archive as finished — you read it, the system never recorded it |
| `never-opened-stale` | `first_opened_at` null AND `saved_at` > **12 months** | Archive — 12 months of not opening it is the decision           |
| `deferred-dead`      | `location: later` AND never opened AND > 3 months     | Archive — earned by the 79/79 measurement                       |
| `abandoned`          | `0.05 ≤ progress < 0.65`, opened > 6 months ago       | **Decide** — never sweep; starting it was an active choice      |
| `duplicate`          | Same `source_url` as another unread item              | Keep highest progress, flag the rest                            |
| `malformed`          | Empty title, or title > 200 chars                     | Fix or drop                                                     |

`duplicate` matches on `source_url`, not title: the inbox holds "Next.js 16.3" and Later
holds "Next.js 16.3: Instant Navigations". Title matching misses that pair; a prefix
match would produce false positives across a release series.

The skill **reports** stale items. It does not archive them — see Non-goals. The app
renders them read-only with links back to Reader, where the user archives by hand.

---

## Ranking

### Tag resolution

Most candidates are untagged (1 of 8 sampled inbox items had a Reader tag). Resolution
falls through a chain:

1. **Reader tags** when present — already the vault taxonomy (`tech/nextjs`, `tech/vue`, …)
2. **`site_name` → Source Registry entry → its `#hashtags`**
3. **Title/summary match** against the 13 profile technologies and 214 wiki page slugs

Step 3 needs semantic judgment — no keyword list resolves "Code is a Design Material" to
`ui-ux`. This is the only step where the agent judges.

### Hybrid execution

The agent performs tag resolution only and writes resolved tags into an intermediate
list. A deterministic script then does all scoring. Prose scoring is not reproducible:
two runs would give two orders and the user could never tell whether the queue changed
because their reading changed or because the model rolled differently. Precedent:
`rss-discover` step 8 already embeds a Python script.

### Tiers

Tiers, not a weighted sum — a weighted sum produces rankings that cannot be explained,
and the `why` sentence falls out of a tier for free.

| Tier | Meaning                  | Signal                                         |
| ---- | ------------------------ | ---------------------------------------------- |
| 1    | Finish what you started  | opened < 6mo, progress 0.30–0.65               |
| 2    | Blind spot in your stack | profile tech, no active topic feeding it       |
| 3    | Wiki leverage            | maps to a `stub` or `growing` wiki page        |
| 4    | Covered interest         | matches an active topic, page already `mature` |
| 5    | Excluded from the queue  | —                                              |

Tier 2 above tier 3 is deliberate: it is the 11-of-13 finding turned into a rule. The
tier order encodes the claim that reading is most valuable where synthesis is thinnest,
not where interest is strongest — 39 sources on `tech-react` means the 40th changes
little, while `tech-swift` at 1 source is one article from being useful.

Worked against live queue items:

| Item                        | Lands | Why                                                   |
| --------------------------- | ----- | ----------------------------------------------------- |
| Reader Beta Update #14      | T1    | 35%, opened 3 days ago — cheap finish                 |
| Next.js 16.3                | T2    | profile-`prioritized`, mature page, no topic feeds it |
| Code is a Design Material   | T3    | `ui-ux`, never opened, saved July                     |
| The Art of Loop Engineering | T4    | `domain/ai` is an active topic, page mature           |
| Claude Powered Second Brain | stale | 91% — `done-unfiled`                                  |
| Instagram Chinese caption   | stale | `malformed`, 300-char title                           |

### Sorting belongs to the app, not the skill

Tier assignment is the only part that cannot move: it requires the profile MCP and wiki
frontmatter, neither of which the app can reach. Ordering _within_ a tier is pure
numeric comparison over data already in the artifact — it needs no re-run, and baking
one choice into the JSON would mean re-running a multi-second join to change a sort.

So the skill emits a default `rank` and every sortable signal; the app re-sorts on
demand.

Default within-tier key — personal context first, length only as a tie-break:

```python
def within_tier_key(c):
    return (c["profileRank"], c["wikiSources"], c["readingMinutes"])
```

**Known limitation:** this key is blind to decay. Release notes rot — a Next.js 16.3
post is worth much less in six months — and a stable signal (profile, wiki maturity)
always beats a decaying one inside the same sort key, because it returns the same answer
in every comparison. Mitigating that properly means demoting stale time-sensitive items
at the _tier_ level, not in the tie-break. Deferred: the app's "newest first" sort
covers the need until the limitation is felt in practice.

---

## rss-manager Reading Queue tab

Follows existing structure; introduces no new patterns.

| File                              | Contents                                                          |
| --------------------------------- | ----------------------------------------------------------------- |
| `src/lib/readingQueue.ts`         | read + type-guard `reading-queue.json`, exported pure comparators |
| `src/pages/api/reading-queue.ts`  | `GET`, same shape as `api/sources.ts`                             |
| `src/components/ReadingQueue.tsx` | React island — sort controls, two panels                          |
| `src/pages/index.astro`           | add `'queue'` to `VALID_TABS`                                     |

**Sort controls:** default (tier) / shortest first / newest first / thinnest wiki page
first. Default groups by tier with section headers; any other sort flattens to one list
with tier as a badge. Client-side, no API round trip.

**Two panels:** _Queue_ (sortable, each row linking to `readerUrl`) and _Stale_
(read-only, grouped by reason, linking back to Reader).

**Missing file is an empty state, not a 500.** `readSources()` currently throws when the
file is absent and surfaces as a server error; `readReadingQueue()` must return a
distinguishable "not generated yet" state that the UI renders as a prompt to run the
skill.

**Validation** is a hand-rolled type guard with tests, consistent with `registry.ts`.
The app's runtime dependencies are astro/react/tailwind only; adding zod for one file is
not justified, and swapping later is a contained change.

---

## Testing

`vitest.config.ts` sets `environment: 'node'` and `include: ['src/**/*.test.ts']`. `.tsx`
files do not match the glob and there is no jsdom, so **components are not testable
without a config change.**

Design consequence: every comparator and the parser live in `src/lib/readingQueue.ts` as
pure exported functions. The component only fetches, renders, and calls them. No config
change is needed and the untested surface stays trivial.

| Test                                    | Rationale                               |
| --------------------------------------- | --------------------------------------- |
| Valid fixture → typed result            | baseline                                |
| Malformed input → clear error, no crash | cross-process boundary                  |
| Missing file → "not generated" state    | must not repeat the `readSources()` 500 |
| Each comparator's ordering              | sorting is what the user sees           |
| Default order equals `rank`             | skill and app must agree on "default"   |

### Privacy constraint

| Repo                  | Visibility |
| --------------------- | ---------- |
| `rainforest-monorepo` | **PUBLIC** |
| `rainforest-obsidian` | private    |

`reading-queue.json` holds real reading history — titles, URLs, progress — and stays in
the private vault, mounted at runtime. **Fixtures committed to the public monorepo must
be synthetic.** This matches the existing rule that PII lives in the vault, never in the
monorepo.

rss-manager sits behind Traefik ForwardAuth gated by the `rf_session` passkey cookie, so
`rss.rainforest.tools` does not expose the queue publicly.

### Contract testing

The synthetic fixture **is** the contract: it is version-controlled, covered by the
parser test, and cited by path in `reading-queue/SKILL.md` as the canonical output shape.
If the skill's output drifts, the app's test fails.

This exists because of an observed failure. `rss-discover/SKILL.md` step 6 states that
its `stale:` comment "is what the rss-manager UI parses into its 'flagged' filter and
Reason column (amber ⚠ suggested badge + amber Retire button)". That UI was never built —
`registry.ts` skips comment lines and never parses `stale:` at all. The skill and the app
agreed in prose and were never tested against each other. Documentation cannot fail, so
it drifts; a fixture fails, so it gets maintained.

### Manual verification

Per `CLAUDE.md`, a green `astro build` says nothing about `astro dev`. The new tab must
be loaded from a running `pnpm nx dev rss-manager` before it counts as verified.

---

## Follow-up work

Out of scope here, recorded so it is not lost:

1. **Typed stale-reason fix (the one real bug).** Four Active sources carry `stale:`
   comments — `MDN Web Docs` and `web.dev` (feed alive, Readwise delivery gap),
   `LY Corporation Tech Blog` and `Readwise Docs` (feed 404). Two faults with opposite
   remedies. `web.dev` is the highest-completion source in the archive (13 items, 9 read
   to ≥90%), and the app offers the same Retire button on it as on a dead feed. Needs a
   typed `feed-dead | delivery-gap | low-value` reason, a matching UI, and a
   `rss-discover` change to emit it. Note the source note in
   `rainforest-obsidian` PR #39 lists three flagged sources; there are four.
2. **Wire profile + wiki context into `rss-digest` and `rss-discover`.** Both currently
   ignore the profile MCP and wiki maturity. A shared personal-context reference read by
   all three skills is the likely shape.
3. **Registry write round-trip test.** `activateSource`, `retireSource`, `activateTopic`,
   `declineTopic` and `spliceEntry` write to the real vault and have no tests —
   `registry.test.ts` covers parsing only.

---

## Corrections to `rainforest-obsidian` PR #39

The executable prompt in `_system/RSS-Manager-Insight-Layer-Brainstorm.md` opens with a
Step 0 instructing the implementer to stop if its assumptions are wrong. Three are:

| PR assumption                                                  | Reality                                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Astro, Vue islands, shadcn-vue"                               | `@astrojs/react` with `.tsx` islands and hand-rolled Tailwind. No Vue, no shadcn.              |
| Stale sources render as "one amber badge with a Retire button" | No badge exists. `registry.ts` never parses `stale:`. Every active source renders identically. |
| Three flagged sources                                          | Four — `LY Corporation Tech Blog` is missing from the note.                                    |

The second matters most: it makes the bug worse than described. There is no amber warning
to misread, because there is no signal at all.
