"""Publish loop state to the shared vault and append an execution ledger.

The machine-local registry remains the execution source of truth. These small,
atomic mirrors are read by Loop Observatory and are safe when the vault is
temporarily unavailable: callers can continue working and retry on the next
state change.
"""
from __future__ import annotations

import json
import os
import tempfile
import time

from loopctl import host_machine
import urllib.error
import urllib.request
import re
from datetime import datetime, timezone
from pathlib import Path


class VaultPathUnset(RuntimeError):
    """No vault path was configured, and there is no safe default to guess."""



def vault_path() -> Path:
    """Where Observatory's overlays are published.

    The old fallback -- ``~/Repositories/rainforest-obsidian`` -- is a stale
    second clone on Air, not the live vault. Publishing there succeeds, writes a
    real entry, and is read by nothing, so a task can go PR-ready on Air while
    the board still shows it as not started. Ask the config before guessing.
    """
    configured = os.environ.get("LOOP_VAULT_PATH") or os.environ.get("VAULT_PATH")
    if configured:
        return Path(configured).expanduser()
    try:
        from loopctl.config import config_path, load_config

        configured = (load_config(config_path()).defaults or {}).get("vault_path")
    except Exception:
        # Publishing is best-effort by design; a malformed or missing config
        # must not take down the caller that was only mirroring state.
        configured = None
    if configured:
        return Path(configured).expanduser()
    # No guess. The fallback this replaces was the very clone the docstring
    # above warns about, so the warning and the behaviour contradicted each
    # other and the behaviour won: `loop-runs.rainforest-mini.jsonl` exists
    # *only* in that clone today, while `loop-runs.Angibles-MacBook-Air.jsonl`
    # exists only in the vault -- the run record split in half along a fallback
    # nobody chose. Measured 2026-08-26.
    #
    # Raising is the point. Every caller here is a best-effort mirror wrapped by
    # the loop, so an unconfigured host now fails visibly at the write instead
    # of succeeding against a directory no reader ever opens.
    raise VaultPathUnset(
        "vault_path is not configured: set LOOP_VAULT_PATH, VAULT_PATH, or "
        "defaults.vault_path in the loop config"
    )


def usage_path(name: str) -> Path:
    return vault_path() / "_system" / "usage" / name


def _atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def _iso(ts: int | float | None = None) -> str:
    value = time.time() if ts is None else ts
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def _notion_page_id(value: object) -> str | None:
    match = re.search(r"([0-9a-f]{32})", str(value).replace("-", ""), re.I)
    return match.group(1) if match else None


def _notion_status(token: str, page_id: str, state: str) -> str | None:
    """Map Loop's internal state to the canonical Work Items status.

    A page response exposes only its selected status, not the database's status
    options, so trying to discover options from ``GET /pages/{id}`` always
    returned an empty list. The enrolled Notion adapter targets the documented
    Work Items schema, whose status vocabulary is stable and explicit.
    """
    del token, page_id
    return {
        "queued": "Not started",
        "not-started": "Not started",
        "in-progress": "In progress / PR",
        "pr-ready": "In progress / PR",
        "in-qa": "In QA",
        "released": "Released",
        "blocked": "Blocked",
    }.get(state)


def _progress_task_id(task: dict) -> str:
    """Return the ID used by Observatory's task snapshot.

    Notion registry entries use the page URL as their source identity, while
    ``tasks.json`` exposes the human AG number. Prefer that numeric item ID so
    the progress overlay can actually join to the corresponding card.
    """
    item_id = (task.get("metadata") or {}).get("item_id")
    return str(item_id if item_id not in (None, "") else task.get("id", ""))


def _display_state(state: object) -> str | None:
    """Translate internal state names to Observatory's public vocabulary."""
    if state is None:
        return None
    value = str(state)
    return {
        "queued": "Queued",
        "not-started": "Queued",
        "needs-tuning": "Needs tuning",
        "spec-drafted": "Spec drafted",
        "split-drafted": "Split drafted",
        "in-progress": "In progress",
        "pr-ready": "PR ready",
        "in-qa": "Merged",
        "released": "Released",
        "blocked": "Blocked",
    }.get(value, value)


def _write_notion_status(task_id: object, state: str) -> str:
    token = os.environ.get("NOTION_TOKEN")
    page_id = _notion_page_id(task_id)
    if not token or not page_id:
        return "unavailable"
    name = _notion_status(token, page_id, state)
    if not name:
        return "pending"
    body = json.dumps({"properties": {"Status": {"status": {"name": name}}}}).encode()
    request = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(request, timeout=15):
            return "applied"
    except (OSError, urllib.error.URLError):
        return "pending"


def _engine_version() -> str | None:
    """The release this machine installed, or None if it cannot say.

    Written by `install.sh` from the bundle it unpacked. None when the engine was
    copied into place by hand -- a real arrangement here, and the reason this
    returns None rather than a guess: a version inferred from the files on disk
    would look exactly like a reported one, and the point of the field is to tell
    a host that is behind from a host that never said.
    """
    home = os.environ.get("LOOP_HOME") or (Path.home() / ".claude" / "loop")
    try:
        text = (Path(home) / ".engine-version").read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def publish_project_assignment(
    documents: list[dict],
    *,
    machine: str | None = None,
    now_ts: int | None = None,
) -> Path:
    """Publish which projects this host may run, so something other than this
    host can answer the question.

    The rule already exists and is not restated here: scan.py refuses a project
    whose ``machines`` list does not name this host (or say ``both``). What did
    not exist was any way to READ that from elsewhere. The list lives in
    ~/.claude/loop/projects/<slug>.json, which is machine-local, so Loop
    Observatory -- a container with the vault mounted and nothing else -- could
    show 33 tasks without being able to say which machine would pick any of them
    up. The two hosts' configs are disjoint: the mini enrols no company project
    at all, so even reading its own copy answers nothing about AG- work.

    A SLIM projection, deliberately. The scan document carries task titles and
    absolute paths, and this file lands in an iCloud vault that syncs to every
    device including phones. Slug, the machines list, and the task item_ids are
    what a reader needs to join task -> project -> host; the titles it already
    has from tasks.json.

    Per host, matching every other cross-machine fact here --
    loop-runs.<machine>.jsonl, quota.<machine>.json, ledger.<machine>.jsonl.
    A shared file would need both hosts to merge into it and would lose which
    of them last spoke.
    """
    from . import host_machine

    name = machine or host_machine()
    path = usage_path(f"projects.{name}.json")
    _atomic_json(
        path,
        {
            "machine": name,
            "published_at": _iso(now_ts),
            # Rides on the file every scan already publishes, rather than on the
            # enrollment probes: adding a probe bumps the protocol version and
            # every installed bundle then refuses to enrol until it is replaced.
            # This channel needs no coordination and updates hourly on its own.
            "engine_version": _engine_version(),
            "projects": [
                {
                    "slug": d.get("slug"),
                    "machines": d.get("machines") or [],
                    "lifecycle": d.get("lifecycle"),
                    "task_item_ids": [
                        item_id
                        for task in (d.get("tasks") or [])
                        # tasks.json keys personal work on this id, so it is the
                        # join column. A task without one cannot be matched and
                        # is left out rather than guessed at.
                        if (item_id := (task.get("metadata") or {}).get("item_id"))
                    ],
                }
                for d in documents
            ],
        },
    )
    return path


def publish_task_state(
    slug: str,
    task: dict,
    *,
    machine: str | None = None,
    now_ts: int | None = None,
) -> dict:
    """Merge one task into Observatory's shared progress overlay.

    The optional ``notion_writeback`` marker is deliberately explicit. A
    headless runner without a Notion token must not pretend the board changed;
    the pending marker gives a later authenticated sync something actionable.
    """
    now = now_ts or int(time.time())
    path = usage_path("tasks-progress.json")
    try:
        current = json.loads(path.read_text()) if path.exists() else {}
    except (OSError, json.JSONDecodeError):
        current = {}
    if not isinstance(current, dict):
        current = {}
    entries = current.get("tasks")
    if not isinstance(entries, dict):
        entries = {}
    task_id = _progress_task_id(task)
    entry = dict(entries.get(task_id) or {})
    notion_state = _write_notion_status(task.get("id"), str(task.get("state") or ""))
    entry.update(
        {
            "loop_status": _display_state(task.get("state")),
            "pr": task.get("pr"),
            "note": (task.get("overlay") or {}).get("note"),
            "project": slug,
            "machine": machine or host_machine(),
            "updated_ts": now,
            "updated_at": _iso(now),
            "notion_writeback": notion_state,
        }
    )
    entries[task_id] = entry
    current.update({"version": 1, "updated_at": _iso(now), "tasks": entries})
    _atomic_json(path, current)
    return entry


def _pct(value: str | float | None) -> float | None:
    """A quota percentage, or None for the '?' the sampler emits when unread."""
    if value is None or value == "" or value == "?":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quota_block(
    before_5h, after_5h, before_week, after_week, pool=None, attribution="upper-bound"
) -> dict | None:
    """Structured quota movement for one run, or None when nothing was sampled.

    The percentage-point deltas were previously only ever written into the free-text
    `note`, which made them unusable for anything but reading. They are the only
    measurement that answers "what did this run actually cost me", so they belong
    in fields.

    `attribution` says whether the delta is that answer or merely a bound on it.
    Two reads of a shared pool measure everything spending it, not this run:
    measured 2026-08-05, an AG-131 iteration costing $4.51 recorded 36pp, almost
    all of it the Claude Code session that was operating the loop, while an
    AG-383 iteration costing $16.34 recorded 1pp because nothing else was awake.
    The figures were not noisy, they were anti-correlated with spend, and the
    field carrying them said nothing about that. `exact` is reserved for a delta
    bracketed inside the run's own session -- what `codex_weekly_pp` does, and
    what Claude offers no equivalent of, since its quota is only ever published
    per account. The default is the weaker claim, because a caller that does not
    say how it measured has not earned the stronger one.
    """
    five_before, five_after = _pct(before_5h), _pct(after_5h)
    week_before, week_after = _pct(before_week), _pct(after_week)
    if all(v is None for v in (five_before, five_after, week_before, week_after)):
        return None
    # A window that rolled over mid-run reads lower afterwards. Usage inside a
    # window cannot fall, so a negative difference measures the reset, not the
    # run -- null is the honest answer. Measured 2026-07-31: an AG-130 run
    # recorded five_hour_delta_pp = -36.0.
    def delta(a, b):
        if a is None or b is None or b < a:
            return None
        return round(b - a, 4)
    return {
        # Which provider's allowance these numbers describe. Without it a row
        # cannot be read: a Codex run moves the Codex weekly pool and leaves
        # Claude's untouched, and the fields alone do not say which was sampled.
        "pool": pool,
        # Whether the deltas below are this run's cost or an upper bound on it.
        # A reader that ignores this field will read a shared-pool sample as a
        # cost, which is exactly how a $4.51 run came to be recorded as 36pp.
        "attribution": attribution,
        "five_hour_before": five_before,
        "five_hour_after": five_after,
        "five_hour_delta_pp": delta(five_before, five_after),
        "weekly_before": week_before,
        "weekly_after": week_after,
        "weekly_delta_pp": delta(week_before, week_after),
    }


def _last_run_id_for(machine: str, task: str) -> str | None:
    """The most recent run_id already recorded for this task on this machine.

    A fix round is not declared, it is simply the next run on a task that already
    has one, so the edge can be read off the ledger instead of being threaded
    through every caller. Reads the partition backwards and stops at the first
    match: the file is append-only and one line per run, so the last hit is the
    parent.

    Best-effort by the same rule as the rest of this module -- a missing or
    unreadable ledger means no parent, never a failed run.
    """
    path = usage_path(f"loop-runs.{machine}.jsonl")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return None
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get("task") == task:
            return row.get("run_id")
    return None


# The outcomes a run may end with. A closed set, because the previous free-text
# status could not be counted: the live ledger holds `completed`, `incomplete`,
# `needs-tuning` and `blocked`, which conflate a task outcome, an executor budget
# exhaustion, a tooling problem and an infrastructure failure. Those are four
# different answers to "was this worth the money" and only one of them is a
# failure of the work.
#
# `turns_exhausted` is deliberately not a failure: exhausting turns means
# unfinished, not unable, which is why ralph writes a note rather than asserting a
# state there. `rate_limited`, `preflight_failed`, `stale` and `reclaimed` are
# excluded from denominators entirely -- none of them got a fair attempt, and
# counting them makes a task class look unworthy of quota it was never given.
#
# `stale` and `reclaimed` come from Hermes Agent's task_runs vocabulary. A
# launchd-driven run can stop reporting without finishing or dying, and a human
# can cancel from Observatory; without words for those, such runs have no outcome
# at all and become invisible in every denominator rather than merely absent.
OUTCOMES = frozenset(
    {
        "reached_stop_at",
        "advanced",
        # The run did work, but not on the task this row names. Distinct from
        # `advanced`, which claims progress ON this task -- the reading that put
        # $9.25 and 12pp of a 5-hour window against a ticket that never ran.
        "misattributed",
        "turns_exhausted",
        "rate_limited",
        "preflight_failed",
        "executor_failed",
        "stale",
        "reclaimed",
    }
)

# What the free-text statuses in the existing ledger meant. `completed` is
# ambiguous on its own -- it says the executor returned cleanly, not that the task
# reached stop_at -- so it resolves by whether a PR was recorded.
_LEGACY_OUTCOMES = {
    "incomplete": "turns_exhausted",
    "blocked": "preflight_failed",
    "failed": "executor_failed",
    # A writeback problem, not a run outcome: the AG-132 row carrying it had
    # greenlit the task and done the work, with only the Notion write pending.
    # Reading it as a failure would put it in the denominator as one, which is
    # the exact distortion the closed set exists to prevent.
    "needs-tuning": "advanced",
}


def normalize_outcome(status: object, *, pr: object = None) -> str:
    """One of OUTCOMES, from either a new outcome or a legacy status string."""
    text = str(status or "").strip()
    if text in OUTCOMES:
        return text
    if text in _LEGACY_OUTCOMES:
        return _LEGACY_OUTCOMES[text]
    if text == "completed":
        return "reached_stop_at" if pr else "advanced"
    # Anything unrecognised. `advanced` rather than a failure, because inventing
    # a failure is the costlier error: it is indistinguishable from a measured
    # one downstream, and it makes a task class look unworthy of quota on the
    # strength of a string nobody defined.
    return "advanced"


def trailing_outcomes(machine: str, task: str, limit: int = 10) -> list[str]:
    """The most recent outcomes for this task on this machine, newest first.

    Read from the ledger rather than tracked separately: the rows are already the
    record of what happened, and a second counter would be a second thing to keep
    correct. An unreadable ledger yields nothing, which reads as "no history" --
    the same answer a first run gets, and the safe one, because the only thing
    that consumes this is a decision to *stop* trying.
    """
    path = usage_path(f"loop-runs.{machine}.jsonl")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, ValueError):
        return []
    found: list[str] = []
    for line in reversed(lines):
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get("task") != task:
            continue
        found.append(str(row.get("outcome") or normalize_outcome(row.get("status"), pr=row.get("pr"))))
        if len(found) >= limit:
            break
    return found


def append_run(
    *,
    project: str,
    task: str,
    executor: str,
    machine: str,
    status: str = "completed",
    note: str | None = None,
    started_ts: int | None = None,
    ended_ts: int | None = None,
    run_id: str | None = None,
    quota_5h_before: str | float | None = None,
    quota_5h_after: str | float | None = None,
    quota_week_before: str | float | None = None,
    quota_week_after: str | float | None = None,
    quota_pool: str | None = None,
    quota_attribution: str = "upper-bound",
    task_id: str | None = None,
    branch: str | None = None,
    pr: str | None = None,
) -> dict:
    """Append one structured iteration/retro record to a machine partition.

    The row carries the outcome and the edges, and deliberately not the
    measurements. Cost, output tokens, model and effort used to be threaded in
    here as optional keyword arguments, which is sparse by construction: a
    caller that does not know a value passes None and succeeds silently. Of the
    19 runs in the live ledger, `task_id` was present on 1 and `cost_usd` was
    0.00 on 11. Those four now arrive on telemetry stamped at process launch,
    carrying this same `run_id`, where they cannot be half-applied.

    What is left is the part telemetry cannot know. The CLI knows what it spent
    and which tools it called; it does not know whether that counted as
    advancing the task. That is the loop's judgement, and this file is where it
    lives -- small, portable, readable offline, and surviving the loss of Loki.

    The edges are the other half. Without them the ledger could say what a run
    cost but not what it was working on, where the work went, or which earlier
    run it was fixing -- so "did the second attempt close what the first missed"
    was unanswerable from own data, which is the whole question a fix round
    exists to answer. These are id fields on an existing row, which is what
    OpenLineage's parent facet and Pydantic AI's step persistence both reduce
    to; neither needs a graph store.

    `run_id` is passed in rather than derived here whenever the caller launched
    the run. It has to exist before the executor starts, because it is stamped
    into OTEL_RESOURCE_ATTRIBUTES and that is set once per process; a value
    invented at append time, after the executor has exited, could never appear
    on the telemetry it is supposed to join. The derivation below stays for
    callers that record a run they did not launch.
    """
    ended = ended_ts or int(time.time())
    record = {
        "run_id": run_id or f"{machine}-{ended}-{task}",
        # The human key (AG-298), alongside `task` which is the source URL. Every
        # other surface -- greenlight, notes, config -- speaks the human key, so a
        # ledger that only knows the URL cannot be joined against any of them.
        "task_id": task_id,
        "branch": branch,
        "pr": pr,
        # Derived rather than passed: the caller has no reason to know it, and a
        # fix round is simply the next run on a task that already has one. Reading
        # it here means every caller gets the edge for free.
        "parent_run_id": _last_run_id_for(machine, task),
        "project": project,
        "task": task,
        "executor": executor,
        "machine": machine,
        "started_at": _iso(started_ts or ended),
        "ended_at": _iso(ended),
        # Both, for one migration window. `outcome` is the closed vocabulary the
        # audit groups by; `status` is what the caller said, kept so a row written
        # by an older engine copy is still readable and so the mapping can be
        # checked rather than trusted.
        "outcome": normalize_outcome(status, pr=pr),
        "status": status,
        "note": note,
        "quota": _quota_block(
            quota_5h_before,
            quota_5h_after,
            quota_week_before,
            quota_week_after,
            quota_pool,
            quota_attribution,
        ),
    }
    path = usage_path(f"loop-runs.{machine}.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record
