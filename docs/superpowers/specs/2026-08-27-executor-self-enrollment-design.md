# Executor self-enrollment — design

**Date:** 2026-08-27
**Status:** design approved, pending implementation plan

## Problem

Enrolling a machine as a loop executor today takes a monorepo clone, a
hand-authored `hosts.yaml` entry, and hand-authored per-host launchd plists.
Nothing verifies the result. Three failures measured on 2026-08-26, all the same
shape — **a machine's true configuration existed only on that machine, and no
reader ever checked it**:

- **The Air had never emitted a single `claude_code_*` metric.** `ralph.sh:78`
  defaults `OTLP_ENDPOINT` to `http://localhost:4318` and injects the exporter
  env into every `claude -p` it launches; nothing was listening on that port, and
  the OTel SDK fails silently against a closed socket. Its Alloy was up and
  healthy the whole time, shipping host metrics and dev events. Zero
  `{job="claude-code"}` series and zero Loki lines carried that machine.
- **The mini never had `defaults.vault_path`.** The Air carried it, with a
  comment warning about the stale clone; the mini did not, so `vault_path()` fell
  through to that clone and every run this machine recorded went somewhere
  nothing reads. `loop-runs.rainforest-mini.jsonl` existed _only_ there.
- **The Air's Alloy config was in no repository.** Hand-edited, unversioned. A
  reimage would have silently restored the first failure above.

The per-host plists encode real machine facts — the Air runs ralph through
`osascript` because launchd there cannot read `~/Library/Mobile Documents` — but
those facts live in prose comments, discovered once by hand and never re-checked.
Other differences between the two hosts are not facts at all, only artefacts of
being hand-written at different times: `LOOP_MACHINE=mini` versus
`LocalHostName=rainforest-mini`, whose workaround is an absolute `LOOP_QUOTA_FILE`
path, and iteration parameters baked into `ProgramArguments` that belong in
config.

## Goals

1. A machine becomes an executor without a monorepo clone.
2. Its configuration is **derived**, not authored, so the same machine enrolled
   twice produces the same result and hand-written divergence cannot accumulate.
3. The facts that drive the derivation are **re-probed**, so a stale record can
   never be mistaken for reality.
4. The same probe answers "is this machine still what it claims to be" — the
   reader that all three failures above lacked.

## Non-goals

- **Handling credentials.** `claude login`, `gh auth` and Tailscale membership
  are established by the owner on the machine. Enrollment verifies and reports
  what they resolved to; it never sets or stores them.
- **Unattended enrollment.** A person is present with the setup page open. This
  is what removes the need for a machine-facing MCP server; see Decisions.
- **Replacing `install.sh`** for the two machines already running. Migration is
  incremental; see Migration.

## Decisions

Six, each closing an alternative that was considered and rejected.

### 1. The app serves a release artifact, not a package and not a working tree

`tools/loop/` is built into a versioned tarball by CI from a tag, published to
GitHub Releases, and mounted by the Observatory to serve over the tailnet.

- _Not an npm package_: publishing and versioning a package is maintenance
  overhead for a personal system.
- _Not the mini's working tree_: the served bytes would be whatever that folder
  happened to contain, which reintroduces "the machine's state depends on
  something nobody recorded". The mini's worktree carries uncommitted changes
  routinely.
- The release artifact gives provenance without a registry, and the machine needs
  no GitHub credential to fetch it. The repo already releases this way — see
  `.github/workflows/release-personal-calibre.yml` and the `release` block in
  `nx.json`.

### 2. The tailnet is a prerequisite, established by the owner

Both machines are already on it (`100.86.67.66` mini, `100.102.101.102` Air), and
the Observatory answers over it unauthenticated in 0.21s. The app does not join
machines to the tailnet; the setup page states it as a precondition.

Trust is layered, not merged: **the tailnet governs who can reach the app; the
app governs what a machine is told to be; the machine governs its own secrets.**

### 3. The app derives; the device probes, applies and reports

Derivation is a pure function of `(declaration, probed facts)`. The device runs a
probe list the app serves — so adding a new derivation input later means adding a
probe, and every machine picks it up on its next run without anything on the
machine being updated.

Rejected: letting an agent on the machine decide how to satisfy stated goals.
That is precisely the failure being fixed — per-machine divergence with no record
of why.

### 4. Declarations only; credentials never reach the app

The app decides which executors a machine may use, which account should run which
scope, default model and effort. All non-secret. The probe reports what
`claude` and `gh` actually resolved to, which lets the app catch **a company
machine logged into a personal account** without seeing any token.

### 5. No MCP server. The setup page is the interface

The page is open during setup, so there is no headless consumer to serve. This
removes the four-round handshake, the tool-tier split, and the
machine-facing MCP endpoint on an unauthenticated tailnet — the last one
disappears rather than being mitigated.

It also resolves the authorisation question. Anything that can drive the page is
inside a Cloudflare Access session, so it is the owner; a greenlight control on
that page is not reachable by an unauthenticated agent because no such agent is
involved.

**WebMCP is the experimental next step, not the foundation.** WebMCP
(`navigator.modelContext.provideContext()`, W3C Web Machine Learning CG) lets a
_page_ declare tools for an agent _in the browser_ — Origin Trial in Chrome 149
and Edge 150, supported in ChatGPT Desktop and experimentally in Brave Leo, with
Firefox and Safari at standards-positions only, and Claude in Chrome not on the
implementation list. It is not MCP-over-HTTP and cannot serve a headless machine.
Because derivation is a pure function with the page as one face, declaring those
same functions as WebMCP tools later adds a face without moving logic. Nothing in
this design may foreclose that.

### 6. Facts are not version-controlled

A committed fact file is a snapshot that goes stale while nothing checks it —
the failure this design exists to remove. A device is re-probed, or re-enrolled;
both read reality.

| Where          | What                                                           | Why there                                                          |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Git**        | role definitions, derivation rules, templates, policy defaults | Generic, human-authored, true across machines. This is the system. |
| **App state**  | which devices exist, the roles each chose, last reported facts | A device record. Changes, and is rebuildable by re-enrolling.      |
| **The device** | generated plists, Alloy config                                 | Pure output. Re-enrolling regenerates it.                          |

Consequently `hosts.yaml` keeps its `roles:` definitions and **loses its `hosts:`
section**, which moves to app state. That file's own note says it is "the only
place that maps a machine to them" — the intent (do not scatter machine config
across directories) is preserved; there is still exactly one place. The note was
written when `install.sh` was the only mechanism.

App state lives at `_system/usage/hosts.json`, beside `quota.*.json` and
`tasks.json`: same directory, same iCloud sync, no database.

**This requires a new `.gitignore` entry, and forgetting it defeats decision 6.**
That directory deliberately mixes committed config with ignored runtime, listed
file by file — its own comment reads "Config files (model-rates.json,
task-map.json) stay committed" — so nothing is ignored by inheriting the
directory. Verified 2026-08-27: `git check-ignore _system/usage/hosts.json`
matches no rule today, meaning the device records would be committed on the first
sync, which is exactly the stale-snapshot-in-git this decision exists to prevent.
The entry belongs with the others, with the reason stated:

```
# Device records: written by enrollment, rebuilt by re-enrolling. Never a source
# of truth -- a committed copy would go stale while nothing checked it.
_system/usage/hosts.json
```

## Architecture

One pure function, one face today, two later.

```
                    ┌──────────────────────────────┐
  declaration ─────►│  enroll/derive.ts            │
  (roles, policy)   │                              ├──────► file contents
  probed facts ────►│  pure: no I/O, no network    │        (deterministic)
                    └──────────────┬───────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
               setup page                  WebMCP tools
               (today)                     (experimental, later)
```

Keeping derivation pure is what stops the page and any future agent surface from
disagreeing — a divergence that would be among the worst bugs this system could
have, because each surface would look correct alone.

## Components

| Component                                        | Responsibility                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `loop-engine` release                            | Versioned tarball of `tools/loop/`, built by CI from a tag, published to GitHub Releases |
| `apps/loop-observatory/src/lib/enroll/derive.ts` | The pure function. No I/O.                                                               |
| `apps/loop-observatory/src/lib/enroll/probes.ts` | The probe list the device runs, versioned                                                |
| `POST /api/enroll/facts`                         | Accepts probe facts for one host. Facts only.                                            |
| `GET /enroll/bundle`                             | Serves the mounted release artifact                                                      |
| `/setup` page                                    | Prerequisites, role selection, derived output, applied-state and drift                   |
| `_system/usage/hosts.json`                       | Device records                                                                           |

## Data flow

```
Prerequisites (owner, once)     Tailscale joined · claude login · gh auth

  device                                             app
    │                                                 │
    │  1. fetch probe list + bundle ─────────────────►│
    │                                                 │
    │  2. run probes                                  │
    │                                                 │
    │  3. POST /api/enroll/facts ────────────────────►│  records facts
    │                                                 │  derives
    │  4. owner picks roles on /setup ────────────────│
    │◄──── derived file contents ─────────────────────│
    │                                                 │
    │  5. write files (all disabled)                  │
    │                                                 │
    │  6. POST facts again ──────────────────────────►│  applied state
    │                                                 │
    │  ... periodically: POST facts ─────────────────►│  drift
```

**Submitting facts causes nothing to happen.** It records an observation.
Derivation is pure and application happens on the device, so the write surface
this endpoint opens cannot be used to change the system — the same class as the
existing usage bridge, where machines already write `quota.<machine>.json`.

Steps 3 and 6 are the same call. **Enrollment and drift detection are one code
path run at different times**, which is why this design produces the missing
reader as a by-product rather than as a second feature.

## Probes and derivation

Every probe corresponds to a divergence measured on 2026-08-26, not an
anticipated one.

| Probe            | Measured                                  | Derives                                                                       |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `tcc_icloud`     | Air **denied**, mini **permitted**        | ralph plist runs `osascript run-ralph-gui.applescript` or `ralph.sh` directly |
| `executors`      | which of `claude` / `codex` / `agy` exist | `LOOP_EXECUTORS`                                                              |
| `brew_prefix`    | `/opt/homebrew` vs `/usr/local`           | `PATH`, absolute binary paths                                                 |
| `otlp_listening` | Air **false** until 2026-08-26            | whether `telemetry-sink` is satisfied                                         |
| `vault_path`     | vault present at the expected path        | `defaults.vault_path`, `LOOP_QUOTA_FILE`                                      |
| `accounts`       | `claude` plan, `gh` login                 | verification only — catches a company machine on a personal account           |

`otlp_listening` deserves its own note: its value was `false` for the Air's entire
life, and that single boolean is the whole of the first failure in Problem. Had
this probe existed, it would have been visible on day one.

Three substantive rules:

1. **Security defaults are declared, never probed.** The OTLP receiver binds
   `127.0.0.1` unless `hosts.yaml` declares otherwise (the mini binds wide because
   its Alloy also serves a Docker bridge). Whether a machine opens a port to the
   network must not be a side effect of what a probe happened to find.
2. **The `LOOP_MACHINE` / `LocalHostName` split disappears.** The mini's plist
   comment admits it is working around an inconsistency, and its absolute
   `LOOP_QUOTA_FILE` exists to route around the same one. Consistent generation
   removes the reason for both.
3. **Iteration parameters leave the plist.** `ralph.sh 1 10` in
   `ProgramArguments` is policy; it belongs in `config.yaml`.

## Error handling

| Situation                                | Behaviour                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A probe fails to run                     | Reported as `unknown`, never as a default. Derivation refuses to emit a file whose content depends on an unknown fact, and the page says which probe is missing. Guessing here is how `vault_path()` produced the second failure in Problem. |
| App unreachable from the device          | Enrollment stops with the tailnet prerequisite restated. Nothing partial is written.                                                                                                                                                         |
| Facts older than the drift window        | The host renders as stale, not as its last known good state. A stale record shown as current is the failure mode this whole design targets.                                                                                                  |
| A device claims a role it cannot satisfy | Enrolls, and the drift view shows it unsatisfied — e.g. `telemetry-sink` declared while `otlp_listening` is false. Enrollment records intent; the probe reports reality; the gap is the product.                                             |
| Re-enrolling an already-enrolled device  | Idempotent. Same facts and declaration produce identical files.                                                                                                                                                                              |
| Account mismatch                         | Enrollment proceeds, drift shows it. A company machine resolving `gh` to a personal account is surfaced, not silently accepted.                                                                                                              |

**Nothing is enabled.** `install.sh` places LaunchAgents disabled because
"starting an unsupervised executor is a separate, explicit act". Self-enrollment
inherits that exactly: it must never become a side effect of registering.

## Testing

`derive.ts` being pure is what makes this tractable, and it is load-bearing for
disaster recovery, so it carries the heaviest coverage:

- **Table-driven derivation**, with both live hosts as fixtures. The Air's facts
  must produce the `osascript` form; the mini's must produce the direct form.
- **Determinism**: identical inputs produce byte-identical output.
- **The declared-not-probed rule**: no probe combination yields a `0.0.0.0` bind;
  only a declaration does. Asserted against comment-stripped output — a naive
  grep counts the comment _explaining_ the loopback bind as a violation, which is
  how `tools/loop/tests/telemetry-sink.sh` first failed.
- **Unknown facts refuse**: a missing probe result raises rather than defaulting.
- **Drift**: declared-but-unsatisfied roles are detected; stale facts render
  stale rather than current.
- **No credentials in output**: no derived file contains a key-shaped string.

## Migration

1. `derive.ts` and the probes ship first, reproducing the two existing hosts'
   current files exactly. Byte-identical output against the committed plists is
   the gate — if it cannot reproduce them, either the generator is wrong or a
   committed file contains an accident worth naming.
2. Once reproduction passes, the per-host plists and `telemetry/*.config.alloy`
   become generated and leave the repo.
3. `hosts:` moves from `hosts.yaml` to `_system/usage/hosts.json`; `roles:` stays.
4. `install.sh` keeps working throughout. It is not removed by this design.

## Risks

- **The facts endpoint is reachable unauthenticated over the tailnet**, as every
  Observatory route already is — `/api/task-decision` is a POST that writes
  greenlight allowlists. This design adds a write surface to a door that is
  already open. It is bounded by accepting facts only, but the door itself is
  pre-existing and worth closing separately.
- **The app becomes a distribution point.** Bounded by serving a release
  artifact rather than a working tree: if the mini is down, the same artifact is
  on GitHub Releases.
- **`derive.ts` enters the disaster-recovery path.** Inputs plus generator equal
  outputs, so the generator must be restorable and correct. This is the reason
  for the coverage above.
- **WebMCP may not arrive.** It is an Origin Trial and Claude in Chrome is not on
  the implementation list. The design must stand fully without it; it does, since
  the page is the face and WebMCP would only add another.
