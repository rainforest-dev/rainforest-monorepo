#!/usr/bin/env bash
# The assignment rule was unreadable from anywhere but the host that held it.
#
# scan.py:492 refuses a project whose `machines` list does not name this host.
# That list lived only in ~/.claude/loop/projects/<slug>.json, so Loop
# Observatory -- which sees the vault and nothing else -- could list 33 tasks
# without being able to say which machine would pick any of them up. The two
# hosts' configs are disjoint, so even reading one of them answers nothing
# about the other's work.
#
# These assert the publication that closes it, and the two ways it could close
# it wrongly: by leaking the scan document's task titles and absolute paths into
# an iCloud-synced file, or by writing during --dry-run.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0
fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else printf '  FAIL  %s\n        got:  %s\n        want: %s\n' "$1" "$2" "$3"; fail=$((fail + 1)); fi
}

V=$(mktemp -d)
export VAULT_PATH="$V"
OUT=$(PYTHONPATH=engine/lib python3 - <<'PY' 2>&1
import json, pathlib, os
from loopctl.writeback import publish_project_assignment
docs = [{
    "slug": "sdf", "machines": ["laptop", "rainforest-air"], "lifecycle": "active",
    "path": "/Users/someone/Repositories/sdf",
    "tasks": [{"metadata": {"item_id": "AG-1"}, "title": "a private ticket title"},
              {"metadata": {}, "title": "no item id at all"}],
}]
p = publish_project_assignment(docs, machine="rainforest-air", now_ts=1)
print(pathlib.Path(p).name)
print(pathlib.Path(p).read_text())
PY
)

echo "== published per host, like every other cross-machine fact here =="
check "file is named for the machine" \
  "$(printf '%s' "$OUT" | head -1)" "projects.rainforest-air.json"

echo "== carries the join columns =="
check "keeps the machines list" \
  "$(printf '%s' "$OUT" | grep -c '"rainforest-air"')" "2"
check "keeps task item_ids" \
  "$(printf '%s' "$OUT" | grep -c '"AG-1"')" "1"
# A task with no item_id cannot be joined to tasks.json. Left out, not guessed.
check "drops a task with no item_id" \
  "$(printf '%s' "$OUT" | grep -c 'no item id at all')" "0"

echo "== slim, because this lands in a vault that syncs to phones =="
check "no task titles" \
  "$(printf '%s' "$OUT" | grep -c 'a private ticket title')" "0"
check "no absolute paths" \
  "$(printf '%s' "$OUT" | grep -c 'Repositories/sdf')" "0"

echo "== --dry-run must not publish =="
# The scan loop guards on args.dry_run. A dry run that writes to the vault is
# not a dry run, and this is the assertion that would catch that guard being
# dropped.
check "the scan loop guards the publish on dry_run" \
  "$(grep -c 'if scanned and not args.dry_run:' engine/lib/loopctl/scan.py)" "1"

echo "== failure is reported, not swallowed =="
# publish_task_state set the convention: best-effort, but never silent. Nothing
# downstream can tell a host that never published from one that published
# nothing.
check "an unpublishable vault prints a reason" \
  "$(grep -c 'assignment not published' engine/lib/loopctl/scan.py)" "1"

rm -rf "$V"
echo
if [ "$fail" -eq 0 ]; then echo "  $pass passed, 0 failed"; else echo "  $pass passed, $fail failed"; exit 1; fi
