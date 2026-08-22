#!/usr/bin/env bash
# Does ralph hand a turn-limited task to the next executor?
#
# Fully isolated: LOOP_HOME, LOOPCTL, CLAUDE_BIN, CODEX_BIN, LOOP_MACHINE and the
# quota file are all redirected, so the real install, its registry and its
# allowlists are never read or written. The allowlist created here names a task
# that exists only inside this sandbox -- it authorises nothing real.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Tests the engine in THIS tree, not whatever happens to be installed -- the point
# is to gate the code under review. The venv is borrowed from an install, because
# it is a build artifact and is not in the repo.
ENGINE=${LOOP_TEST_ENGINE:-"$HERE/../engine"}
VENV=${LOOP_TEST_VENV:-"$HOME/.claude/loop/.venv"}
INSTALLED=${LOOP_TEST_INSTALLED:-"$HOME/.claude/loop"}

[ -f "$ENGINE/ralph.sh" ] || { echo "engine not found at $ENGINE"; exit 2; }
[ -x "$VENV/bin/python" ] || {
  echo "no loopctl venv at $VENV — install first (tools/loop/install.sh), or set LOOP_TEST_VENV"
  exit 2
}

ROOT=$(mktemp -d /tmp/ralph-maxturns-XXXXXX)
HOME_DIR="$ROOT/loop-home"
# For an obsidian-base project, tasks_dir resolves against the PROJECT path, so
# the project and the vault are the same tree -- as they are for the real
# obsidian-vault entry. It is also a git repo, which the repo-moved guard reads.
VAULT="$ROOT/vault"
PROJECT="$VAULT"
MACHINE=test-host
TASK_ID=T-99999999999999

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  PASS  %s\n' "$1"
  else fail=$((fail+1)); printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fi
}

# --- sandboxed loop home -----------------------------------------------------
mkdir -p "$HOME_DIR/greenlight"
cp "$ENGINE/loopctl" "$ENGINE/ralph.sh" "$ENGINE/contract.md" \
   "$ENGINE/pyproject.toml" "$HOME_DIR/"
cp -R "$ENGINE/lib" "$HOME_DIR/lib"
ln -s "$VENV" "$HOME_DIR/.venv"

# --- the vault, which is also the project tree and a git repo ----------------
mkdir -p "$VAULT/_system/tasks"
git -C "$VAULT" init -q
printf 'seed\n' > "$VAULT/README.md"
git -C "$VAULT" add -A
git -C "$VAULT" -c commit.gpgsign=false -c user.email=t@t -c user.name=t commit -qm seed
cat > "$VAULT/_system/tasks/$TASK_ID.md" <<NOTE
---
task_id: "$TASK_ID"
status: Not started
priority: P2
points: 1
scope: personal
---

# Sandbox task

Exists only inside this test.
NOTE

cat > "$HOME_DIR/config.yaml" <<CFG
defaults:
  policy: greenlit-only
  dormant_days: 21
  budget_usd: 10
  max_iter: 15
  vault_path: $VAULT

projects:
  - slug: sandbox
    path: $PROJECT
    source: obsidian-base
    source_config:
      tasks_dir: _system/tasks
      scope: personal
    greenlight: $HOME_DIR/greenlight/sandbox.md
    policy: greenlit-only
    stop_at: pr-ready
    machines: [$MACHINE]
CFG

# The bullet names the task's `id`, which for an obsidian-base source is the note
# path -- not the bare T-… . _greenlight_rank matches on id, metadata.item_id, or
# title, and item_id only exists for Notion-sourced tasks.
cat > "$HOME_DIR/greenlight/sandbox.md" <<GL
# sandbox greenlight

## Cleared
- _system/tasks/$TASK_ID.md
GL

# --- fake executors ----------------------------------------------------------
# claude: behaves exactly as the real CLI does on turn exhaustion (measured
# 2026-07-29): the max-turns JSON on stdout, exit 1.
cat > "$ROOT/fake-claude" <<'FAKE'
#!/usr/bin/env bash
echo "claude" >> "$RALPH_TEST_CALLS"
cat <<'JSON'
{"type":"result","subtype":"error_max_turns","is_error":true,"num_turns":100,"total_cost_usd":1.23,"result":null}
JSON
exit 1
FAKE

# codex: must never run. If it does, it leaves its name in the call log.
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
echo "codex" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"success","result":"codex redid the work"}'
exit 0
FAKE
chmod +x "$ROOT/fake-claude" "$ROOT/fake-codex"

# --- quota gate: force "ok" so it is not what stops the run ------------------
mkdir -p "$ROOT/quota/_system/usage"
cat > "$ROOT/quota/_system/usage/quota.$MACHINE.json" <<Q
{"claude": {"five_hour": {"used_pct": 10}, "weekly_all": {"used_pct": 10}}}
Q

export LOOP_HOME="$HOME_DIR"
export LOOPCTL="$HOME_DIR/loopctl"
export LOOP_CONTRACT="$HOME_DIR/contract.md"
export LOOP_VAULT_PATH="$VAULT"
export LOOP_MACHINE="$MACHINE"
export CLAUDE_BIN="$ROOT/fake-claude"
export CODEX_BIN="$ROOT/fake-codex"
export AGY_BIN=/nonexistent/agy
export LOOP_EXECUTORS=claude,codex,agy
export LOOP_QUOTA_FILE="$ROOT/quota/_system/usage/quota.$MACHINE.json"
export RALPH_TEST_CALLS="$ROOT/calls.log"
export RALPH_MAX_TURNS=100
: > "$RALPH_TEST_CALLS"

echo "  scan:"
"$LOOPCTL" scan sandbox >/dev/null 2>&1 || echo "        scan failed"
candidates=$("$LOOPCTL" next sandbox 2>/dev/null | "$VENV/bin/python" -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
check "sandbox 有 1 個 greenlit 候選（前置條件）" "$candidates" "1"
[ "$candidates" = "1" ] || { echo "  前置條件失敗，測試無意義"; echo "  $ROOT"; exit 1; }

echo "  ralph:"
set +e
bash "$HOME_DIR/ralph.sh" 1 10 > "$ROOT/ralph.out" 2>&1
ralph_exit=$?
set -e
sed 's/^/        /' "$ROOT/ralph.out"

echo
calls=$(tr '\n' ' ' < "$RALPH_TEST_CALLS" | sed 's/ *$//')
check "claude 被呼叫" "$(grep -c '^claude$' "$RALPH_TEST_CALLS" | tr -d ' ')" "1"
check "codex 沒有被呼叫（核心：不 fallback）" "$(grep -c '^codex$' "$RALPH_TEST_CALLS" | tr -d ' ')" "0"
check "呼叫序列只有 claude" "$calls" "claude"
check "ralph exit 1" "$ralph_exit" "1"
check "log 說明 turn limit" "$(grep -c 'turn limit (100) reached' "$ROOT/ralph.out" | tr -d ' ')" "1"
check "log 明說不會傳給下一個" "$(grep -c 'NOT passed on' "$ROOT/ralph.out" | tr -d ' ')" "1"
check "log 記下這次花費" "$(grep -c 'spent \$1.23' "$ROOT/ralph.out" | tr -d ' ')" "1"
check "log 未出現舊的 fallback 字樣" "$(grep -c 'trying next executor' "$ROOT/ralph.out" | tr -d ' ')" "0"
# `grep -c` only prefixes `filename:` when it is given more than one file, so
# counting non-":0" lines reported a hit whenever the installed greenlight dir
# held exactly one allowlist -- a bare "0" does not end in ":0". `-l` lists the
# files that matched and nothing else, which is the question being asked.
check "真環境的 allowlist 未被碰" \
  "$(grep -l "$TASK_ID" "$INSTALLED/greenlight/"*.md 2>/dev/null | wc -l | tr -d ' ')" "0"

# The spend is real whether or not the task finished; a ledger that omits it
# understates the task's cost. Assert the entry, not just the absence of an error.
LEDGER="$VAULT/_system/usage/loop-runs.$MACHINE.jsonl"
ledger_row=$("$VENV/bin/python" - "$LEDGER" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
if not p.exists():
    print("NO_FILE"); raise SystemExit
rows = [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
if len(rows) != 1:
    print(f"ROWS={len(rows)}"); raise SystemExit
r = rows[0]
# The cost used to be read back off this row. It is not written here any more:
# it arrives on the executor's own telemetry under the run_id below, so what
# the row has to prove is that the id exists to join them by.
print("{}|{}|{}".format(
    r.get("status"), "run_id" if r.get("run_id") else "NO-RUN-ID", r.get("executor")))
PY
)
# `incomplete` 說不出「用完預算」和「做不到」的差別，而這兩者對「這個 task 值不
# 值得配額」是相反的答案。turns_exhausted 是自己一桶，永遠不算失敗。
check "ledger 記為 turns_exhausted 且可連回 telemetry" "$ledger_row" "turns_exhausted|run_id|claude"

# The whole point of the turn-limit branch is that the session can be picked up.
# Assert the command is printed and reaches the task card, not just that we logged
# something.
check "log 印出可直接跑的 resume 指令" "$(grep -c "claude --resume" "$ROOT/ralph.out" | tr -d ' ')" "1"
# Only what ralph owns: a complete, runnable command. Where the CLI keeps the
# transcript is its own business, and `cd <path> && claude --resume <id>` does not
# depend on that encoding -- so asserting the file's location would test the CLI,
# not this branch. That resume restores context was verified separately against a
# real session.
check "resume 指令完整（cd + 36 字元 session id）" \
  "$(grep -cE "cd '.*' && claude --resume [A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}" "$ROOT/ralph.out" | tr -d ' ')" "1"
# Matched by content, not by key. How the overlay is keyed is the code's business
# -- for an obsidian-base task it is the note path, for a Notion one the AG- id --
# and duplicating that rule here would just test the test.
progress_note=$("$VENV/bin/python" - "$VAULT/_system/usage/tasks-progress.json" <<'PYNOTE'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
if not p.exists():
    print("NO_FILE"); raise SystemExit
entries = (json.loads(p.read_text()).get("tasks") or {})
hits = [k for k, v in entries.items() if "claude --resume" in ((v or {}).get("note") or "")]
if len(hits) == 1:
    print("HAS_RESUME")
elif not entries:
    print("NO_ENTRIES")
else:
    print(f"NO_RESUME(keys={list(entries)[:2]})")
PYNOTE
)
check "task note 帶著 resume 指令（Observatory 讀得到）" "$progress_note" "HAS_RESUME"

echo
echo "  $pass/$((pass+fail))"
[ "$fail" -eq 0 ] && rm -rf "$ROOT" || echo "  保留現場: $ROOT"
exit "$fail"
