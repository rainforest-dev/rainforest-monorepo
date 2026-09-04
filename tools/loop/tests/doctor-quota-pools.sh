#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV=${LOOP_TEST_VENV:-"$HOME/.claude/loop/.venv"}
export PYTHONPATH="${LOOP_TEST_ENGINE:-$HERE/../engine}/lib"
export PYTHONDONTWRITEBYTECODE=1
"$VENV/bin/python" "$HERE/doctor_quota_pools.py"
