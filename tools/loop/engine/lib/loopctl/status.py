from __future__ import annotations

import re


_STATUS_MAP = {
    "backlog": "queued",
    "not started": "queued",
    "not-started": "queued",
    "queued": "queued",
    "in progress": "in-progress",
    "in progress / pr": "in-progress",
    "in-progress": "in-progress",
    # Live on the board and unmapped until now, so it derived as `not-started`
    # -- a task waiting on a reviewer looked like fresh work and could be picked
    # up again. Review happens after the PR exists, so it belongs with pr-ready.
    "in review": "pr-ready",
    "pr ready": "pr-ready",
    "pr-ready": "pr-ready",
    "in qa": "in-qa",
    "merged": "in-qa",
    "done": "in-qa",
    "in-qa": "in-qa",
    "released": "released",
    "closed": "released",
    "blocked": "blocked",
    "needs tuning": "needs-tuning",
    "needs-tuning": "needs-tuning",
    "spec drafted": "spec-drafted",
    "spec-drafted": "spec-drafted",
    "split drafted": "split-drafted",
    "split-drafted": "split-drafted",
}


def normalize_source_state(value) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"\s+", " ", str(value).strip().lower())
    return _STATUS_MAP.get(normalized)


def priority_key(value) -> tuple[int, str]:
    if isinstance(value, int):
        return value, str(value)
    text = str(value or "").strip().upper()
    match = re.fullmatch(r"P?(\d+)", text)
    return (int(match.group(1)), text) if match else (99, text)
