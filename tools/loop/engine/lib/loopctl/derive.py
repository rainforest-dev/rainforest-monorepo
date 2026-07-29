from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TaskSignals:
    claimed: bool = False
    branch_exists: bool = False
    commits_ahead: int = 0
    pr_state: str = "none"       # none | open | merged
    ci: str = "none"             # none | success | failure | pending
    released: bool = False
    blocked_reason: str | None = None
    source_state: str | None = None
    pr_url: str | None = None
    pr_number: int | None = None


def derive_task_state(sig: TaskSignals) -> str:
    # Ground truth wins: terminal signals override any sticky/prior state.
    if sig.released:
        return "released"
    if sig.pr_state == "merged":
        return "in-qa"
    if sig.blocked_reason or sig.ci == "failure":
        return "blocked"
    if sig.pr_state == "open":
        return "pr-ready"
    if sig.branch_exists and sig.commits_ahead > 0:
        return "in-progress"
    if sig.source_state:
        return sig.source_state
    if sig.claimed:
        return "queued"
    return "not-started"


_OPEN_STATES = {
    "queued",
    "in-progress",
    "pr-ready",
    "blocked",
    "needs-tuning",
    "spec-drafted",
    "split-drafted",
}


def derive_lifecycle(task_states, last_activity_ts, now_ts, dormant_days, archived):
    if archived:
        return "archived"
    has_open = any(s in _OPEN_STATES for s in task_states)
    if not task_states and last_activity_ts is None:
        return "onboarding"
    if has_open:
        return "active"
    silent = last_activity_ts is None or (now_ts - last_activity_ts) > dormant_days * 86400
    if silent:
        return "dormant"
    return "maintenance"
