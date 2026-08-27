#!/usr/bin/env bash
# Does the loop see a commit the executor made in a worktree of its own?
#
# It did not. `head_before`/`head_after` compared `rev-parse HEAD` of the one
# path the loop handed the executor, so a commit anywhere else -- which is every
# commit, once the executor creates its own worktree -- read as `no commit`, and
# `run_branch` recorded the branch the loop started on rather than the one the
# work is on.
#
# Pointing projects at a repository root instead of a dedicated loop checkout is
# what makes this load-bearing: the root is a person's working tree (measured
# 2026-08-25, service-dashboard-frontend sat on `dev` with 13 uncommitted files),
# so the executor must work elsewhere and the loop must still see it.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# repo_heads, lifted from ralph.sh so the test exercises the shipped definition.
LIB=$(mktemp); trap 'rm -f "$LIB"' EXIT
awk '/^repo_heads\(\) \{/,/^}/' "$ROOT/engine/ralph.sh" > "$LIB"
# shellcheck disable=SC1090
. "$LIB"
[ "$(type -t repo_heads)" = "function" ] || { echo "  repo_heads not extracted"; exit 1; }

SANDBOX=$(mktemp -d); trap 'rm -f "$LIB"; rm -rf "$SANDBOX"' EXIT
REPO="$SANDBOX/repo"
git init -q "$REPO"
git -C "$REPO" -c user.email=t@t -c user.name=t commit -q --allow-empty -m base
BASE_BRANCH=$(git -C "$REPO" rev-parse --abbrev-ref HEAD)

before=$(repo_heads "$REPO")
check "one worktree, one head" "$(echo "$before" | wc -w | tr -d ' ')" "1"

# The executor creates its own worktree and commits there. The handed path's HEAD
# never moves.
handed_before=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" worktree add -q -b task/x "$REPO/.claude/worktrees/x" "$BASE_BRANCH"
git -C "$REPO/.claude/worktrees/x" -c user.email=t@t -c user.name=t \
  commit -q --allow-empty -m "work done elsewhere"
handed_after=$(git -C "$REPO" rev-parse HEAD)
after=$(repo_heads "$REPO")

check "the handed path's HEAD did not move" "$handed_before" "$handed_after"
check "but the head set changed" "$([ "$before" != "$after" ] && echo yes || echo no)" "yes"
check "so the old check would say no-commit" "$([ "$handed_before" = "$handed_after" ] && echo no-commit || echo committed)" "no-commit"
check "and the new check says committed" "$([ "$before" != "$after" ] && echo committed || echo no-commit)" "committed"

# Which worktree, so the log can name it and run_branch can read from it.
found=$(git -C "$REPO" worktree list --porcelain 2>/dev/null \
  | awk -v known=" $before " '
      /^worktree /{wt=$2}
      /^HEAD /{ if (index(known, " " $2 " ") == 0) { print wt; exit } }')
check "the new worktree is identified" "$(basename "$found")" "x"
check "and its branch is readable" "$(git -C "$found" rev-parse --abbrev-ref HEAD)" "task/x"

# A run that changes nothing must still read as nothing.
quiet_before=$(repo_heads "$REPO")
check "no commit means no change" "$([ "$quiet_before" = "$(repo_heads "$REPO")" ] && echo same || echo changed)" "same"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
