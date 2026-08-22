# Carry run identity on the telemetry itself — implementation plan

**Task:** T-20260821210329 · **Design:**
[2026-08-21-loop-telemetry-and-effectiveness-metrics-design.md](../specs/2026-08-21-loop-telemetry-and-effectiveness-metrics-design.md)

Scope is the **producer side only**. The transport (Alloy `otelcol.receiver.otlp` on
4317/4318 → `prometheus.remote_write.rpi` / `loki.write.rpi`) is already built and
verified; nothing here touches it, and nothing here touches the Observatory or the
`sync` skill, which the design retires later and separately.

## What has to move, and why it is not just an env block

`run_id` is derived at **write** time today — `append_run()` builds
`f"{machine}-{ended}-{task}"` from a timestamp it takes when the row is appended,
which is after the executor has exited. Attribution needs the id to exist _before_
the process starts, because the whole point of `OTEL_RESOURCE_ATTRIBUTES` is that it
is stamped once at launch and cannot be half-applied. So the id moves upstream into
`ralph.sh` and is passed down, rather than being invented at the bottom.

That move also fixes the id's shape. Today it embeds the task ref, which for Notion
is a full URL:

    Angibles-MacBook-Air-1785980754-https://app.notion.com/p/3b30f67c1d0c8191ad02cf3d2280f666

`OTEL_RESOURCE_ATTRIBUTES` is W3C-baggage-encoded, where `,` and `=` are delimiters.
A task ref carrying a query string would silently corrupt every attribute after it.
The id also duplicates `task` and `task_id`, which are already their own fields. The
new form is opaque, bounded and sortable:

    rainforest-mini-1787398000-3f9a2c71

## Steps

1. **`run_id` at launch.** `ralph.sh` generates one per executor attempt. `append_run`
   gains an optional `run_id=`; when absent it falls back to today's derivation, so
   no other caller changes behaviour. `_last_run_id_for` is unaffected — it reads the
   field, not its shape.

2. **`story_point` reaches ralph.** Both adapters read the frontmatter/cache but drop
   `points` on the floor. `obsidian_base` and `notion` put it in `TaskRef.metadata`;
   `ralph.sh` reads it off `loopctl next` alongside `item_id`.

   Stamped at launch, not looked up later: a point value read afterwards compares the
   actual against a number nobody was working to.

3. **The env block, in `run_claude`.** Extends the prefix that already carries
   `LOOP_PROJECT` / `LOOP_EXECUTOR` / `LOOP_QUOTA_MODE`, so attribution and the
   existing per-invocation context are set by one mechanism.

   `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` is not optional:
   Claude Code defaults to delta and Alloy's Prometheus converter drops delta
   silently, with `target_info` still arriving and every `claude_code.*` counter
   vanishing at zero export failures.

   `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false` is the other load-bearing one.
   `run_id` is unbounded; letting it onto metric labels reproduces exactly the
   `session.id` cardinality problem `OTEL_METRICS_INCLUDE_SESSION_ID=false` exists to
   avoid. Metrics keep their native attributes, Loki events keep the full resource
   block. That is the three-store division enforced at the exporter.

4. **Codex.** Same `OTEL_RESOURCE_ATTRIBUTES` — the Rust SDK's `Resource::builder()`
   carries the default env detector, so the variable reaches Codex's resource without
   a Codex-specific mechanism. Exporters go through `-c`, which ralph already uses,
   and take **full signal paths**: Codex hands the endpoint to
   `LogExporter::builder().with_http().with_endpoint(..)`, which uses the URL as given
   and appends no signal suffix.

5. **`append_run` slims to outcome and edges.** `cost_usd`, `tokens_out`, `model` and
   `effort` come off — they arrive on telemetry already carrying the same `run_id`.
   The `quota` block stays: the design retires it only after reconciliation, and this
   task does not claim that.

## Verification

`tools/loop/tests/execution-presets.sh` runs ralph against fake executors that record
their argv. The fakes also dump their OTel environment, and the assertions that used
to read `model`/`effort`/`tokens_out` off the ledger row move to reading them off the
attribute string — the same fact, checked where it now lives.

A green test proves the producer is configured. It cannot prove export, because the
failure mode is silent. So one real iteration must also land
`claude_code_cost_usage_USD_total` in Prometheus and `{job="claude-code"}` events in
Loki, both joinable on the `run_id` ralph generated.

## Verified 2026-08-22

The suite is green at 135 + 14 + 11 checks. It proves the producer is configured
and nothing more, so one real run was launched through ralph's own
`otel_claude_env` — the functions extracted from `ralph.sh`, not a hand-written
copy of them — and both stores were queried for it.

`run_id=rainforest-mini-1787398828-0F8E5440`, one `claude -p` costing $0.056422:

- **Prometheus.** `sum by (model, effort) (claude_code_cost_usage_USD_total)`
  returns `{model="claude-haiku-4-5-20251001"} 0.056422` — the CLI's own figure to
  the last digit. Cumulative temporality is doing its job: with the default the
  series would not exist at all. No `run_id` label and no `session.id` label, so
  the cardinality controls hold.
- **Loki.** 107 events under this run, including `claude_code.api_request`
  carrying `cost_usd 0.056422` and `output_tokens 110`, both matching the CLI.
  The full resource block is on every line: `machine`, `project`, `task_id`,
  `run_id`, `executor`, `model`, `story_point`, `budget_usd`, `max_turns`.

**The first Loki query returned zero, and the pipeline was fine.** `run_id` is a
resource attribute, so it arrives nested and LogQL's `json` flattens it to
`resources_run_id`; a filter on bare `run_id` matches nothing. That is worth
stating plainly because it is indistinguishable from the failure this design
warns about — the OTel SDK drops silently, so "no rows" is exactly what a dropped
export looks like too. The design's own queries have been corrected against the
live pipeline rather than left to be rediscovered.

Two further findings are recorded in the design rather than acted on here, both
belonging to the estimate audit that comes later: the cost attribute is
`cost_usd` in decimal dollars, not `cost_usd_micros`, and `query_source` on a
`-p` run is `sdk`, not `main` — so the turn-count query as drafted would return
an empty result for every loop run and read as "nothing came close to the limit".

**Not verified: Codex.** It is not installed on this host, so its `-c` overrides
and its reading of `OTEL_RESOURCE_ATTRIBUTES` are checked only against the shape
of its own source and asserted in the suite. Both need one real Codex run on the
Air before the cross-executor comparisons are trusted.
