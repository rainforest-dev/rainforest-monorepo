"""loopctl — deterministic loop state engine."""

import os
import subprocess

__version__ = "0.2.0"


def host_machine() -> str:
    """The one name this host's per-machine files are keyed on.

    Lives here because five call sites derived it independently and drifted:
    ralph, install.sh, relay/pull.sh, `enroll`, and the Observatory mirror. On
    2026-07-30 `hostname -s` followed DHCP from Angibles-MacBook-Air to
    Angibles-Air mid-session, which opened a third run-ledger partition, pointed
    the quota gate at a file that did not exist, and left install.sh unable to
    find the host in hosts.yaml. LocalHostName is the stable macOS name and does
    not move with the network. The shell sites derive it in this same order.
    """
    override = os.environ.get("LOOP_MACHINE")
    if override:
        return override
    try:
        proc = subprocess.run(
            ["scutil", "--get", "LocalHostName"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip().split(".")[0]
    except (OSError, subprocess.SubprocessError):
        pass  # not macOS, or scutil is unavailable
    return os.uname().nodename.split(".")[0]

PIPELINE_STATES = [
    "not-started",
    "queued",
    "in-progress",
    "pr-ready",
    "in-qa",
    "released",
    "blocked",
]

AGENT_STATES = [
    "needs-tuning",
    "spec-drafted",
    "split-drafted",
]

LIFECYCLE_STATES = [
    "onboarding",
    "active",
    "maintenance",
    "dormant",
    "archived",
]
