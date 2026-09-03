"""Pairs where one side writes and another side is supposed to read.

Nearly every failure this system has had takes the same shape: something reports
success about the half it touched, and nothing checks the half that consumes it.
The engine bundle mounted stale for two days; the container image for three; the
Air's ledger swallowed every row for a month; a scan printed task JSON, exited 0,
and published nothing; `claude plugin update` said "already at the latest version"
and copied nothing. Each was found by a person looking, days later, for something
else.

So this does not check that things work. It reports, for each pair, what the
producer last said and what the consumer actually holds -- and how old each is.
A pair whose two sides disagree, or whose consumer is older than its SLA, is the
signal; nothing here decides what to do about it.

Rules for adding a pair:

  * Both sides must be observable without running the thing. A pair you can only
    evaluate by triggering the work is a test, not a check.
  * `unknown` is a first-class answer. A pair that cannot be read says so; it
    never reports `ok` by default, because the whole class being caught here is
    absence read as success.
  * Every pair carries the path or command it read, so a red row is a place to
    go and not a thing to interpret.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

from loopctl import host_machine
from loopctl.writeback import usage_path

#: How old a consumer may be before the pair is reported stale, per pair id.
#: Absent means "no age expectation" -- the pair is about agreement, not
#: freshness. These are judgement, not measurement, and are named here rather
#: than buried so they can be argued with.
SLA_SECONDS: dict[str, int] = {
    "ledger": 48 * 3600,
    "projects_published": 3 * 3600,
    "quota_snapshot": 3 * 3600,
}


def _age(ts: float | None, now: float) -> int | None:
    return None if ts is None else max(0, int(now - ts))


def _mtime(path: Path) -> float | None:
    try:
        return path.stat().st_mtime
    except OSError:
        return None


def _pair(
    pair_id: str,
    *,
    declared: object,
    observed: object,
    source: str,
    age: int | None = None,
    note: str | None = None,
    state: str | None = None,
) -> dict:
    """One row.

    `state` is derived from the two sides for the pairs that are a comparison.
    A pair whose sides are not comparable strings -- the runner is declared by a
    file and observed through launchctl -- passes its own verdict instead, rather
    than being forced through an equality that reports `differs` for every host.
    """
    if state is not None:
        pass
    elif declared is None and observed is None:
        state = "unknown"
    elif observed is None:
        state = "missing"
    elif declared is not None and str(declared) != str(observed):
        state = "differs"
    else:
        sla = SLA_SECONDS.get(pair_id)
        state = "stale" if (sla is not None and age is not None and age > sla) else "ok"

    return {
        "id": pair_id,
        "declared": declared,
        "observed": observed,
        "age_seconds": age,
        "sla_seconds": SLA_SECONDS.get(pair_id),
        "state": state,
        "source": source,
        "note": note,
    }


def _engine_version_pair(loop_home: Path) -> dict:
    """What the bundle on disk says, against what this machine installed."""
    installed = None
    try:
        installed = (loop_home / ".engine-version").read_text(encoding="utf-8").strip()
    except OSError:
        pass
    bundle = None
    share = Path(
        os.environ.get("XDG_DATA_HOME") or (Path.home() / ".local" / "share")
    )
    marker = share / "loop-engine-bundle" / "loop-engine.tar.gz.sha256"
    try:
        # The release filename carries the version; the checksum file names it.
        first = marker.read_text(encoding="utf-8").split()
        bundle = next(
            (
                part.split("loop-engine-")[-1].removesuffix(".tar.gz")
                for part in first
                if "loop-engine-" in part
            ),
            None,
        )
    except OSError:
        pass
    return _pair(
        "engine_version",
        declared=bundle,
        observed=installed,
        source=f"{marker} vs {loop_home}/.engine-version",
        note="the bundle a machine could install, against the one it did",
    )


def _ledger_pair(machine: str, now: float) -> dict:
    """The ledger this host writes, against when it last actually wrote."""
    path = usage_path(f"loop-runs.{machine}.jsonl")
    last = None
    try:
        lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if lines:
            last = json.loads(lines[-1]).get("started_at")
    except (OSError, ValueError):
        pass
    return _pair(
        "ledger",
        declared=machine,
        observed=machine if last else None,
        age=_age(_mtime(path), now),
        source=str(path),
        note=f"last row started {last or 'never'}"
        " -- the Air swallowed every row for a month and said nothing",
    )


def _projects_pair(machine: str, now: float) -> dict:
    """What `scan` says it published, against the file it publishes to."""
    path = usage_path(f"projects.{machine}.json")
    count = None
    published = None
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        count = len(doc.get("projects") or [])
        published = doc.get("published_at")
    except (OSError, ValueError):
        pass
    return _pair(
        "projects_published",
        declared=machine,
        observed=machine if count else None,
        age=_age(_mtime(path), now),
        source=str(path),
        note=f"{count if count is not None else 'no'} project(s), published {published or 'never'}"
        " -- scan exits 0 even when this step dies",
    )


def _quota_pair(machine: str, now: float) -> dict:
    path = usage_path(f"quota.{machine}.json")
    return _pair(
        "quota_snapshot",
        declared=machine,
        observed=machine if path.exists() else None,
        age=_age(_mtime(path), now),
        source=str(path),
        note="the file the budget gate reads before every run",
    )


def _runner_pair(loop_home: Path) -> dict:
    """Whether the runner this host declares is loaded and enabled.

    Read from launchctl rather than from the plist: a plist on disk says what
    would run, and this pair exists because "installed and silent" and "running"
    looked identical for eight days.
    """
    import subprocess

    label = "tools.rainforest.loop-ralph"
    declared = (Path(os.environ.get("HOME", "")) / "Library/LaunchAgents" / f"{label}.plist").exists()
    loaded = enabled = None
    try:
        uid = os.getuid()
        listed = subprocess.run(
            ["launchctl", "list"], capture_output=True, text=True, timeout=10
        )
        loaded = label in listed.stdout
        dis = subprocess.run(
            ["launchctl", "print-disabled", f"gui/{uid}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        for line in dis.stdout.splitlines():
            if label in line:
                enabled = "=> enabled" in line.replace('"', "")
                break
    except (OSError, subprocess.SubprocessError):
        pass
    observed = None if loaded is None else f"loaded={loaded} enabled={enabled}"
    # Judged, not compared. "installed" and "loaded and enabled" are different
    # facts about different systems, and the interesting states are: no plist
    # (missing), a plist that is loaded and enabled (ok), and a plist that is
    # present but held off (differs) -- which is what "installed and silent"
    # looks like, and what went unnoticed on the Air for eight days.
    if not declared:
        verdict = "missing"
    elif loaded is None:
        verdict = "unknown"
    elif loaded and enabled:
        verdict = "ok"
    else:
        verdict = "differs"
    return _pair(
        "runner",
        declared=f"plist installed={declared}",
        observed=observed,
        state=verdict,
        source=f"launchctl list / print-disabled gui/{os.getuid()}",
        note="a disabled job stays disabled across a bootstrap, and looks installed",
    )


def report(machine: str | None = None, now: float | None = None) -> dict:
    """Every pair for this host."""
    now = time.time() if now is None else now
    name = machine or host_machine()
    loop_home = Path(os.environ.get("LOOP_HOME") or (Path.home() / ".claude" / "loop"))
    pairs = [
        _engine_version_pair(loop_home),
        _ledger_pair(name, now),
        _projects_pair(name, now),
        _quota_pair(name, now),
        _runner_pair(loop_home),
    ]
    worst = "ok"
    for order in ("unknown", "stale", "differs", "missing"):
        if any(p["state"] == order for p in pairs):
            worst = order
    return {
        "machine": name,
        "checked_at": int(now),
        # The worst state present, so one number can be watched. Ordered by how
        # much it costs to be wrong about: missing beats differs beats stale.
        "state": worst,
        "pairs": pairs,
    }
