from __future__ import annotations

import os
import subprocess

from loopctl.errors import SourceUnreachable


def run(args: list[str], cwd) -> tuple[int, str]:
    code, out, _ = run_full(args, cwd)
    return code, out


def run_full(args: list[str], cwd) -> tuple[int, str, str]:
    """Same as run, but keeps stderr.

    stderr was captured and dropped, so a failing signal reported only its exit
    code. On 2026-07-30 a scan went stale with `gh pr list failed for branch X
    (exit 1)`, which reads like a branch problem; the discarded stderr said
    `Could not resolve to a Repository` -- gh was signed in to the wrong account.
    Diagnosing that took minutes of guessing at branches and sandboxes.
    """
    timeout = int(os.environ.get("LOOP_SIGNAL_TIMEOUT", "15"))
    try:
        proc = subprocess.run(
            args,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise SourceUnreachable(
            f"signal command timed out after {timeout}s: {args[0]}"
        ) from exc
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def _why(stderr: str) -> str:
    """One line of the command's own error, for a message a human will read."""
    first = next((ln for ln in stderr.splitlines() if ln.strip()), "")
    return f": {first[:200]}" if first else ""


def branch_exists(repo, branch: str) -> bool:
    code, _, err = run_full(["git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], repo)
    if code not in {0, 1}:
        raise SourceUnreachable(
            f"git could not inspect branch {branch} (exit {code}){_why(err)}"
        )
    return code == 0


def commits_ahead(repo, branch: str, base: str) -> int:
    code, out, err = run_full(["git", "rev-list", "--count", f"{base}..{branch}"], repo)
    if code != 0:
        raise SourceUnreachable(
            f"git could not compare {branch} with {base} (exit {code}){_why(err)}"
        )
    return int(out) if out.isdigit() else 0


def last_commit_ts(repo, ref: str = "HEAD") -> int | None:
    code, out, err = run_full(["git", "log", "-1", "--format=%ct", ref], repo)
    if code != 0:
        raise SourceUnreachable(f"git could not inspect {ref} (exit {code}){_why(err)}")
    return int(out) if out.isdigit() else None


import json as _json

_PR_STATE = {"OPEN": "open", "MERGED": "merged"}


def pr_for_branch(repo, branch: str) -> dict | None:
    code, out, err = run_full(
        ["gh", "pr", "list", "--head", branch, "--state", "all",
         "--json", "number,state,url", "--limit", "1"],
        repo,
    )
    if code != 0:
        raise SourceUnreachable(
            f"gh pr list failed for branch {branch} (exit {code}){_why(err)}"
        )
    if not out:
        return None
    try:
        rows = _json.loads(out)
    except _json.JSONDecodeError as exc:
        raise SourceUnreachable(f"gh returned invalid PR data for branch {branch}") from exc
    for row in rows:
        norm = _PR_STATE.get(row.get("state", ""))
        if norm:
            return {"number": row["number"], "state": norm, "url": row["url"]}
    return None


def checks_conclusion(repo, branch: str) -> str:
    code, out, err = run_full(["gh", "pr", "checks", branch], repo)
    if not out:
        # `gh pr checks` exits 1 with no output when an open draft/stacked PR
        # has no check runs. That is a valid "no signal" state, not a transport
        # failure that should make the whole project registry stale.
        if code in {0, 1}:
            return "none"
        raise SourceUnreachable(
            f"gh pr checks failed for branch {branch} (exit {code}){_why(err)}"
        )
    low = out.lower()
    if code == 0:
        return "pending" if "pending" in low else "success"
    if "no pull requests found" in low:
        return "none"
    if "pending" in low and "fail" not in low:
        return "pending"
    if any(token in low for token in ("fail", "cancel", "timed out", "startup_failure")):
        return "failure"
    raise SourceUnreachable(f"gh pr checks was unreachable for branch {branch}{_why(err)}")
