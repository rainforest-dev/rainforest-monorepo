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
    # No entry for `ledger`. Rows are written per iteration and never for an
    # empty sweep, so an idle host's ledger ages by design: a 48h SLA turned
    # every quiet weekend red, and a check that is red when nothing is wrong is
    # one people learn to ignore. What that pair should compare is the run ralph
    # says it started against the run the ledger holds -- see `_ledger_pair`.
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
    elif declared is None or observed is None:
        # Either side unreadable is `unknown`, and an unreadable DECLARED side
        # with a present observed one is the case worth naming: it fell through
        # to the comparison, which cannot fail against None, and came out `ok`.
        # On a host with no bundle mount that is engine_version reporting green
        # for a machine nothing could have told to upgrade -- absence read as
        # success, in the file whose docstring exists to forbid it.
        state = "missing" if declared is not None else "unknown"
    elif str(declared) != str(observed):
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
    bundle_dir = share / "loop-engine-bundle"
    marker = bundle_dir / "loop-engine.tar.gz.sha256"
    # A host with no bundle directory has no local source to compare against.
    #
    # The mount belongs to whichever machine serves the Observatory -- it is a
    # homelab concern, not a loop role -- and the other host installs from a
    # tarball it downloads and discards. So on the Air the declared side is not
    # missing, it does not exist, and reporting `unknown` there made doctor exit
    # non-zero forever on a perfectly healthy machine. That is how a check earns
    # being ignored, which is the one thing this file cannot afford.
    #
    # The distinction is between the mechanism being absent and the mechanism
    # failing: no directory at all is `not_applicable`, a directory whose marker
    # cannot be read stays `unknown`.
    if not bundle_dir.is_dir():
        return _pair(
            "engine_version",
            declared=None,
            observed=installed,
            state="not_applicable",
            source=f"no {bundle_dir}; this host installs from a downloaded bundle",
            note="nothing local to compare against -- cross-machine drift is the"
            " Observatory's engines row, which both hosts publish to",
        )
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


def _ledger_pair(machine: str, loop_home: Path, now: float) -> dict:
    """The run ralph says it started, against the run the ledger holds.

    Not an age check. Rows exist only for iterations, never for empty sweeps, so
    an idle host's ledger is old because there was nothing to do -- a freshness
    SLA there is red every quiet weekend, which is how a check earns being
    ignored. What matters is whether the row for the run that DID happen arrived:
    those two diverge exactly when `record-run` failed, which on the Air went
    unnoticed from 2026-08-06 to 2026-09-03 because a ledger with no new rows
    looks identical to a machine with nothing to run.
    """
    path = usage_path(f"loop-runs.{machine}.jsonl")
    intended = intended_ts = None
    try:
        doc = json.loads((loop_home / "last-iteration.json").read_text(encoding="utf-8"))
        intended, intended_ts = doc.get("run_id"), doc.get("started_ts")
    except (OSError, ValueError):
        pass
    recorded = None
    try:
        lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if lines:
            recorded = json.loads(lines[-1]).get("run_id")
    except (OSError, ValueError):
        pass
    return _pair(
        "ledger",
        declared=intended,
        observed=recorded,
        age=_age(intended_ts, now) if isinstance(intended_ts, (int, float)) else None,
        source=f"{loop_home}/last-iteration.json vs {path}",
        note="the run this host set out to make, against the row it recorded"
        " -- these part when record-run fails, and nothing else notices",
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
    # Counts, not names. Comparing the machine to itself passed while `scan
    # <slug>` rewrote the file down to a single project -- the publication was
    # present, current, and missing most of what it should list.
    declared_count = None
    try:
        from loopctl.config import config_path, load_config

        declared_count = sum(
            1
            for pr in load_config(config_path()).projects
            if not pr.machines or "both" in pr.machines or machine in pr.machines
        )
    except Exception:
        declared_count = None
    return _pair(
        "projects_published",
        declared=declared_count,
        observed=count,
        age=_age(_mtime(path), now),
        source=str(path),
        note=f"{count if count is not None else 'no'} project(s), published {published or 'never'}"
        " -- scan exits 0 even when this step dies",
    )


def _quota_pair(machine: str, now: float) -> dict:
    """The budget gate's input, aged by when it was MEASURED.

    mtime is the one number that hid this: on 2026-09-03 the Air's file had a
    fresh written_at over a source_ts 21 hours old, so anything reading the file
    date saw a current snapshot of a stale reading. The age that matters is the
    newest source_ts across pools -- what the gate is actually deciding on.
    """
    path = usage_path(f"quota.{machine}.json")
    newest = None
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
        for pool in doc.values():
            ts = (pool or {}).get("source_ts") if isinstance(pool, dict) else None
            if isinstance(ts, (int, float)):
                newest = ts if newest is None else max(newest, ts)
    except (OSError, ValueError):
        pass
    return _pair(
        "quota_snapshot",
        declared=machine,
        observed=machine if newest is not None else None,
        age=_age(newest, now),
        source=str(path),
        note="aged by source_ts, not the file date -- a fresh file can hold a"
        " reading from yesterday, and the gate decides on the reading",
    )


def _loaded_definition_pair(loop_home: Path) -> dict:
    """The plist on disk, against the definition launchd is actually running.

    launchd reads a plist once, at bootstrap, and keeps what it read. Replacing
    the file afterwards changes nothing about the running service, and `disable`
    does not unload it -- so `install.sh` can write a corrected unit that the
    machine never adopts, silently, for as long as the old one stays registered.

    Measured 2026-09-03 on the Air: the plist said `ralph.sh 1 10` while launchd
    ran `ralph.sh` alone, so the runner kept the 15-iteration default it had been
    bootstrapped with, twice, after the file had been fixed. `bootstrap` on the
    already-registered label failed with `5: Input/output error`, a message that
    says nothing about which definition is loaded.

    Compare the executable, argument boundaries, and explicit environment.
    """
    import subprocess

    label = "tools.rainforest.loop-ralph"
    plist = Path(os.environ.get("HOME", "")) / "Library/LaunchAgents" / f"{label}.plist"
    declared = None
    errors = []
    try:
        out = subprocess.run(
            ["plutil", "-convert", "json", "-o", "-", str(plist)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode == 0:
            doc = json.loads(out.stdout)
            args = doc.get("ProgramArguments")
            program = doc.get("Program") or (args[0] if args else None)
            env = doc.get("EnvironmentVariables", {})
            if not isinstance(program, str) or not program:
                raise ValueError("plist has no executable")
            if args is None:
                args = [program]
            if not isinstance(args, list) or not args or not all(isinstance(a, str) for a in args):
                raise ValueError("invalid ProgramArguments")
            if not isinstance(env, dict) or not all(isinstance(v, str) for v in env.values()):
                raise ValueError("invalid EnvironmentVariables")
            declared = {"program": program, "arguments": args, "environment": env}
        else:
            errors.append(f"plutil exited {out.returncode}")
    except (OSError, ValueError, TypeError, AttributeError, subprocess.SubprocessError) as exc:
        errors.append(f"plist read failed: {type(exc).__name__}")

    observed = None
    absent = False
    try:
        printed = subprocess.run(
            ["launchctl", "print", f"gui/{os.getuid()}/{label}"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if printed.returncode == 0:
            args, env, program, collecting = None, None, None, None
            for raw in printed.stdout.splitlines():
                line = raw.strip()
                if not line:
                    continue
                if line.startswith("program = "):
                    program = line.removeprefix("program = ")
                if line == "arguments = {":
                    args, collecting = [], "arguments"
                    continue
                if line == "environment = {":
                    env, collecting = {}, "environment"
                    continue
                if collecting:
                    if line == "}":
                        collecting = None
                    elif collecting == "arguments":
                        args.append(line)
                    elif " => " in line:
                        key, value = line.split(" => ", 1)
                        env[key] = value
                    else:
                        raise ValueError("unparseable launchd environment")
            if not program or collecting is not None:
                raise ValueError("incomplete launchd definition")
            if args is None:
                args = [program]
            if not args:
                raise ValueError("empty launchd arguments")
            env = env or {}
            # launchd adds these independently of EnvironmentVariables.
            for key in ("OSLogRateLimit", "XPC_SERVICE_NAME"):
                if key not in (declared or {}).get("environment", {}):
                    env.pop(key, None)
            observed = {"program": program, "arguments": args, "environment": env}
        elif f'Could not find service "{label}" in domain' in printed.stderr:
            absent = True
        else:
            errors.append(f"launchctl print exited {printed.returncode}")
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        errors.append(f"launchctl read failed: {type(exc).__name__}")

    # Nothing registered means nothing to disagree with. A runner that is
    # deliberately off must not make this red -- that is the `runner` pair's
    # question, and asking it twice is how a check becomes noise.
    if errors:
        state = "unknown"
    elif absent:
        state = "not_applicable"
    elif declared is None or observed is None:
        state = "unknown"
    else:
        state = "ok" if declared == observed else "differs"
    return _pair(
        "loaded_definition",
        declared=declared,
        observed=observed,
        state=state,
        source=f"{plist} vs launchctl print gui/{os.getuid()}/{label}",
        note=("; ".join(errors) + "; " if errors else "")
        + "launchd keeps the plist it read at bootstrap; replacing the file"
        " changes nothing until the label is booted out and bootstrapped again",
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
    elif loaded and enabled is not False:
        # `enabled is None` means launchctl holds no override for the label, and
        # launchd's default for that is enabled -- so only an explicit `=>
        # disabled` is a held-off job. Requiring True made every host that was
        # never explicitly toggled report `differs` while running perfectly.
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
        _ledger_pair(name, loop_home, now),
        _projects_pair(name, now),
        _quota_pair(name, now),
        _runner_pair(loop_home),
        _loaded_definition_pair(loop_home),
    ]
    # The runner is excluded from the overall state. On a host whose owner has
    # deliberately not enabled it, `differs` is the correct reading of the pair
    # and the wrong thing to exit non-zero on every hour -- that is how a check
    # gets muted. It goes back in when hosts.yaml can say `ralph: enabled` and
    # the pair can tell "off on purpose" from "off and forgotten".
    graded = [
        p for p in pairs if p["id"] != "runner" and p["state"] != "not_applicable"
    ]
    worst = "ok"
    # Ordered by how much it costs to be wrong. `unknown` sits with `stale`
    # rather than below it: a pair that cannot be read is not a milder version
    # of one that is merely old.
    for order in ("stale", "unknown", "differs", "missing"):
        if any(p["state"] == order for p in graded):
            worst = order
    return {
        "machine": name,
        "checked_at": int(now),
        # The worst state present, so one number can be watched. Ordered by how
        # much it costs to be wrong about: missing beats differs beats stale.
        "state": worst,
        "pairs": pairs,
    }
