from __future__ import annotations

from pathlib import Path

import yaml

from loopctl.adapters.common import task_signals_from_ref
from loopctl.errors import SourceUnreachable
from loopctl.models import TaskRef
from loopctl.status import normalize_source_state, priority_key


def _frontmatter(path: Path) -> tuple[dict, str]:
    try:
        text = path.read_text()
    except OSError as exc:
        raise SourceUnreachable(f"task note is unreadable: {path}") from exc
    if not text.startswith("---\n"):
        return {}, text
    try:
        raw, body = text[4:].split("\n---", 1)
        data = yaml.safe_load(raw) or {}
    except (ValueError, yaml.YAMLError) as exc:
        raise SourceUnreachable(f"task note has invalid frontmatter: {path}") from exc
    return data if isinstance(data, dict) else {}, body.lstrip("\n")


def enumerate_tasks(project, run=None) -> list[TaskRef]:
    configured = project.source_config.get("tasks_dir", "_system/tasks")
    tasks_dir = Path(configured).expanduser()
    if not tasks_dir.is_absolute():
        tasks_dir = project.path / tasks_dir
    if not tasks_dir.exists():
        raise SourceUnreachable(f"Obsidian task folder is missing: {tasks_dir}")
    required_scope = project.source_config.get("scope", "personal")
    tasks = []
    for path in sorted(tasks_dir.rglob("*.md")):
        data, body = _frontmatter(path)
        if required_scope and data.get("scope") != required_scope:
            continue
        relative = path.relative_to(project.path).as_posix()
        claimed_by = data.get("claimed_by") or data.get("claimed")
        source_state = normalize_source_state(data.get("status"))
        tasks.append(
            TaskRef(
                id=relative,
                title=str(data.get("title") or path.stem.replace("-", " ")),
                branch=data.get("branch"),
                claimed=True,
                source_state=source_state,
                priority=data.get("priority"),
                metadata={
                    "task_id": data.get("task_id"),
                    "claimed_by": claimed_by or ("loop" if "(@loop)" in body else None),
                    "order": data.get("order", 999999),
                    # The estimate in force, carried so a run can be stamped with
                    # it at launch. Read afterwards it would be worthless: a note
                    # is re-pointed as it is refined, and an audit that looks it
                    # up later compares the actual against a number nobody was
                    # working to.
                    "points": data.get("points"),
                    "source": "obsidian-base",
                },
            )
        )
    return sorted(
        tasks,
        key=lambda task: (
            priority_key(task.priority),
            task.metadata.get("order", 999999),
            task.id,
        ),
    )


def task_signals(project, task: TaskRef):
    return task_signals_from_ref(project, task)
