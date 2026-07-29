from __future__ import annotations

import json
import os
import socket
import tempfile
import time
from pathlib import Path


def loop_home() -> Path:
    env = os.environ.get("LOOP_HOME")
    return Path(env) if env else Path.home() / ".claude" / "loop"


def _projects_dir() -> Path:
    d = loop_home() / "projects"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _project_path(slug: str) -> Path:
    return loop_home() / "projects" / f"{slug}.json"


def _dump(obj) -> str:
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def atomic_write(path: Path, content: str) -> None:
    """Replace `path`'s contents in one step, never leaving it truncated.

    Public because greenlight.py writes the allowlist through this: `loopctl
    next` reads that file without taking a ProjectLock, so a truncate-then-write
    would let a concurrent reader see a partial file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        dir=path.parent,
        prefix=f".{path.name}.",
        delete=False,
    ) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.replace(path)


def write_project_state(slug: str, state: dict) -> Path:
    path = _project_path(slug)
    atomic_write(path, _dump(state))
    return path


def read_project_state(slug: str) -> dict | None:
    path = _project_path(slug)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def update_index(slug: str, lifecycle: str, scanned_ts: int) -> None:
    path = loop_home() / "registry.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    idx = json.loads(path.read_text()) if path.exists() else {}
    idx[slug] = {"lifecycle": lifecycle, "scanned_ts": scanned_ts}
    atomic_write(path, _dump(idx))


class LockBusy(RuntimeError):
    pass


class ProjectLock:
    def __init__(self, slug: str):
        self.path = loop_home() / "projects" / f"{slug}.lock"
        self._held = False

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = _dump(
            {
                "host": socket.gethostname(),
                "pid": os.getpid(),
                "started_ts": int(time.time()),
            }
        )
        try:
            descriptor = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise LockBusy(f"project '{self.path.stem}' is already locked") from exc
        with os.fdopen(descriptor, "w") as handle:
            handle.write(payload)
        self._held = True
        return self

    def __exit__(self, exc_type, exc, traceback):
        if self._held:
            try:
                self.path.unlink()
            except FileNotFoundError:
                pass
        self._held = False
