#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV=${LOOP_TEST_VENV:-"$HOME/.claude/loop/.venv"}
ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
LOOP_HOME="$ROOT" PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="${LOOP_TEST_ENGINE:-$HERE/../engine}/lib" "$VENV/bin/python" - <<'PY'
from types import SimpleNamespace
from loopctl.scan import next_candidates

project = SimpleNamespace(slug="test", policy="autonomous", source="obsidian-base", machines=[], stop_at="done")
states = ["not-started", "blocked", "queued", "pr-ready", "in-progress"]
tasks = [{"id": s, "state": s, "title": s, "metadata": {}} for s in states]
actual = [t["id"] for t in next_candidates(project, {"tasks": tasks})]
assert actual, "positive control returned no candidates"
assert actual == ["in-progress", "pr-ready", "queued", "not-started"], actual
project.stop_at = "pr-ready"
assert [t["id"] for t in next_candidates(project, {"tasks": tasks})] == ["in-progress", "queued", "not-started"]
print("PASS candidate order is unchanged; blocked has no place in the queue")
PY
