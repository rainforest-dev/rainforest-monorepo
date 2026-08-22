from __future__ import annotations

import json
from pathlib import Path

import yaml

from loopctl.adapters.common import task_signals_from_ref
from loopctl.errors import SourceUnreachable
from loopctl.models import TaskRef
from loopctl.status import normalize_source_state, priority_key


def _configured_path(project, key: str, default: str) -> Path:
    configured = project.source_config.get(key)
    path = Path(configured or default).expanduser()
    return path if path.is_absolute() else project.path / path


def _read_json(path: Path, *, required: bool) -> dict:
    if not path.exists():
        if required:
            raise SourceUnreachable(f"local Notion cache is missing: {path}")
        return {}
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise SourceUnreachable(f"local Notion cache is unreadable: {path}") from exc
    if not isinstance(data, dict):
        raise SourceUnreachable(f"local Notion cache must contain an object: {path}")
    return data


def _branches_by_ref(task_map: dict) -> dict[str, str]:
    reverse = {}
    for branch, value in task_map.items():
        if isinstance(value, str):
            task_ref = value
        elif isinstance(value, dict):
            task_ref = value.get("task_ref") or value.get("url") or value.get("notion_ref")
        else:
            task_ref = None
        if task_ref:
            reverse[str(task_ref)] = str(branch)
    return reverse


def _task_items_from_notes(project) -> dict:
    configured = project.source_config.get("tasks_dir", "_system/tasks")
    tasks_dir = Path(configured).expanduser()
    if not tasks_dir.is_absolute():
        tasks_dir = project.path / tasks_dir
    if not tasks_dir.exists():
        return {}
    items = {}
    for path in sorted(tasks_dir.glob("*.md")):
        try:
            text = path.read_text()
            if not text.startswith("---\n"):
                continue
            raw, body = text[4:].split("\n---", 1)
            data = yaml.safe_load(raw) or {}
        except (OSError, ValueError, yaml.YAMLError):
            continue
        if data.get("task_source") != "notion" or not data.get("task_ref"):
            continue
        heading = next(
            (line[2:].strip() for line in body.splitlines() if line.startswith("# ")),
            path.stem,
        )
        items[str(data["task_ref"])] = {
            "item_id": data.get("task_id"),
            "task_name": heading,
            "status": data.get("status"),
            "priority": data.get("priority"),
            "component": data.get("component"),
            "assignee": data.get("assignee"),
        }
    return items


def enumerate_tasks(project, run=None) -> list[TaskRef]:
    tasks_path = _configured_path(project, "tasks_path", "_system/usage/notion-tasks.json")
    map_path = _configured_path(project, "task_map_path", "_system/usage/task-map.json")
    cached = _read_json(tasks_path, required=False)
    if not cached:
        cached = _task_items_from_notes(project)
    if not cached:
        raise SourceUnreachable(
            f"no local Notion cache or task-note mirror was found for {project.slug}"
        )
    branches = _branches_by_ref(_read_json(map_path, required=False))
    assignee = str(project.source_config.get("assignee", "")).strip().lower()
    components = {
        str(component).strip().lower()
        for component in project.source_config.get("components", [])
    }
    tasks = []
    for task_ref, item in cached.items():
        if not isinstance(item, dict):
            continue
        cached_assignee = str(item.get("assignee", "")).strip().lower()
        if assignee and cached_assignee and assignee not in cached_assignee:
            continue
        component = str(item.get("component", "")).strip().lower()
        if components and component not in components:
            continue
        source_state = normalize_source_state(item.get("status"))
        tasks.append(
            TaskRef(
                id=str(task_ref),
                title=str(item.get("task_name") or item.get("title") or item.get("item_id") or task_ref),
                branch=branches.get(str(task_ref)),
                claimed=True,
                source_state=source_state,
                priority=item.get("priority"),
                metadata={
                    "item_id": item.get("item_id"),
                    "component": item.get("component"),
                    # See the same field in the obsidian_base adapter: the
                    # estimate has to be stamped at launch to mean anything.
                    "points": item.get("points"),
                    "source": "notion",
                },
            )
        )
    return sorted(tasks, key=lambda task: (priority_key(task.priority), task.title.lower(), task.id))


def task_signals(project, task: TaskRef):
    return task_signals_from_ref(project, task)
