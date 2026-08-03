"""Dependency edges between tasks, resolved from prose and recorded with their source.

The board is a DAG and always was. On 2026-08-01 it turned out to be
AG-297 -> AG-298 -> AG-299, AG-297 -> AG-300 -> AG-301, AG-130 -> AG-131 --
discovered by reading Notion tickets one at a time, after two execution plans had
already been written against the wrong order and one had routed a model at a task
blocked two levels deep.

The edges cannot be parsed. The prose that states them mostly does not name ids:
"Depends on customer-scoped state boundaries" is AG-298 by its *title*, "First:
AG-195/AG-196 shared foundation" is AG-297, and "Order 1 of 3" names nothing at
all. Resolving those needs judgement, and a parser that guesses would fail the
same silent way this file exists to prevent.

So the split is: the owner writes prose in the ticket, an agent resolves it to
ids here, the owner verifies. What makes that safe rather than a second source of
truth is `from` -- the source text verbatim, as it read when the edge was
resolved. When the ticket is rewritten the recorded text no longer matches, and
the resolution is visibly stale instead of quietly wrong.

Schema, one entry per task key:

    AG-298:
      depends_on: [AG-297]
      from: "First: AG-195/AG-196 shared foundation."
      resolved: 2026-08-03
      verified: 2026-08-03      # optional; absent means the owner has not confirmed
      note: "..."               # optional

Enforcement is deliberately asymmetric. A wrong edge in the "too many" direction
costs a wait; a missing edge costs work done in the wrong order, which is what
actually happened. So an unsatisfied edge blocks, an edge naming a task that is
not on the board blocks, and neither waits for `verified` -- an unverified edge is
still the best reading available, and enforcing it is the safe direction. `verified`
exists so `deps` can show what has not been looked at, not to gate execution.
"""

from __future__ import annotations

import datetime
from pathlib import Path

import yaml

from loopctl import registry

# A dependency is met once its work is reviewable. Waiting for `in-qa` would
# serialise the stacked-branch flow this board actually uses -- AG-298 was built
# on AG-297 while AG-297 sat in review, correctly.
SATISFIED_STATES = {"pr-ready", "in-qa", "released"}


def depends_path(slug: str) -> Path:
    """Where a project's resolved edges live. Convention, not configuration.

    Alongside `greenlight/`, and for the same reason: it is owner-facing state
    that happens to live in the install directory. Nothing in the repo writes it.
    """
    return registry.loop_home() / "depends" / f"{slug}.yaml"


def load(slug: str) -> dict:
    """Resolved edges for a project, or an empty mapping.

    A missing or malformed file means "no edges known", never an error. The file
    is hand-and-agent maintained, and a syntax slip in it must not stop the loop
    from running the tasks that have no edges at all.
    """
    path = depends_path(slug)
    try:
        loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError):
        return {}
    if not isinstance(loaded, dict):
        return {}
    # No key filtering. An earlier version skipped keys beginning with "_" so a
    # `_note:` block could sit at the top, and that silently dropped every task in
    # an obsidian-base project, whose keys are paths like
    # `_system/tasks/T-1.md`. Commentary belongs in a `#` comment.
    return {str(key): value for key, value in loaded.items() if isinstance(value, dict)}


def _task_key(task: dict) -> str:
    """The human key a person and this file both use, e.g. AG-298."""
    return str((task.get("metadata") or {}).get("item_id") or task.get("id") or "")


def blockers(task: dict, edges: dict, tasks: list[dict]) -> list[tuple[str, str]]:
    """Unmet dependencies for one task, as (key, why) pairs. Empty means free.

    `why` is a state name when the task is on the board, or "not on the board"
    when it is not. The second case blocks on purpose: it means the edge names
    something the scan cannot see -- closed, renamed, or simply not synced yet --
    and the loop's standing rule for state it cannot confirm is to stop. Clearing
    it is a one-line edit here, which `deps` will point at.
    """
    entry = edges.get(_task_key(task)) or {}
    wanted = entry.get("depends_on") or []
    if not isinstance(wanted, list):
        return []
    states = {_task_key(row): str(row.get("state") or "") for row in tasks}
    unmet = []
    for key in wanted:
        key = str(key)
        state = states.get(key)
        if state is None:
            unmet.append((key, "not on the board"))
        elif state not in SATISFIED_STATES:
            unmet.append((key, state))
    return unmet


def audit(slug: str, tasks: list[dict]) -> list[dict]:
    """One row per task on the board, describing its edges and their standing.

    Covers tasks with no entry too -- a task nobody has looked at is exactly what
    this needs to make visible, and it cannot be seen by listing the file alone.
    """
    edges = load(slug)
    today = datetime.date.today()
    rows = []
    for task in tasks:
        key = _task_key(task)
        if not key:
            continue
        entry = edges.get(key)
        unmet = blockers(task, edges, tasks)
        if entry is None:
            standing = "unaudited"
            age = None
        elif unmet:
            standing = "blocked"
            age = _age_days(entry.get("verified") or entry.get("resolved"), today)
        elif entry.get("verified"):
            standing = "clear"
            age = _age_days(entry.get("verified"), today)
        else:
            standing = "unverified"
            age = _age_days(entry.get("resolved"), today)
        rows.append(
            {
                "task": key,
                "state": task.get("state"),
                "standing": standing,
                "depends_on": list((entry or {}).get("depends_on") or []),
                "unmet": [f"{k} ({why})" for k, why in unmet],
                "from": (entry or {}).get("from"),
                # Stringified: YAML parses a bare 2026-08-03 into a date object,
                # which json.dumps refuses, and this row is printed as JSON.
                "resolved": _iso((entry or {}).get("resolved")),
                "verified": _iso((entry or {}).get("verified")),
                # Days since the edge was last looked at. There is no live check
                # that the ticket's prose still says what `from` records -- the
                # sync has no Notion token and cannot read page bodies -- so age
                # is the honest proxy, and it is shown rather than hidden.
                "age_days": age,
            }
        )
    return rows


def _iso(stamp) -> str | None:
    if stamp is None:
        return None
    if isinstance(stamp, datetime.datetime):
        return stamp.date().isoformat()
    if isinstance(stamp, datetime.date):
        return stamp.isoformat()
    return str(stamp)


def _age_days(stamp, today: datetime.date) -> int | None:
    if not stamp:
        return None
    if isinstance(stamp, datetime.datetime):
        stamp = stamp.date()
    if isinstance(stamp, datetime.date):
        return (today - stamp).days
    try:
        parsed = datetime.date.fromisoformat(str(stamp))
    except ValueError:
        return None
    return (today - parsed).days
