"""Publish loop state to the shared vault and append an execution ledger.

The machine-local registry remains the execution source of truth. These small,
atomic mirrors are read by Loop Observatory and are safe when the vault is
temporarily unavailable: callers can continue working and retry on the next
state change.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.error
import urllib.request
import re
from datetime import datetime, timezone
from pathlib import Path


def vault_path() -> Path:
    """Where Observatory's overlays are published.

    The old fallback -- ``~/Repositories/rainforest-obsidian`` -- is a stale
    second clone on Air, not the live vault. Publishing there succeeds, writes a
    real entry, and is read by nothing, so a task can go PR-ready on Air while
    the board still shows it as not started. Ask the config before guessing.
    """
    configured = os.environ.get("LOOP_VAULT_PATH") or os.environ.get("VAULT_PATH")
    if configured:
        return Path(configured).expanduser()
    try:
        from loopctl.config import config_path, load_config

        configured = (load_config(config_path()).defaults or {}).get("vault_path")
    except Exception:
        # Publishing is best-effort by design; a malformed or missing config
        # must not take down the caller that was only mirroring state.
        configured = None
    if configured:
        return Path(configured).expanduser()
    return Path.home() / "Repositories" / "rainforest-obsidian"


def usage_path(name: str) -> Path:
    return vault_path() / "_system" / "usage" / name


def _atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def _iso(ts: int | float | None = None) -> str:
    value = time.time() if ts is None else ts
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def _notion_page_id(value: object) -> str | None:
    match = re.search(r"([0-9a-f]{32})", str(value).replace("-", ""), re.I)
    return match.group(1) if match else None


def _notion_status(token: str, page_id: str, state: str) -> str | None:
    """Map Loop's internal state to the canonical Work Items status.

    A page response exposes only its selected status, not the database's status
    options, so trying to discover options from ``GET /pages/{id}`` always
    returned an empty list. The enrolled Notion adapter targets the documented
    Work Items schema, whose status vocabulary is stable and explicit.
    """
    del token, page_id
    return {
        "queued": "Not started",
        "not-started": "Not started",
        "in-progress": "In progress / PR",
        "pr-ready": "In progress / PR",
        "in-qa": "In QA",
        "released": "Released",
        "blocked": "Blocked",
    }.get(state)


def _progress_task_id(task: dict) -> str:
    """Return the ID used by Observatory's task snapshot.

    Notion registry entries use the page URL as their source identity, while
    ``tasks.json`` exposes the human AG number. Prefer that numeric item ID so
    the progress overlay can actually join to the corresponding card.
    """
    item_id = (task.get("metadata") or {}).get("item_id")
    return str(item_id if item_id not in (None, "") else task.get("id", ""))


def _display_state(state: object) -> str | None:
    """Translate internal state names to Observatory's public vocabulary."""
    if state is None:
        return None
    value = str(state)
    return {
        "queued": "Queued",
        "not-started": "Queued",
        "needs-tuning": "Needs tuning",
        "spec-drafted": "Spec drafted",
        "split-drafted": "Split drafted",
        "in-progress": "In progress",
        "pr-ready": "PR ready",
        "in-qa": "Merged",
        "released": "Released",
        "blocked": "Blocked",
    }.get(value, value)


def _write_notion_status(task_id: object, state: str) -> str:
    token = os.environ.get("NOTION_TOKEN")
    page_id = _notion_page_id(task_id)
    if not token or not page_id:
        return "unavailable"
    name = _notion_status(token, page_id, state)
    if not name:
        return "pending"
    body = json.dumps({"properties": {"Status": {"status": {"name": name}}}}).encode()
    request = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(request, timeout=15):
            return "applied"
    except (OSError, urllib.error.URLError):
        return "pending"


def publish_task_state(
    slug: str,
    task: dict,
    *,
    machine: str | None = None,
    now_ts: int | None = None,
) -> dict:
    """Merge one task into Observatory's shared progress overlay.

    The optional ``notion_writeback`` marker is deliberately explicit. A
    headless runner without a Notion token must not pretend the board changed;
    the pending marker gives a later authenticated sync something actionable.
    """
    now = now_ts or int(time.time())
    path = usage_path("tasks-progress.json")
    try:
        current = json.loads(path.read_text()) if path.exists() else {}
    except (OSError, json.JSONDecodeError):
        current = {}
    if not isinstance(current, dict):
        current = {}
    entries = current.get("tasks")
    if not isinstance(entries, dict):
        entries = {}
    task_id = _progress_task_id(task)
    entry = dict(entries.get(task_id) or {})
    notion_state = _write_notion_status(task.get("id"), str(task.get("state") or ""))
    entry.update(
        {
            "loop_status": _display_state(task.get("state")),
            "pr": task.get("pr"),
            "note": (task.get("overlay") or {}).get("note"),
            "project": slug,
            "machine": machine or os.environ.get("LOOP_MACHINE") or os.uname().nodename,
            "updated_ts": now,
            "updated_at": _iso(now),
            "notion_writeback": notion_state,
        }
    )
    entries[task_id] = entry
    current.update({"version": 1, "updated_at": _iso(now), "tasks": entries})
    _atomic_json(path, current)
    return entry


def _pct(value: str | float | None) -> float | None:
    """A quota percentage, or None for the '?' the sampler emits when unread."""
    if value is None or value == "" or value == "?":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quota_block(before_5h, after_5h, before_week, after_week) -> dict | None:
    """Structured quota movement for one run, or None when nothing was sampled.

    The percentage-point deltas were previously only ever written into the free-text
    `note`, which made them unusable for anything but reading. They are the only
    measurement that answers "what did this run actually cost me", so they belong
    in fields.
    """
    five_before, five_after = _pct(before_5h), _pct(after_5h)
    week_before, week_after = _pct(before_week), _pct(after_week)
    if all(v is None for v in (five_before, five_after, week_before, week_after)):
        return None
    delta = lambda a, b: None if a is None or b is None else round(b - a, 4)
    return {
        "five_hour_before": five_before,
        "five_hour_after": five_after,
        "five_hour_delta_pp": delta(five_before, five_after),
        "weekly_before": week_before,
        "weekly_after": week_after,
        "weekly_delta_pp": delta(week_before, week_after),
    }


def append_run(
    *,
    project: str,
    task: str,
    executor: str,
    machine: str,
    cost_usd: str | float | int = 0,
    status: str = "completed",
    note: str | None = None,
    started_ts: int | None = None,
    ended_ts: int | None = None,
    model: str | None = None,
    effort: str | None = None,
    tokens_out: int | None = None,
    quota_5h_before: str | float | None = None,
    quota_5h_after: str | float | None = None,
    quota_week_before: str | float | None = None,
    quota_week_after: str | float | None = None,
) -> dict:
    """Append one structured iteration/retro record to a machine partition."""
    ended = ended_ts or int(time.time())
    record = {
        "run_id": f"{machine}-{ended}-{task}",
        "project": project,
        "task": task,
        "executor": executor,
        "machine": machine,
        "started_at": _iso(started_ts or ended),
        "ended_at": _iso(ended),
        "cost_usd": float(cost_usd or 0),
        "status": status,
        "note": note,
        # Which model and effort actually ran. Neither was recorded anywhere
        # before, so "was xhigh worth it" could not be answered from own data.
        "model": model,
        "effort": effort,
        "tokens_out": tokens_out,
        "quota": _quota_block(
            quota_5h_before, quota_5h_after, quota_week_before, quota_week_after
        ),
    }
    path = usage_path(f"loop-runs.{machine}.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return record
