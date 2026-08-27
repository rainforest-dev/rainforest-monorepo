#!/usr/bin/env bash
# Does an allowlist authorise only what it names, in the section where it names it?
#
# It did not. Measured 2026-08-25 against the company allowlist, whose Cleared
# section read `_(none yet — add task IDs above to greenlight them)_`:
#
#   * the worked example under it lived in `<!-- e.g. ... -->`, and a
#     line-at-a-time scan cannot see the fence -- so `106` and `31` were live
#     authorisations, and `-->` itself parsed as a bullet;
#   * every bulleted line in `## How to use` and `## Notes` counted too, as did
#     the YAML frontmatter `---` (`_BULLET` allows zero whitespace after `-`);
#   * `task_id` was compared with `in`, so enumerating 1..999 against that empty
#     list returned six matches: 1, 3, 6, 10, 31, 106.
#
# Nothing was exploitable, but only because the live ids had all migrated to
# `AG-<n>` -- a property of that day's data, not of the check.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/engine/lib"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
rank() { PYTHONPATH="$LIB" python3 -c '
import sys
from loopctl.scan import _greenlight_rank
task = {"id": sys.argv[1], "title": "", "metadata": {"item_id": sys.argv[2]}}
print(_greenlight_rank(task, sys.stdin.read()) is not None)
' "$1" "$2"; }

TEMPLATE='---
type: greenlight
---

# Company Loop — Greenlight List

## How to use
- Add a line under **Cleared** for each task: `- <id> — <title> · repo: <repo>`.

## Cleared
<!-- e.g.
- 106 — [FE] dashboard timezone · repo: service-dashboard-frontend
- 31  — [FE] client-side locale sort · repo: service-dashboard-frontend
-->
_(none yet — add task IDs above to greenlight them)_

## Notes
- Hard rules live in `.claude/company-loop.md`.
'
echo "an empty allowlist authorises nothing:"
for id in 106 31 1 3 6 10; do
  check "id $id is not authorised" "$(printf '%s' "$TEMPLATE" | rank "$id" "")" "False"
done

echo "a real entry still authorises, in both file shapes:"
GENERATED='# repo greenlight

## Cleared

- T-20260821210329
  ↳ detail · repo: x
'
HANDWRITTEN='# repo — authorised tasks
Written by hand.
- T-20260821210329 — some task
'
check "generated shape, by item_id" "$(printf '%s' "$GENERATED" | rank "path/x.md" "T-20260821210329")" "True"
check "generated shape, by task id" "$(printf '%s' "$GENERATED" | rank "T-20260821210329" "")" "True"
# No `## Cleared` at all: narrowing to nothing would silently revoke every entry
# these carry, so the section filter is skipped and only comments are stripped.
check "hand-written shape still works" "$(printf '%s' "$HANDWRITTEN" | rank "T-20260821210329" "")" "True"

echo "naming one id does not authorise its substrings:"
SUBSTR='# repo

## Cleared
- 106
'
check "106 is authorised"   "$(printf '%s' "$SUBSTR" | rank "106" "")" "True"
for id in 1 6 10; do
  check "but $id is not" "$(printf '%s' "$SUBSTR" | rank "$id" "")" "False"
done

echo "prose outside Cleared is not permission:"
PROSE='# repo

## Cleared
_(none)_

## Notes
- T-20260821210329 is discussed here but not cleared.
'
check "a bullet under ## Notes does not authorise" \
  "$(printf '%s' "$PROSE" | rank "T-20260821210329" "")" "False"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
