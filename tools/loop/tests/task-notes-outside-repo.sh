#!/usr/bin/env bash
# Can a code repo point at task notes kept in the vault?
#
# `tasks_dir` has always accepted an absolute path -- that is the arrangement
# for a work project whose decision record lives in Obsidian while its code
# does not. It never worked. Two faults, found 2026-08-26 by configuring one:
#
#   * `render()` in new_task.py wrote `name: {name}` unquoted, so the first
#     title containing a colon produced a note that YAML reads as a nested
#     mapping. The adapter turns that into `SourceUnreachable`, which marks the
#     *whole project* stale -- one bad note emptied the task list;
#   * the note's id was taken relative to `project.path`, which contains the
#     notes only when the project *is* the vault. Otherwise `relative_to`
#     raised `ValueError` from inside `enumerate_tasks`, below any
#     `SourceUnreachable` handling, killing the scan outright.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/engine/lib"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
VAULT="$TMP/vault"; REPO="$TMP/repo"
mkdir -p "$VAULT/_system/tasks" "$REPO/src"

note() { # file scope title
  cat > "$VAULT/_system/tasks/$1" <<NOTE
---
scope: $2
task_source: obsidian
task_id: $3
name: "$4"
status: todo
priority: P2
order:
---

## Acceptance
- something
NOTE
}
note a.md work-adhoc T-1001 'Probe: a title with a colon'
note b.md work-adhoc T-1002 'An ordinary title'
note c.md personal    T-1003 'Someone else, scoped personal'

enumerate() { # project_path tasks_dir scope
  PYTHONPATH="$LIB" python3 -c '
import sys, json
from pathlib import Path
from types import SimpleNamespace
from loopctl.adapters import obsidian_base
from loopctl.errors import SourceUnreachable
project = SimpleNamespace(
    path=Path(sys.argv[1]),
    source_config={"tasks_dir": sys.argv[2], "scope": sys.argv[3]},
)
try:
    tasks = obsidian_base.enumerate_tasks(project)
except SourceUnreachable as exc:
    print(json.dumps({"error": "SourceUnreachable", "detail": str(exc)}))
except Exception as exc:                      # the ValueError this test exists for
    print(json.dumps({"error": type(exc).__name__, "detail": str(exc)}))
else:
    print(json.dumps([
        {"id": t.id, "item_id": t.metadata.get("item_id"), "title": t.title} for t in tasks
    ]))
' "$1" "$2" "$3"; }

echo "== notes outside the repo: an absolute tasks_dir =="
OUT="$(enumerate "$REPO" "$VAULT/_system/tasks" work-adhoc)"
check "the scan does not raise"        "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).__class__ is list)')" "True"
check "both work-adhoc notes are seen" "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" "2"
check "the personal note is filtered"  "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(any(t["item_id"]=="T-1003" for t in json.load(sys.stdin)))')" "False"
check "id is relative to tasks_dir"    "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')" "a.md"
check "a colon in the title survives"  "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["title"])')" "Probe: a title with a colon"
check "item_id is the frontmatter id"  "$(printf '%s' "$OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["item_id"])')" "T-1001"

echo "== notes inside the project: ids must not move =="
mkdir -p "$REPO/_system/tasks"
cp "$VAULT/_system/tasks/b.md" "$REPO/_system/tasks/b.md"
OUT2="$(enumerate "$REPO" "_system/tasks" work-adhoc)"
check "a relative tasks_dir still works" "$(printf '%s' "$OUT2" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" "1"
check "id stays repo-relative"           "$(printf '%s' "$OUT2" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')" "_system/tasks/b.md"

echo "== a vault that is its own project: the personal arrangement =="
OUT3="$(enumerate "$VAULT" "_system/tasks" personal)"
check "personal notes enumerate"  "$(printf '%s' "$OUT3" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" "1"
check "id is vault-relative"      "$(printf '%s' "$OUT3" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')" "_system/tasks/c.md"

echo "== a malformed note is one note's problem, not the project's =="
# This asserted `SourceUnreachable`, which was an improvement on the crash it
# replaced but is still the second of the two faults named at the top of this
# file: SourceUnreachable marks the WHOLE project stale, so a typo in one note
# emptied the task list on both machines and said only "stale". The note is
# skipped now, with a warning on stderr naming it, and its neighbours enumerate.
printf -- '---\nscope: work-adhoc\nname: Probe: unquoted\n---\n' > "$VAULT/_system/tasks/bad.md"
OUT4="$(enumerate "$REPO" "$VAULT/_system/tasks" work-adhoc 2>"$ROOT/../.note-warning")"
# Both good work-adhoc notes -- the same two line 76 counts before bad.md exists.
check "its neighbours still enumerate" "$(printf '%s' "$OUT4" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else "error:"+str(d.get("error")))')" "2"
check "and the skipped one is named, not silent" "$(grep -c 'bad.md' "$ROOT/../.note-warning" || true)" "1"
rm -f "$ROOT/../.note-warning"

echo "== the title comes from wherever its writer put it =="
# 31 of 43 live notes are Notion-synced: no `name:`, title only in the body H1.
cat > "$VAULT/_system/tasks/AG-999.md" <<'NOTION'
---
task_id: "AG-999"
task_source: "notion"
scope: "work-adhoc"
status: "Todo"
---

# [FE] Dashboard timezone switcher
NOTION
rm -f "$VAULT/_system/tasks/bad.md"
OUT5="$(enumerate "$REPO" "$VAULT/_system/tasks" work-adhoc)"
title_of() { printf '%s' "$OUT5" | python3 -c '
import json, sys
print(next(t["title"] for t in json.load(sys.stdin) if t["item_id"] == sys.argv[1]))
' "$1"; }
check "H1 beats the filename stem" "$(title_of AG-999)" "[FE] Dashboard timezone switcher"
check "name: still wins over H1"   "$(title_of T-1002)" "An ordinary title"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
