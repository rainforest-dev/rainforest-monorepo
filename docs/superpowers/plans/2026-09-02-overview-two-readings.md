# Overview's Machines: two readings, and where they disagree

Task `T-20260902130101` (P1, `loop-observatory`). Spec: `LoopObservatoryDesktop v2.dc.html`
in the *Loop Observatory Mobile View* design project. v1 is fiction and is not a source.

## The argument the design is making

> Every machine is read twice, from two sources on two clocks. Where the two
> disagree, this page says so instead of choosing.

`hosts.json` is written once, by hand, by `enroll.sh`, and `drift.ts` calls it stale
after fifteen minutes — nothing re-sends it. `quota.<host>.json` is written hourly by
the usage job. For the same machine these two routinely give opposite answers, which is
exactly what `readingsFor()` in `src/lib/enroll/view.ts` was built to surface.

`SetupPanel.vue` already renders `readings.{enrollment,telemetry,conflict}`.
`MachinesPanel.vue` and `OverviewDashboard.vue` do not read them at all. So Overview
still picks one clock and reports it as *the* "Last seen" — the arbitration the design
forbids. This is mostly a wiring task, not a new data pipeline.

## Changes

### 1. `src/lib/machineReadings.ts` (new, pure, no `node:` imports)

`MachinesPanel` is a client island, so the logic has to be node-free to be importable
at runtime rather than type-only. Everything here is a pure function over plain data
and gets unit tests:

- `remainingPct(used_pct)` — the number the page shows is what is **left**.
- `remainingStatus(remaining)` — `bad ≤ 10`, `warn ≤ 25`, else `ok`. Low is bad; this
  is the inverse of the current `statusOf(used_pct)`, and the inversion is the point.
- `HALT_AT_PCT = 10` and `haltMarker(bar)` — the 5-hour window carries the line the
  loop actually stops at, so a reader sees the threshold and not just the value.
- `readingPills(readings)` — one pill per source, each naming *its own* source file and
  *its own* age, plus `expired` on an enrollment report past `STALE_AFTER_MS`.
- `unknownNote(bar)` — "no figure since X — unknown, not zero".

### 2. `src/components/MachinesPanel.vue`

- Accept a `readings` prop keyed by machine name; render the two pills and, when
  `readings.conflict` is set, a *Sources disagree* box with `snapshot says` /
  `enrollment says` and the server's one-line explanation of why both hold.
  It states the split. It does not resolve it, and it does not rank the sources.
- Replace the single "Last seen" line, which was the arbitration.
- Quota groups (Claude / Codex) each carry a `stale`/`live` tag **and** their source.
- Unknown window: a hatched track (`repeating-linear-gradient`, 135deg) inside a dashed
  warn border. Not 0%, not full — an empty bar and a full bar are both confident claims
  about a number nobody has.
- Bars read as remaining, coloured by `remainingStatus`.

### 3. `src/components/OverviewDashboard.vue`

Fetch `/api/enroll/hosts` alongside the existing three. It is a fourth reading source
for a page whose thesis is that one source is not enough; a failure there degrades to
"no second reading" rather than blanking the panel.

## Verification

- `nx test loop-observatory` — unit tests for every pure function above, including the
  ≤10 / ≤25 boundaries and the unknown-vs-zero distinction.
- `nx lint loop-observatory`, `nx typecheck loop-observatory`.
- Load the running dev server and read a machine card, per the repository's own note
  that a green build says nothing about dev.

## Known gap carried from the design

The design names a machine `Angibles-MacBook-Air`; it was renamed `rainforest-air` on
2026-08-31. Nothing in this change hardcodes either name.
