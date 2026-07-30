#!/usr/bin/env bash
# Does a task's preset reach the executor as a real model/effort flag, and does
# the run record keep what ran?
#
# The three things this gates, each of which was silently broken or absent:
#   1. `--model` / `--effort` on claude, `-m` / `-c model_reasoning_effort=` on
#      codex. Neither executor was ever told which model to use, so a plan card
#      naming Opus 4.8 while the CLI default was Opus 5 was simply a lie.
#   2. No agent config, or an unknown preset, must change nothing -- the loop has
#      to keep working exactly as it did for tasks with no preset.
#   3. `model`, `effort` and the quota before/after must land in the run record
#      as fields. They previously existed only inside a free-text note, or (for
#      effort) nowhere at all, so "was xhigh worth it" was unanswerable.
#
# Fully isolated: LOOP_HOME, LOOPCTL, CLAUDE_BIN, CODEX_BIN, LOOP_MACHINE, the
# quota file and the agent config are all redirected. The allowlist created here
# names a task that exists only inside this sandbox -- it authorises nothing real.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE=${LOOP_TEST_ENGINE:-"$HERE/../engine"}
VENV=${LOOP_TEST_VENV:-"$HOME/.claude/loop/.venv"}

[ -f "$ENGINE/ralph.sh" ] || { echo "engine not found at $ENGINE"; exit 2; }
[ -x "$VENV/bin/python" ] || {
  echo "no loopctl venv at $VENV — install first (tools/loop/install.sh), or set LOOP_TEST_VENV"
  exit 2
}

ROOT=$(mktemp -d /tmp/ralph-presets-XXXXXX)
HOME_DIR="$ROOT/loop-home"
VAULT="$ROOT/vault"
PROJECT="$VAULT"
MACHINE=test-host
TASK_ID=T-99999999999999
TASK_KEY="_system/tasks/$TASK_ID.md"

pass=0; fail=0
check() {
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  PASS  %s\n' "$1"
  else fail=$((fail+1)); printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fi
}
contains() {
  case "$2" in *"$3"*) check "$1" yes yes ;; *) check "$1" "missing: $3" "present in: $2" ;; esac
}
excludes() {
  case "$2" in *"$3"*) check "$1" "present: $3" "absent" ;; *) check "$1" yes yes ;; esac
}

# --- sandboxed loop home -----------------------------------------------------
mkdir -p "$HOME_DIR/greenlight"
cp "$ENGINE/loopctl" "$ENGINE/ralph.sh" "$ENGINE/contract.md" \
   "$ENGINE/pyproject.toml" "$HOME_DIR/"
cp -R "$ENGINE/lib" "$HOME_DIR/lib"
ln -s "$VENV" "$HOME_DIR/.venv"

# --- the vault, which is also the project tree and a git repo ----------------
mkdir -p "$VAULT/_system/tasks" "$VAULT/_system/usage"
git -C "$VAULT" init -q
printf 'seed\n' > "$VAULT/README.md"
git -C "$VAULT" add -A
git -C "$VAULT" -c commit.gpgsign=false -c user.email=t@t -c user.name=t commit -qm seed
cat > "$VAULT/$TASK_KEY" <<NOTE
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

cat > "$HOME_DIR/greenlight/sandbox.md" <<GL
# sandbox greenlight

## Cleared
- $TASK_KEY
GL

# --- fake executors: record the exact argv they were handed ------------------
cat > "$ROOT/fake-claude" <<'FAKE'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"success","total_cost_usd":0.5,"usage":{"output_tokens":4242},"result":"done"}'
exit 0
FAKE
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"success","result":"done"}'
exit 0
FAKE
chmod +x "$ROOT/fake-claude" "$ROOT/fake-codex"

mkdir -p "$ROOT/quota/_system/usage"
write_quota() {
  cat > "$ROOT/quota/_system/usage/quota.$MACHINE.json" <<Q
{"claude": {"five_hour": {"used_pct": $1}, "weekly_all": {"used_pct": $2}}}
Q
}
write_quota 10 20

export LOOP_HOME="$HOME_DIR"
export LOOPCTL="$HOME_DIR/loopctl"
export LOOP_CONTRACT="$HOME_DIR/contract.md"
export LOOP_VAULT_PATH="$VAULT"
export VAULT_PATH="$VAULT"
export LOOP_MACHINE="$MACHINE"
export CLAUDE_BIN="$ROOT/fake-claude"
export CODEX_BIN="$ROOT/fake-codex"
export AGY_BIN=/nonexistent/agy
export LOOP_EXECUTORS=claude,codex,agy
export LOOP_QUOTA_FILE="$ROOT/quota/_system/usage/quota.$MACHINE.json"
export RALPH_TEST_CALLS="$ROOT/calls.log"
# No usage runtime in the sandbox, so refresh_quota is a no-op and the quota file
# written above is what both samples read.
export LOOP_USAGE_RUNTIME="$ROOT/no-such-runtime"

"$LOOPCTL" scan sandbox >/dev/null 2>&1 || echo "  scan failed"

runs_file="$VAULT/_system/usage/loop-runs.$MACHINE.jsonl"
run_ralph() {
  : > "$RALPH_TEST_CALLS"
  rm -f "$runs_file"
  "$HOME_DIR/ralph.sh" 1 10 >/dev/null 2>&1
}
last_run_field() {
  [ -f "$runs_file" ] || { printf 'NO-RUN-RECORD'; return; }
  "$VENV/bin/python" - "$runs_file" "$1" <<'PY'
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
if not rows:
    print("NO-RUN-RECORD"); raise SystemExit
value = rows[-1]
for part in sys.argv[2].split("."):
    value = (value or {}).get(part) if isinstance(value, dict) else None
print("" if value is None else value)
PY
}

# --- 1. a claude preset reaches the CLI as real flags ------------------------
echo "  claude preset:"
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"deep": {"provider": "claude", "model": "claude-opus-5", "effort": "xhigh"}},
  "tasks": {"$TASK_KEY": {"preset": "deep"}}
}
JSON
export LOOP_AGENT_CONFIG="$ROOT/agents.json"
run_ralph
calls=$(cat "$RALPH_TEST_CALLS")
contains "claude is told the model" "$calls" -- "--model claude-opus-5"
contains "claude is told the effort" "$calls" "--effort xhigh"
check "the run record keeps the model" "$(last_run_field model)" "claude-opus-5"
check "the run record keeps the effort" "$(last_run_field effort)" "xhigh"
check "the run record keeps output tokens" "$(last_run_field tokens_out)" "4242"

# --- 2. quota is recorded as fields, with the delta computed -----------------
echo "  quota fields:"
check "5h before is a number" "$(last_run_field quota.five_hour_before)" "10.0"
check "weekly before is a number" "$(last_run_field quota.weekly_before)" "20.0"
check "5h delta is computed" "$(last_run_field quota.five_hour_delta_pp)" "0.0"

# --- 3. a codex preset uses codex's own flag spelling ------------------------
echo "  codex preset:"
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"trial-terra": {"provider": "codex", "model": "gpt-5.6-terra", "effort": "medium"}},
  "tasks": {"$TASK_KEY": {"preset": "trial-terra"}}
}
JSON
run_ralph
calls=$(cat "$RALPH_TEST_CALLS")
contains "codex ran, not claude" "$calls" "codex "
contains "codex is told the model" "$calls" "-m gpt-5.6-terra"
contains "codex effort goes through -c" "$calls" "-c model_reasoning_effort=medium"

# --- 4. no config at all: unchanged behaviour --------------------------------
# The regression that matters most. A task with no preset must invoke the CLI
# exactly as before, or every existing task changes behaviour on upgrade.
echo "  no agent config:"
unset LOOP_AGENT_CONFIG
run_ralph
calls=$(cat "$RALPH_TEST_CALLS")
contains "claude still runs" "$calls" "claude "
excludes "no model flag is invented" "$calls" "--model"
excludes "no effort flag is invented" "$calls" "--effort"
check "the run record leaves model empty" "$(last_run_field model)" ""

# --- 5. an unknown preset falls back rather than failing ---------------------
echo "  unknown preset:"
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"deep": {"provider": "claude", "model": "claude-opus-5", "effort": "xhigh"}},
  "tasks": {"$TASK_KEY": {"preset": "no-such-preset"}}
}
JSON
export LOOP_AGENT_CONFIG="$ROOT/agents.json"
run_ralph
calls=$(cat "$RALPH_TEST_CALLS")
contains "claude still runs on an unknown preset" "$calls" "claude "
excludes "an unknown preset invents no model" "$calls" "--model"

# --- 5b. a fallback to another provider must not carry the model with it ------
# Measured failure, 2026-07-30: a codex-routed task fell back to claude still
# carrying `--model gpt-5.6-terra`, and claude refused the model rather than
# running. A model name belongs to one provider.
echo "  fallback drops the model:"
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"trial-terra": {"provider": "codex", "model": "gpt-5.6-terra", "effort": "medium"}},
  "tasks": {"$TASK_KEY": {"preset": "trial-terra"}}
}
JSON
export LOOP_AGENT_CONFIG="$ROOT/agents.json"
# codex reports a rate limit, so ralph moves on to claude.
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"error","message":"rate limit reached"}'
exit 1
FAKE
chmod +x "$ROOT/fake-codex"
run_ralph
calls=$(cat "$RALPH_TEST_CALLS")
contains "codex was tried first, with its model" "$calls" "-m gpt-5.6-terra"
claude_line=$(printf '%s\n' "$calls" | grep '^claude ' || true)
check "claude was reached as the fallback" "$([ -n "$claude_line" ] && echo yes || echo no)" "yes"
excludes "the fallback carries no foreign model" "$claude_line" "gpt-5.6-terra"
excludes "the fallback carries no effort either" "$claude_line" "--effort"
# Restore the success-shaped codex for anything after this.
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"success","result":"done"}'
exit 0
FAKE
chmod +x "$ROOT/fake-codex"

# --- 6. a Notion-shaped task: id is a URL, the config is keyed by item_id -----
# The near-miss this exists for. A Notion task's `id` is its page URL, while the
# key a person writes in the config -- and the one the greenlight file and the
# contract already use -- is `metadata.item_id` (`AG-132`). Looking up by `id`
# alone matched nothing, so every task silently fell through to default_preset
# and the whole routing experiment would have run on one model.
echo "  notion-shaped id:"
cat > "$ROOT/agents.json" <<'JSON'
{
  "default_agent": "claude",
  "default_preset": "slice",
  "presets": {
    "slice": {"provider": "claude", "model": "claude-opus-5", "effort": "high"},
    "trial-terra": {"provider": "codex", "model": "gpt-5.6-terra", "effort": "medium"}
  },
  "tasks": {"AG-132": {"preset": "trial-terra"}}
}
JSON
resolver="$ROOT/resolver.sh"
awk '/^preferred_plan\(\) \{/,/^\}/' "$HOME_DIR/ralph.sh" > "$resolver"
resolve() {
  AGENT_CONFIG="$ROOT/agents.json" PYTHON_BIN="$VENV/bin/python" \
    bash -c '. "$1"; preferred_plan "$2" "$3"' _ "$resolver" "$2" "$3" | tr '\t' ' '
}
url="https://app.notion.com/p/39f0f67c1d0c81aaba20dd126c204cc8"
check "item_id wins over the url id" "$(resolve _ "$url" AG-132)" "codex gpt-5.6-terra medium"
check "an unmapped item_id takes the default preset" "$(resolve _ "$url" AG-999)" "claude claude-opus-5 high"
# A source with no item_id at all (obsidian-base) must still resolve by id.
cat > "$ROOT/agents.json" <<'JSON'
{
  "default_agent": "claude",
  "presets": {"deep": {"provider": "claude", "model": "claude-opus-5", "effort": "xhigh"}},
  "tasks": {"_system/tasks/T-1.md": {"preset": "deep"}}
}
JSON
check "id still resolves when there is no item_id" "$(resolve _ "_system/tasks/T-1.md" "")" "claude claude-opus-5 xhigh"

printf '\n  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
rm -rf "$ROOT"
