from __future__ import annotations

import argparse
import contextlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

import yaml

from loopctl import AGENT_STATES, PIPELINE_STATES, host_machine, registry, signals
from loopctl.audit import audit_task
from loopctl.doctor import report as doctor_report
from loopctl import depends as depends_mod
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
from loopctl.writeback import (
    append_run,
    publish_project_assignment,
    publish_task_state,
)

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
        # Whether the task has a branch decides, on a rate limit, between trying
        # the next executor and waiting for this one. It was already on the
        # TaskRef and simply never reached the caller, so ralph had no way to
        # tell a task that had not started from one it would be restarting.
        "branch": task.branch,
        "priority": task.priority,
        "metadata": task.metadata,
    }
    if overlay:
        output["overlay"] = overlay
    return output


@contextlib.contextmanager
def _gh_account(project):
    """Pin gh to the project's account for the duration of a scan.

    `gh auth switch` is global, so whichever account was last selected anywhere
    leaks into the loop. Measured 2026-07-30: merging a PR on the personal
    monorepo left gh on the personal login, and the next company iteration read
    the registry as stale because `gh pr list` could not see the repo -- the
    executor then correctly refused to work, and the iteration was wasted.

    A token is minted per project instead of trusting ambient state. A project
    that names no account, or an account gh cannot mint a token for, falls
    through to the ambient login unchanged.
    """
    account = getattr(project, "account", None)
    if not account:
        yield
        return
    try:
        proc = subprocess.run(
            ["gh", "auth", "token", "-u", account],
            capture_output=True,
            text=True,
            timeout=10,
        )
        token = proc.stdout.strip() if proc.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        token = ""
    if not token:
        yield
        return
    prior = os.environ.get("GH_TOKEN")
    os.environ["GH_TOKEN"] = token
    try:
        yield
    finally:
        if prior is None:
            os.environ.pop("GH_TOKEN", None)
        else:
            os.environ["GH_TOKEN"] = prior


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
        with _gh_account(project):
            tasks = adapter.enumerate_tasks(project)
            signal_rows = [(task, adapter.task_signals(project, task)) for task in tasks]
        for task, sig in signal_rows:
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
        "account": project.account,
        "machines": project.machines,
        "lifecycle": lifecycle,
        "scanned_ts": now_ts,
        "stale": False,
        "tasks": tasks_out,
    }


def _now() -> int:
    import time

    return int(time.time())


def _host_machine() -> str:
    """The one name this host's telemetry is filed under. See loopctl.host_machine."""
    return host_machine()


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


#: Shortest title that may authorise a task on its own, on a bullet naming no id.
MIN_TITLE_MATCH = 12


def _greenlight_rank(task: dict, text: str) -> int | None:
    if not text:
        return None
    task_id = str(task.get("id", ""))
    title = str(task.get("title", ""))
    item_id = str((task.get("metadata") or {}).get("item_id") or "")
    # Only `## Cleared` authorises, and only outside comments. Scanning the whole
    # file made every bulleted line in `## How to use` and `## Notes` an
    # authorisation, along with the commented-out worked example under Cleared
    # itself. See greenlight.cleared_section.
    for rank, line in enumerate(greenlight_mod.cleared_section(text).splitlines()):
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
        # `task_id` is matched exactly, like `item_id`, and no longer as a
        # substring. `x in line` authorised far more than it named: with
        # `- 106 -- [FE] dashboard timezone` on the list, enumerating ids 1..999
        # against the *empty* company allowlist returned six matches --
        # 1, 3, 6, 10, 31, 106 -- because each is a substring of some bullet.
        # Nothing was exploitable only because the live ids had all migrated to
        # `AG-<n>`, which is a property of today's data rather than of this
        # check. Title is left as a substring deliberately: a human writing a
        # bullet is expected to paraphrase a title, never an id.
        id_match = bool(task_id) and greenlight_mod.is_bullet_for(task_id, line)
        # A bullet that names an id is decided by that id alone.
        #
        # Title-as-substring stays for bullets an owner typed without one -- they
        # paraphrase a title, never an id, and that is the case it was written
        # for. But applied to a bullet that DOES name a task, it authorised
        # whatever else happened to share a word with it: a task titled `Setup`
        # matched every bullet containing "Setup", including bullets clearing a
        # different id entirely. The id is the specific thing on such a line; the
        # prose beside it is context for the reader, not a second key.
        #
        # MIN_TITLE_MATCH is calibrated against nothing but judgement: it is the
        # length below which a title is too generic to authorise on. Raise it if
        # a short title ever slips through; lower it only with an example.
        title_match = (
            bool(title)
            and len(title) >= MIN_TITLE_MATCH
            and greenlight_mod.bullet_id(line) is None
            and title in line
        )
        if id_match or item_match or title_match:
            return rank
    return None


def next_candidates(project, state: dict) -> list[dict]:
    if project.policy == "read-only" or state.get("stale"):
        return []
    # Assigned to this machine, checked here rather than only in the sweep.
    #
    # `sweep_projects` filtered on `machines:`; `next <slug>` did not, and `next`
    # is the path ralph actually takes. So the assignment held only for the sweep
    # -- a project listing one machine would hand its queue to the other as soon
    # as anything asked for it by name. Checking inside the candidate function
    # means every caller gets it, which is why the two disagreed in the first
    # place.
    machines = list(getattr(project, "machines", None) or [])
    if machines and "both" not in machines and host_machine() not in machines:
        return []
    lifecycle = state.get("lifecycle")
    if lifecycle in {"dormant", "archived"}:
        return []
    greenlight = _greenlight_text(project) if project.policy == "greenlit-only" else ""
    edges = depends_mod.load(project.slug)
    tasks = state.get("tasks", [])
    candidates = []
    for task in tasks:
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
        # An unmet dependency drops the task from the queue. The board is a DAG
        # and the edges were invisible to this function until now: on 2026-08-01
        # a model was routed at a task blocked two levels deep, because the order
        # lived only in ticket prose. Work already in flight is exempt -- a task
        # that has a branch open is past the point where ordering helps, and
        # stopping it mid-way would strand it.
        if task_state not in _IN_FLIGHT and depends_mod.blockers(task, edges, tasks):
            continue
        # Another machine's claim is honoured here, not only in prose.
        # contract.md tells the executor "if another owner/machine already holds
        # the claim, choose another candidate" -- but nothing enforced it, so the
        # rule held exactly as long as the executor read and obeyed that line.
        # Six notes carry a claim today; the second machine would have offered
        # every one of them.
        claimed = str((task.get("metadata") or {}).get("claimed_by") or "").strip()
        if claimed and claimed != f"loop-{host_machine()}":
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
    # temporarily unavailable iCloud/local vault never blocks execution. Not
    # silent, though: on 2026-07-30 the executor took AG-132 to pr-ready, the
    # registry recorded it, `loopctl set` reported success -- and Loop
    # Observatory went on showing "Queued" for an hour, because the sandbox had
    # denied the mirror write and the failure was swallowed here.
    try:
        publish_task_state(slug, task, source=_project_source(slug))
    except OSError as exc:
        task["mirror_error"] = f"{type(exc).__name__}: {exc}"
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
    # Best-effort and reported, exactly as in set_task_state.
    try:
        publish_task_state(slug, task, source=_project_source(slug))
    except OSError as exc:
        task["mirror_error"] = f"{type(exc).__name__}: {exc}"
    return task


def _project_source(slug: str) -> str | None:
    """The configured source for a slug, or None when it cannot be determined.

    Resolved here rather than passed in: neither `set_task_state` nor
    `set_task_note` has the project in scope, and giving them one would thread it
    through for a single field. None on any failure, which `publish_task_state`
    treats as "do not write to Notion" -- the safe reading, because not knowing
    where a task came from is not a reason to write it somewhere.
    """
    try:
        project = find_project(load_config(config_path()), slug)
    except (OSError, ValueError, yaml.YAMLError):
        return None
    return getattr(project, "source", None) if project else None


def _ledger_machines() -> list[str]:
    """Every machine that has a run ledger in the vault, newest name order aside.

    Discovered from the files rather than from hosts.yaml: a partition can exist
    for a machine no longer declared -- `loop-runs.Angibles-MacBook-Air.jsonl`
    would be one -- and a total that silently skipped it would be short in
    exactly the case where somebody is asking why the numbers look wrong.
    """
    from loopctl.writeback import usage_path

    # usage_path("").parent is <vault>/_system, one level ABOVE the usage dir --
    # an easy off-by-one that silently finds nothing, which is why this asks for
    # the parent of a named file instead.
    try:
        names = sorted(p.name for p in usage_path("loop-runs").parent.iterdir())
    except OSError:
        return []
    out = []
    for name in names:
        if name.startswith("loop-runs.") and name.endswith(".jsonl"):
            out.append(name[len("loop-runs.") : -len(".jsonl")])
    return out


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
    # Reached OR passed, not exactly equal.
    #
    # Equality meant retirement fired only if a scan happened to observe the task
    # in precisely the stop_at state. A task that went straight from in-progress
    # to in-qa or released -- which is what happens when the owner merges the PR
    # before the next sweep -- was never seen at `pr-ready`, kept its
    # authorisation, and stayed the top candidate. AG-290 sat cleared on the Air
    # with its PR merged 2026-08-13 and cost $1.29 on 08-26 to rediscover that it
    # was done. Equality also made retirement unreachable outright for a project
    # whose stop_at is `done` or `none`: no task is ever in those states.
    # `blocked` is excluded, not ranked. PIPELINE_STATES is a list, and `blocked`
    # is appended last -- so by index it sorts AFTER `released`, and comparing on
    # that would retire the authorisation of a task that is stuck rather than
    # finished, making the owner clear it again to unblock it. Progress order is
    # the prefix up to `released`; blocked is a state off to one side of it.
    progress = [s for s in PIPELINE_STATES if s != "blocked"]
    order = {name: i for i, name in enumerate(progress)}
    state = str(task.get("state") or "")
    target = str(project.stop_at or "")
    if target in ("done", "none"):
        # Nothing short of a terminal board state ends such a project's interest.
        if state not in _TERMINAL_GROUND_TRUTH:
            return None
    elif state not in order or target not in order:
        return None
    elif order[state] < order[target]:
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

    deps_parser = sub.add_parser("deps")
    deps_parser.add_argument("slug", nargs="?")
    deps_parser.add_argument("--config", default=default_config)
    deps_parser.add_argument(
        "--unaudited",
        action="store_true",
        help="only tasks with no recorded edges — the review queue",
    )

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
    run_parser.add_argument("--machine", default=_host_machine())
    run_parser.add_argument("--status", default="completed")
    run_parser.add_argument("--note")
    run_parser.add_argument("--started-ts", type=int)
    # Generated by whoever launched the executor, because it is stamped into
    # OTEL_RESOURCE_ATTRIBUTES before the process starts. Omitted, the row falls
    # back to a derived id -- correct for a run this host did not launch, and
    # unjoinable against telemetry, which is the honest outcome in that case.
    run_parser.add_argument("--run-id")
    run_parser.add_argument("--quota-5h-before")
    run_parser.add_argument("--quota-5h-after")
    run_parser.add_argument("--quota-week-before")
    run_parser.add_argument("--quota-week-after")
    run_parser.add_argument("--quota-pool", choices=["claude", "codex"])
    # Defaults to the weaker claim: a caller that does not say how it measured
    # has not shown the delta belongs to this run rather than to whatever else
    # was spending the same pool.
    run_parser.add_argument(
        "--quota-attribution", choices=["exact", "upper-bound"], default="upper-bound"
    )
    run_parser.add_argument("--task-id", help="the human key, e.g. AG-298")
    run_parser.add_argument("--branch")
    run_parser.add_argument("--pr")
    run_parser.add_argument("--points", help="the board's estimate for this task")

    doctor_parser = sub.add_parser("doctor")
    doctor_parser.add_argument("--machine", default=None)
    doctor_parser.add_argument(
        "--publish",
        action="store_true",
        help="also write the report to the vault, where the Observatory reads it",
    )

    audit_parser = sub.add_parser("audit")
    audit_parser.add_argument("task", help="task id or source url")
    audit_parser.add_argument(
        "--machine",
        action="append",
        dest="machines",
        help="ledger partition to read; repeatable, defaults to every one present",
    )

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
            # `pr-ready` is the terminal claim for a greenlit project: it says a
            # branch is finished and a human should review it. `--note` is where
            # the contract has always asked for the checks that back that claim,
            # and it was optional, so a task could reach the end of the loop with
            # no evidence recorded at all.
            #
            # Measured 2026-09-02 on PR #342, the first PR the loop opened
            # unattended: CI failed on `Check formatting`. The repository's own
            # CLAUDE.md documents `pnpm prettier --write`, and nothing had asked
            # the executor to say whether it ran it. Requiring the note does not
            # prove the checks ran -- nothing here can -- but it stops the claim
            # being made silently, and the note is what the dashboard shows.
            if args.state == "pr-ready" and not (args.note or "").strip():
                raise ValueError(
                    "pr-ready needs --note naming the checks you ran "
                    "(format, lint, tests) and their result"
                )
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

        if args.cmd == "doctor":
            result = doctor_report(args.machine)
            if args.publish:
                # Published like every other cross-machine fact: one file per
                # host, so a silent machine is visibly absent rather than merging
                # into the other one's answer.
                #
                # A failure here becomes a field, not a traceback: this command's
                # whole point is that it still reports when something underneath
                # it cannot be reached.
                from loopctl.writeback import publish_doctor

                try:
                    result["published_to"] = publish_doctor(result)
                except (OSError, ValueError) as exc:
                    result["published_to"] = None
                    result["publish_error"] = str(exc)
                    result["state"] = "missing"
            _print_json(result)
            # Non-zero when anything is not ok, so an hourly job that runs this
            # cannot report success over a red pair -- the exact failure the
            # whole command exists to end.
            return 0 if result.get("state") == "ok" else 1

        if args.cmd == "audit":
            # Every partition by default. A task can move between machines, and
            # reading only this host's ledger would report a total that is
            # confidently short -- the failure mode this command exists to end.
            machines = args.machines or _ledger_machines()
            _print_json(audit_task(args.task, machines))
            return 0

        if args.cmd == "record-run":
            # The machine name picks the file the row lands in, so a free-form
            # value silently forks the telemetry rather than failing. On
            # 2026-07-30 an executor passed the macOS display name, "Angible's
            # MacBook Air", and its iteration row went to a second partition
            # beside the real one -- same run, same host, two files, neither
            # complete. A host records under one name only; wanting another
            # means setting LOOP_MACHINE, not passing a string.
            # Compared on the first dot-segment, so `air` and `air.local` are one
            # host, then normalised to the canonical name so both spellings land
            # in the same file. A genuinely different name still fails.
            host = _host_machine()
            if args.machine.split(".")[0].casefold() != host.split(".")[0].casefold():
                raise ValueError(
                    f"record-run --machine {args.machine!r} is not this host; "
                    f"it records as {host!r} (set LOOP_MACHINE to change that)"
                )
            args.machine = host
            _print_json(
                append_run(
                    project=args.project,
                    task=args.task,
                    executor=args.executor,
                    machine=args.machine,
                    status=args.status,
                    note=args.note,
                    started_ts=args.started_ts,
                    run_id=args.run_id,
                    quota_5h_before=args.quota_5h_before,
                    quota_5h_after=args.quota_5h_after,
                    quota_week_before=args.quota_week_before,
                    quota_week_after=args.quota_week_after,
                    quota_pool=args.quota_pool,
                    quota_attribution=args.quota_attribution,
                    task_id=args.task_id,
                    branch=args.branch,
                    pr=args.pr,
                    points=args.points,
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
            machines = args.machines or [host_machine()]
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

        if args.cmd == "deps":
            project = _resolve_project(config, args.slug)
            if not project:
                print(
                    "loopctl: current path is not enrolled"
                    if not args.slug
                    else f"loopctl: no enrolled project '{args.slug}'"
                )
                return 1
            state = registry.read_project_state(project.slug) or {}
            rows = depends_mod.audit(project.slug, state.get("tasks") or [])
            if args.unaudited:
                rows = [row for row in rows if row["standing"] == "unaudited"]
            _print_json(rows)
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
        scanned: list[dict] = []
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
            scanned.append(document)
            _print_json(document)
        # Best-effort and reported, exactly as publish_task_state is: an
        # unavailable vault must not fail a scan, and must not pass quietly
        # either. Nothing downstream can tell a host that never published
        # from one that published nothing.
        if scanned and not args.dry_run:
            try:
                published = publish_project_assignment(scanned)
                print(f"loopctl: published assignment to {published}")
            except (OSError, ValueError) as exc:
                print(f"loopctl: assignment not published: {exc}")
        return 0
    except (ValueError, registry.LockBusy) as exc:
        print(f"loopctl: {exc}")
        return 2
