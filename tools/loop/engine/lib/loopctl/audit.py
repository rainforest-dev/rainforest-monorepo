"""What a task actually cost, summed from the rows the runner wrote.

The ledger records one row per iteration. A task that took four rounds is four
rows, on possibly two machines, with two quota pools -- so "what did AG-290 cost"
has never had an answer anyone could read off, and the two attempts at it in this
session were both done by eye.

Deliberately arithmetic over the ledger and nothing else. It computes no estimate
and fetches nothing: every number here is a sum or a count of values some run
recorded, so a wrong total means a wrong row, which is a bug with a location.

Two things are reported as absent rather than zero, because zero is a claim:

  * `points`, when no row carried one. Cost per point is then unanswerable, and
    saying so beats dividing by a number nobody supplied.
  * quota deltas whose attribution is `upper-bound`. Those are a ceiling on this
    run's spend, not a measurement of it -- a shared pool moves for reasons that
    have nothing to do with the loop -- so they are summed separately and
    labelled, never folded into a figure that reads as measured.
"""

from __future__ import annotations

import json
from collections.abc import Iterable

from loopctl.writeback import usage_path


def _rows_for(task: str, machines: Iterable[str]) -> list[dict]:
    out: list[dict] = []
    for machine in machines:
        path = usage_path(f"loop-runs.{machine}.jsonl")
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for line in lines:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                row = json.loads(line)
            except ValueError:
                # One unreadable row must not hide the rest of the history.
                continue
            if task in (row.get("task_id"), row.get("task")):
                out.append(row)
    return sorted(out, key=lambda r: str(r.get("started_at") or ""))


def _seconds(row: dict) -> int | None:
    """Wall time for one run, or None when the row cannot say.

    Rows written before 2026-09-03 have started_at == ended_at by construction:
    ralph had the epoch and never passed it, so every one of them claims zero.
    Zero is indistinguishable from a genuinely instant failure, so those are
    excluded from the total and counted separately instead of being summed as 0.
    """
    from datetime import datetime

    def parse(value: object) -> datetime | None:
        text = str(value or "")
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    start, end = parse(row.get("started_at")), parse(row.get("ended_at"))
    if start is None or end is None:
        return None
    delta = int((end - start).total_seconds())
    return None if delta <= 0 else delta


def _delta(row: dict, before: str, after: str) -> float | None:
    quota = row.get("quota") or {}
    a, b = quota.get(before), quota.get(after)
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return None
    return round(float(b) - float(a), 2)


def audit_task(task: str, machines: Iterable[str]) -> dict:
    """Everything the ledger knows about one task, summed."""
    rows = _rows_for(task, machines)
    if not rows:
        return {"task": task, "runs": 0, "reason": "no run has ever recorded this task"}

    outcomes: dict[str, int] = {}
    for row in rows:
        key = str(row.get("outcome") or row.get("status") or "unknown")
        outcomes[key] = outcomes.get(key, 0) + 1

    timed = [s for s in (_seconds(r) for r in rows) if s is not None]
    points = next(
        (r["points"] for r in reversed(rows) if isinstance(r.get("points"), int)), None
    )

    # Per pool, and per attribution, because adding an exact delta to a bracketed
    # one produces a number with no meaning either reading would support.
    spend: dict[str, dict[str, float]] = {}
    for row in rows:
        quota = row.get("quota") or {}
        pool = str(quota.get("pool") or "unknown")
        attribution = str(quota.get("attribution") or "upper-bound")
        bucket = spend.setdefault(f"{pool}/{attribution}", {"five_hour_pp": 0.0, "weekly_pp": 0.0})
        for field, keys in (
            ("five_hour_pp", ("five_hour_before", "five_hour_after")),
            ("weekly_pp", ("weekly_before", "weekly_after")),
        ):
            value = _delta(row, *keys)
            if value is not None:
                bucket[field] = round(bucket[field] + value, 2)

    prs = [r["pr"] for r in rows if r.get("pr")]
    return {
        "task": task,
        "runs": len(rows),
        "machines": sorted({str(r.get("machine")) for r in rows if r.get("machine")}),
        "executors": sorted({str(r.get("executor")) for r in rows if r.get("executor")}),
        "outcomes": outcomes,
        "first_started_at": rows[0].get("started_at"),
        "last_ended_at": rows[-1].get("ended_at"),
        # Split, not averaged over all runs: a total that silently excludes rows
        # would read as the whole story.
        "wall_seconds": sum(timed) if timed else None,
        "runs_without_duration": len(rows) - len(timed),
        "points": points,
        "quota": spend,
        "prs": prs,
        # The question the ledger cannot answer on its own, said plainly rather
        # than left for a reader to notice is missing.
        "cost_per_point": None
        if points in (None, 0) or not timed
        else {"wall_seconds_per_point": round(sum(timed) / points, 1)},
    }
