from __future__ import annotations

import json

from loopctl import signals
from loopctl.adapters.common import task_signals_from_ref
from loopctl.errors import SourceUnreachable
from loopctl.models import TaskRef


def enumerate_tasks(project, run=None) -> list[TaskRef]:
    _run = run or signals.run
    label = project.source_config.get("label", "agent-ready")
    code, out = _run(
        ["gh", "issue", "list", "--label", label, "--state", "open",
         "--json", "number,title,assignees,labels",
         "--limit", "50"],
        project.path,
    )
    if code != 0:
        raise SourceUnreachable(f"gh issue list failed for {project.slug} (exit {code})")
    if not out:
        return []
    tasks = []
    for row in json.loads(out):
        num = str(row["number"])
        branch_template = project.source_config.get("branch_template", "issue-{id}")
        labels = [label.get("name", "") for label in row.get("labels", [])]
        priority = next((label for label in labels if label.upper() in {"P0", "P1", "P2", "P3"}), None)
        tasks.append(TaskRef(
            id=num,
            title=row.get("title", ""),
            branch=branch_template.format(id=num),
            claimed=bool(row.get("assignees")),
            priority=priority,
            metadata={"labels": labels},
        ))
    return tasks


def task_signals(project, task: TaskRef):
    return task_signals_from_ref(project, task)
