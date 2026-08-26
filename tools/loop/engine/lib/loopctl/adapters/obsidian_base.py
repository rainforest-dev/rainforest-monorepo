from __future__ import annotations

import re
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


_H1 = re.compile(r"^#\s+(.+)$", re.M)


def _task_title(data: dict, body: str, path: Path) -> str:
    """The note's title, from whichever place its writer put it.

    Only `title:` was read, and nothing writes it. Measured 2026-08-26 over 43
    live notes: 12 carry `name:` (new_task.py writes that), 31 carry the title
    only as the body's `# ` heading (the Notion sync writes that), and none
    carry `title:` -- so every title in the loop was the fallback, a filename
    stem with its hyphens turned to spaces. Every Notion task displayed as
    `AG 106`.

    Widening this cannot widen an authorisation: `_greenlight_rank` requires the
    *task's* title to appear inside an allowlist bullet, so a longer real title
    matches strictly fewer lines than a short slug did.
    """
    for value in (data.get("title"), data.get("name")):
        if isinstance(value, str) and value.strip():
            return value.strip()
    heading = _H1.search(body or "")
    if heading:
        return heading.group(1).strip()
    return path.stem.replace("-", " ")


def _task_path_id(path: Path, project_path: Path, tasks_dir: Path) -> str:
    """The note's id: its path relative to whichever root contains it.

    `tasks_dir` is allowed to be absolute -- that is how a code repo points at
    task notes kept in the vault, which is the whole arrangement for a work
    project whose decision record lives in Obsidian while its code does not.
    But the id was always taken relative to `project.path`, which only contains
    the notes when the project *is* the vault. Pointing a repo at the vault
    therefore raised `ValueError: ... is not in the subpath of ...` out of
    `enumerate_tasks`, one level below any `SourceUnreachable` handling, so the
    scan died outright rather than reporting a bad source.

    Preferring `project.path` keeps every existing id byte-identical -- the
    registry and the ledger are keyed on it -- and falls back to `tasks_dir`
    only for notes that live outside the repo, where no id existed before.
    """
    for root in (project_path, tasks_dir):
        try:
            return path.relative_to(root).as_posix()
        except ValueError:
            continue
    return path.as_posix()


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
        relative = _task_path_id(path, project.path, tasks_dir)
        claimed_by = data.get("claimed_by") or data.get("claimed")
        source_state = normalize_source_state(data.get("status"))
        tasks.append(
            TaskRef(
                id=relative,
                title=_task_title(data, body, path),
                branch=data.get("branch"),
                claimed=True,
                source_state=source_state,
                priority=data.get("priority"),
                metadata={
                    "task_id": data.get("task_id"),
                    # The id an allowlist bullet may name. `_greenlight_rank` falls
                    # back to substring-matching `task_id` -- which for this adapter
                    # is the note's *path* -- when `item_id` is absent, and a path
                    # cannot be spelled in the SAFE_ID grammar the greenlight outbox
                    # emits (`[A-Za-z]{0,8}-?\d{1,20}`). So an outbox request could
                    # never authorise a personal task at all, and a hand-written
                    # bullet authorised it by substring: with `- 106` on the list,
                    # tasks numbered 1, 6 and 10 matched too. The frontmatter
                    # `task_id` is already in that grammar (`T-20260823121007` from
                    # new_task.py), so carrying it here gives greenlight an exact
                    # key and closes both holes.
                    "item_id": data.get("task_id"),
                    "claimed_by": claimed_by or ("loop" if "(@loop)" in body else None),
                    # `or`, not a default argument: the note template ships `order:`
                    # with no value, which YAML loads as None rather than leaving
                    # the key absent, so the default never fired and the sort below
                    # compared None against the ints of notes that do set an order.
                    # Found 2026-08-21, the first time personal notes were visible
                    # to a scan at all -- five of twelve had an empty `order:`.
                    "order": data.get("order") or 999999,
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
