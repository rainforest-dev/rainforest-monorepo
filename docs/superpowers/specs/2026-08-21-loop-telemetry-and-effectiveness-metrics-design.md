# Loop telemetry and effectiveness metrics — design

**Date:** 2026-08-21
**Status:** design approved, pending implementation plan
**Supersedes:** the telemetry half of the per-task usage tracker
(`loop-engineering-system` layer 3). Does not touch layers 1, 2, 5 or 6.

## Problem

`apps/loop-observatory` (~10,600 LOC) and `tools/loop` (~5,288 LOC) took **13% of
the last 90 days' commits**, and nearly all of that churn was one kind of work:
telemetry accounting. Machine identity derived in five places, Codex tokens not
counted, sessions charged to the wrong run, partitions splitting per host, rate
limits needing to be read from structured events.

That layer is not the product. It is a hand-written metrics pipeline sitting beside
a healthy Grafana/Prometheus/Loki/Alloy stack that already runs in the homelab and
holds no agent data.

Two measurement defects make the current ledger unfixable rather than merely buggy:

1. **Quota delta is not attributable.** Recorded in
   `tools/loop/engine/lib/loopctl/writeback.py:215`: an AG-131 iteration costing
   $4.51 registered 36pp of quota while an AG-383 iteration costing $16.34
   registered 1pp, "because nothing else was awake." With concurrent sessions,
   quota delta measures ambient load. No amount of fixing repairs this.
2. **Write-time attribution is sparse by construction.** In the live ledger, of 19
   runs: `task_id` is present on 1, `pr` on 1, `branch` on 1, and `cost_usd` is
   `0.00` on 11. These are optional keyword arguments to `append_run()`; a caller
   that does not know a value at call time passes `None` and succeeds silently.

## Goals

Serve exactly two decisions, in priority order:

1. **Where to spend quota** — which task types, models and effort levels are worth
   giving to an agent.
2. **Improve the loop's own success rate** — where the loop fails and why.

## Non-goals

- **Code-quality metrics.** First-pass yield and rework rate require joining agent
  telemetry to git history, because the CLI has no visibility past `git push`.
  Neither goal above needs them: the outcome variable for both is whether a loop
  run advanced its task, which the loop already knows. This is deliberately out of
  scope and is the single largest simplification in this design.
- **Proving value externally.** Not a goal, so no metric here needs to be defensible
  to a third party.
- **Replacing the harness.** LangGraph, Google ADK, Claude Managed Agents et al.
  would replace the generic half of `tools/loop` (iteration driving, checkpointing)
  and not the half that encodes local policy (greenlight authorisation, the
  single-writer relay, `stop_at` = open PR never merge, the Notion adapter). The
  maintenance cost is not in the generic half.

## Architecture

### Three stores, three jobs

The division is by _which question only this store can answer_, not by preference.
Putting per-run cost in Prometheus is what forced the invention of quota delta.

| Store                 | Owns                                         | Answers                                                        |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| **Prometheus**        | cumulative counters, trends, alerting        | "how much per week by model/project", "alert me when abnormal" |
| **Loki**              | per-event records, correlated by `prompt.id` | "what did this run cost exactly", "which tool is failing"      |
| **`loop-runs.jsonl`** | run outcome and lineage only                 | "why did this run stop", "whose retry is it"                   |

`loop-runs.jsonl` exists because **outcome is the only thing telemetry cannot know.**
The CLI knows what it spent and which tools it called; it does not know whether that
counted as advancing the task. That is the loop's judgement.

It stays in the vault — small, portable, readable offline, and it survives losing
Loki.

**`ralph.sh` dual-writes the outcome**: the JSONL row as today, plus one OTLP log
record to Alloy carrying the same `run_id`. File tailing was the obvious
alternative and is wrong here for three independent reasons:

1. `ralph` runs on **both** machines and Alloy runs only on the mini, so tailing a
   local file would silently lose every company-side outcome.
2. The vault lives on iCloud. `launchd` on the Air is already denied _read_ access
   to iCloud under TCC — the reason `usage/run-hourly-air.sh` exists — and mounting
   an iCloud path into a container invites the same class of failure.
3. Alloy has no persistent volume for `/var/lib/alloy`, so it loses file positions
   on every container replacement and would replay the entire file into Loki.

The dual write is roughly five lines and reuses the OTLP endpoint the executor is
already pointed at. It makes the outcome path identical on both machines and
independent of the filesystem.

### Attribution happens at process launch, not at write time

This is the core structural change. `OTEL_RESOURCE_ATTRIBUTES` is set once before
the executor starts and is stamped on **every** metric and event that process emits.
It cannot be partially applied, which is precisely the failure mode of the current
optional-kwarg approach.

Verified 2026-08-21: two probe sessions ran with
`OTEL_RESOURCE_ATTRIBUTES=machine=…,telemetry_probe=…`, and both attributes appear
on all 208 resulting Loki events and on every Prometheus series — no gaps.

`ralph.sh` already uses a per-invocation env prefix in `run_claude()`:

```bash
LOOP_PROJECT="$slug" LOOP_EXECUTOR=claude LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$CLAUDE_BIN" -p …
```

The change extends that existing line:

```bash
OTEL_RESOURCE_ATTRIBUTES="machine=$MACHINE,task_id=$TASK_ID,run_id=$RUN_ID,project=$slug,executor=claude,model=$PLAN_MODEL,effort=$PLAN_EFFORT"
```

Consequently `append_run()` keeps only the outcome and the lineage edges. Cost,
tokens and model no longer need to be threaded to it — they arrive on the telemetry
already carrying the same `run_id`.

### Transport

Verified working end to end on 2026-08-21 (`feat/alloy-otlp-receiver` in
`rainforest-homelab`): `otelcol.receiver.otlp` on 4317/4318 → `otelcol.processor.batch`
→ the pre-existing `prometheus.remote_write.rpi` and `loki.write.rpi`.

**`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` is mandatory.**
Claude Code defaults to delta; Alloy's Prometheus converter drops delta silently.
The symptom is diagnostic: `target_info` lands (it is a gauge synthesised from
resource attributes) while every `claude_code.*` counter vanishes, with
`prometheus_remote_storage_samples_failed_total = 0`. Partial arrival rules out the
whole transport path and points at the data type.

Cardinality and hygiene, all set on the CLI side:

- `OTEL_METRICS_INCLUDE_SESSION_ID=false` — every CLI session is a new
  `session.id`; leaving this on churns Prometheus series without bound.
- `OTEL_METRICS_INCLUDE_ACCOUNT_UUID=false` — strips `user.email`, `user.id`,
  `user.account_uuid` from metric labels. Own hardware, so not an exposure, but it
  is unnecessary cardinality.
- **`OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false`** — this one is load-bearing.
  `OTEL_RESOURCE_ATTRIBUTES` applies to both signals, and `run_id` is unbounded, so
  leaving resource attributes on metrics reproduces exactly the `session.id`
  cardinality problem this design set out to avoid. With it off:
  - **Metrics** keep only their native attributes — `model`, `effort`,
    `query_source`, `speed`, `type` — which is all a trend needs.
  - **Loki events** still carry the full resource block, including `run_id`,
    `task_id` and `project`.

  This is not a compromise; it is the three-store division enforced at the exporter.
  Exact per-run cost was always Loki's job. Prometheus was never meant to hold a
  `run_id`.

## Modularity: the seams

`loop-engineering-system` defines this system by its seams — the interface contracts
that keep layers swappable. This design replaces two of those seams and leaves the
rest alone. Stating the new set is the point of this section: a module boundary that
is not written down is not a boundary.

### Seam 1 — Attribution (loop → executor)

**Contract:** an `OTEL_RESOURCE_ATTRIBUTES` string carrying
`machine, project, task_id, run_id, executor, model, effort` plus the estimates in
force for this run: `story_point, budget_usd, max_turns`.

The estimates must be **stamped at launch, not looked up later**. `story_point`
lives in Notion and changes as a task is refined; an audit that reads it afterwards
compares the actual against a number nobody was working to. Capturing it here makes
the estimate immutable per run for free, on the same mechanism that fixed
attribution.

**What it replaces:** per-provider cost extraction. Today, charging a run means
parsing that provider's session files — which is why "Codex tokens not counted" and
"a codex run charged from the newest file, not its own session" were both bugs, and
why each fix had to be written twice.

**The modularity payoff, stated plainly:** adding a third executor currently means
writing a new cost parser. After this it means setting environment variables. The
executor becomes pluggable because the loop stopped needing to understand its
internals — it only needs the executor to speak OTLP, which Claude Code and Codex
both already do.

### Seam 2 — Outcome (loop → stores)

**Contract:** `{run_id, parent_run_id, task_id, project, outcome, branch, pr}` where
`outcome` is the closed vocabulary below.

One shape, two sinks (file and OTLP), reconciled on `run_id`. The loop is the only
writer; nothing downstream may invent an outcome. This preserves the property the
greenlight relay already has — a verdict you cannot establish stays unrecorded
rather than guessed.

### Seam 3 — Query (stores → consumers)

**Contract:** PromQL and LogQL. Not file formats.

This is the seam that did not exist before, and its absence is why the system was
hard to extend: every consumer — Observatory, the `sync` skill, the `loop` skill —
had to parse JSONL itself, so every schema change touched all of them. After this,
a consumer issues a query. Grafana, Observatory, a skill, and the Grafana MCP tools
all become equivalent clients of one surface, and a new consumer costs nothing.

That includes agents: the Grafana MCP server is already wired into the Docker MCP
Gateway, so "why did last week cost more" becomes answerable by an agent without any
bespoke integration.

### Seam 4 — Control (Observatory → loop) — unchanged

The greenlight outbox → pull → apply → ack protocol stays exactly as it is. It is
the one part of Observatory that Grafana cannot host, and it is already correct:
Observatory has no code path that can fabricate an ack.

### What this buys, concretely

| Change            | Before                | After              |
| ----------------- | --------------------- | ------------------ |
| Add an executor   | write a cost parser   | set env vars       |
| Add a dashboard   | write a Vue component | write a query      |
| Add a consumer    | parse JSONL           | issue a query      |
| Change the schema | update every parser   | update one emitter |

### What stays deliberately monolithic

The loop's own policy — task ranking, `stop_at`, greenlight authorisation — is not
made pluggable. It encodes judgement specific to this setup, has one implementation
and one caller, and abstracting it would add indirection with no second
implementation to justify it.

## The outcome vocabulary

Outcome is a typed enum, not a boolean. `ralph.sh` already distinguishes these
cases — it calls `task-note` rather than `set` on turn exhaustion precisely because
"exhausting turns means unfinished, not unable" and any state passed would be a
guess. This design writes that existing judgement into a controlled vocabulary
instead of a free-text status string.

| Outcome            | Meaning                                                   | In denominator?                           |
| ------------------ | --------------------------------------------------------- | ----------------------------------------- |
| `reached_stop_at`  | Task pushed to pr-ready                                   | yes                                       |
| `advanced`         | Committed work, did not reach `stop_at`                   | yes                                       |
| `turns_exhausted`  | Budget spent, result unknown                              | own bucket — **never counted as failure** |
| `rate_limited`     | Never got a fair attempt                                  | **excluded**                              |
| `preflight_failed` | Infrastructure failed before the task ran                 | **excluded**                              |
| `executor_failed`  | Genuine failure                                           | yes                                       |
| `stale`            | Started, then stopped reporting — no completion, no death | **excluded**                              |
| `reclaimed`        | Cancelled or moved by hand                                | **excluded**                              |

The last two are borrowed from Hermes Agent's `task_runs` outcome column, which
carries `completed`, `crashed`, `spawn_failed`, `timed_out`, `error_budget` /
`error_max_turns`, `gave_up`, `reclaimed` and `stale`. Its first six map onto the six
above; the last two had no equivalent here, and both describe states this loop can
reach:

- **`stale`** — an unsupervised run driven by launchd can stop reporting without
  either finishing or crashing. Without this value such a run has no outcome at all
  and becomes an orphan row, which is worse than a recorded failure because it is
  invisible in every denominator.
- **`reclaimed`** — Observatory exists to let a human intervene, so manual
  cancellation is a normal event, not an anomaly. Counting it against the executor
  would punish the loop for being supervised.

**Why the denominator rule matters.** The live ledger contains a `blocked` run —
AG-289, stopped at an `openapi-sync` preflight with `curl exit 60`. That run never
attempted the task. Counting it as a failure would make its whole task class look
unworthy of quota, which inverts the decision the metric exists to inform.

**`preflight_failed` needs a circuit breaker, not just a label.** Recording the
outcome is not enough: task ranking will re-select the same task on the next sweep,
it will fail at the same preflight, and it will do so every sweep until a human
notices. AG-289 is exactly this shape — `curl exit 60` is a TLS failure that will not
resolve by retrying. After N consecutive `preflight_failed` outcomes on one task, the
task is auto-blocked and drops out of ranking until something changes. Hermes calls
its equivalent `gave_up` and trips it on repeated spawn failure; the mechanism is
worth copying even though the trigger differs.

This is the one behavioural change in an otherwise measurement-only design, and it
earns its place because the failure it prevents is unbounded repetition of a known
failure — the cheapest possible thing to stop.

Run-level records plus the existing `parent_run_id` edge make task-level rollups a
`GROUP BY`, not a second dataset. Record at the finest grain; derive the rest.

Mapping from today's free-text statuses: `completed` → `reached_stop_at` when a `pr`
is recorded, else `advanced`; `incomplete` → `turns_exhausted`; `blocked` →
`preflight_failed`; `needs-tuning` is not a run outcome and moves to a note.

## Estimate audit

The loop already carries three estimates and never checks any of them against what
happened. This is the first consumer of the new telemetry, and it is deliberately
**measurement only — no gate**.

That is not a reduction in ambition. `BUDGET_USD` was never a gate: its own comment
says it is "checked between iterations (cannot stop one)", and the record shows it
stopping the 2026-07-31 AG-130 run at $11.25 _after_ the PR was already open. Framing
it as an audit puts it where it already was.

| Estimate           | Source                                       | Actual, from                                                               |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------------- |
| `story_point`      | Notion task cache — 27 of 30 tasks carry one | summed `api_request.cost_usd_micros` per `task_id`                         |
| `MAX_TURNS` (100)  | ralph parameter                              | count of `api_request` per `run_id` — see the note on `query_source` below |
| `BUDGET_USD` ($10) | ralph parameter                              | summed cost per `run_id`                                                   |
| `model` / `effort` | resolved preset                              | cost and outcome, stratified by `story_point`                              |

**Turn count is a proxy, not an exact figure.** One main-loop API request is
approximately one agent turn; subagent and auxiliary requests are meant to be
excluded by a `query_source` filter.

**But `query_source="main"` selects none of them.** Measured 2026-08-22: a
headless `claude -p` run — which is what every loop run is — reports
`query_source: sdk` on its `api_request` events. `main` is the interactive
session's value. Filtering on it would return an empty result for every loop run
ever recorded, and an empty result here reads exactly like "no run came close to
the limit", which is the opposite of what it means. Whoever implements this audit
has to settle which `query_source` values a `-p` run actually emits before
writing the filter, rather than inheriting this one. Whether a run _hit_ the limit is exact — `ralph` already
detects the `error_max_turns` subtype and it becomes the `turns_exhausted` outcome.
Only "how close did it get" is approximate.

### The four questions

1. **Does a story point predict cost?** Cost per point and its variance. If it does,
   quota can be budgeted before a run starts, which is what "where to spend quota"
   means operationally.
2. **Is `MAX_TURNS=100` right?** Which story-point sizes hit `turns_exhausted`. If
   they are all 5-pointers, that is a mis-set budget, not a weak model.
3. **Is `BUDGET_USD=$10` right?** Where $10 sits in the actual per-iteration cost
   distribution.
4. **Is higher effort worth it?** Cost and outcome by `model` and `effort`,
   **stratified by story point** — a single average across task sizes answers nothing.

`story_point` is safe as a Prometheus label on `loop_run_outcome_total`: six distinct
values observed (0, 1, 1.5, 2, 3, 5). It is the one resource attribute that earns a
place on a metric series, which is why it is listed explicitly rather than arriving
through `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES`.

### Sample size is the binding constraint

Nineteen runs exist in total, and question 1 needs several runs per story-point value
to say anything. **These audits accumulate; they do not report on day one.** State the
sample size beside every figure, and treat a per-point cell with fewer than five runs
as unreported rather than noisy.

### One hygiene fix pulled in

The Antigravity quota reading is a `words × 1.3` estimate priced at a Gemini Flash
rate — a fabricated number, not a measurement. Everything else in the quota-source
repair list (moving Codex off session-file tailing, enforcing `source_ts` freshness)
served the gate and is deferred with it. This one is not: while it keeps writing,
it contaminates the very records these audits read. It becomes `null`.

Recording "unknown" is strictly better than recording a guess, because a guess is
indistinguishable from a measurement downstream.

## Metrics

Metric names below are the real ones. Prometheus names are as they arrive through
Alloy's converter (verified 2026-08-21); Loki queries are LogQL over
`{job="claude-code"}` and `{job="loop-runs"}`.

### Derived series: run outcome

Outcome is not telemetry, so nothing emits it as a metric today. `ralph.sh` sends
it as an OTLP log record; Alloy's `loki.process` applies a `stage.metrics` counter
to the resulting stream, deriving:

```
loop_run_outcome_total{outcome, project, executor, model, effort}
```

Low cardinality by construction — no `run_id`, no `task_id`. Those stay in the log
line for Loki-side joins.

### Where to spend quota

Trend and ratio work in Prometheus:

```promql
# Model/effort economics — the core "is xhigh worth it" question
sum by (model, effort) (claude_code_cost_usage_USD_total)
  /
sum by (model, effort) (
  loop_run_outcome_total{outcome="reached_stop_at"}
)

# Where the money goes, grouped by how runs ended
sum by (outcome) (loop_run_outcome_total) * on() group_left()
  sum(rate(claude_code_cost_usage_USD_total[1w]))

# Outcome mix by project
sum by (project, outcome) (loop_run_outcome_total)
```

Exact per-run and per-task cost in Loki, where `run_id` lives:

```logql
sum by (resources_run_id) (
  sum_over_time(
    {job="claude-code"} | json | body="claude_code.api_request"
    | unwrap attributes_cost_usd [$__range]
  )
)
```

**Corrected against the live pipeline on 2026-08-22, from a run whose export was
verified.** Three details in the query above were wrong as first written, and each
one fails by returning nothing rather than by erroring — the same shape as a
dropped export, which is how a working pipeline gets diagnosed as broken:

- `run_id` is a **resource** attribute, so it arrives nested. LogQL's `json`
  flattens with `_`, making the field `resources_run_id`. A filter on bare
  `run_id` matches no line. Same for `task_id` and `project`.
- the attribute is `cost_usd`, a decimal dollar figure, not `cost_usd_micros`, so
  there is no `/ 1e6`. Measured: a run costing $0.056422 by the CLI's own
  accounting reported `cost_usd: 0.056422` on its `claude_code.api_request`
  event, and `claude_code_cost_usage_USD_total` in Prometheus agreed to the last
  digit.
- `json` prefixes event attributes too, so the unwrapped field is
  `attributes_cost_usd`.

All quota ratios exclude `outcome=~"rate_limited|preflight_failed"`.

### Improve loop success rate

```promql
# Turn-budget mis-set: which project/preset exhausts turns
sum by (project, effort) (loop_run_outcome_total{outcome="turns_exhausted"})
  / sum by (project, effort) (loop_run_outcome_total)

# Infrastructure health
sum by (project) (loop_run_outcome_total{outcome="preflight_failed"})
```

```logql
# Tool failure rate by tool
sum by (tool_name) (
  count_over_time({job="claude-code"} | json
    | body="claude_code.tool_result" | success="false" [$__range])
)
```

Escalation rate — how often a fallback executor is invoked — is derived from
`loop_run_outcome_total` grouped by `executor` against the task's first-choice
executor, which `ralph.sh` already knows when it records the outcome.

## Migration

New and old pipelines run in parallel for **two weeks**, then the old one retires.

**Reconciliation is the gate.** For each run present in both, compare:

| Field         | Tolerance                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------- |
| cost          | within 5% between `api_request.cost_usd_micros` summed by `run_id` and the ledger's `cost_est_usd` |
| output tokens | within 5%                                                                                          |
| run count     | exact — every run in one appears in the other                                                      |

Runs whose ledger `cost_usd` is `0.00` (11 of 19 today) are reconciliation failures
of the **old** pipeline and are recorded as such rather than excluded.

This period also settles the one unverified claim carried over from the survey: a
community report of OTel metrics overstating input tokens ~8× and output tokens
~80–90× versus local JSONL. If it reproduces here, metrics are demoted to trends
only and every cost figure is sourced from Loki events. If it does not, it is
recorded as not reproduced. Either way the ambiguity ends with data.

### Retire, after reconciliation passes

- the `quota` block in `append_run()` — structurally invalid
- `cost_est_usd` derivation from session files
- `ledger.*.jsonl`, `tools/loop/usage/*.sh`, and their two launchd plists
- `apps/loop-observatory` `ledger.ts`, `budget.ts` and the chart components

### Downstream surfaces that break with it

Retiring the ledger is not contained to this repo. Each of these reads it today and
must be updated in the same change, not discovered afterwards:

- **the `sync` skill** — its whole contract is "budget/quota first, then the usage
  ledger, then the Notion task board". The first two steps cease to exist; quota
  comes from Grafana and cost from Loki. The skill either re-points or retires.
- **the `loop` skill** — reports loop state and may read budget from the same files.
- **`apps/loop-observatory` API routes** `api/usage.ts` and `api/budget.ts` — removed
  with the charts they serve.

### Keep

- greenlight authorisation and the single-writer relay — encode judgement, and
  Grafana cannot host a button
- the Notion adapter and task ranking
- `loop-runs.jsonl`, slimmed to outcome and edges
- Observatory as a **control surface**: greenlight, task notes, feedback write-back.
  The charts move to Grafana; the interactions stay. Its value was never the charts.

## Risks

- **Silent OTLP drop.** The OTel SDK fails silently and CLI processes are
  short-lived. Community sources cite `CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS`,
  `CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS` and `CLAUDE_CODE_OTEL_DIAG_STDERR` for
  this, but **none appears in the official documentation** and none is verified
  here. Mitigation does not depend on them: reconciliation catches drops, because a
  dropped run is a run count mismatch.
- **Alloy loses positions on every container replacement.** `/var/lib/alloy` has no
  persistent volume, so `loki.source.docker` replays container logs from the
  beginning after each `terraform apply` and Loki rejects the old entries with 400.
  Observed 2026-08-21; settles in about a minute. Choosing the OTLP dual write over
  file tailing keeps this bounded to container logs rather than extending it to
  outcome data. Worth a persistent volume regardless, but no longer a prerequisite
  for this design.
- **The run ledger has no consumer, and no transport either.** Measured 2026-08-21.
  `loop-runs.<machine>.jsonl` is written by `writeback.py:267` and read by nothing —
  not Observatory, not any skill, only two test scripts. Separately, the Air's
  partition (12 KB) exists solely in the iCloud vault and is absent from the clone
  Observatory actually reads (`VAULT_PATH=~/Repositories/rainforest-obsidian`),
  because all three transports miss it: iCloud sync does not reach the clone,
  `icloud-mirror` carries a three-file allowlist, and `publish-air-to-mini.sh` sends
  only `quota.*` and `ledger.*` from a local runtime copy.

  **The missing consumer is the primary gap; the transport is downstream of it.**
  Patching the transport alone would move a file nobody reads into a directory nobody
  reads it from — the exact pattern `writeback.py:23` warns about ("publishing there
  succeeds, writes a real entry, and is read by nothing"). This design supplies the
  consumer, and the OTLP path supplies the transport, in one move.

  The estimate audit in this document is therefore not blocked on plumbing. It is the
  first consumer this data has ever had.

  The two copies are not merely out of step; **neither contains the other**. On the
  same day the clone's ledgers were 56 MB and 30 MB against iCloud's 10 MB and 7 MB,
  while `tasks.json` was larger in iCloud than in the clone. Staleness runs in
  different directions per file, and which copy is authoritative differs _per machine_
  — `writeback.py:23` documents the clone as the stale one on Air, while on the mini
  it is the live one.

  This is not an argument against the vault as a store. `_system/` has zero sync
  conflicts because every file there is machine-partitioned with one writer, which is
  the correct design and works. It is an argument against file sync as a _distribution
  backbone_: three hand-maintained allowlists is a defect generator, and the same class
  of bug has already been fixed once from the writer's side (`writeback.py`'s docstring
  records a task going PR-ready on Air while the board showed it not started) without
  the transports being brought along.

  OTLP has one path, identical on both machines, with no allowlist to forget.

- **The dual write can diverge.** Two sinks, one truth. `run_id` is the reconciler:
  any row in `loop-runs.jsonl` with no matching OTLP record in Loki is a dropped
  emit, and the two-week parallel window is where that rate gets measured. If it is
  non-zero, the file stays authoritative and Loki is treated as a queryable cache —
  which is already how this design reads it.
- **The Pi is the single point of failure** for both Prometheus and Loki.
  `loop-runs.jsonl` staying authoritative in the vault is the mitigation: outcomes
  survive losing the Pi; only cost history is lost.
- **Two-week window is short** at current volume (19 runs total to date). If fewer
  than 10 runs accumulate, extend rather than conclude — reconciliation on a
  handful of runs proves little.

## Open questions

1. **Where the OTel env vars live.** `~/.claude/settings.json` `env` block covers
   interactive sessions; a shell profile covers all shells; the ralph launchd plist
   covers unsupervised runs. These have different scopes and the choice is not
   obvious — unsupervised loop runs and manual sessions arguably want different
   `OTEL_RESOURCE_ATTRIBUTES`.
2. **Whether Codex reaches parity.** Its `[otel]` block emits token usage, latency,
   API requests, tool calls and approvals, but the attribute names are not
   guaranteed to match Claude Code's. Verify during the parallel window before
   assuming cross-executor comparisons are valid.
