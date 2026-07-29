# loop

The engine behind [Loop Observatory](../../apps/loop-observatory). Observatory is
the window; this is the machinery it watches.

Both halves live in this repo on purpose. They share invariants that are enforced
in two languages — `SAFE_ID` exists in both `engine/lib/loopctl/greenlight.py` and
`apps/loop-observatory/src/lib/greenlightOutbox.ts`, and the two must agree on
what a valid task id is. Keeping them apart meant a change to one could ship
without the other; the Python and JavaScript versions of that pattern had already
diverged in a way that let the stricter check sit on the producer and the looser
one on the trust boundary.

## What it does

The loop picks an authorised task, hands it to an executor (Claude, Codex, or
Antigravity), and stops at the project's `stop_at` — for company work, an open
PR, never a merge.

## Layout

    engine/     loopctl + ralph.sh + the contract. Every executing machine.
    relay/      Applies greenlight requests queued by Observatory.
    usage/      Telemetry publishing.
    launchd/    Schedules, one file per host per job.
    hosts.yaml  Which machine has which roles.
    install.sh  Reads hosts.yaml, installs this host's roles.

Organised by **role, not by host**. `engine` runs on every executing machine, so
a per-host tree would mean two copies of the same twelve Python modules — and on
2026-07-29 the two live installs were found already drifted from each other (one
was missing `greenlight.py` and three modules behind), which is the failure this
layout exists to prevent. Hostnames are also the least durable fact here: replace
a machine and every path changes, while "the company executor" does not.

Where a role genuinely needs a different implementation per host, that is a
filename, not a directory: `usage/run-hourly-air.sh` exists because launchd on
that machine is denied _read_ access to iCloud under TCC (writes are allowed), so
a plist pointing at the iCloud path fails before the script starts, and silently.

## Install

    tools/loop/install.sh --dry-run      # see what it would do
    tools/loop/install.sh                # install this host's roles
    tools/loop/install.sh --host=<name>  # install as a specific host

It places files and installs LaunchAgent plists **without loading or enabling
anything**. Starting an unsupervised executor is a deliberate act, never a side
effect of an install.

## Enabling

    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<label>.plist

To check what is currently held off:

    launchctl print-disabled gui/$(id -u) | grep rainforest

A label can be _explicitly disabled_, which is distinct from _not loaded_ — a
disabled job stays disabled across a bootstrap, so a job that appears installed
and silent is usually this rather than a broken plist.

## When a run runs out of turns

ralph does **not** resume. A turn-limited run stops without passing the task to
the next executor — exhausting turns means unfinished, not unable, and handing it
on would restart the same task on a budget that just proved insufficient, or open
a second PR for work the first executor had already committed.

The session survives with its full context, so it can be picked up by hand. Both
the log and the task card carry the exact command:

    cd '<project path>' && claude --resume <session id>

Verified against a real turn-limited session: it came back knowing the ticket,
the fix it had written, the PR it had opened, and that its next call had failed.

The note is written with `loopctl task-note`, not `loopctl set`. `set` requires a
state, and every state it accepts is an assertion — a run that exhausted its
turns may have committed, opened a PR, or produced nothing, so any state passed
would be a guess. `task-note` records the observation and asserts nothing.

Automatic resume is deliberately not implemented. It would need a guard for when
continuing is unsafe: the branch may have moved under the session, the task
definition may have changed, or the session may simply be stale — and continuing
with an outdated understanding can be worse than starting over.

## Tests

    tools/loop/tests/max-turns-no-fallback.sh

Runs the engine **in this tree** — not whatever is installed — against a
throwaway `LOOP_HOME`, vault, git repo and fake executors. The real install, its
registry and its allowlists are never read or written, and the allowlist the test
creates names a task that exists only inside its sandbox, so it authorises
nothing. Needs a loopctl venv, borrowed from an install: the venv is a build
artifact and is not in the repo.

It guards one behaviour that is expensive to get wrong: an executor that
exhausts its turn budget must **not** be handed on to the next executor.
Exhausting turns means unfinished, not unable — the next executor would start the
same task from zero on a budget that just proved insufficient, and if the first
one had already committed, it would open a second PR for the same fix. Verified
to fail when that guard is removed.

## Not in this repo

Four kinds of file live in the install directory but are deliberately absent
here. `install.sh` does not create, overwrite, or delete any of them.

|                                    |                                                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `greenlight/*.md`                  | **Authorisations** — which tasks an unsupervised agent may act on. Committing these would put authorisation into version history, and checking out an old commit would restore an old authorisation. |
| `config.yaml`                      | Names real repositories and absolute paths. Seed from `config.example.yaml`.                                                                                                                         |
| `registry.json`, `projects/*.json` | Execution state. Machine-local by design; the registry is the source of truth for what has run.                                                                                                      |
| `~/.config/loop/*`                 | Provider tokens. Referenced by path from the plists, never by value.                                                                                                                                 |

## The greenlight relay

Company work executes on a different machine from the one hosting Observatory,
so the button and the allowlist are not on the same host. Rather than let two
machines write one file, the allowlist has a **single writer**:

1. Observatory queues a request into an outbox
2. The owning machine pulls it (`relay/pull.sh`) and applies it through
   `loopctl greenlight-apply`
3. That machine writes an ack back; Observatory renders it on the card

Observatory has no code path that can create an ack. A verdict it cannot
establish leaves the request outstanding rather than inventing one — writing an
ack claims you observed an outcome. A transient lock collision returns `busy`,
which is retryable, so a sweep landing on a pull tick no longer kills an
authorisation permanently.

Authorisation is per task: reaching `stop_at` retires the entry from the
allowlist. Without that, a finished task stays the highest-ranked candidate
(`_IN_FLIGHT` includes `pr-ready`, ranked above `not-started`) and the next sweep
picks up work that is already done. Re-pressing Greenlight is how you send the
loop back to a PR that needs more work.
