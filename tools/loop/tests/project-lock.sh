#!/usr/bin/env bash
# Does a lock survive the process that took it?
#
# It did. ProjectLock releases in __exit__, so a process killed while holding one
# left the file behind and every later run failed with exit 2. Measured
# 2026-08-25 on the company machine: a scan interrupted by `launchctl bootout`
# blocked both company projects until the files were deleted by hand, and the
# symptom -- "project X is already locked" -- named no pid and suggested no fix.
#
# The payload always recorded the pid. Nothing read it.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/engine/lib"
pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

HOME_DIR=$(mktemp -d); trap 'rm -rf "$HOME_DIR"' EXIT
mkdir -p "$HOME_DIR/projects"

run() { LOOP_HOME="$HOME_DIR" PYTHONPATH="$LIB" python3 -c "$1" 2>&1; }

echo "a live holder still blocks:"
check "taking a free lock works" "$(run '
from loopctl.registry import ProjectLock
with ProjectLock("p"):
    print("held")
')" "held"

check "and it is released on exit" "$(run '
import pathlib, os
from loopctl.registry import ProjectLock
with ProjectLock("p"):
    pass
print(pathlib.Path(os.environ["LOOP_HOME"], "projects", "p.lock").exists())
')" "False"

check "a lock held by this live process blocks" "$(run '
from loopctl.registry import ProjectLock, LockBusy
with ProjectLock("p"):
    try:
        with ProjectLock("p"):
            print("took it twice")
    except LockBusy:
        print("blocked")
')" "blocked"

echo "a dead holder is reclaimed:"
check "a lock naming a dead pid is taken over" "$(run '
import json, os, pathlib, socket
from loopctl.registry import ProjectLock
p = pathlib.Path(os.environ["LOOP_HOME"], "projects", "p.lock")
p.parent.mkdir(parents=True, exist_ok=True)
# A pid that cannot exist: os.kill raises ProcessLookupError for it.
p.write_text(json.dumps({"host": socket.gethostname(), "pid": 2**22, "started_ts": 0}))
with ProjectLock("p"):
    print("reclaimed")
')" "reclaimed"

echo "anything ambiguous is left alone:"
check "another host's lock is not reclaimed" "$(run '
import json, os, pathlib
from loopctl.registry import ProjectLock, LockBusy
p = pathlib.Path(os.environ["LOOP_HOME"], "projects", "p.lock")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps({"host": "some-other-machine", "pid": 2**22, "started_ts": 0}))
try:
    with ProjectLock("p"):
        print("reclaimed")
except LockBusy:
    print("blocked")
')" "blocked"

check "an unparseable lock is not reclaimed" "$(run '
import os, pathlib
from loopctl.registry import ProjectLock, LockBusy
p = pathlib.Path(os.environ["LOOP_HOME"], "projects", "p.lock")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text("not json at all")
try:
    with ProjectLock("p"):
        print("reclaimed")
except LockBusy:
    print("blocked")
')" "blocked"

check "a lock with no pid is not reclaimed" "$(run '
import json, os, pathlib, socket
from loopctl.registry import ProjectLock, LockBusy
p = pathlib.Path(os.environ["LOOP_HOME"], "projects", "p.lock")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps({"host": socket.gethostname(), "started_ts": 0}))
try:
    with ProjectLock("p"):
        print("reclaimed")
except LockBusy:
    print("blocked")
')" "blocked"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
