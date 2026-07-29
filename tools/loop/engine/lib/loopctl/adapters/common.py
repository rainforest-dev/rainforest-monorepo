from __future__ import annotations

from loopctl import signals
from loopctl.derive import TaskSignals
from loopctl.models import TaskRef


def task_signals_from_ref(project, task: TaskRef) -> TaskSignals:
    base = project.source_config.get("base", "main")
    branch = task.branch
    exists = bool(branch and signals.branch_exists(project.path, branch))
    ahead = signals.commits_ahead(project.path, branch, base) if exists else 0
    pr = signals.pr_for_branch(project.path, branch) if branch else None
    ci = signals.checks_conclusion(project.path, branch) if pr and pr["state"] == "open" else "none"
    return TaskSignals(
        claimed=task.claimed,
        branch_exists=exists,
        commits_ahead=ahead,
        pr_state=pr["state"] if pr else "none",
        ci=ci,
        released=False,
        blocked_reason=None,
        source_state=task.source_state,
        pr_url=pr["url"] if pr else None,
        pr_number=pr["number"] if pr else None,
    )
