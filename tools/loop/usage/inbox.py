"""The receiving half of the cross-machine bridge.

The Air cannot finish its own delivery. It copies its telemetry here over ssh,
and an ssh session on macOS is outside the GUI security session, which for a
CloudDocs (iCloud) directory means it may only modify files *it created
itself*. Renaming onto a file that a GUI-session process wrote -- or even
unlinking it -- returns `Operation not permitted`, from a session that owns the
directory and the file by every POSIX measure.

Measured 2026-08-26. The 61 MB ledger was copied in full every hour, landed
beside its destination as `.ledger.<machine>.jsonl.incoming`, and was dropped
at the final rename -- leaving a 27,205-line file from 27 July in place while a
complete 167,408-line one sat next to it, unused, for a month. Nothing reported
a failure: the bridge's `|| true` swallowed it, and the destination's mtime is
not a delivery marker because deliveries land on a different name.

So promotion happens here, on the receiving side, run by a launchd job in the
`gui/` domain that may write the vault freely. The sender's job ends when the
bytes are on disk.

The two-stage name is what makes this race-free. The sender writes
`.<name>.partial`, then renames it to `.<name>.incoming` -- both names it
created, so both operations are permitted -- and only a fully-transferred file
ever carries the `.incoming` name. This side never sees a partial write.
"""

from __future__ import annotations

import os
import pathlib

INCOMING_SUFFIX = ".incoming"


def incoming_paths(usage_dir):
    """Every settled delivery waiting to be promoted, oldest first."""
    usage_dir = pathlib.Path(usage_dir)
    if not usage_dir.is_dir():
        return []
    found = [
        p
        for p in usage_dir.iterdir()
        if p.is_file() and p.name.startswith(".") and p.name.endswith(INCOMING_SUFFIX)
    ]
    return sorted(found, key=lambda p: p.name)


def final_name(path):
    """`.ledger.air.jsonl.incoming` -> `ledger.air.jsonl`.

    Returns None for a name that does not round-trip to a plausible target, so
    a stray dotfile cannot be promoted into the directory the readers scan.
    """
    name = pathlib.Path(path).name
    if not (name.startswith(".") and name.endswith(INCOMING_SUFFIX)):
        return None
    stripped = name[1 : -len(INCOMING_SUFFIX)]
    if not stripped or stripped.startswith("."):
        return None
    return stripped


def promote_incoming(usage_dir):
    """Rename every settled delivery onto its final name.

    Returns {final_name: True} for each promotion, and {final_name: False} for
    one that failed -- a failure here means this process is not in the GUI
    session either, which is the whole reason this function exists, so it is
    worth reporting rather than swallowing.
    """
    results = {}
    for path in incoming_paths(usage_dir):
        target_name = final_name(path)
        if target_name is None:
            continue
        target = path.parent / target_name
        try:
            os.replace(path, target)
        except OSError:
            results[target_name] = False
        else:
            results[target_name] = True
    return results
