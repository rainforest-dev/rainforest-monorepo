# Task 5 Report: Alloy config, and the declared-not-probed bind rule

## What was implemented

Appended to `apps/loop-observatory/src/lib/enroll/derive.ts` (verbatim from the brief, no redesign):

- `deriveAlloyConfig(d, f): DerivedFile | null` — returns `null` for a host without the
  `telemetry-sink` role (the mini's case: its sink is the homelab's containerised Alloy).
  Otherwise throws `UnknownFact('tccICloud')` on an unresolved probe, and emits an
  `.alloy` file at `.config/dev-telemetry/alloy/config.alloy` declaring:
  - `otelcol.receiver.otlp "agents"` with `http.endpoint = "${d.otlpBind}:4318"` —
    the bind address comes from `HostDeclaration.otlpBind`, never from any probed fact.
  - `otelcol.processor.batch "agents"` fanning metrics/logs out to
  - `otelcol.exporter.prometheus "agents"` → `prometheus.remote_write.rpi.receiver`
  - `otelcol.exporter.loki "agents"` → `loki.write.rpi.receiver`
- `derive(d, f): DerivedFile[]` — the single entry point: pushes the ralph plist when
  `roles` includes `'ralph'`, pushes the Alloy config when `deriveAlloyConfig` returns
  non-null, and nothing else.

Appended to `apps/loop-observatory/src/lib/enroll/derive.test.ts`: the `deriveAlloyConfig`
describe block (5 tests) and the `derive` describe block (3 tests), transcribed verbatim
from the brief. Only change from the brief's snippet: merged the new `derive.js` imports
(`derive`, `deriveAlloyConfig`) into the existing import line rather than adding a
duplicate import statement, since `AIR_DECL`/`AIR_FACTS` and the rest of the file are
shared scope — `simple-import-sort/eslint` then reordered `import type` before the
value import from `./types.js` on autofix.

## Commands and output

**Red run** (before implementation), `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`:

```
FAIL src/lib/enroll/derive.test.ts > derive > returns every file a host needs, and only those
TypeError: (0 , derive) is not a function
...
FAIL src/lib/enroll/derive.test.ts > derive > is deterministic
TypeError: (0 , derive) is not a function
...
FAIL src/lib/enroll/derive.test.ts > derive > emits no credential-shaped string
TypeError: (0 , derive) is not a function

 Test Files  1 failed (1)
      Tests  8 failed | 13 passed (21)
```

All 8 new tests failed with `deriveAlloyConfig`/`derive is not a function`, exactly as
expected; the 13 pre-existing tests stayed green.

**Green run** after implementation, `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`:

```
✓ src/lib/enroll/derive.test.ts (21 tests) 3ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

**Full suite**, `pnpm nx test loop-observatory`:

```
✓ src/lib/markdown.test.ts (22 tests)
✓ src/lib/taskSort.test.ts (10 tests)
✓ src/lib/taskStatus.test.ts (22 tests)
✓ src/lib/loop.test.ts (14 tests)
✓ src/lib/budget.test.ts (19 tests)
✓ src/lib/tasks.test.ts (8 tests)
✓ src/lib/enroll/derive.test.ts (21 tests)
✓ src/lib/taskDecision.test.ts (12 tests)
✓ src/lib/taskNote.test.ts (9 tests)
✓ src/lib/greenlightOutbox.test.ts (26 tests)
✓ src/lib/enroll/plist.test.ts (5 tests)
✓ src/lib/ledger.test.ts (12 tests)

 Test Files  12 passed (12)
      Tests  180 passed (180)
```

`pnpm format:check` — passed cleanly both before and after the lint autofix.

`pnpm nx lint loop-observatory` — failed once on import ordering
(`simple-import-sort/imports` in `derive.test.ts`); ran
`pnpm nx lint loop-observatory --fix`, which reordered the `import type` line
above the `UnknownFact` value import. Re-ran format check and the full test
suite after the fix; both still clean/green.

## Deviations

None from the brief's implementation or test bodies. The only deviation is the import
statement merge described above (cosmetic, immediately corrected to canonical order by
the project's own lint autofix).

## Self-review

- `derive.ts` stays pure: no `node:fs`, `fetch`, `Date.now()`, or `process.env` were
  introduced.
- The load-bearing test — "no combination of facts can produce a wide bind" — passes
  against all four `HostFacts` variants (`otlpListening: false`, `executors: []`,
  `vaultPath` set, `accounts` nulled), with `// comment` stripping applied before the
  `0.0.0.0` assertion, matching the brief's own warning about the bind-address string
  appearing inside the explanatory comment.
- `deriveAlloyConfig` correctly gates on `d.roles.includes('telemetry-sink')` before
  even touching `f`, so the mini path returns `null` without evaluating `tccICloud` —
  consistent with `MINI_FACTS.tccICloud === 'permitted'` never mattering there.
- Generated Alloy config, read as something that has to run on a real collector: it
  forwards into `prometheus.remote_write.rpi.receiver` and `loki.write.rpi.receiver`,
  neither of which is defined in this file. That's not a bug in isolation — Alloy loads
  every `.alloy` file in a config directory into one merged component graph, so those
  two components are expected to live in a sibling file already present on the
  `telemetry-sink` host (the note in the header even calls this out as "Alloy" rather
  than a standalone daemon). But it does mean this generated file is inert on its own:
  if the sibling file defining `prometheus.remote_write "rpi"` / `loki.write "rpi"` is
  ever missing or renamed, Alloy will fail at load time with an unresolved-component
  reference, and nothing in this codebase currently checks that assumption. Worth a
  follow-up task (out of scope here) to either probe for that file's presence or
  document the dependency where the Alloy directory itself is provisioned.
- The receiver only declares an `http` block (port 4318), matching ralph's OTLP/HTTP
  exporter; no `grpc` block, so port 4317 is untouched by this file — consistent with
  the brief's `endpoint = "...:4318"` assertions and with `ralph.sh:78`'s stated default.

---

## Fix report: fragment, not overwrite

The coordinator verified my self-review's concern against the live host: its
`com.homelab.dev-alloy` launchd plist points Alloy at a single file,
`config.alloy`, which already defines `prometheus.scrape "host"`,
`prometheus.remote_write "rpi"`, `local.file_match "dev_events"`,
`loki.process "dev_events"`, and `loki.write "rpi"`. Since `deriveAlloyConfig`
wrote to that exact path, applying its output would have deleted those
definitions — Alloy would fail to load entirely, losing all telemetry, not
just failing to gain the OTLP intake. Ruling: make the derived file a
fragment beside the hand-maintained config, and point Alloy at the directory
instead of the single file (`alloy run --help`: "If path is a directory, all
`*.alloy` files in that directory will be combined into a single unit").

### Changes

1. **`apps/loop-observatory/src/lib/enroll/derive.ts`** — `deriveAlloyConfig`
   now returns path `.config/dev-telemetry/alloy/loop-otlp.alloy` instead of
   `.config/dev-telemetry/alloy/config.alloy`. Extended the doc comment to
   state explicitly that this is a fragment, that the live host's plist must
   point Alloy at the directory (not this file) for the fragment to be
   loaded, that it depends on a sibling file defining
   `prometheus.remote_write "rpi"` and `loki.write "rpi"`, and why it does
   not define its own remote-write destination (the homelab owns the
   destinations and the host scrape/dev-events tailing; this fragment must
   not redefine or remove them).

2. **`apps/loop-observatory/src/lib/enroll/derive.test.ts`** — TDD order:
   - Added `does not overwrite the hand-maintained config` to the
     `deriveAlloyConfig` describe block *first*, asserting
     `file?.path !== '.config/dev-telemetry/alloy/config.alloy'`, and ran it
     against the unmodified implementation to confirm it failed (see red run
     below) before touching `derive.ts`.
   - After implementing the path change, updated the two assertions that
     still pointed at the old path: `declares an OTLP receiver on the
     declared bind address` (now expects `loop-otlp.alloy`), and `returns
     every file a host needs, and only those` (both the Air's `toContain`
     and the mini's `not.toContain`, both now `loop-otlp.alloy`).

3. **`tools/loop/launchd/Angibles-MacBook-Air.com.homelab.dev-alloy.plist`** —
   changed the last `ProgramArguments` string from
   `/Users/rainforest/.config/dev-telemetry/alloy/config.alloy` to
   `/Users/rainforest/.config/dev-telemetry/alloy` (the directory). Added an
   XML comment above `ProgramArguments` explaining the directory form is
   required because the loop's OTLP intake ships as a separate
   `loop-otlp.alloy` fragment. Deliberately avoided any `--` inside the
   comment (drafted one that quoted `alloy run --help` verbatim, caught it
   with `grep -n -- '--'` before running `plutil`, and reworded to describe
   the same fact — "alloy's own run subcommand help documents that..." —
   without the literal flag spelling).

### Commands and output

**Red run** — new test only, before any implementation change,
`pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`:

```
FAIL src/lib/enroll/derive.test.ts > deriveAlloyConfig > does not overwrite the hand-maintained config
AssertionError: expected '.config/dev-telemetry/alloy/config.al…' not to be '.config/dev-telemetry/alloy/config.al…'
 Test Files  1 failed (1)
      Tests  1 failed | 21 passed (22)
```

**`pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`** (after
the implementation and assertion changes):

```
✓ src/lib/enroll/derive.test.ts (22 tests) 3ms
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

**`pnpm nx test loop-observatory`** (full suite):

```
 Test Files  12 passed (12)
      Tests  181 passed (181)
```

**`./tools/loop/tests/telemetry-sink.sh`**:

```
== the role exists and is claimed by the hosts that need it ==
  PASS  telemetry-sink is a declared role
  PASS  Angibles-MacBook-Air runs ralph, so it has a sink
  PASS  rainforest-mini documents why it is exempt
== the files the role promises are actually in the repo ==
  PASS  Angibles-MacBook-Air config.alloy is checked in
  PASS  Angibles-MacBook-Air dev-alloy plist is checked in
== the config actually receives what ralph sends ==
  PASS  declares an OTLP receiver
  PASS  the receiver speaks http
  PASS  listens on ralph's default port
  PASS  bound to loopback, not 0.0.0.0
  PASS  no 0.0.0.0 bind anywhere
  PASS  declares a metrics exporter
  PASS  declares a logs exporter
  PASS  the receiver outputs metrics
  PASS  the receiver outputs logs
== no credentials rode along ==
  PASS  no key-shaped strings
  PASS  no endpoint is hard-coded
  PASS  endpoints come from the environment
== install.sh implements the role it declares ==
  PASS  install.sh handles telemetry-sink
  PASS  it installs the plist too

  19 passed, 0 failed
```

This test did **not** fail. It reads its fixture from
`tools/loop/launchd/Angibles-MacBook-Air.config.alloy`, a hand-maintained
file from an earlier, separate piece of work that is independent of
`apps/loop-observatory`'s `derive.ts` — nothing in this fix touches it, and
it never referenced the path this fix changed. Reporting per the
coordinator's instruction, since it was flagged as something to watch.

**`pnpm format:check`**:

```
Checking formatting...
All matched files use Prettier code style!
```

**`plutil -lint` on the edited plist**:

```
tools/loop/launchd/Angibles-MacBook-Air.com.homelab.dev-alloy.plist: OK
```

### Self-review

- `derive.ts` remains pure — the fix only changed a returned path string and
  a comment; no new I/O.
- The new test's name (`does not overwrite the hand-maintained config`)
  carries the reason forward the way `UnknownFact`'s design already insists
  on elsewhere in this file: a future reader who breaks this test should not
  have to reconstruct why it exists.
- Confirmed by direct `grep -n -- '--'` against the edited plist that the
  only `--` sequences left are inside `<string>` elements (the CLI flags
  `--server.http.listen-addr` and `--storage.path`, which are not comments
  and are unaffected by XML's comment restriction), not inside the new
  `<!-- ... -->` block.

---

## Fix report round 2: assert the directory form in telemetry-sink.sh

The coordinator's recorded ruling from round 1 said the risk of the plist
regressing to a single-file path would be "mitigated by asserting the
directory form in the telemetry-sink test," but the three change instructions
actually sent never asked for that assertion, so it was not written. Leaving
it undone would let the ledger claim a safeguard that does not exist. Adding
it now, as a fourth change, per the coordinator's follow-up.

### Change

**`tools/loop/tests/telemetry-sink.sh`** — added a new section, `== the plist
points Alloy at the fragment directory, not a single file ==`, between the
"files the role promises are actually in the repo" section and "the config
actually receives what ralph sends" section. For every host with the
`telemetry-sink` role (same `y '...'` host-listing idiom the file already
uses for `hosts.yaml`), it reads the plist's last `ProgramArguments` element
via `plutil -convert json -o -` piped to `python3` (matching the file's
existing `y()` pattern of shelling out to Python rather than grepping the
XML), then asserts:

- **`<host>'s Alloy is pointed at a directory, not a .alloy file`** — the
  last argument does not end in `.alloy`.
- **`<host>'s Alloy directory is the dev-telemetry alloy config dir`** — the
  last argument ends in `/dev-telemetry/alloy`.

Both carry a covering comment, matching the file's house convention that
every assertion explains why it exists: the risk is this project's exact
failure class — the plist edit succeeded and nothing checked it, so a future
hand-edit or re-enrollment could silently restore the single-file form and
the OTLP intake would vanish again with no error.

### Proving the assertion discriminates

1. Added the assertion first.
2. Temporarily reverted the live plist's last `ProgramArguments` string from
   `/Users/rainforest/.config/dev-telemetry/alloy` back to
   `/Users/rainforest/.config/dev-telemetry/alloy/config.alloy` (backed up
   first to `/tmp/plist.bak`).
3. Ran `./tools/loop/tests/telemetry-sink.sh` — **red**, both new checks
   failed:

```
== the plist points Alloy at the fragment directory, not a single file ==
  FAIL  Angibles-MacBook-Air's Alloy is pointed at a directory, not a .alloy file
        got=1
        want=0
  FAIL  Angibles-MacBook-Air's Alloy directory is the dev-telemetry alloy config dir
        got=0
        want=1
...
  19 passed, 2 failed
exit code: 1
```

4. Restored the plist from the backup (`diff` against the backup confirmed
   byte-identical restoration; `git diff` on the plist afterward was empty).
5. Re-ran `./tools/loop/tests/telemetry-sink.sh` — **green**:

```
== the plist points Alloy at the fragment directory, not a single file ==
  PASS  Angibles-MacBook-Air's Alloy is pointed at a directory, not a .alloy file
  PASS  Angibles-MacBook-Air's Alloy directory is the dev-telemetry alloy config dir
...
  21 passed, 0 failed
exit code: 0
```

### Commands and output

**`./tools/loop/tests/telemetry-sink.sh`** (final, plist restored): 21
passed, 0 failed, exit 0 (shown above).

**`for t in tools/loop/tests/*.sh; do "$t" >/dev/null || echo "FAILED $t"; done`**:
no output — every script in the directory exited 0, including
`telemetry-sink.sh` itself and the eight siblings
(`execution-presets.sh`, `greenlight-scope.sh`, `max-turns-no-fallback.sh`,
`project-lock.sh`, `rate-limit-detection.sh`, `task-notes-outside-repo.sh`,
`vault-path-required.sh`, `worktree-detection.sh`).

**`pnpm format:check`**:

```
Checking formatting...
All matched files use Prettier code style!
```

### Self-review

- Only `tools/loop/tests/telemetry-sink.sh` changed for this round;
  `git diff --stat` confirms it (24 insertions, 0 deletions) and the plist
  file shows no diff against its round-1 committed state.
- Followed the file's existing idioms deliberately rather than introducing a
  new style: the per-host loop reuses the same `y '...'` python-via-hosts.yaml
  query already used twice above it, and the new `plist_last_arg()` helper
  mirrors the shape of the file's own `y()` and `cgrep()` helpers (a small
  named function wrapping one external call, called inline in `check`).
- Used `plutil -convert json -o - | python3 -json.load` exactly as directed,
  not a grep over the XML — a regex over `<string>...</string>` siblings
  would have been fragile against key reordering or additional
  `ProgramArguments` entries, whereas indexing `[-1]` after JSON parsing
  reads the same "last element" semantics `alloy run`'s own argument parsing
  relies on.
