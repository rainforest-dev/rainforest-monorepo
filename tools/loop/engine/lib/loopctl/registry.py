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
            # The lock is released in __exit__, so a process killed while holding
            # it leaves the file behind and every later run fails with exit 2 --
            # measured 2026-08-25 on the company machine, where a scan interrupted
            # by `launchctl bootout` blocked both company projects until the files
            # were removed by hand. The payload already records the pid; nothing
            # was reading it.
            #
            # Reclaimed only when the recorded pid is this host's and no longer
            # exists. A lock from another machine is left alone: the pid means
            # nothing here, and these files sit in a directory that has been synced
            # between machines before.
            if not self._holder_is_gone():
                raise LockBusy(
                    f"project '{self.path.stem}' is already locked"
                ) from exc
            try:
                self.path.unlink()
                descriptor = os.open(
                    self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
                )
            except (FileNotFoundError, FileExistsError) as race:
                # Another process reclaimed it between the check and the unlink.
                raise LockBusy(
                    f"project '{self.path.stem}' is already locked"
                ) from race
        with os.fdopen(descriptor, "w") as handle:
            handle.write(payload)
        self._held = True
        return self

    def _holder_is_gone(self) -> bool:
        """True when the lock names a dead process on this host.

        Anything unreadable, unparseable, or from another host counts as held:
        the failure to prefer is refusing to run, not two writers.
        """
        try:
            payload = json.loads(self.path.read_text())
        except (OSError, ValueError):
            return False
        if payload.get("host") != socket.gethostname():
            return False
        pid = payload.get("pid")
        if not isinstance(pid, int) or pid <= 0:
            return False
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return True
        except PermissionError:
            return False  # alive, owned by someone else
        return False

    def __exit__(self, exc_type, exc, traceback):
        if self._held:
            try:
                self.path.unlink()
            except FileNotFoundError:
                pass
        self._held = False
