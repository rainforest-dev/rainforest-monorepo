from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

import yaml

from loopctl import AGENT_STATES, PIPELINE_STATES, registry, signals
from loopctl import greenlight as greenlight_mod
from loopctl.adapters import github, notion, obsidian_base, vault
from loopctl.config import (
    POLICIES,
    SOURCES,
    Project,
    config_path,
    find_project,
    find_project_for_path,
    load_config,
)
from loopctl.derive import derive_lifecycle, derive_task_state
from loopctl.errors import SourceUnreachable
from loopctl.status import priority_key
from loopctl.writeback import append_run, publish_task_state

_ADAPTERS = {
    "github": github,
    "notion": notion,
    "obsidian-base": obsidian_base,
    "vault": vault,
}
_TERMINAL_GROUND_TRUTH = {"in-qa", "released"}
_IN_FLIGHT = {
    "in-progress",
    "pr-ready",
    "blocked",
    "needs-tuning",
    "spec-drafted",
    "split-drafted",
}


def _merge_task(task, sig, derived_state: str, prior_task: dict | None) -> dict:
    overlay = dict((prior_task or {}).get("overlay") or {})
    agent_state = overlay.get("agent_state")
    state = derived_state
    if derived_state not in _TERMINAL_GROUND_TRUTH:
        if agent_state in AGENT_STATES and derived_state in {"not-started", "queued"}:
            state = agent_state
        elif agent_state == "blocked" and derived_state not in {"in-progress", "pr-ready"}:
            state = "blocked"
        elif (
            agent_state == "pr-ready"
            and overlay.get("pr")
            and derived_state in {"not-started", "queued", "in-progress"}
        ):
            state = "pr-ready"
    output = {
        "id": task.id,
        "title": task.title,
        "state": state,
        "pr": sig.pr_url or overlay.get("pr"),
        "priority": task.priority,
        "metadata": task.metadata,
    }
    if overlay:
        output["overlay"] = overlay
    return output


def scan_project(
    project,
    now_ts: int,
    dormant_days: int,
    prior_state: dict | None = None,
) -> dict:
    if not project.path.exists():
        return {
            "slug": project.slug,
            "path": str(project.path),
            "lifecycle": (prior_state or {}).get("lifecycle", "onboarding"),
            "scanned_ts": now_ts,
            "stale": True,
            "missing": True,
            "tasks": (prior_state or {}).get("tasks", []),
        }
    adapter = _ADAPTERS.get(project.source)
    if adapter is None:
        return {
            "slug": project.slug,
            "path": str(project.path),
            "lifecycle": (prior_state or {}).get("lifecycle", "onboarding"),
            "scanned_ts": now_ts,
            "stale": True,
            "stale_reason": f"unsupported source adapter: {project.source}",
            "tasks": (prior_state or {}).get("tasks", []),
        }
    prior_tasks = {
        str(task.get("id")): task
        for task in (prior_state or {}).get("tasks", [])
        if task.get("id") is not None
    }
    tasks_out = []
    states = []
    try:
        tasks = adapter.enumerate_tasks(project)
        for task in tasks:
            sig = adapter.task_signals(project, task)
            prior_task = prior_tasks.get(str(task.id))
            overlay = (prior_task or {}).get("overlay") or {}
            if overlay.get("blocked_reason"):
                sig.blocked_reason = overlay["blocked_reason"]
            derived_state = derive_task_state(sig)
            merged = _merge_task(task, sig, derived_state, prior_task)
            states.append(merged["state"])
            tasks_out.append(merged)
    except SourceUnreachable as exc:
        return {
            "slug": project.slug,
            "path": str(project.path),
            "lifecycle": (prior_state or {}).get("lifecycle", "onboarding"),
            "scanned_ts": now_ts,
            "stale": True,
            "stale_reason": str(exc),
            "tasks": (prior_state or {}).get("tasks", []),
        }
    try:
        last_activity = signals.last_commit_ts(project.path, "HEAD")
    except SourceUnreachable as exc:
        return {
            "slug": project.slug,
            "path": str(project.path),
            "lifecycle": (prior_state or {}).get("lifecycle", "onboarding"),
            "scanned_ts": now_ts,
            "stale": True,
            "stale_reason": str(exc),
            "tasks": (prior_state or {}).get("tasks", []),
        }
    lifecycle = derive_lifecycle(states, last_activity, now_ts, dormant_days, archived=False)
    return {
        "slug": project.slug,
        "path": str(project.path),
        "source": project.source,
        "policy": project.policy,
        "stop_at": project.stop_at,
        "machines": project.machines,
        "lifecycle": lifecycle,
        "scanned_ts": now_ts,
        "stale": False,
        "tasks": tasks_out,
    }


def _now() -> int:
    import time

    return int(time.time())


def _load(path: Path):
    return load_config(path)


def _resolve_project(config, slug: str | None, cwd: Path | None = None) -> Project | None:
    if slug:
        return find_project(config, slug)
    return find_project_for_path(config, cwd or Path.cwd())


def _greenlight_text(project) -> str:
    if not project.greenlight:
        return ""
    path = Path(project.greenlight).expanduser()
    if not path.is_absolute():
        path = project.path / path
    try:
        return path.read_text()
    except OSError:
        return ""


def _greenlight_rank(task: dict, text: str) -> int | None:
    if not text:
        return None
    task_id = str(task.get("id", ""))
    title = str(task.get("title", ""))
    item_id = str((task.get("metadata") or {}).get("item_id") or "")
    for rank, line in enumerate(text.splitlines()):
        # Shared with greenlight.py, the module that writes this file. Both
        # sides must agree on what a bullet is: they once differed by a single
        # whitespace quantifier, so a hand-typed `-290` was a duplicate to the
        # writer and invisible to this reader.
        if not greenlight_mod.is_bullet(line):
            continue
        if "HOLD" in line.upper() or "PR ready:" in line:
            continue
        # Exact: the bullet must name this item_id and no other. This was a
        # digit-boundary regex plus a prefix-stripping comparison, from when one
        # Notion sync emitted both `290` and `AG-290` for the same task. Neither
        # was exact -- the regex matched `290` inside `- AG-290`, and stripping
        # the prefix made `EHT-290` and `AG-290` the same key. The ids are all
        # `AG-<n>` now, so both spellings can go.
        item_match = bool(item_id) and greenlight_mod.is_bullet_for(item_id, line)
        if (
            (task_id and task_id in line)
            or item_match
            or (title and title in line)
        ):
            return rank
    return None


def next_candidates(project, state: dict) -> list[dict]:
    if project.policy == "read-only" or state.get("stale"):
        return []
    lifecycle = state.get("lifecycle")
    if lifecycle in {"dormant", "archived"}:
        return []
    greenlight = _greenlight_text(project) if project.policy == "greenlit-only" else ""
    candidates = []
    for task in state.get("tasks", []):
        task_state = task.get("state")
        if task_state in _TERMINAL_GROUND_TRUTH:
            continue
        if lifecycle == "maintenance" and task_state not in _IN_FLIGHT:
            continue
        greenlight_rank = None
        if project.policy == "greenlit-only":
            greenlight_rank = _greenlight_rank(task, greenlight)
            if greenlight_rank is None:
                continue
        if task_state not in _IN_FLIGHT | {"queued", "not-started"}:
            continue
        candidates.append((task, greenlight_rank))
    state_order = {
        "in-progress": 0,
        "blocked": 1,
        "needs-tuning": 2,
        "spec-drafted": 3,
        "split-drafted": 4,
        "pr-ready": 5,
        "queued": 6,
        "not-started": 7,
    }
    return sorted(
        (task for task, _ in candidates),
        key=lambda task: (
            state_order.get(task.get("state"), 99),
            next(
                (
                    rank
                    for candidate, rank in candidates
                    if candidate is task and rank is not None
                ),
                999999,
            ),
            priority_key(task.get("priority")),
            str(task.get("id")),
        ),
    )


def _answers_to(item: dict, task_id: str) -> bool:
    """A task answers to either name it is known by.

    The registry keys tasks by `id`, a Notion URL. Every surface a human or an
    executor actually sees -- the board, the greenlight allowlist, `next`'s
    output, the contract -- uses `metadata.item_id` (`AG-290`). Accepting only
    the URL made `set` reject an id that `next` had just handed out.
    """
    if str(item.get("id")) == task_id:
        return True
    return str((item.get("metadata") or {}).get("item_id") or "") == task_id


def set_task_state(
    slug: str,
    task_id: str,
    state: str,
    *,
    pr: str | None = None,
    note: str | None = None,
    blocked_reason: str | None = None,
    now_ts: int | None = None,
) -> dict:
    document = registry.read_project_state(slug)
    if not document:
        raise ValueError(f"project '{slug}' has no scanned registry state")
    tasks = document.setdefault("tasks", [])
    matches = [item for item in tasks if _answers_to(item, str(task_id))]
    if not matches:
        known = ", ".join(
            sorted(
                filter(
                    None,
                    (
                        str((item.get("metadata") or {}).get("item_id") or "")
                        for item in tasks
                    ),
                )
            )
        )
        raise ValueError(
            f"task '{task_id}' is not present in project '{slug}'"
            + (f"; known items: {known}" if known else "")
        )
    if len(matches) > 1:
        raise ValueError(
            f"task '{task_id}' matches {len(matches)} tasks in project '{slug}'; "
            "use the Notion URL to disambiguate"
        )
    task = matches[0]
    overlay = dict(task.get("overlay") or {})
    overlay["agent_state"] = state
    overlay["updated_ts"] = now_ts or _now()
    if pr is not None:
        overlay["pr"] = pr
    if note is not None:
        overlay["note"] = note
    if blocked_reason is not None:
        overlay["blocked_reason"] = blocked_reason
    elif state != "blocked":
        overlay.pop("blocked_reason", None)
    task["overlay"] = overlay
    task["state"] = state
    if pr is not None:
        task["pr"] = pr
    registry.write_project_state(slug, document)
    # Registry writes stay authoritative; this mirror is best-effort so a
    # temporarily unavailable iCloud/local vault never blocks execution.
    try:
        publish_task_state(slug, task)
    except OSError:
        pass
    return task


def set_task_note(slug: str, task_id: str, note: str, *, now_ts: int | None = None) -> dict:
    """Record an observation against a task without claiming its state changed.

    `set_task_state` cannot be reused for this: it requires a state, and every
    state it would accept is an assertion. A run that exhausted its turn budget
    may have committed, opened a PR, or produced nothing at all -- asserting any
    of those would be a guess, and asserting the state it already had would still
    risk tripping the stop_at path that retires the greenlight.

    The note reaches Observatory through the same overlay `set_task_state`
    publishes, so it renders on the task card (TaskDetail's `loopNote`).
    """
    document = registry.read_project_state(slug)
    if not document:
        raise ValueError(f"project '{slug}' has no scanned registry state")
    matches = [item for item in document.get("tasks") or [] if _answers_to(item, str(task_id))]
    if not matches:
        raise ValueError(f"task '{task_id}' is not present in project '{slug}'")
    if len(matches) > 1:
        raise ValueError(
            f"task '{task_id}' matches {len(matches)} tasks in project '{slug}'; "
            "use the Notion URL to disambiguate"
        )
    task = matches[0]
    overlay = dict(task.get("overlay") or {})
    overlay["note"] = note
    overlay["updated_ts"] = now_ts or _now()
    task["overlay"] = overlay
    registry.write_project_state(slug, document)
    # Best-effort, exactly as in set_task_state: an unavailable vault must not
    # fail the caller that was only leaving a note.
    try:
        publish_task_state(slug, task)
    except OSError:
        pass
    return task


def _retire_greenlight_if_terminal(slug: str, task: dict) -> dict | None:
    """Withdraw the task's greenlight once the loop has reached the project's stop_at.

    The contract calls recording PR-ready the terminal action, but `next` did not
    agree: `_IN_FLIGHT` includes `pr-ready` and `state_order` ranks it above
    `not-started`, so a finished task stayed the top candidate and the next sweep
    would pick it up again. Retiring the authorisation is the half that belongs
    here -- the task is done, so there is nothing left to authorise. Re-pressing
    Greenlight is how the owner sends the loop back to a PR that needs more work,
    which keeps that path open instead of closing it.

    Returns None when this project has no allowlist to retire from.
    """
    try:
        project = find_project(load_config(config_path()), slug)
    except (OSError, ValueError, yaml.YAMLError):
        return None
    if project is None or project.policy != "greenlit-only" or not project.greenlight:
        return None
    if str(task.get("state") or "") != str(project.stop_at or ""):
        return None
    item_id = (task.get("metadata") or {}).get("item_id") or task.get("id")
    path = Path(project.greenlight).expanduser()
    if not path.is_absolute():
        path = project.path / path
    return greenlight_mod.retire(item_id, path)


def sweep_projects(config, machine: str) -> list[dict]:
    projects = []
    lifecycle_order = {"active": 0, "maintenance": 1, "onboarding": 2}
    for position, project in enumerate(config.projects):
        if project.policy == "read-only":
            continue
        if machine not in project.machines and "both" not in project.machines:
            continue
        state = registry.read_project_state(project.slug)
        if not state or state.get("stale"):
            continue
        candidates = next_candidates(project, state)
        if not candidates:
            continue
        lifecycle = state.get("lifecycle", "onboarding")
        if lifecycle not in lifecycle_order:
            continue
        projects.append(
            {
                "slug": project.slug,
                "path": str(project.path),
                "lifecycle": lifecycle,
                "policy": project.policy,
                "candidates": len(candidates),
                "_order": position,
            }
        )
    projects.sort(
        key=lambda item: (
            lifecycle_order[item["lifecycle"]],
            -item["candidates"],
            item["_order"],
        )
    )
    for item in projects:
        item.pop("_order", None)
    return projects


def _git_remote(path: Path) -> str:
    code = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=path,
        capture_output=True,
        text=True,
    )
    return code.stdout.strip() if code.returncode == 0 else ""


def _infer_enrollment(path: Path) -> tuple[str, str]:
    if (path / "_system" / "personal-tasks.base").exists():
        return "obsidian-base", "read-only"
    remote = _git_remote(path).lower()
    if "github.com" in remote:
        return "github", "greenlit-only"
    return "vault", "read-only"


def _write_yaml(path: Path, raw: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = yaml.safe_dump(raw, sort_keys=False, allow_unicode=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)


def enroll_project(
    path: Path,
    cfg_path: Path,
    *,
    slug: str | None,
    source: str | None,
    policy: str | None,
    machines: list[str],
    stop_at: str | None,
    greenlight: str | None,
) -> Project:
    repo = path.expanduser().resolve()
    if not repo.exists():
        raise ValueError(f"project path does not exist: {repo}")
    inferred_source, inferred_policy = _infer_enrollment(repo)
    selected_source = source or inferred_source
    selected_policy = policy or inferred_policy
    selected_slug = slug or repo.name
    raw = yaml.safe_load(cfg_path.read_text()) if cfg_path.exists() else {}
    raw = raw or {}
    raw.setdefault("defaults", {"policy": "greenlit-only", "dormant_days": 21})
    projects = raw.setdefault("projects", [])
    if any(entry.get("slug") == selected_slug for entry in projects):
        raise ValueError(f"project '{selected_slug}' is already enrolled")
    entry = {
        "slug": selected_slug,
        "path": str(repo),
        "source": selected_source,
        "policy": selected_policy,
        "machines": machines,
    }
    if stop_at:
        entry["stop_at"] = stop_at
    if greenlight:
        entry["greenlight"] = greenlight
    projects.append(entry)
    _write_yaml(cfg_path, raw)
    return find_project(load_config(cfg_path), selected_slug)


def _print_json(value) -> None:
    print(json.dumps(value, indent=2, sort_keys=True))


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="loopctl")
    sub = parser.add_subparsers(dest="cmd", required=True)
    default_config = str(config_path())

    scan_parser = sub.add_parser("scan")
    scan_parser.add_argument("slug", nargs="?")
    scan_parser.add_argument("--all", action="store_true")
    scan_parser.add_argument("--dry-run", action="store_true")
    scan_parser.add_argument("--config", default=default_config)

    show_parser = sub.add_parser("show")
    show_parser.add_argument("slug", nargs="?")

    next_parser = sub.add_parser("next")
    next_parser.add_argument("slug", nargs="?")
    next_parser.add_argument("--config", default=default_config)

    set_parser = sub.add_parser("set")
    set_parser.add_argument("slug")
    set_parser.add_argument("task")
    set_parser.add_argument("state", choices=PIPELINE_STATES + AGENT_STATES)
    set_parser.add_argument("--pr")
    set_parser.add_argument("--note")
    set_parser.add_argument("--blocked-reason")

    # Separate from `set` on purpose: this asserts nothing about the task's state.
    note_parser = sub.add_parser("task-note")
    note_parser.add_argument("slug")
    note_parser.add_argument("task")
    note_parser.add_argument("--note", required=True)

    run_parser = sub.add_parser("record-run")
    run_parser.add_argument("--project", required=True)
    run_parser.add_argument("--task", required=True)
    run_parser.add_argument("--executor", required=True)
    run_parser.add_argument("--machine", default=os.environ.get("LOOP_MACHINE") or os.uname().nodename)
    run_parser.add_argument("--cost", default="0")
    run_parser.add_argument("--status", default="completed")
    run_parser.add_argument("--note")
    run_parser.add_argument("--started-ts", type=int)
    run_parser.add_argument("--model")
    run_parser.add_argument("--effort")
    run_parser.add_argument("--tokens-out", type=int)
    run_parser.add_argument("--quota-5h-before")
    run_parser.add_argument("--quota-5h-after")
    run_parser.add_argument("--quota-week-before")
    run_parser.add_argument("--quota-week-after")

    sweep_parser = sub.add_parser("sweep")
    sweep_parser.add_argument("--machine", required=True)
    sweep_parser.add_argument("--config", default=default_config)

    greenlight_parser = sub.add_parser("greenlight-apply")
    greenlight_parser.add_argument("--project", required=True)
    greenlight_parser.add_argument("--request", required=True)
    greenlight_parser.add_argument("--dry-run", action="store_true")
    greenlight_parser.add_argument("--config", default=default_config)

    enroll_parser = sub.add_parser("enroll")
    enroll_parser.add_argument("path", nargs="?", default=os.getcwd())
    enroll_parser.add_argument("--slug")
    enroll_parser.add_argument("--source", choices=sorted(SOURCES))
    enroll_parser.add_argument("--policy", choices=sorted(POLICIES))
    enroll_parser.add_argument("--machine", action="append", dest="machines")
    enroll_parser.add_argument("--stop-at")
    enroll_parser.add_argument("--greenlight")
    enroll_parser.add_argument("--config", default=default_config)
    enroll_parser.add_argument("--dry-run", action="store_true")
    return parser


def main(argv=None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        if args.cmd == "show":
            if args.slug:
                _print_json(registry.read_project_state(args.slug) or {})
            else:
                index_path = registry.loop_home() / "registry.json"
                print(index_path.read_text() if index_path.exists() else "{}")
            return 0

        if args.cmd == "set":
            with registry.ProjectLock(args.slug):
                task = set_task_state(
                    args.slug,
                    args.task,
                    args.state,
                    pr=args.pr,
                    note=args.note,
                    blocked_reason=args.blocked_reason,
                )
                # Inside the same lock: a sweep must not observe a task at its
                # terminal state while its authorisation is still listed.
                retired = _retire_greenlight_if_terminal(args.slug, task)
            if retired is not None:
                task["greenlight"] = retired
            _print_json(task)
            return 0

        if args.cmd == "task-note":
            with registry.ProjectLock(args.slug):
                task = set_task_note(args.slug, args.task, args.note)
            _print_json(task)
            return 0

        if args.cmd == "record-run":
            _print_json(
                append_run(
                    project=args.project,
                    task=args.task,
                    executor=args.executor,
                    machine=args.machine,
                    cost_usd=args.cost,
                    status=args.status,
                    note=args.note,
                    started_ts=args.started_ts,
                    model=args.model,
                    effort=args.effort,
                    tokens_out=args.tokens_out,
                    quota_5h_before=args.quota_5h_before,
                    quota_5h_after=args.quota_5h_after,
                    quota_week_before=args.quota_week_before,
                    quota_week_after=args.quota_week_after,
                )
            )
            return 0

        if args.cmd == "greenlight-apply":
            config = _load(Path(args.config).expanduser())
            project = find_project(config, args.project)
            if project is None or not project.greenlight:
                _print_json(
                    {
                        "result": "failed",
                        "reason": f"project {args.project!r} is not enrolled with a greenlight file",
                        "line": None,
                    }
                )
                return 0
            try:
                with registry.ProjectLock(args.project):
                    result = greenlight_mod.apply_request_file(
                        Path(args.request).expanduser(),
                        Path(project.greenlight).expanduser(),
                        expected_slug=project.slug,
                        dry_run=args.dry_run,
                    )
            except registry.LockBusy:
                # `busy` is retryable, not terminal, and the distinction is the
                # whole point. A sweep holds the same ProjectLock for the
                # duration of scan_project (git, Notion and GitHub reads), so a
                # 300s pull tick landing inside one is routine. Reporting
                # `failed` made the pull job write an ack, and an ack is what
                # marks a request answered -- the authorisation then died
                # permanently, and re-pressing Greenlight could not revive it.
                # pull.sh treats `busy` like an unreadable verdict: log it,
                # write no ack, leave the request outstanding for the next tick.
                result = {
                    "result": "busy",
                    "reason": "project lock is busy; a sweep is running",
                    "line": None,
                }
            _print_json(result)
            return 0

        cfg_path = Path(args.config).expanduser()
        if args.cmd == "enroll":
            machines = args.machines or [os.environ.get("LOOP_MACHINE") or os.uname().nodename]
            if args.dry_run:
                inferred_source, inferred_policy = _infer_enrollment(Path(args.path).expanduser())
                _print_json(
                    {
                        "slug": args.slug or Path(args.path).expanduser().resolve().name,
                        "path": str(Path(args.path).expanduser().resolve()),
                        "source": args.source or inferred_source,
                        "policy": args.policy or inferred_policy,
                        "machines": machines,
                    }
                )
                return 0
            project = enroll_project(
                Path(args.path),
                cfg_path,
                slug=args.slug,
                source=args.source,
                policy=args.policy,
                machines=machines,
                stop_at=args.stop_at,
                greenlight=args.greenlight,
            )
            with registry.ProjectLock(project.slug):
                document = scan_project(
                    project,
                    now_ts=_now(),
                    dormant_days=load_config(cfg_path).defaults.get("dormant_days", 21),
                )
                if not document["stale"]:
                    registry.write_project_state(project.slug, document)
                    registry.update_index(project.slug, document["lifecycle"], document["scanned_ts"])
            _print_json(document)
            return 0

        config = _load(cfg_path)
        if args.cmd == "next":
            project = _resolve_project(config, args.slug)
            if not project:
                print("loopctl: current path is not enrolled" if not args.slug else f"loopctl: no enrolled project '{args.slug}'")
                return 1
            state = registry.read_project_state(project.slug)
            _print_json(next_candidates(project, state or {}))
            return 0

        if args.cmd == "sweep":
            _print_json(sweep_projects(config, args.machine))
            return 0

        dormant_days = config.defaults.get("dormant_days", 21)
        if args.all:
            targets = config.projects
        else:
            project = _resolve_project(config, args.slug)
            targets = [project] if project else []
            if not targets:
                print("loopctl: current path is not enrolled" if not args.slug else f"loopctl: no enrolled project '{args.slug}'")
                return 1
        now = _now()
        for project in targets:
            prior = registry.read_project_state(project.slug)
            if args.dry_run:
                document = scan_project(project, now, dormant_days, prior)
            else:
                with registry.ProjectLock(project.slug):
                    document = scan_project(project, now, dormant_days, prior)
                    if not document["stale"]:
                        registry.write_project_state(project.slug, document)
                        registry.update_index(project.slug, document["lifecycle"], now)
            _print_json(document)
        return 0
    except (ValueError, registry.LockBusy) as exc:
        print(f"loopctl: {exc}")
        return 2
