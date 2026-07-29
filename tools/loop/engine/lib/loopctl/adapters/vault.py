from __future__ import annotations

import re
from pathlib import Path

from loopctl.adapters.common import task_signals_from_ref
from loopctl.errors import SourceUnreachable
from loopctl.models import TaskRef
from loopctl.status import priority_key


_HEADING = re.compile(r"^#{1,6}\s+.*?\b(P[0-3])\b", re.IGNORECASE)
_TASK = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$")


def enumerate_tasks(project, run=None) -> list[TaskRef]:
    configured = project.source_config.get("queue_path", "_system/Task-Queue.md")
    queue_path = Path(configured).expanduser()
    if not queue_path.is_absolute():
        queue_path = project.path / queue_path
    if not queue_path.exists():
        raise SourceUnreachable(f"vault task queue is missing: {queue_path}")
    priority = None
    tasks = []
    try:
        lines = queue_path.read_text().splitlines()
    except OSError as exc:
        raise SourceUnreachable(f"vault task queue is unreadable: {queue_path}") from exc
    for line_number, line in enumerate(lines, start=1):
        heading = _HEADING.match(line)
        if heading:
            priority = heading.group(1).upper()
            continue
        match = _TASK.match(line)
        if not match or match.group(1).lower() == "x":
            continue
        raw = match.group(2).strip()
        claimed = "(@loop)" in raw
        title = raw.replace("(@loop)", "").strip()
        tasks.append(
            TaskRef(
                id=f"{queue_path.relative_to(project.path).as_posix()}:{line_number}",
                title=title,
                claimed=True,
                source_state="queued",
                priority=priority,
                metadata={
                    "claimed_by": "loop" if claimed else None,
                    "line": line_number,
                    "source": "vault",
                },
            )
        )
    return sorted(tasks, key=lambda task: (priority_key(task.priority), task.metadata["line"]))


def task_signals(project, task: TaskRef):
    return task_signals_from_ref(project, task)
