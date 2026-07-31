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
# Codex speaks newline-delimited events, not claude's single result object. The
# fake used to emit claude's shape, which is why nothing caught that ralph read
# output tokens with one `json.loads` of the whole blob -- a parse that fails on
# every real codex run.
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"thread.started","thread_id":"t-1"}'
echo '{"type":"turn.started"}'
echo '{"type":"item.completed","item":{"id":"i-1","type":"agent_message","text":"done"}}'
echo '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":800,"output_tokens":777,"reasoning_output_tokens":123}}'
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

# The executor's output used to be read for a cost figure and then dropped, so a
# failed run left no evidence at all — and codex kept no session either, because
# it still ran with --ephemeral then. Transcripts remain the primary record: they
# cover every executor, and unlike codex sessions they are pruned.
transcripts=$(ls -1 "$HOME_DIR/transcripts"/*.log 2>/dev/null | wc -l | tr -d ' ')
check "the executor output is kept" "$([ "${transcripts:-0}" -ge 1 ] && echo yes || echo no)" "yes"
newest=$(ls -1t "$HOME_DIR/transcripts"/*.log 2>/dev/null | head -1)
contains "the transcript holds what the executor said" "$(cat "$newest" 2>/dev/null)" "4242"
case "$(basename "${newest:-}")" in
  *-claude-*) check "the transcript names the executor" yes yes ;;
  *) check "the transcript names the executor" "$(basename "${newest:-none}")" "…-claude-…" ;;
esac

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
# Measured 2026-07-30: without this, `loopctl scan` inside the codex sandbox
# exits 2 on a lock it cannot create in LOOP_HOME, and the executor correctly
# refuses to start work. claude has had the same grant since 2026-07-29.
contains "codex can reach LOOP_HOME" "$calls" "--add-dir $HOME_DIR"
# Measured 2026-07-30, three AG-132 runs: workspace-write denies the network, so
# `loopctl scan` could not resolve the task's PR with `gh pr list`, the registry
# read stale, and the contract stopped the run. Pushing the branch needs it too.
contains "codex can reach the network" "$calls" \
  "-c sandbox_workspace_write.network_access=true"
# Measured 2026-07-30: every codex run recorded tokens_out as null, because the
# reader parsed the whole blob as claude's single result object. `reasoning` is
# deliberately not added in -- see executor_tokens_out.
check "the run record keeps codex output tokens" "$(last_run_field tokens_out)" "777"
# Dropped 2026-07-30 so a loop run is reopenable with `codex resume` and visible
# in the ChatGPT app. It is one word, easy to reinstate by reflex, and doing so
# would silently take that back.
excludes "codex sessions are not thrown away" "$calls" "--ephemeral"

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
echo '{"type":"turn.completed","usage":{"output_tokens":777}}'
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

# --- 7. one host, one telemetry partition ------------------------------------
# On 2026-07-30 an executor recorded its own iteration row with
# `--machine "Angible's MacBook Air"` -- the macOS display name, not the host
# name -- and the row landed in a second .jsonl beside the real one. Same run,
# same host, two files, neither complete. The name picks the file, so a
# free-form value has to fail rather than fork the data.
echo "  one machine, one partition:"
before=$(ls "$VAULT/_system/usage/" | wc -l | tr -d ' ')
bogus_out=$("$LOOPCTL" record-run --project sandbox --task "$TASK_KEY" \
  --executor codex --machine "Some Laptop’s Display Name" 2>&1)
check "a foreign machine name is refused" "$?" "2"
contains "the error names this host" "$bogus_out" "$MACHINE"
after=$(ls "$VAULT/_system/usage/" | wc -l | tr -d ' ')
check "no second partition was created" "$after" "$before"
# The host's own name still works, or the guard would have broken recording.
"$LOOPCTL" record-run --project sandbox --task "$TASK_KEY" \
  --executor codex --machine "$MACHINE" >/dev/null 2>&1
check "this host's own name still records" "$?" "0"
# The regression the first guard shipped with: ralph derives the machine name
# with `hostname -s` while loopctl defaulted to os.uname().nodename, which on
# macOS carries `.local`. The guard then rejected ralph's own record-run and a
# 2026-07-30 run logged "run ledger unavailable" with no row written. Same host,
# two spellings -- accepted, and filed under one name.
"$LOOPCTL" record-run --project sandbox --task "$TASK_KEY" \
  --executor codex --machine "$MACHINE.local" >/dev/null 2>&1
check "a .local spelling of this host is accepted" "$?" "0"
partitions=$(ls "$VAULT/_system/usage/" | grep -c '^loop-runs\.' || true)
check "both spellings share one partition" "$partitions" "1"
# The invariant that actually broke: ralph and loopctl each derive the machine name
# independently, and on 2026-07-30 they disagreed -- ralph used `hostname -s`,
# loopctl used os.uname().nodename. DHCP then moved the short name mid-session and
# opened a third partition, while the quota gate read a file that did not exist.
# With nothing pinned, both must land on the same string.
ralph_derived=$(env -u LOOP_MACHINE -u USAGE_MACHINE bash -c \
  'm=${LOOP_MACHINE:-${USAGE_MACHINE:-$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null)}}; printf "%s" "${m%%.*}"')
loopctl_derived=$(env -u LOOP_MACHINE PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.scan import _host_machine; print(_host_machine())')
check "ralph and loopctl derive one machine name" "$ralph_derived" "$loopctl_derived"
check "the derived name carries no domain suffix" "${loopctl_derived##*.}" "$loopctl_derived"
# install.sh and relay/pull.sh derive it too, and install.sh failing to find the
# host in hosts.yaml is how the third site was found -- after the first fix
# claimed "both sides agree". Compare the literal expression so a fourth site
# cannot drift silently.
canon='$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null)'
for f in install.sh relay/pull.sh engine/ralph.sh; do
  hits=$(grep -c -F "$canon" "$ENGINE/../$f" 2>/dev/null || echo 0)
  check "$f derives the machine name the one way" "$hits" "1"
done

# --- 8. a failing signal says why -------------------------------------------
# `gh pr list failed for branch X (exit 1)` reads like a branch problem. On
# 2026-07-30 it was the wrong gh account, and the answer was in the stderr the
# runner captured and threw away.
echo "  signal failures are legible:"
signal_msg=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" - <<'PYEOF'
from loopctl import signals
from loopctl.errors import SourceUnreachable
try:
    signals.run_full(["/bin/sh", "-c", "echo boom-from-stderr >&2; exit 1"], ".")
except SourceUnreachable as exc:
    print("unexpected:", exc); raise SystemExit
code, out, err = signals.run_full(["/bin/sh", "-c", "echo boom-from-stderr >&2; exit 1"], ".")
print(f"{code}|{err}|{signals._why(err)}")
PYEOF
)
contains "run_full keeps stderr" "$signal_msg" "boom-from-stderr"
contains "the reason is appended, not swallowed" "$signal_msg" ": boom-from-stderr"

# --- 9. gh is pinned to the project's account, not to ambient state ----------
# `gh auth switch` is global. Merging on the personal repo left gh personal, and
# the next company iteration read the registry as stale. A project that names an
# account gets a token minted for it; one that names none is left alone.
echo "  gh account is per project:"
mkdir -p "$ROOT/ghbin"
cat > "$ROOT/ghbin/gh" <<'FAKE'
#!/usr/bin/env bash
if [ "$1" = "auth" ] && [ "$2" = "token" ]; then
  [ "$4" = "known-account" ] && { echo "token-for-$4"; exit 0; }
  exit 1
fi
exit 0
FAKE
chmod +x "$ROOT/ghbin/gh"
gh_probe() {
  PATH="$ROOT/ghbin:$PATH" PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" - "$1" <<'PYEOF'
import os, sys, types
from loopctl.scan import _gh_account
project = types.SimpleNamespace(account=(sys.argv[1] or None))
os.environ.pop("GH_TOKEN", None)
with _gh_account(project):
    print("inside=" + os.environ.get("GH_TOKEN", "(unset)"))
print("after=" + os.environ.get("GH_TOKEN", "(unset)"))
PYEOF
}
contains "a named account mints a token" "$(gh_probe known-account)" "inside=token-for-known-account"
contains "the token does not outlive the scan" "$(gh_probe known-account)" "after=(unset)"
contains "no account leaves the ambient login alone" "$(gh_probe '')" "inside=(unset)"
contains "an unmintable account falls through" "$(gh_probe other-account)" "inside=(unset)"
# --- 10. a refused Observatory mirror is reported, not swallowed -------------
# On 2026-07-30 the executor took AG-132 to pr-ready inside the codex sandbox.
# The registry recorded it and `loopctl set` reported success, while the mirror
# write was refused with "Operation not permitted" and Loop Observatory went on
# showing "Queued". Still non-fatal -- an unavailable vault must not stop a run --
# but the caller is told.
echo "  a refused mirror is visible:"
readonly_vault="$ROOT/readonly-vault"
mkdir -p "$readonly_vault/_system/usage"
chmod a-w "$readonly_vault/_system/usage"
mirror_out=$(LOOP_VAULT_PATH="$readonly_vault" "$LOOPCTL" set sandbox "$TASK_KEY" queued --note "mirror probe" 2>&1)
mirror_rc=$?
chmod u+w "$readonly_vault/_system/usage"
check "the set still succeeds" "$mirror_rc" "0"
contains "the refused mirror is named" "$mirror_out" "mirror_error"
contains "and says what refused it" "$mirror_out" "Permission denied"
# The happy path must stay clean, or every run would look broken.
clean_out=$("$LOOPCTL" set sandbox "$TASK_KEY" queued --note "mirror probe ok" 2>&1)
excludes "a working mirror reports nothing" "$clean_out" "mirror_error"

printf '\n  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
rm -rf "$ROOT"
