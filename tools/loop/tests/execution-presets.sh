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
# `-b main`, not bare `init`. loopctl's base defaults to "main"
# (adapters/common.py), and commits_ahead runs `git rev-list main..<branch>`,
# which exits non-zero when main does not exist and raises SourceUnreachable.
# A bare `git init` takes the branch name from the machine's
# init.defaultBranch, so this sandbox was `main` on a dev box that sets it and
# `master` on one that does not -- and on `master` the task was still selected
# but arrived with its branch dropped, so ralph read it as not-yet-started and
# switched executors. Reproduced exactly by running this suite with
# GIT_CONFIG_GLOBAL pointing at init.defaultBranch=master: 141 passed, 2 failed,
# the same two.
git -C "$VAULT" init -q -b main
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

# The bullet names the task's `task_id` frontmatter, not the note path. The
# path used to work because obsidian-base left `metadata.item_id` empty and
# the id comparison was a substring test; both are fixed, so only the id
# authorises now.
cat > "$HOME_DIR/greenlight/sandbox.md" <<GL
# sandbox greenlight

## Cleared
- $TASK_ID
GL

# --- fake executors: record the exact argv they were handed ------------------
# Attribution is set in the launch environment, so the environment is what has
# to be captured. Nothing downstream can tell a correctly-attributed run from an
# unattributed one after the fact -- that is the failure mode the whole change
# exists to close, and it is invisible to an argv-only fake.
cat > "$ROOT/fake-claude" <<'FAKE'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$RALPH_TEST_CALLS"
env | grep -E '^(CLAUDE_CODE_ENABLE_TELEMETRY|OTEL_)' | sort >> "$RALPH_TEST_ENV"
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
env | grep -E '^(CLAUDE_CODE_ENABLE_TELEMETRY|OTEL_)' | sort >> "$RALPH_TEST_ENV"
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
export RALPH_TEST_ENV="$ROOT/env.log"
# No usage runtime in the sandbox, so refresh_quota is a no-op and the quota file
# written above is what both samples read.
export LOOP_USAGE_RUNTIME="$ROOT/no-such-runtime"

"$LOOPCTL" scan sandbox >/dev/null 2>&1 || echo "  scan failed"

runs_file="$VAULT/_system/usage/loop-runs.$MACHINE.jsonl"
ralph_log="$ROOT/ralph.log"
run_ralph() {
  : > "$RALPH_TEST_CALLS"
  : > "$RALPH_TEST_ENV"
  rm -f "$runs_file"
  # Kept rather than discarded: the run_id and the locally-parsed token count
  # are printed here and recorded nowhere else, so throwing the log away would
  # leave both unassertable.
  "$HOME_DIR/ralph.sh" 1 10 > "$ralph_log" 2>&1
}
# One attribute out of the OTEL_RESOURCE_ATTRIBUTES string the executor was
# actually launched with.
launch_attr() {
  [ -f "$RALPH_TEST_ENV" ] || { printf 'NO-ENV'; return; }
  "$VENV/bin/python" - "$RALPH_TEST_ENV" "$1" <<'PY'
import sys
from urllib.parse import unquote
want = sys.argv[2]
for line in open(sys.argv[1]):
    if not line.startswith("OTEL_RESOURCE_ATTRIBUTES="):
        continue
    for pair in line.split("=", 1)[1].strip().split(","):
        key, _, value = pair.partition("=")
        if key == want:
            print(unquote(value)); raise SystemExit
print("")
PY
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
# The dollar guard is checked between iterations and cannot stop one, and at
# MAX_ITER=1 there are no iterations to check between -- which is how a $10 guard
# sat over a ~$30 run on 2026-08-22 without ever being wrong. The cap is the half
# that binds inside the run, so its absence has to fail here rather than show up
# as an overspend nobody could have prevented.
contains "claude is capped in-run by the dollar budget" "$calls" -- "--max-budget-usd 10"
# Model, effort and the token count used to be fields on the ledger row, passed
# as optional arguments. That is why they were sparse -- a caller that did not
# know a value passed None and the write still succeeded. They now ride on the
# launch environment, where the same omission is not expressible.
check "the launch env names the model" "$(launch_attr model)" "claude-opus-5"
check "the launch env names the effort" "$(launch_attr effort)" "xhigh"
check "and the row no longer carries either" \
  "$(last_run_field model)$(last_run_field effort)" ""
check "nor the cost it used to duplicate" "$(last_run_field cost_usd)" ""
# The locally parsed figure is not thrown away -- it is the second reading the
# parallel window checks the telemetry against.
contains "the log keeps a locally parsed token count" "$(cat "$ralph_log")" \
  "4242 output tokens (locally parsed)"

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
contains "codex output tokens are still parsed correctly" "$(cat "$ralph_log")" \
  "777 output tokens (locally parsed)"
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
check "no model is invented on the launch env either" "$(launch_attr model)" ""

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

# The other half of the same rule. A task with a branch is half-done: switching
# restarts from a context the first executor built and cannot hand over, and
# splits one task's spend across two providers -- the per-task figure the
# estimate audit exists to produce.
echo "  a rate limit on a started task waits instead of switching:"
# The gh shim matters here and nowhere else in this suite. A task that declares a
# branch makes the scanner look the branch's PR up, and a sandbox repo has no
# usable remote -- the lookup fails, the scan goes stale, and a stale project has
# no candidates at all. Every other test avoids this by having no branch, which
# is why the shim was never needed before.
mkdir -p "$ROOT/ghbin"
cat > "$ROOT/ghbin/gh" <<'GHFAKE'
#!/usr/bin/env bash
exit 0
GHFAKE
chmod +x "$ROOT/ghbin/gh"
# Not `|| true`. Every assertion below depends on this branch existing: ralph
# waits instead of switching only when TASK_BRANCH is set, and TASK_BRANCH comes
# from the note's `branch:` being real. When the create was swallowed the suite
# still ran and reported two assertion failures -- "claude was not reached" and
# "the log says why" -- which describe the symptom and name nothing about the
# cause. A setup step the assertions rely on has to fail as a setup step.
git -C "$PROJECT" branch feat/sandbox-in-flight >/dev/null 2>&1 || {
  echo "  SETUP FAILED: could not create feat/sandbox-in-flight in $PROJECT"
  git -C "$PROJECT" status --short 2>&1 | head -3 | sed "s/^/    /"
  git -C "$PROJECT" log --oneline -1 2>&1 | head -1 | sed "s/^/    HEAD: /"
  exit 2
}
git -C "$PROJECT" rev-parse --verify feat/sandbox-in-flight >/dev/null 2>&1 || {
  echo "  SETUP FAILED: feat/sandbox-in-flight does not resolve after creation"
  exit 2
}
cat > "$VAULT/$TASK_KEY" <<NOTE
---
task_id: "$TASK_ID"
status: In progress
priority: P2
points: 1
branch: feat/sandbox-in-flight
scope: personal
---

# Sandbox task

Exists only inside this test.
NOTE
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"error","message":"rate limit reached"}'
exit 1
FAKE
chmod +x "$ROOT/fake-codex"
# Not silenced: a scan that fails here leaves the old state and the assertions
# below would pass or fail for the wrong reason.
PATH="$ROOT/ghbin:$PATH" "$HOME_DIR/loopctl" scan sandbox >/dev/null || echo "  SETUP FAILED: scan errored"
: > "$RALPH_TEST_CALLS"; : > "$RALPH_TEST_ENV"
# MAX_WAITS=0 so the wait path exits instead of sleeping: the reset-aware sleep
# reads a real resets_at from the fixture quota file and would park the suite for
# hours. Exiting still proves the branch was taken -- the switch never happened.
PATH="$ROOT/ghbin:$PATH" RALPH_MAX_WAITS=0 "$HOME_DIR/ralph.sh" 1 10 > "$ralph_log" 2>&1 || true
inflight_calls=$(cat "$RALPH_TEST_CALLS")
inflight_log=$(cat "$ralph_log")
contains "codex was still tried" "$inflight_calls" "codex "
excludes "but claude was not reached" "$inflight_calls" "claude "
contains "and the log says why" "$inflight_log" "waiting for this executor rather than switching"
# Put the task back for everything after this.
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
"$HOME_DIR/loopctl" scan sandbox >/dev/null 2>&1 || true

# A task whose last runs all ended without a fair attempt, or in genuine failure,
# stops being selected. AG-289 is the shape: it died at an openapi-sync preflight
# with curl exit 60, a TLS failure that does not resolve by retrying, and ranking
# would have re-picked it every sweep until a human noticed.
echo "  a task that keeps failing leaves ranking:"
: > "$RALPH_TEST_CALLS"
for _ in 1 2 3; do
  printf '{"run_id":"seed","task":"%s","machine":"%s","outcome":"preflight_failed","status":"preflight_failed"}\n' \
    "$TASK_KEY" "$MACHINE" >> "$runs_file"
done
# Not run_ralph: it clears the ledger on entry, which is exactly the history
# this test depends on.
: > "$RALPH_TEST_ENV"
"$HOME_DIR/ralph.sh" 1 10 > "$ralph_log" 2>&1 || true
breaker_log=$(cat "$ralph_log")
breaker_calls=$(cat "$RALPH_TEST_CALLS")
contains "the loop says it is leaving the task out" "$breaker_log" "consecutive blocking outcomes"
excludes "and no executor was launched" "$breaker_calls" "claude "
# One good run in the history is enough to let it back in -- the rule is
# consecutive, not cumulative, or a task could never recover from a bad week.
printf '{"run_id":"seed","task":"%s","machine":"%s","outcome":"advanced","status":"advanced"}\n' \
  "$TASK_KEY" "$MACHINE" >> "$runs_file"
: > "$RALPH_TEST_CALLS"
"$HOME_DIR/ralph.sh" 1 10 > "$ralph_log" 2>&1 || true
contains "a later good run lets it back in" "$(cat "$RALPH_TEST_CALLS")" "claude "
rm -f "$runs_file"
# Restore the success-shaped codex for anything after this.
cat > "$ROOT/fake-codex" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
env | grep -E '^(CLAUDE_CODE_ENABLE_TELEMETRY|OTEL_)' | sort >> "$RALPH_TEST_ENV"
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
    bash -c '. "$1"; preferred_plan "$2" "$3"' _ "$resolver" "$2" "$3" | tr '\037' ' '
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

# --- 11. a rolled-over quota window is not negative usage ---------------------
# 2026-07-31: an AG-130 run logged `5h 44%→8.0% (~-36.0pp)` and recorded
# five_hour_delta_pp = -36.0. Usage inside a window cannot fall; a lower "after"
# means the window reset, and this run's cost is unmeasurable from those two
# samples. Both the log line and the run record must say so rather than invent a
# refund.
echo "  a window reset is not a refund:"
delta_lib="$ROOT/pct-delta.sh"
awk '/^pct_delta\(\) \{/,/^\}/' "$HOME_DIR/ralph.sh" > "$delta_lib"
delta_probe() {
  PYTHON_BIN="$VENV/bin/python" bash -c '. "$1"; pct_delta "$2" "$3"' _ "$delta_lib" "$1" "$2"
}
check "a reset is named, not subtracted" "$(delta_probe 44 8)" "window reset"
check "a real rise still reports points"  "$(delta_probe 31 81)" "~50pp"
check "no movement is zero, not blank"    "$(delta_probe 10 10)" "~0pp"
block=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.writeback import _quota_block; import json; print(json.dumps(_quota_block(44, 8, 31, 81)))')
check "the record nulls the reset delta" "$(printf '%s' "$block" | "$VENV/bin/python" -c 'import json,sys; print(json.load(sys.stdin)["five_hour_delta_pp"])')" "None"
check "and keeps the measurable one"     "$(printf '%s' "$block" | "$VENV/bin/python" -c 'import json,sys; print(json.load(sys.stdin)["weekly_delta_pp"])')" "50.0"

# --- 12. the per-run budget is denominated in quota points -------------------
# BUDGET_USD stopped the 2026-07-31 AG-130 run at $11.25 with the PR already
# open. A dollar figure says nothing about whether the week can absorb the run;
# the same run moved weekly usage 31%->81%, which is the number that decides it.
# Approval is for an estimate, so a small overshoot must not abandon work —
# the run stops only past OVERRUN_RATIO.
echo "  budget in quota points:"
write_quota 10 20
# max_iter=1 so the loop body runs: the headroom line lives inside it.
: > "$RALPH_TEST_CALLS"; rm -f "$runs_file"
budget_log=$(LOOP_BUDGET_WEEKLY_PP=4 LOOP_OVERRUN_RATIO=1.5 "$HOME_DIR/ralph.sh" 1 10 2>&1 || true)
contains "the start line names the approved points" "$budget_log" "approved 4pp weekly"
contains "headroom to the stop threshold is stated" "$budget_log" "room: 5h"
# The executor here is claude, whose delta is a shared-pool sample. There is no
# "Xpp of 4pp approved" tally to print, because a tally built on that figure
# would be a number the engine cannot stand behind -- section 17 covers why, and
# section 14 covers the codex run that does get one.
contains "an unattributable delta is not tallied against the approval" "$budget_log" \
  "the 4pp approval cannot be checked against it"
# Unset means nothing changes: the dollar cap stays the only per-run limit.
excludes "no points budget, no points line" \
  "$("$HOME_DIR/ralph.sh" 1 10 2>&1)" "approved"

# --- 13. each pool is read, and each run is charged to its own --------------
# quota_state read `claude` only. Measured 2026-07-31: the AG-297 Sol run
# recorded `weekly 31%->31% (~0pp)` while spending Codex, and a Claude pool at
# 82% would have blocked a task that costs Claude nothing.
echo "  both quota pools:"
cat > "$ROOT/quota/_system/usage/quota.$MACHINE.json" <<'Q'
{"claude": {"five_hour": {"used_pct": 12}, "weekly_all": {"used_pct": 22}},
 "codex":  {"weekly": {"used_pct": 44}, "five_hour": null}}
Q
qs_lib="$ROOT/quota-state.sh"
awk '/^quota_state\(\) \{/,/^PY$/' "$HOME_DIR/ralph.sh" > "$qs_lib"; printf '}\n' >> "$qs_lib"
qs() {
  PYTHON_BIN="$VENV/bin/python" QUOTA_FILE="$1" \
  PCT_5H_STOP=80 PCT_WEEK_STOP=90 PCT_5H_DRAIN=60 PCT_WEEK_DRAIN=85 \
    bash -c '. "$1"; quota_state | tr "\037" "|"' _ "$qs_lib"
}
check "both pools are reported" "$(qs "$ROOT/quota/_system/usage/quota.$MACHINE.json")" "ok|12|22||44"
# A pool over its stop threshold halts the iteration whichever pool it is: the
# gate runs before the executor is chosen, so it cannot know who would pay.
cat > "$ROOT/quota/codex-hot.json" <<'Q'
{"claude": {"five_hour": {"used_pct": 5}, "weekly_all": {"used_pct": 5}},
 "codex":  {"weekly": {"used_pct": 95}, "five_hour": null}}
Q
check "a hot codex pool stops the run" "$(qs "$ROOT/quota/codex-hot.json" | cut -d'|' -f1)" "stop"
check "a missing file is still unknown" "$(qs /nonexistent | cut -d'|' -f1)" "unknown"
# The record must name the pool, or a Codex row is indistinguishable from a
# free Claude one.
pool_row=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.writeback import _quota_block; import json; print(json.dumps(_quota_block(None, None, 30, 47, "codex")))')
contains "the record names the pool" "$pool_row" '"pool": "codex"'
check "and charges the delta to it" "$(printf '%s' "$pool_row" | "$VENV/bin/python" -c 'import json,sys; print(json.load(sys.stdin)["weekly_delta_pp"])')" "17.0"
write_quota 10 20

# --- 14. a codex run is charged from its own session -------------------------
# The exporter samples "the newest session file", which is not necessarily this
# run's: codex exec writes guardian and subagent sessions alongside it. Measured
# 2026-07-31, both samples of the AG-288 Luna run came back empty and the record
# stored `quota: null`, while the run's own session held 53%→57% throughout.
echo "  codex points from its own session:"
sessions="$ROOT/codex-sessions/2026/07/31"
mkdir -p "$sessions"
mk_session() {  # <thread> <first-pct> <last-pct>
  local f="$sessions/rollout-2026-07-31T00-00-00-$1.jsonl"
  printf '{"type":"session_meta","payload":{"source":"exec"}}\n' > "$f"
  for pct in "$2" "$3"; do
    printf '{"type":"event_msg","payload":{"type":"token_count","rate_limits":{"primary":{"used_percent":%s,"window_minutes":10080}}}}\n' "$pct" >> "$f"
  done
}
mk_session "thread-real" 53.0 57.0
# A sibling written later with no rate_limits at all — the exact shape that made
# "newest file" return nothing.
printf '{"type":"session_meta","payload":{"source":"exec"}}\n' > "$sessions/rollout-2026-07-31T23-59-59-thread-guardian.jsonl"
cat > "$ROOT/fake-transcript.log" <<'T'
{"type":"thread.started","thread_id":"thread-real"}
{"type":"turn.completed","usage":{"output_tokens":47983}}
T
cpp_lib="$ROOT/codex-pp.sh"
awk '/^codex_weekly_pp\(\) \{/,/^PY$/' "$HOME_DIR/ralph.sh" > "$cpp_lib"; printf '}\n' >> "$cpp_lib"
cpp() {  # <fake-home> <transcript>
  PYTHON_BIN="$VENV/bin/python" HOME="$1" \
    bash -c '. "$1"; type codex_weekly_pp >/dev/null 2>&1 || { echo "HELPER-NOT-LOADED"; exit 0; }; codex_weekly_pp "$2"' \
    _ "$cpp_lib" "$2"
}
# HOME is redirected so the helper looks in the sandbox's .codex/sessions.
mkdir -p "$ROOT/fakehome/.codex"; ln -sfn "$ROOT/codex-sessions" "$ROOT/fakehome/.codex/sessions"
check "the run's own session is found and bracketed" \
  "$(cpp "$ROOT/fakehome" "$ROOT/fake-transcript.log" | tr '\037' '>')" "53.0>57.0"
# A transcript naming no thread must yield nothing rather than someone else's run.
printf '{"type":"turn.completed"}\n' > "$ROOT/no-thread.log"
check "no thread id means no number" "$(cpp "$ROOT/fakehome" "$ROOT/no-thread.log")" ""
check "a missing transcript is silent" "$(cpp "$ROOT/fakehome" /nonexistent.log)" ""

# End to end: a codex run bracketed by its own session is the one delta the
# engine can attribute, so it is the one that still advances the approval and
# still stops the loop. Every $HOME in ralph.sh is behind an env override the
# sandbox already sets, except the codex sessions dir -- which is the one this
# redirect is for. The fake codex announces thread t-1, so that is the session.
mk_session "t-1" 30.0 47.0
# Its own fake: the one section 5b restores announces no thread, and locating the
# session is the entire mechanism under test here.
cat > "$ROOT/fake-codex-threaded" <<'FAKE'
#!/usr/bin/env bash
printf 'codex %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"thread.started","thread_id":"t-1"}'
echo '{"type":"turn.completed","usage":{"output_tokens":777}}'
exit 0
FAKE
chmod +x "$ROOT/fake-codex-threaded"
# Routed by preset, not by LOOP_EXECUTORS: a preset's provider is tried first
# whatever the executor list says, so an ambient claude preset would take the run.
cat > "$ROOT/agents-codex.json" <<JSON
{
  "default_agent": "codex",
  "presets": {"codex-exact": {"provider": "codex"}},
  "tasks": {"$TASK_KEY": {"preset": "codex-exact"}}
}
JSON
: > "$RALPH_TEST_CALLS"; rm -f "$runs_file"
exact_log=$(HOME="$ROOT/fakehome" CODEX_BIN="$ROOT/fake-codex-threaded" \
  LOOP_AGENT_CONFIG="$ROOT/agents-codex.json" \
  LOOP_BUDGET_WEEKLY_PP=4 LOOP_OVERRUN_RATIO=1.5 "$HOME_DIR/ralph.sh" 1 10 2>&1 || true)
check "the codex iteration ran at all" "$(last_run_field executor)" "codex"
check "its delta comes from its own session" "$(last_run_field quota.weekly_delta_pp)" "17.0"
check "and is recorded as exact" "$(last_run_field quota.attribution)" "exact"
excludes "an exact delta is printed without a bound" "$exact_log" "upper bound"
contains "an exact delta is tallied against the approval" "$exact_log" "17.0pp of 4pp approved"
contains "and still stops the run past the ratio" "$exact_log" \
  "over the approved weekly points: 17.0pp exceeds 4pp by more than 1.5x"
write_quota 10 20

# --- 15. the run row carries edges, not just measurements --------------------
# The ledger could say what a run cost but not what it worked on, where the work
# went, or which earlier run it was fixing. "Did the second attempt close what
# the first missed" is the whole question a fix round exists to answer, and it was
# unanswerable from own data.
echo "  run rows carry edges:"
write_quota 10 20
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"deep": {"provider": "claude", "model": "claude-opus-5", "effort": "high"}},
  "tasks": {"$TASK_KEY": {"preset": "deep"}}
}
JSON
export LOOP_AGENT_CONFIG="$ROOT/agents.json"
run_ralph
sandbox_branch=$(git -C "$VAULT" rev-parse --abbrev-ref HEAD)
check "the row names the branch it worked on" "$(last_run_field branch)" "$sandbox_branch"
# First run on this task: nothing to be a fix round for.
check "a first run has no parent" "$(last_run_field parent_run_id)" ""
first_run=$(last_run_field run_id)
# Second run on the same task IS the fix round, and the edge is derived from the
# ledger rather than threaded through every caller.
: > "$RALPH_TEST_CALLS"
"$HOME_DIR/ralph.sh" 1 10 >/dev/null 2>&1
check "the next run points at the previous one" "$(last_run_field parent_run_id)" "$first_run"
check "and is not its own parent" "$([ "$(last_run_field parent_run_id)" = "$(last_run_field run_id)" ] && echo same || echo distinct)" "distinct"
# An unrelated task must not inherit a parent from a different one.
other=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.writeback import _last_run_id_for; print(_last_run_id_for("'"$MACHINE"'", "no-such-task") or "")')
check "a different task gets no parent" "$other" ""

# --- 16. an unmet dependency keeps a task out of the queue -------------------
# The board is a DAG and next_candidates could not see it. On 2026-08-01 a model
# was routed at a task blocked two levels deep, because the order lived only in
# ticket prose. Edges are resolved by judgement, not parsed -- most of that prose
# names its dependency by title, and "Order 1 of 3" names nothing at all.
echo "  dependency edges gate the queue:"
mkdir -p "$HOME_DIR/depends"
SECOND=T-88888888888888
SECOND_KEY="_system/tasks/$SECOND.md"
sed "s/$TASK_ID/$SECOND/" "$VAULT/$TASK_KEY" > "$VAULT/$SECOND_KEY"
printf -- '- %s\n' "$SECOND" >> "$HOME_DIR/greenlight/sandbox.md"
# Keyed by `_task_key` -- `metadata.item_id or id`. For an obsidian-base source
# that is now the `T-<timestamp>` frontmatter id; it was the note path only while
# the adapter left `item_id` empty. depends.py's own docstring always said the
# key is "the human key a person and this file both use, e.g. AG-298".
cat > "$HOME_DIR/depends/sandbox.yaml" <<YAML
$SECOND:
  depends_on: ["$TASK_ID"]
  from: "Depends on the sandbox task."
  resolved: 2026-08-03
YAML
"$LOOPCTL" scan sandbox >/dev/null 2>&1
queued=$("$LOOPCTL" next sandbox 2>/dev/null | "$VENV/bin/python" -c \
  'import json,sys; print(",".join(r.get("id","") for r in json.load(sys.stdin)))')
excludes "a blocked task is out of the queue" "$queued" "$SECOND"
contains "its dependency is still offered" "$queued" "$TASK_ID"
# Satisfied once the dependency is reviewable — waiting for in-qa would serialise
# the stacked-branch flow this board actually uses.
"$LOOPCTL" set sandbox "$TASK_KEY" pr-ready --pr https://example.invalid/1 --note "sandbox: suites green" >/dev/null 2>&1
"$LOOPCTL" scan sandbox >/dev/null 2>&1
queued=$("$LOOPCTL" next sandbox 2>/dev/null | "$VENV/bin/python" -c \
  'import json,sys; print(",".join(r.get("id","") for r in json.load(sys.stdin)))')
contains "pr-ready satisfies the edge" "$queued" "$SECOND"

# pr-ready is the terminal claim for a greenlit project -- it says a branch is
# finished and a person should look. `--note` is where the contract asks for the
# checks behind that claim, and it was optional, so the claim could be made with
# no evidence at all. Measured 2026-09-02 on PR #342, the first PR this loop
# opened unattended: CI failed on `Check formatting`, and nothing had asked the
# executor whether it ran the formatter the repo's own CLAUDE.md documents.
noteless=$("$LOOPCTL" set sandbox "$TASK_KEY" pr-ready --pr https://example.invalid/2 2>&1 || true)
check "pr-ready 沒有 note 會被拒絕" \
  "$(printf '%s' "$noteless" | grep -c 'pr-ready needs --note' | tr -d ' ')" "1"
# Whitespace is not evidence either.
blank=$("$LOOPCTL" set sandbox "$TASK_KEY" pr-ready --pr https://example.invalid/3 --note "   " 2>&1 || true)
check "只有空白的 note 一樣被拒絕" \
  "$(printf '%s' "$blank" | grep -c 'pr-ready needs --note' | tr -d ' ')" "1"

# --- stop_at has to be a value a task can actually reach ---------------------
# Greenlight retirement compares stop_at to a task's state by string equality, so
# a value no task can hold means the authorisation is never withdrawn and the
# finished task stays the top candidate. Measured 2026-09-02: rainforest-monorepo
# carried `stop_at: pr` -- a plausible typo for `pr-ready` -- and nothing
# complained. Two tasks finished, kept their greenlight, and the next sweep was
# about to redo one that already had a PR open, at roughly $10 a run.
bad_cfg="$ROOT/bad-stop-at.yaml"
sed 's/^    stop_at: pr-ready$/    stop_at: pr/' "$HOME_DIR/config.yaml" > "$bad_cfg"
check "測試前置:壞掉的 config 確實含 stop_at: pr" \
  "$(grep -c 'stop_at: pr$' "$bad_cfg" | tr -d ' ')" "1"
bad_out=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" - "$bad_cfg" <<'PYBAD' 2>&1 || true
import sys
from pathlib import Path
from loopctl.config import load_config
try:
    load_config(Path(sys.argv[1]))
    print("LOADED")
except ValueError as exc:
    print(f"REJECTED {exc}")
PYBAD
)
check "不合法的 stop_at 會被拒絕" \
  "$(printf '%s' "$bad_out" | grep -c 'REJECTED unsupported loop stop_at: pr' | tr -d ' ')" "1"
# `done` and `none` are not pipeline states but are the documented terminals for
# autonomous and read-only projects, so they must keep loading.
for term in done none; do
  ok_cfg="$ROOT/stop-at-$term.yaml"
  sed "s/^    stop_at: pr-ready$/    stop_at: $term/" "$HOME_DIR/config.yaml" > "$ok_cfg"
  ok_out=$(PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" - "$ok_cfg" <<'PYOK' 2>&1 || true
import sys
from pathlib import Path
from loopctl.config import load_config
try:
    load_config(Path(sys.argv[1]))
    print("LOADED")
except ValueError as exc:
    print(f"REJECTED {exc}")
PYOK
)
  check "stop_at: $term 仍可載入" "$(printf '%s' "$ok_out" | grep -c '^LOADED$' | tr -d ' ')" "1"
done
# Satisfied but nobody has confirmed the resolution: enforced anyway, and flagged.
contains "deps flags an unreviewed resolution" "$("$LOOPCTL" deps sandbox 2>/dev/null)" "unverified"
# An edge naming something the scan cannot see blocks on purpose: closed, renamed
# or simply not synced is state the loop cannot confirm, and its standing rule is
# to stop rather than guess.
cat > "$HOME_DIR/depends/sandbox.yaml" <<YAML
$SECOND:
  depends_on: ["T-00000000000000"]
  from: "Depends on something that is not there."
  resolved: 2026-08-03
YAML
"$LOOPCTL" scan sandbox >/dev/null 2>&1
queued=$("$LOOPCTL" next sandbox 2>/dev/null | "$VENV/bin/python" -c \
  'import json,sys; print(",".join(r.get("id","") for r in json.load(sys.stdin)))')
excludes "an edge to an unknown task blocks" "$queued" "$SECOND"
audit=$("$LOOPCTL" deps sandbox 2>/dev/null)
contains "deps names why it is blocked" "$audit" "not on the board"
# A malformed file must not take the loop down with it.
printf 'this: [is: not: yaml\n' > "$HOME_DIR/depends/sandbox.yaml"
"$LOOPCTL" scan sandbox >/dev/null 2>&1
queued=$("$LOOPCTL" next sandbox 2>/dev/null | "$VENV/bin/python" -c \
  'import json,sys; print(",".join(r.get("id","") for r in json.load(sys.stdin)))')
contains "a broken edge file means no edges, not no queue" "$queued" "$SECOND"
rm -f "$HOME_DIR/depends/sandbox.yaml" "$VAULT/$SECOND_KEY"

# --- 17. a shared pool measures everyone, so the row says so -----------------
# Measured 2026-08-05: the AG-131 iteration cost $4.51 and recorded 36pp, while
# AG-383 cost $16.34 and recorded 1pp. The delta is the difference between two
# reads of a file every claude process on the account moves, and the loudest one
# is usually the session operating the loop -- so the figures were not noisy,
# they were anti-correlated with spend, and the engine declared an overrun on
# one of them.
echo "  a shared pool is an upper bound:"
# Section 16 drove the sandbox task to pr-ready, which is terminal here and
# retires its greenlight entry. Without restoring all three -- note, allowlist,
# derived state -- the queue is empty, no run record is written, and every
# assertion below compares blank to blank and passes.
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
cat > "$HOME_DIR/greenlight/sandbox.md" <<GL
# sandbox greenlight

## Cleared
- $TASK_ID
GL
rm -rf "$HOME_DIR/projects"
"$LOOPCTL" scan sandbox >/dev/null 2>&1
write_quota 10 20

# A second process spending the same pool while the iteration runs. The fake
# executor invokes it, so the ordering is deterministic rather than a race, but
# it is a separate process writing the shared file -- which is exactly what the
# operating Claude Code session does to a real run.
cat > "$ROOT/fake-burner" <<'BURN'
#!/usr/bin/env bash
cat > "$LOOP_QUOTA_FILE" <<Q
{"claude": {"five_hour": {"used_pct": 12}, "weekly_all": {"used_pct": 67}}}
Q
BURN
cat > "$ROOT/fake-claude-burned" <<'FAKE'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$RALPH_TEST_CALLS"
"$RALPH_TEST_BURNER"
echo '{"type":"result","subtype":"success","total_cost_usd":0.5,"usage":{"output_tokens":10},"result":"done"}'
exit 0
FAKE
chmod +x "$ROOT/fake-burner" "$ROOT/fake-claude-burned"
: > "$RALPH_TEST_CALLS"; rm -f "$runs_file"
burn_log=$(CLAUDE_BIN="$ROOT/fake-claude-burned" RALPH_TEST_BURNER="$ROOT/fake-burner" \
  LOOP_BUDGET_WEEKLY_PP=4 LOOP_OVERRUN_RATIO=1.5 "$HOME_DIR/ralph.sh" 1 10 2>&1 || true)
# Before anything else: the iteration has to have happened. Assertions in this
# suite have twice passed because a helper had not loaded and empty compared
# equal to empty, and an empty queue would do it again here.
check "the iteration ran at all" "$(last_run_field executor)" "claude"
check "the pool movement is still recorded" "$(last_run_field quota.weekly_delta_pp)" "47.0"
check "but the row does not claim it" "$(last_run_field quota.attribution)" "upper-bound"
# 47pp of movement beside $0.50 of spend is the AG-131 shape. The exact figure
# claude does have is no longer copied onto the row; it arrives on the run's own
# events, which is why the row has to carry the id that joins them.
contains "the run is joinable to what it emitted" "$(last_run_field run_id)" "$MACHINE-"
contains "the log marks the delta as a bound" "$burn_log" "upper bound — shared pool"
contains "the approval is not checked against it" "$burn_log" "cannot be checked against it"
# 47pp against a 4pp approval is 7.8x the 1.5x ceiling. Before this change that
# printed an overrun and stopped the loop, on a number that was mostly somebody
# else's spend.
excludes "no overrun is declared on it" "$burn_log" "over the approved weekly points"

# Codex is unchanged: its delta comes from inside its own session, which no
# other process can move, so it keeps the exact claim and keeps stopping the run.
attr_lib="$ROOT/attribution.sh"
awk '/^quota_attribution\(\) \{/,/^\}/' "$HOME_DIR/ralph.sh" > "$attr_lib"
attr() {  # <provider> <own-session-bracket>
  bash -c '. "$1"
type quota_attribution >/dev/null 2>&1 || { echo "HELPER-NOT-LOADED"; exit 0; }
quota_attribution "$2" "$3"' _ "$attr_lib" "$1" "${2:-}"
}
check "a bracketed codex delta is exact" "$(attr codex "$(printf '53.0\03757.0')")" "exact"
check "codex falling back to the file is not" "$(attr codex "")" "upper-bound"
# The point of the whole change: claude has no per-session quota to bracket, so
# no input makes its delta exact.
check "claude is never exact, bracket or not" "$(attr claude "$(printf '53.0\03757.0')")" "upper-bound"

mb_lib="$ROOT/mark-bound.sh"
awk '/^mark_bound\(\) \{/,/^\}/' "$HOME_DIR/ralph.sh" > "$mb_lib"
mb() {  # <delta> <attribution>
  bash -c '. "$1"
type mark_bound >/dev/null 2>&1 || { echo "HELPER-NOT-LOADED"; exit 0; }
mark_bound "$2" "$3"' _ "$mb_lib" "$1" "$2"
}
check "an exact delta is printed plain" "$(mb '~17pp' exact)" "~17pp"
check "an unattributable one carries its provenance" "$(mb '~36.0pp' upper-bound)" \
  "~36.0pp, upper bound — shared pool"
# "window reset" and "?" already say they are not measurements; bounding them
# would suggest a bound exists where there is no number at all.
check "a reset is not given a bound" "$(mb 'window reset' upper-bound)" "window reset"
check "nor is an absent reading" "$(mb '?' upper-bound)" "?"

# --- 18. the dollar guard is checked between iterations, and says so ---------
# AG-383 was started with a $15 guard and spent $16.34 in a single iteration.
# SPENT accumulates and is compared only after an iteration returns, so with
# max_iter=1 the guard cannot fire at all -- and the log still printed "$15
# guard" as though it had applied.
echo "  the dollar guard does not cap an iteration:"
cat > "$ROOT/fake-claude-expensive" <<'FAKE'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"success","total_cost_usd":16.34,"usage":{"output_tokens":10},"result":"done"}'
exit 0
FAKE
# The AG-383 shape exactly: the turn limit, which exits before the between-
# iterations check is ever reached.
cat > "$ROOT/fake-claude-maxturns" <<'FAKE'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$RALPH_TEST_CALLS"
echo '{"type":"result","subtype":"error_max_turns","total_cost_usd":16.34,"is_error":true,"result":null}'
exit 1
FAKE
chmod +x "$ROOT/fake-claude-expensive" "$ROOT/fake-claude-maxturns"
write_quota 10 20
: > "$RALPH_TEST_CALLS"; rm -f "$runs_file"
spend_log=$(CLAUDE_BIN="$ROOT/fake-claude-expensive" "$HOME_DIR/ralph.sh" 1 15 2>&1 || true)
check "the iteration ran at all" "$(last_run_field executor)" "claude"
excludes "the start line no longer calls it a guard alone" "$spend_log" "\$15 guard·"
# The note used to end "(cannot stop one)", which stopped being true for claude
# when --max-budget-usd landed. The between-iteration half still applies to the
# executors that have no in-run cap, so the line has to say both rather than
# either -- a note that claims the budget cannot stop a run would now be wrong,
# and one that claims it always can would be wrong for codex and agy.
contains "the start line says the cap binds in-run for claude" "$spend_log" \
  "\$15 — capped in-run for claude"
contains "and that the between-iteration check still exists" "$spend_log" \
  "checked between iterations otherwise"
contains "a single iteration over the guard is named" "$spend_log" \
  "this iteration alone spent \$16.34, over the \$15 guard by \$1.34"
contains "and why it was not stopped" "$spend_log" \
  "the guard is checked between iterations, so it could not stop it"

: > "$RALPH_TEST_CALLS"; rm -f "$runs_file"
turns_log=$(CLAUDE_BIN="$ROOT/fake-claude-maxturns" "$HOME_DIR/ralph.sh" 1 15 2>&1 || true)
contains "the turn-limit exit reports the spend" "$turns_log" "spent \$16.34 this attempt"
# This path exits before the between-iterations check, so until now a run could
# end $1.34 over its guard having never compared the two.
contains "the turn-limit exit also names the overrun" "$turns_log" \
  "over the \$15 guard by \$1.34"

# --- 19. the run is attributable before it starts, not after it ends ---------
# The producer half of the telemetry design. Every check here is on the launch
# environment, because that is the only place the attribution exists -- and a
# green run proves nothing about it: the OTel SDK drops silently, so the failure
# mode is a run that looks entirely normal and lands nothing.
echo "  launch attribution:"
unset LOOP_AGENT_CONFIG
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"deep": {"provider": "claude", "model": "claude-opus-5", "effort": "xhigh"}},
  "tasks": {"$TASK_KEY": {"preset": "deep"}}
}
JSON
export LOOP_AGENT_CONFIG="$ROOT/agents.json"
export LOOP_OTLP_ENDPOINT="http://collector.test:4318"
run_ralph
otel_env=$(cat "$RALPH_TEST_ENV")

contains "telemetry is switched on at all" "$otel_env" "CLAUDE_CODE_ENABLE_TELEMETRY=1"
contains "metrics go to the collector" "$otel_env" "OTEL_METRICS_EXPORTER=otlp"
contains "so do events" "$otel_env" "OTEL_LOGS_EXPORTER=otlp"
contains "at the configured endpoint" "$otel_env" \
  "OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.test:4318"
# The single most load-bearing line in this file. Claude Code defaults to delta,
# Alloy's Prometheus converter drops delta silently, and the run still exits 0 --
# so nothing but this assertion stands between a working pipeline and one where
# only target_info ever arrives.
contains "counters are cumulative, or Alloy drops them silently" "$otel_env" \
  "OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative"
# run_id is unbounded and session.id is new every session. Either on a metric
# label grows Prometheus series without limit; both belong to Loki instead.
contains "session id stays off metric labels" "$otel_env" \
  "OTEL_METRICS_INCLUDE_SESSION_ID=false"
contains "and so does the whole resource block" "$otel_env" \
  "OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false"

check "the run is identified" "$(launch_attr run_id)" "$(last_run_field run_id)"
check "the machine is named" "$(launch_attr machine)" "$MACHINE"
check "the project is named" "$(launch_attr project)" "sandbox"
check "the executor is named" "$(launch_attr executor)" "claude"
# obsidian-base calls the human key `task_id` and Notion calls it `item_id`.
# Reading only the latter is why --task-id was empty on every personal run.
check "the task's human key survives the source's spelling" \
  "$(launch_attr task_id)" "$TASK_ID"
# The estimates in force for THIS run, stamped now so an audit compares the
# actual against the number that was actually being worked to.
check "the story point in force is stamped" "$(launch_attr story_point)" "1"
check "so is the dollar guard" "$(launch_attr budget_usd)" "10"
check "and the turn budget" "$(launch_attr max_turns)" "100"

# The ledger row and the telemetry have to agree on the id or neither can be
# joined to the other, which is the entire mechanism.
check "the row and the launch env share one run id" \
  "$([ "$(launch_attr run_id)" = "$(last_run_field run_id)" ] && echo same || echo split)" "same"
# It used to embed the task ref -- an 80-character Notion URL inside a baggage
# value, where a query string would have corrupted every attribute after it.
excludes "the id no longer embeds the task ref" "$(last_run_field run_id)" "/"

echo "  codex attribution:"
cat > "$ROOT/agents.json" <<JSON
{
  "default_agent": "claude",
  "presets": {"trial-terra": {"provider": "codex", "model": "gpt-5.6-terra", "effort": "medium"}},
  "tasks": {"$TASK_KEY": {"preset": "trial-terra"}}
}
JSON
run_ralph
otel_env=$(cat "$RALPH_TEST_ENV")
calls=$(cat "$RALPH_TEST_CALLS")
# Codex needs no exporter env: its provider builds the resource with
# Resource::builder(), which carries the default env detector.
check "codex is attributed by the same variable" "$(launch_attr executor)" "codex"
check "carrying the same estimates" "$(launch_attr story_point)" "1"
# ...but its exporters come from config, and they take FULL signal paths --
# with_endpoint() uses the URL as given and appends no /v1/logs of its own.
contains "codex events carry the full signal path" "$calls" \
  "endpoint=\"http://collector.test:4318/v1/logs\""
contains "and so do its traces" "$calls" \
  "endpoint=\"http://collector.test:4318/v1/traces\""
# Left alone this defaults to statsig, which resolves to ab.chatgpt.com -- every
# loop run shipping metrics to a third party without anyone saying so.
contains "codex metrics do not go to a third party by default" "$calls" \
  "-c otel.metrics_exporter=none"

echo "  no collector configured:"
export LOOP_OTLP_ENDPOINT=""
run_ralph
otel_env=$(cat "$RALPH_TEST_ENV")
# One switch, not nine. A host with no collector must not half-configure the
# SDK and then block on an endpoint that will never answer.
excludes "telemetry is off entirely" "$otel_env" "CLAUDE_CODE_ENABLE_TELEMETRY"
excludes "and nothing is left pointing anywhere" "$otel_env" "OTEL_EXPORTER_OTLP_ENDPOINT"
check "but the run still happens and still records" "$(last_run_field executor)" "codex"

echo
echo "ledger: a run says how long it took and which task it moved"

# started_at fell back to the append time for every row ever written, because
# ralph had the epoch (it is inside RUN_ID) and never passed it on.
#
# Not asserted by comparing this run's own two stamps: the harness's executor
# returns instantly, so both land in the same second whether or not the value
# was passed -- the test would pass for the wrong reason. Two checks that cannot:
# the CLI honours an explicit start, and every call site in ralph supplies one.
"$HOME_DIR/loopctl" record-run \
  --project ledger-probe --task ledger-probe --executor claude \
  --status advanced --started-ts 1700000000 >/dev/null 2>&1 || true
probe_started=$(last_run_field started_at)
probe_ended=$(last_run_field ended_at)
check "the ledger honours an explicit start time" "${probe_started%%T*}" "2023-11-14"
if [ "$probe_started" = "$probe_ended" ]; then
  fail=$((fail + 1)); printf '    FAIL %s\n' "started_at was overwritten by the append time"
else
  pass=$((pass + 1)); printf '    ok   %s\n' "and does not overwrite it with the append time"
fi

# A future call site that forgets the flag reintroduces the whole class, and it
# would look correct in every fast test. Checked at the source instead.
# Invocations only. A bare `record-run` also appears in a comment, and counting
# that made this demand a flag on a line that cannot carry one.
run_calls=$(grep -c '"\$LOOPCTL" record-run' "$ENGINE/ralph.sh")
started_args=$(grep -c -- '--started-ts' "$ENGINE/ralph.sh")
check "every record-run in ralph passes a start time" "$started_args" "$run_calls"

# The closed vocabulary has to carry the new outcome, or normalize_outcome
# silently rewrites it to `advanced` -- which is the exact claim it exists to
# stop making.
outcomes=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c 'from loopctl.writeback import OUTCOMES; print(" ".join(sorted(OUTCOMES)))')
contains "misattributed is a recordable outcome" "$outcomes" "misattributed"
normalised=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c 'from loopctl.writeback import normalize_outcome; print(normalize_outcome("misattributed"))')
check "and survives normalisation rather than degrading to advanced" "$normalised" "misattributed"

# The engine version rides on the file every scan publishes. Absent means absent:
# a host that never installed from a bundle must not be given a version it
# cannot have, because a guess is indistinguishable from a report.
echo "  engine version:"
unset LOOP_ENGINE_VERSION 2>/dev/null || true
absent=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c '
import os
os.environ["LOOP_HOME"] = "/nonexistent/loop"
from loopctl.writeback import _engine_version
print("NONE" if _engine_version() is None else "SOMETHING")')
check "no marker on disk reports nothing, not a guess" "$absent" "NONE"
printf '2026.09.03-abc1234\n' > "$LOOP_HOME/.engine-version"
reported=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c '
from loopctl.writeback import _engine_version
print(_engine_version())')
check "an installed marker is reported verbatim" "$reported" "2026.09.03-abc1234"

# The misattribution detector, run as the shipped code rather than a copy: the
# block is extracted from ralph.sh itself, so a change there that breaks it fails
# here. It is the one piece of this that `bash -n` cannot vouch for -- a heredoc
# inside a command substitution parses fine and can still decide wrongly.
echo "  misattribution detector:"
det_a=$(grep -n "<<'PYEOF'" "$ENGINE/ralph.sh" | cut -d: -f1)
det_b=$(grep -n '^PYEOF$' "$ENGINE/ralph.sh" | cut -d: -f1)
det="$HOME_DIR/detect.py"
sed -n "$((det_a + 1)),$((det_b - 1))p" "$ENGINE/ralph.sh" > "$det"

detect() { # rows-json claimed-id -> what it would report
  printf '%s' "$1" > "$HOME_DIR/progress.json"
  "$VENV/bin/python" "$det" "$HOME_DIR/progress.json" "$2" 1000 \
    rainforest-mini rainforest-monorepo 2>/dev/null
}
here='"machine":"rainforest-mini","project":"rainforest-monorepo"'

check "another task moving in this run's window is reported" \
  "$(detect "{\"tasks\":{\"T-OTHER\":{$here,\"updated_ts\":1500}}}" T-MINE)" "T-OTHER"
# The claimed task moving is proof the run was on the right thing, PR or not.
check "the claimed task moving keeps it quiet" \
  "$(detect "{\"tasks\":{\"T-MINE\":{$here,\"updated_ts\":1500},\"T-OTHER\":{$here,\"updated_ts\":1500}}}" T-MINE)" ""
check "a task last touched before this run is not evidence" \
  "$(detect "{\"tasks\":{\"T-OTHER\":{$here,\"updated_ts\":500}}}" T-MINE)" ""
# Another host's concurrent run overlaps this window constantly; reading it as
# this run's work would make misattribution the normal outcome on two machines.
check "another machine's work is not this run's" \
  "$(detect "{\"tasks\":{\"T-OTHER\":{\"machine\":\"rainforest-air\",\"project\":\"rainforest-monorepo\",\"updated_ts\":1500}}}" T-MINE)" ""
check "another project's work is not this run's" \
  "$(detect "{\"tasks\":{\"T-OTHER\":{\"machine\":\"rainforest-mini\",\"project\":\"other-repo\",\"updated_ts\":1500}}}" T-MINE)" ""
# Six rows in the live mirror predate the timestamp entirely. Undated is unknown,
# and accusing a run on the strength of unknown is the costlier error.
check "an undated row is not read as movement" \
  "$(detect "{\"tasks\":{\"T-OTHER\":{$here}}}" T-MINE)" ""

echo
echo "field separators: an empty middle field must survive the read"

# The defect, reproduced against the shell that actually runs this: `read` with
# IFS=tab collapses adjacent separators, so an empty field does not arrive empty
# -- it vanishes and everything after it shifts left. On a team plan five_hour is
# null, which put the WEEKLY percentage in the 5-hour column and left weekly
# blank, on the machine whose company quota the gate is meant to protect.
collapsed=$(/bin/bash -c "printf 'a\t\tc' | { IFS=\$'\t' read -r x y z; printf '%s|%s|%s' \"\$x\" \"\$y\" \"\$z\"; }")
check "the shell really does collapse adjacent tabs" "$collapsed" "a|c|"
kept=$(/bin/bash -c "printf 'a\037\037c' | { IFS=\$'\037' read -r x y z; printf '%s|%s|%s' \"\$x\" \"\$y\" \"\$z\"; }")
check "and does not collapse \\x1f" "$kept" "a||c"

# No tab-separated multi-field line may come back: any of them can grow an empty
# field later, and the failure is silent when it does.
tabbed=$(grep -c "IFS=\$'\\t'" "$ENGINE/ralph.sh" || true)
check "no reader in ralph splits on tab any more" "$tabbed" "0"

echo
echo "the runner does not invent work or lose it"

# An empty queue used to launch the executor anyway; `record-run --task ""` then
# landed a row that normalize_outcome reads as `advanced`, so nothing-to-do was
# recorded as progress -- and paid for.
contains "an empty task queue breaks instead of running" \
  "$(grep -A10 "read -r task_id task_item_id" "$ENGINE/ralph.sh")" \
  'if [ -z "${task_id:-}" ]; then'

# The contract has executors commit in a worktree of their own, so $project_path
# is precisely the checkout that does NOT move. Comparing it meant a run that
# committed, pushed and then exited non-zero was handed to the next executor: a
# second branch and a second PR for work already done.
excludes "the failure guard does not compare the one checkout that cannot move" \
  "$(grep -A1 'the repo moved before this failure' "$ENGINE/ralph.sh")" \
  'rev-parse HEAD'
contains "it compares every worktree instead" \
  "$(grep -B2 'the repo moved before this failure' "$ENGINE/ralph.sh")" \
  'repo_heads "$project_path"'

# One stderr line inside the envelope makes verdict, subtype, cost and tokens all
# absent -- and an outcome is then decided without the fields that decide it.
excludes "the executor's stderr does not enter the parsed envelope" \
  "$(grep 'candidate_out=$(run_executor' "$ENGINE/ralph.sh")" "2>&1"
contains "it is captured separately" \
  "$(grep 'candidate_out=$(run_executor' "$ENGINE/ralph.sh")" '2>"$candidate_err"'

echo "greenlight: authorisation does not change without saying so"

gl_py() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c "$1" "${@:2}"; }

# The live hazard: rainforest-monorepo.md has bullets and no `## Cleared` at all,
# and cleared_section deliberately treats such a file as all-bullets so a
# hand-written allowlist keeps working. Adding the heading at the END therefore
# moved every existing bullet OUTSIDE the section that authorises it -- the first
# apply returned success while revoking everything already cleared.
gl_file="$HOME_DIR/gl-demo.md"
printf '# demo greenlight\n\n- AG-111 — already authorised\n  ↳ context line\n' > "$gl_file"
gl_after=$(gl_py '
import sys, pathlib
from loopctl.greenlight import apply_request, cleared_section, SUPPORTED_VERSION
p = pathlib.Path(sys.argv[1])
apply_request({"version": SUPPORTED_VERSION, "slug": "demo", "id": "AG-222", "title": "new"},
              p, expected_slug="demo")
print(" ".join(sorted(
    l.strip().split()[1] for l in cleared_section(p.read_text()).splitlines()
    if l.strip().startswith("-"))))
' "$gl_file")
check "clearing one id does not revoke the ids already there" "$gl_after" "AG-111 AG-222"

# Title-as-substring stays for a bullet an owner typed with no id -- that is the
# case it was written for -- but a bullet that names an id is decided by the id.
# A task titled `Setup` otherwise matched every bullet containing the word.
ranked=$(gl_py '
from loopctl.scan import _greenlight_rank
text = "## Cleared\n- AG-999 — Setup the collector\n"
short = _greenlight_rank({"id": "AG-1", "title": "Setup"}, text)
named = _greenlight_rank({"id": "AG-999", "title": "Setup"}, text)
print(f"{short is None} {named is not None}")
')
check "a short title cannot ride on a bullet that names another id" "$ranked" "True True"

# greenlit-only with nothing to read is inert, not strict: every task ranks None
# and `next` reports zero candidates, which reads exactly like "nothing cleared
# yet". obsidian-vault has been in that state on the mini since enrolment.
inert=$(gl_py '
import pathlib, sys, tempfile
from loopctl.config import load_config
d = pathlib.Path(tempfile.mkdtemp())
(d / "c.yaml").write_text(
    "projects:\n- slug: x\n  path: /tmp\n  source: obsidian-base\n  policy: greenlit-only\n")
try:
    load_config(str(d / "c.yaml"))
    print("ACCEPTED")
except ValueError as exc:
    print("REJECTED" if "greenlight" in str(exc) else f"OTHER: {exc}")
')
check "greenlit-only without a greenlight file is refused at load" "$inert" "REJECTED"

echo
echo "greenlight retirement: reached OR passed, and blocked is neither"

# Equality meant retirement fired only if a scan happened to catch the task in
# precisely the stop_at state. A task that went straight to in-qa or released --
# what happens when the PR is merged before the next sweep -- kept its
# authorisation and stayed the top candidate. AG-290 sat cleared on the Air with
# its PR merged 2026-08-13 and cost $1.29 on 08-26 to rediscover it was done.
retire=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c '
from loopctl import PIPELINE_STATES
progress = [s for s in PIPELINE_STATES if s != "blocked"]
order = {n: i for i, n in enumerate(progress)}
def retires(state, target="pr-ready"):
    return state in order and order[state] >= order[target]
print(" ".join(
    f"{s}={retires(s)}" for s in
    ("in-progress", "pr-ready", "in-qa", "released", "blocked")))
')
check "a task at or past stop_at retires; one short of it does not" "$retire" \
  "in-progress=False pr-ready=True in-qa=True released=True blocked=False"

# The trap in the fix itself: PIPELINE_STATES is a list and `blocked` is appended
# last, so BY INDEX it sorts after `released`. Ranking on that would retire the
# authorisation of a task that is stuck rather than finished, and the owner would
# have to clear it again to unblock it.
blocked_idx=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c '
from loopctl import PIPELINE_STATES
print(PIPELINE_STATES.index("blocked") > PIPELINE_STATES.index("released"))
')
check "blocked really does sort after released by raw index" "$blocked_idx" "True"

# Unreachable outright before: no task is ever in state `done` or `none`, so a
# project configured that way could never retire anything at all.
unreachable=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c '
from loopctl import PIPELINE_STATES
print(" ".join(s for s in ("done", "none") if s in PIPELINE_STATES) or "neither")
')
check "done and none are not states a task can be in" "$unreachable" "neither"

echo
echo "the engine does not act on what it cannot know"

eng() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c "$1"; }

# contract.md tells the executor to skip a task another machine has claimed, but
# nothing enforced it: the rule held only as long as the executor read that line.
# Six notes carry a claim today, and the second machine would have offered them.
claims=$(eng '
import types
from loopctl import host_machine
from loopctl.scan import next_candidates
mine, theirs = f"loop-{host_machine()}", "loop-somebody-else"
def task(tid, owner):
    return {"id": tid, "state": "queued", "title": "t", "metadata": {"claimed_by": owner}}
project = types.SimpleNamespace(policy="autonomous", slug="p", source="obsidian-base",
                                stop_at="pr-ready")
state = {"tasks": [task("A", mine), task("B", theirs), task("C", None)]}
print(" ".join(t["id"] for t in next_candidates(project, state)))
')
check "a task claimed by another machine is not offered" "$claims" "A C"

# `In review` was live on the board and unmapped, so it derived as `not-started`:
# a task waiting on a reviewer looked like fresh work and could be picked up.
review=$(eng 'from loopctl.status import normalize_source_state; print(normalize_source_state("In review"))')
check "In review derives as pr-ready, not as fresh work" "$review" "pr-ready"

# VaultPathUnset reached `main`, which catches only ValueError and LockBusy, so
# an unset vault path came out as a traceback rather than its own message --
# while every vault read here already guards with `except OSError`.
vpu=$(eng 'from loopctl.writeback import VaultPathUnset; print(issubclass(VaultPathUnset, OSError))')
check "VaultPathUnset is the kind of error its callers already catch" "$vpu" "True"

# The Notion write was gated on "a token exists and the id parses", neither of
# which says the task came from Notion. An unstated source now writes nowhere:
# not knowing where a task came from is not a reason to write it somewhere.
gate=$(grep -c 'source == "notion"' "$HOME_DIR/lib/loopctl/writeback.py")
check "the Notion write is gated on the project source" "$gate" "1"

echo
echo "a project assigned elsewhere is not this machine's to run"

# `sweep_projects` filtered on machines:; `next <slug>` did not -- and `next` is
# the path ralph takes. The assignment therefore held only for the sweep, so a
# project listing one machine handed its queue to the other the moment anything
# asked for it by name. Checked inside next_candidates now, so both agree.
cat > "$HOME_DIR/scope_probe.py" <<'PROBE'
import types

from loopctl import host_machine
from loopctl.scan import next_candidates

task = {"id": "A", "state": "queued", "title": "t", "metadata": {}}


def n(machines):
    project = types.SimpleNamespace(
        policy="autonomous", slug="p", source="obsidian-base", machines=machines,
        stop_at="pr-ready",
    )
    return len(next_candidates(project, {"tasks": [task]}))


print(f"{n([host_machine()])}{n(['somebody-elses-mac'])}{n(['both'])}{n([])}")
PROBE
scoped=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" "$HOME_DIR/scope_probe.py")
check "mine yes, another machine no, both yes, unassigned yes" "$scoped" "1011"

echo "agy: the prompt has to reach it"

# `--print` is a string option on agy. `--print --dangerously-skip-permissions`
# handed it that flag as the prompt and left the real one, arriving on stdin,
# unread -- agy says so and exits non-zero. Reproduced on 1.1.23 and 1.1.25:
#
#   Error: --print took "--dangerously-skip-permissions" as its prompt, so the
#   intended prompt was left as an argument and ignored.
#
# So this executor never ran once, and `claude,agy` meant "claude, then nothing".
agy_src=$(sed -n '/^run_agy()/,/^}/p' "$ENGINE/ralph.sh")
contains "the prompt is attached to the flag" "$agy_src" '--print="$prompt"'
excludes "not passed as a bare flag with the prompt on stdin" "$agy_src" '"$AGY_BIN" --print '
excludes "and stdin is no longer where the prompt goes" "$agy_src" "printf '%s' \"\$prompt\" | LOOP_PROJECT"

# Making it work while leaving skip-permissions on would have turned a fallback
# that did nothing into an unbounded one -- worse than the bug being fixed.
contains "unbounded requires an explicit opt-in" "$agy_src" 'LOOP_AGY_ALLOW_UNBOUNDED:-0'
contains "and the default mode bounds it" "$agy_src" '--mode accept-edits'
# loopctl writes its lock under LOOP_HOME, outside the workspace, exactly as the
# claude executor already grants.
contains "LOOP_HOME is granted, as it is for claude" "$agy_src" '--add-dir "$LOOP_HOME"'

# Bounded and able to do nothing are different things. In headless mode agy
# auto-denies every command(...) no permissions.allow rule covers -- measured:
# "no output produced -- a tool required the "command" permission that headless
# mode cannot prompt for, so it was auto-denied". ~/.gemini/settings.json carries
# no permissions block, so a fixed agy would edit files, have every git, npm and
# loopctl call refused, and exit 0 with prose -- which ralph files as `advanced`.
# A row reading as progress for a run that could not commit, push or record
# anything is the failure this whole series has been removing.
grants_fn="$HOME_DIR/grants.sh"
sed -n '/^agy_has_command_grants()/,/^}/p' "$ENGINE/ralph.sh" > "$grants_fn"
grants() { # settings-json -> yes|no
  printf '%s' "$2" > "$HOME_DIR/agy-settings.json"
  PYTHON_BIN="$VENV/bin/python" AGY_SETTINGS="$HOME_DIR/agy-settings.json" \
    /bin/bash -c ". \"$grants_fn\"; agy_has_command_grants && echo yes || echo no"
}
check "a command( rule counts as a grant" \
  "$(grants _ '{"permissions":{"allow":["command(git status)"]}}')" "yes"
check "a rule that is not a command does not" \
  "$(grants _ '{"permissions":{"allow":["read(*)"]}}')" "no"
check "no permissions block at all does not" "$(grants _ '{"general":{}}')" "no"
contains "and agy reports itself unavailable rather than running blind" "$agy_src" \
  "! agy_has_command_grants"

# The default path itself, which every case above hides by setting AGY_SETTINGS.
# The first version read ~/.gemini/settings.json -- the Gemini CLI's file, which
# has no permissions key on either machine -- so grants were never found and agy
# was always unavailable: the same "claude, then nothing", with a log line. agy's
# own binary states the path: "The CLI is configured via
# ~/.gemini/antigravity-cli/settings.json".
grants_src=$(sed -n '/^agy_has_command_grants()/,/^}/p' "$ENGINE/ralph.sh")
contains "the default is agy's settings file" "$grants_src" \
  '$HOME/.gemini/antigravity-cli/settings.json'
excludes "not the Gemini CLI's, which has no permissions key" "$grants_src" \
  '${AGY_SETTINGS:-$HOME/.gemini/settings.json}'


echo
echo "metrics: a run says how big the task was, and audit adds it up"

# TASK_POINTS was read for the budget gate and thrown away. Without it in the row
# there is no cost per point to compute -- which is why every "what did this
# cost" answer in this session was arrived at by eye.
contains "ralph passes the estimate it already read" \
  "$(grep -A1 'run_fields+=(--points' "$ENGINE/ralph.sh")" '--points "$TASK_POINTS"'

pts() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  "from loopctl.writeback import _points; print(repr(_points($1)))"; }
check "an integer estimate is kept"          "$(pts 3)"           "3"
check "the string a CLI flag delivers too"   "$(pts \"'5'\")"      "5"
# "3 (was 5)" is a note somebody typed, not a size. Coercing it would invent
# data, and an absent estimate divides better than a wrong one.
check "prose is refused rather than coerced" "$(pts \"'3 (was 5)'\")" "None"
check "and absent stays absent, never zero"  "$(pts None)"        "None"

echo
echo "audit: what the ledger cannot say, it declines to say"
AUDIT_VAULT="$HOME_DIR/auditvault"
aud() {
  rm -rf "$AUDIT_VAULT"
  env PYTHONPATH="$HOME_DIR/lib" AUDIT_VAULT="$AUDIT_VAULT" \
    "$VENV/bin/python" "$HERE/audit_probe.py" "$1"
}
jq_field() { "$VENV/bin/python" -c "import json,sys;d=json.load(sys.stdin);print($1)"; }

same='{"task_id":"T-1","machine":"m","started_at":"2026-09-01T00:00:00+00:00","ended_at":"2026-09-01T00:00:00+00:00","outcome":"advanced"}'
real='{"task_id":"T-1","machine":"m","started_at":"2026-09-01T00:00:00+00:00","ended_at":"2026-09-01T00:10:00+00:00","outcome":"reached_stop_at","points":2}'

# Rows written before 2026-09-03 all have started_at == ended_at, because ralph
# had the epoch and never passed it. Summing those as zero would make every
# historical task look instant.
out=$(aud "[$same,$real]")
check "a zero-length row is excluded, not summed as zero" \
  "$(printf '%s' "$out" | jq_field 'str(d[chr(119)+chr(97)+chr(108)+chr(108)+chr(95)+chr(115)+chr(101)+chr(99)+chr(111)+chr(110)+chr(100)+chr(115)])')" "600"
check "and the excluded ones are counted, not hidden" \
  "$(printf '%s' "$out" | jq_field 'd["runs_without_duration"]')" "1"
# Named latency, not cost: wall time includes rate-limit sleeps and turn-limit
# stalls, so per-point seconds says how long a point takes to come back rather
# than what it consumed. Cost is quota percentage points, reported separately.
check "latency per point uses the estimate the rows carried" \
  "$(printf '%s' "$out" | jq_field 'd["latency"]["wall_seconds_per_point"]')" "300.0"

# No usable duration means the question has no answer, and saying so beats
# dividing by something nobody supplied.
check "no timed run yields no latency figure" \
  "$(aud "[$same]" | jq_field 'd["latency"]')" "None"
check "a task with no rows says so rather than reporting zeroes" \
  "$(aud '[]' | jq_field 'd["reason"]')" "no run has ever recorded this task"

echo
echo "doctor: absence is a state, not a pass"

doc() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  "from loopctl.doctor import _pair; print(_pair('x', declared=$1, observed=$2, source='s')['state'])"; }
# The class every one of today's bugs belongs to: a consumer that was never
# written reads exactly like one that agrees.
check "neither side readable is unknown, never ok" "$(doc None None)"        "unknown"
check "a producer with no consumer is missing"     "$(doc \"'a'\" None)"     "missing"
check "two sides that disagree say so"             "$(doc \"'a'\" \"'b'\")" "differs"
check "and agreement is the only ok"               "$(doc \"'a'\" \"'a'\")" "ok"

# An SLA turns agreement into staleness: the bundle mount matched for two days
# while being two days old, and matching was not the question.
# projects_published, not ledger: the ledger pair deliberately has no SLA now,
# because rows exist per iteration and an idle host is not a broken one.
sla() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  "from loopctl.doctor import _pair; print(_pair('projects_published', declared='m', observed='m', source='s', age=$1)['state'])"; }
check "inside its SLA a pair is ok"    "$(sla 3600)"    "ok"
check "past its SLA the same pair is stale" "$(sla 999999)" "stale"

# The runner is declared by a file and observed through launchctl -- forcing
# those through string equality reported `differs` on a healthy host, which is
# how a check earns being ignored.
run_state() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  "from loopctl.doctor import _pair; print(_pair('runner', declared='plist installed=True', observed='loaded=True enabled=True', source='s', state=$1)['state'])"; }
check "a pair may pass its own verdict" "$(run_state \"'ok'\")" "ok"

# The review found doctor doing the exact thing its docstring forbids: with no
# declared side, the comparison could not fail, so a host with no bundle mount
# reported engine_version green for a machine nothing could have told to upgrade.
check "an unreadable declared side is unknown, not ok" "$(doc None \"'x'\")" "unknown"

# launchctl holds no override for a label that was never explicitly toggled, and
# launchd's default for that is enabled. Requiring True reported `differs` on
# every host that had simply never been touched.
runner_default=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c "
loaded, enabled = True, None
print('ok' if (loaded and enabled is not False) else 'differs')")
check "no override means enabled, not unknown-so-broken" "$runner_default" "ok"

# Rows exist per iteration and never for an empty sweep, so an age SLA on the
# ledger is red every quiet weekend. The pair compares run ids instead.
excludes "the ledger pair carries no freshness SLA" \
  "$(sed -n '/^SLA_SECONDS/,/^}/p' "$ENGINE/lib/loopctl/doctor.py")" '"ledger"'
contains "ralph records the run it intends to start" \
  "$(grep -B4 'last-iteration.json' "$ENGINE/ralph.sh" | head -8)" 'run_id'

# Non-zero exit, so an hourly job cannot report success over a red pair.
grep -q 'return 0 if result.get("state") == "ok" else 1' "$ENGINE/lib/loopctl/scan.py" \
  && { pass=$((pass+1)); printf '    PASS  %s\n' "doctor exits non-zero when a pair is not ok"; } \
  || { fail=$((fail+1)); printf '    FAIL  %s\n' "doctor exits non-zero when a pair is not ok"; }

echo
echo "a killed run leaves evidence, and a stalled one ends"

# record-run, write_handoff and save_transcript all happen AFTER the executor
# returns, and there was no trap -- so a SIGTERM mid-run wrote nothing at all.
# Measured 2026-09-03 on the Air: a 39-minute run killed by hand left no ledger
# row, no handoff, no transcript. That absence is evidence for nothing, because
# it is what every interruption looks like whatever caused it.
contains "TERM is trapped"  "$(grep 'trap .* TERM' "$ENGINE/ralph.sh")" "on_interrupt"
contains "and INT too"      "$(grep 'trap .* INT'  "$ENGINE/ralph.sh")" "on_interrupt"
interrupt_src=$(sed -n '/^on_interrupt()/,/^}/p' "$ENGINE/ralph.sh")
contains "the interrupt records a run"   "$interrupt_src" 'record-run'
contains "with its own outcome"          "$interrupt_src" '--status interrupted'
contains "and leaves a handoff"          "$interrupt_src" 'write_handoff'
# Nothing to say between runs: a trap that recorded a phantom row for an idle
# interrupt would be inventing the thing this exists to stop inventing.
contains "but only while one is in flight" "$interrupt_src" 'RUN_IN_FLIGHT'

outcomes=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.writeback import OUTCOMES; print(" ".join(sorted(OUTCOMES)))')
contains "interrupted is a recordable outcome" "$outcomes" "interrupted"
norm=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  'from loopctl.writeback import normalize_outcome; print(normalize_outcome("interrupted"))')
check "and is not rewritten to advanced" "$norm" "interrupted"

# --max-turns bounds the conversation and --max-budget-usd the spend; neither
# ends a session that has stopped. The Air sat eleven minutes at 0% CPU with no
# network and nothing in the loop would have ended it.
contains "claude runs under a wall-clock ceiling" \
  "$(sed -n '/^run_claude()/,/^}/p' "$ENGINE/ralph.sh")" 'run_with_timeout'

# Killing only the job leaves its children holding the stdout pipe, and the
# command substitution then waits for them anyway: 20s against a 1s timeout,
# measured. The watchdog takes the process group.
wd=$(sed -n '/^run_with_timeout()/,/^}/p' "$ENGINE/ralph.sh")
contains "the watchdog kills the process group" "$wd" 'kill -TERM -"$job"'
contains "which needs job control on"           "$wd" 'set -m'

echo
echo "the runner refreshes the world before choosing in it"

# `next` reads registry state and only `scan` writes it. ralph never called
# scan, so every wake chose from a snapshot of unbounded age -- 3.5h on
# 2026-09-03, and only that fresh because a person had run scan by hand. It is
# half of why AG-290 stayed selectable after its PR merged.
contains "ralph scans before the iteration loop" \
  "$(grep -B2 -A6 'refreshing task state' "$ENGINE/ralph.sh")" 'scan --all'
# Falling back to the old snapshot on error would reintroduce the failure at the
# moment the data is least trustworthy.
contains "and a failed scan stops the wake" \
  "$(grep -A4 'scan --all' "$ENGINE/ralph.sh")" 'exit 4'

# scan printed a task document, published nothing, and exited 0 -- on the Air,
# for a month, because gh was missing from a non-interactive PATH.
contains "a scan that could not publish exits non-zero" \
  "$(grep -B2 -A2 'publish_failed' "$ENGINE/lib/loopctl/scan.py" | tail -6)" 'return 3 if publish_failed'

echo
echo "doctor: a mechanism that is absent is not a mechanism that failed"
# The Air installs from a downloaded tarball and has no bundle mount at all, so
# `unknown` there made doctor exit 1 forever on a healthy host -- which is how a
# check earns being ignored. Absent mechanism and failing mechanism are split.
na=$(env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c "
from loopctl.doctor import _pair
p = _pair('engine_version', declared=None, observed='v', source='s', state='not_applicable')
print(p['state'])")
check "an absent mechanism reports not_applicable" "$na" "not_applicable"
contains "and not_applicable is excluded from the verdict" \
  "$(sed -n '/graded = \[/,/\]/p' "$ENGINE/lib/loopctl/doctor.py")" 'not_applicable'

echo
echo "doctor: launchd keeps the plist it read, not the one on disk"

# launchd reads a plist once, at bootstrap, and keeps it. Replacing the file
# changes nothing about the running service and `disable` does not unload it, so
# install.sh can write a corrected unit the machine never adopts. Measured
# 2026-09-03 on the Air: the plist said `ralph.sh 1 10` while launchd ran
# `ralph.sh` alone, and the runner kept the 15-iteration default it had been
# bootstrapped with -- twice, after the file was fixed. `bootstrap` on the
# already-registered label then failed with `5: Input/output error`, a message
# that says nothing about which definition is loaded.
ld() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" -c \
  "from loopctl.doctor import _pair; print(_pair('loaded_definition', declared=$1, observed=$2, source='s', state=$3)['state'])"; }
check "a plist launchd never re-read is differs" \
  "$(ld \"'ralph.sh 1 10'\" \"'ralph.sh'\" None)" "differs"
check "and matching definitions are ok" \
  "$(ld \"'ralph.sh 1 10'\" \"'ralph.sh 1 10'\" None)" "ok"
# Nothing registered means nothing to disagree with. A runner that is
# deliberately off must not make this red -- that is the `runner` pair's
# question, and asking it twice is how a check becomes noise.
check "nothing loaded is not applicable, not broken" \
  "$(ld None None \"'not_applicable'\")" "not_applicable"

# The pair reads both sides through the tools that own them, so it cannot drift
# from either: plutil for the file, launchctl print for what is running.
def_src=$(sed -n '/^def _loaded_definition_pair/,/^def /p' "$ENGINE/lib/loopctl/doctor.py")
contains "the declared side comes from the plist itself" "$def_src" 'plutil'
contains "and the observed side from launchd"            "$def_src" 'launchctl'

echo
echo "selection: greenlit, unfinished, and unblocked -- all three"

cat > "$HOME_DIR/sel_probe.py" <<'PROBE'
import sys, types
from loopctl.scan import next_candidates

def task(tid, state):
    return {"id": tid, "state": state, "title": "t", "metadata": {}}

project = types.SimpleNamespace(
    policy="autonomous", slug="p", source="obsidian-base",
    machines=[], stop_at=sys.argv[1],
)
state = {"tasks": [task(s, s) for s in
                   ("queued", "in-progress", "pr-ready", "blocked", "in-qa")]}
print(" ".join(sorted(t["id"] for t in next_candidates(project, state))))
PROBE
sel() { env PYTHONPATH="$HOME_DIR/lib" "$VENV/bin/python" "$HOME_DIR/sel_probe.py" "$1"; }

# `blocked` was in _IN_FLIGHT, and membership does two things: it makes a task
# selectable AND exempts it from the dependency check. A blocked task travelled
# through a WIDER gate than a healthy one. AG-801 was correctly marked Blocked
# and reselected nine times between 2026-09-03 16:04 and 09-04 00:59, each run
# timing out at thirty minutes with nothing to show, moving the company weekly
# quota 37% -> 54%. The board said the right thing; nothing read it.
check "blocked is never selected, and pr-ready stops at stop_at" \
  "$(sel pr-ready)" "in-progress queued"
# A project that runs past pr-ready still continues that work.
check "a project stopping later still continues a pr-ready task" \
  "$(sel done)" "in-progress pr-ready queued"

echo
echo "outcome: advanced is a claim, so it has to be earned"

# It was the else-branch of "is there a PR", so every clean exit that produced
# nothing was recorded as progress -- and MAX_BLOCKED counts blocked and failed
# runs, neither of which `advanced` is. Nine timeouts, nine claims of progress,
# no guard reached.
#
# Called, not grepped. The first attempt at this fix WAS grepped: the assertions
# below were `contains ... 'task_moved'` against the source, and they passed
# while the chain read $task_moved eleven lines above the probe that sets it.
# A test that asks whether code mentions a thing cannot tell you it does it.
eval "$(sed -n '/^decide_outcome()/,/^}/p' "$ENGINE/ralph.sh")"
check "a PR is reached_stop_at" \
  "$(decide_outcome '#365' same '')" "reached_stop_at"
check "a commit anywhere is advanced" \
  "$(decide_outcome '' changed '')" "advanced"
# Writing `blocked` with a reason is work, even with nothing else to show.
check "the task's own state moving is advanced" \
  "$(decide_outcome '' same blocked)" "advanced"
check "and nothing at all is no_progress" \
  "$(decide_outcome '' same '')" "no_progress"
# A PR outranks the rest: it is the only evidence that says the task is finished
# rather than merely further along.
check "a PR wins over a commit" \
  "$(decide_outcome '#365' changed moved)" "reached_stop_at"

# `task_moved` is a comparison, so its two halves must bracket the executor. A
# "before" taken after the run is not one, and a decision taken before the
# "after" reads the previous iteration's value.
line() { grep -n "$1" "$ENGINE/ralph.sh" | head -1 | cut -d: -f1; }
before_line=$(line '^  task_state_before=')
launch_line=$(line 'candidate_out=.(run_executor')
after_line=$(line '^  task_state_after=')
decide_line=$(line 'decide_outcome "')
ordered=yes
prev=0
for n in "$before_line" "$launch_line" "$after_line" "$decide_line"; do
  { [ -n "$n" ] && [ "$n" -gt "$prev" ]; } || ordered=no
  prev=${n:-$prev}
done
check "before, run, after, decide -- in that order" "$ordered" "yes"

# The probe itself. `updated_ts >= run start` answered "was this row touched",
# and an executor touches its own row every iteration before it does anything --
# AG-801 rewrote its note nine times while its state stayed Blocked, and each of
# those read as a move. Two readings of the same field cannot be fooled that way.
eval "$(sed -n '/^task_overlay_state()/,/^}/p' "$ENGINE/ralph.sh")"
# The two variables the function closes over. Unset, every call returns empty --
# which would make "an unchanged state is not a move" pass because BOTH sides are
# empty, the same fixture trap that let a stripped-plist test pass earlier today.
PYTHON_BIN="$VENV/bin/python"
VAULT_USAGE="$HOME_DIR/vaultusage"; mkdir -p "$VAULT_USAGE"
progress() { cat > "$VAULT_USAGE/tasks-progress.json" <<JSON
{"tasks": {"AG-801": {"loop_status": "$1", "note": "$2", "updated_ts": 9999999999}}}
JSON
}

progress Blocked "first pass: no unbind contract on develop"
was=$(task_overlay_state AG-801)
check "the probe reads the state the overlay records" "$was" "Blocked"
# Guards every comparison below: two empty strings also compare equal.
check "and that reading is not empty" \
  "$([ -n "$was" ] && printf 'read' || printf 'empty')" "read"

# The nine-run case, exactly: same state, a freshly rewritten note.
progress Blocked "second pass: still no unbind contract, quota now 58%"
now=$(task_overlay_state AG-801)
check "a rewritten note with an unchanged state is not a move" \
  "$([ "$was" != "$now" ] && printf 'moved' || printf 'still')" "still"

progress "PR ready" "opened the PR"
now=$(task_overlay_state AG-801)
check "a changed state is a move" \
  "$([ "$was" != "$now" ] && printf 'moved' || printf 'still')" "moved"

# Unreadable must read the same both times, so before equals after and the run
# claims nothing on the strength of a failure.
rm -f "$VAULT_USAGE/tasks-progress.json"
check "an unreadable overlay says nothing rather than something" \
  "$(task_overlay_state AG-801)" ""
check "and a task with no id says nothing" "$(task_overlay_state '')" ""

blocking=$(grep '^blocking = ' "$ENGINE/ralph.sh")
contains "no_progress counts toward MAX_BLOCKED"  "$blocking" 'no_progress'
contains "and so does interrupted"                "$blocking" 'interrupted'

printf '\n  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
rm -rf "$ROOT"
