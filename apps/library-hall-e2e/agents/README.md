# Agent e2e (library-hall-e2e/agents)

These are agent-driven end-to-end tests for the library. They run on
[TesterArmy's open-source `e2e` runner](https://e2e.tester.army/docs). Each test mixes
two kinds of step:

- `agent.act`: a goal in plain words, which the model carries out in a real Chromium.
- `agent.assert`: a statement the model judges against the screen, and against a screenshot
  when `vision: true` is set.

Locator checks (`screen`, `expect`) need no model and pin down the exact values. The
Playwright suites in the `*-e2e` projects stay the main regression net. These tests cover
what those suites can't see, such as a hall that shows only one collection or a camera that
won't turn.

| Suite | Config                        | Against                                                                                            |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| hall  | `e2e.config.ts`, `tests/`     | The hall's production build in front of a fictional set of collections (`support/collections.mjs`) |
| live  | `e2e.live.config.ts`, `live/` | The deployed `library.rainforest.tools`, read-only, through a Cloudflare Access service token      |

## Run it

The runner needs Node 24.8 or newer, and an Anthropic key in `ANTHROPIC_API_KEY`. Locally,
keep it in `apps/library-hall-e2e/.env.local` (gitignored); Nx loads that file for this project's
targets. These targets are separate from `e2e`, so `nx affected -t e2e` never runs them.
`E2E_MODEL` overrides the model, which defaults to `claude-sonnet-5-5`.

```bash
pnpm nx run library-hall-e2e:agent-e2e                     # builds the hall, runs tests/
pnpm nx run library-hall-e2e:agent-e2e-live                # needs LIBRARY_URL and CF_ACCESS_CLIENT_*
pnpm nx run library-hall-e2e:bug-bash -- "Explore the hall on a phone and report anything broken"
cd apps/library-hall-e2e/agents && pnpm exec e2e run --headed     # watch it
```

Verified `agent.act` steps are recorded in `.e2e/cache/` and replay later without a model
call. Assertions always run live. Each run prints its tokens and cost.

## CI

`.github/workflows/agent-e2e.yml` runs these suites:

- **Hall suite on a PR:** runs once the PR carries the `agent-e2e` label, and again on every
  push while the label stays.
- **Live suite:** runs every night, and only when its secrets are set.
- **Manual runs:** "Run workflow" can start the hall suite, the live suite, or a bug bash
  with a goal.

On a PR, the results are posted as one PR comment. The replay cache is kept in an Actions
cache.

The workflow reads these repository secrets:

| Secret                                           | For                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                              | Every model call                                                                                                       |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | The live suite: an Access service token. The library's Access application needs a Service Auth policy that accepts it. |
