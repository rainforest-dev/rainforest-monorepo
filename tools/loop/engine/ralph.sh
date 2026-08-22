#!/usr/bin/env bash
# Sweep-aware, budget-limited background runner for the global loop framework.
set -uo pipefail

LOOP_HOME=${LOOP_HOME:-"$HOME/.claude/loop"}
LOOPCTL=${LOOPCTL:-"$LOOP_HOME/loopctl"}
CONTRACT=${LOOP_CONTRACT:-"$LOOP_HOME/contract.md"}
CLAUDE_BIN=${CLAUDE_BIN:-$(command -v claude 2>/dev/null || echo "$HOME/.local/bin/claude")}
CODEX_BIN=${CODEX_BIN:-$(command -v codex 2>/dev/null || echo "$HOME/.local/bin/codex")}
AGY_BIN=${AGY_BIN:-$(command -v agy 2>/dev/null || echo "$HOME/.local/bin/agy")}
PYTHON_BIN=${LOOP_PYTHON:-"$LOOP_HOME/.venv/bin/python"}
# `hostname -s` is not an identity: it follows DHCP. Measured 2026-07-30, it
# returned Angibles-MacBook-Air for one run and Angibles-Air for the next on the
# same laptop, which forked the run ledger into a third partition and left the
# quota gate reading a quota.<machine>.json that did not exist -- so the gate
# silently degraded to "unknown" and the run proceeded ungated. LocalHostName is
# the stable macOS name and does not move with the network; loopctl derives it the
# same way, and the two must agree or every per-machine file splits.
MACHINE=${LOOP_MACHINE:-${USAGE_MACHINE:-$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null)}}
MACHINE=${MACHINE%%.*}
EXECUTORS=${LOOP_EXECUTORS:-claude,codex,agy}
# Where `loopctl set` mirrors task state for Loop Observatory. Resolved through
# loopctl so this cannot drift from the path writeback actually writes to; empty
# if that fails, and the grant below is simply skipped.
VAULT_USAGE=$("$PYTHON_BIN" -c \
  'import sys; sys.path.insert(0, "'"${LOOP_HOME}"'/lib"); from loopctl.writeback import usage_path; print(usage_path("").parent)' \
  2>/dev/null || printf '')
AGENT_CONFIG=${LOOP_AGENT_CONFIG:-}
# Resolved per iteration from the agent config's preset for this task. Empty
# means "say nothing", so each executor falls back to its own default -- the
# behaviour that existed before presets.
PLAN_MODEL=""
PLAN_EFFORT=""
# The usage tracker lives outside LOOP_HOME and runs on the system interpreter;
# the loop venv does not carry its dependencies.
USAGE_RUNTIME=${LOOP_USAGE_RUNTIME:-"$HOME/.local/share/loop-usage-runtime"}
USAGE_PYTHON=${LOOP_USAGE_PYTHON:-$(command -v python3 2>/dev/null || echo python3)}
MAX_ITER=${1:-15}
BUDGET_USD=${2:-10}
BACKOFF=${RALPH_BACKOFF_SECS:-1800}
MAX_WAITS=${RALPH_MAX_WAITS:-48}
# A runaway guard, not a cost control -- cost is bounded by BUDGET_USD and the
# quota gate below, both of which stop the loop on real spend. 40 was too tight
# to be only a guard: on 2026-07-29 a single bug fix (read the ticket, locate
# the code, fix, test, commit, open the PR, record the state) hit the limit on
# the last step, after the PR was already open.
MAX_TURNS=${RALPH_MAX_TURNS:-100}
# Where the OTLP collector is. Alloy runs on the mini, so localhost is right
# there and the Air reaches it across the LAN; 4318 is the HTTP receiver, which
# needs no gRPC toolchain on either host. Setting this to empty turns the whole
# telemetry block off -- the one switch, rather than nine variables to unset.
OTLP_ENDPOINT=${LOOP_OTLP_ENDPOINT-http://localhost:4318}
# Generated per executor attempt, below, and stamped into the launch environment
# before the process starts. Empty here so a function that reads it before the
# first attempt gets nothing rather than the previous task's id.
RUN_ID=""
TASK_POINTS=""
SPENT=0
WEEK_PP_SPENT=0
waits=0
iter=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ralph: $*"; }

# Executor output was read for a cost figure and a verdict line, then dropped. So
# when the first preset run died on 2026-07-30 there was no way to see what the
# executor had actually said -- and codex kept no session either, because it still
# ran with `--ephemeral` then. The log said "rate limited" and that was the entire
# evidence trail. Keep the output. Transcripts stay the primary record even now
# that codex sessions persist: they cover every executor, and they are pruned.
TRANSCRIPTS=${LOOP_TRANSCRIPTS:-"$LOOP_HOME/transcripts"}
TRANSCRIPT_KEEP=${LOOP_TRANSCRIPT_KEEP:-200}

# Writes one executor's output and echoes the path, or nothing if it cannot.
# Best-effort throughout: losing a transcript must never fail a run.
save_transcript() {
  local executor="$1" body="$2" label="$3"
  mkdir -p "$TRANSCRIPTS" 2>/dev/null || return 0
  local safe
  safe=$(printf '%s' "${label:-task}" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-48)
  local path="$TRANSCRIPTS/$(date '+%Y%m%dT%H%M%S')-$MACHINE-$executor-$safe.log"
  printf '%s' "$body" > "$path" 2>/dev/null || return 0
  # Bounded so an unattended loop cannot fill the disk with transcripts.
  ls -1t "$TRANSCRIPTS"/*.log 2>/dev/null | tail -n +"$((TRANSCRIPT_KEEP + 1))" |
    while IFS= read -r stale; do rm -f "$stale"; done
  printf '%s' "$path"
}

# The harness's own error text from an executor's output — never the model's prose.
#
# Grepping the whole blob was a live bug: this contract instructs the executor to
# "rely on the outer runner's rate-limit handling", so an executor that reported
# following its instructions was read as the provider rate-limiting us. On
# 2026-07-30 that killed the first preset run and sent a codex task to claude
# carrying codex's model name. What the model *says* is not provider state.
#
# Codex emits newline-delimited events; only `item.type == "error"` messages and
# failed-turn payloads are the harness speaking. Claude emits one result object;
# only its `subtype`/`result` when `is_error`. Anything that is not JSON at all
# (agy prints plain text) falls back to the whole output, since there is no
# envelope to read and a real message would be in there.
executor_error_text() {
  printf '%s' "$1" | "$PYTHON_BIN" -c '
import json, sys

raw = sys.stdin.read()
parts = []
saw_json = False

# Both readings run over the same bytes and the results are unioned, rather than
# choosing one by shape. A single-line codex event parses as one JSON object, so
# "parses as a dict" cannot mean "this is claude" -- deciding that way silently
# dropped genuine codex rate-limit errors. Each reading finds nothing in the
# other format, so the union is safe.

# Claude: one result object, and only when it says it failed.
try:
    doc = json.loads(raw)
except ValueError:
    doc = None
if isinstance(doc, dict):
    saw_json = True
    if doc.get("is_error") or str(doc.get("subtype") or "").startswith("error"):
        for key in ("subtype", "result", "error", "message"):
            value = doc.get(key)
            if isinstance(value, str):
                parts.append(value)

# Codex: newline-delimited events; the harness speaks through error items and
# failed turns. `agent_message` items are the model talking and are never read.
for line in raw.splitlines():
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        event = json.loads(line)
    except ValueError:
        continue
    saw_json = True
    kind = str(event.get("type") or "")
    item = event.get("item") if isinstance(event.get("item"), dict) else {}
    if str(item.get("type") or "") == "error":
        parts.append(str(item.get("message") or ""))
    if "failed" in kind or kind.endswith("error"):
        for key in ("message", "error", "reason"):
            value = event.get(key)
            if isinstance(value, str):
                parts.append(value)

print("\n".join(parts) if saw_json else raw)
' 2>/dev/null || printf '%s' "$1"
}

# Weekly points a codex run actually spent, read from the session it just wrote.
#
# The exporter samples "the newest session file", which is not this run's: codex
# exec spawns guardian and subagent sessions alongside it, and the newest one can
# be a sibling that carries no rate_limits yet. Measured 2026-07-31, both samples
# of the AG-288 Luna run came back empty and the record stored `quota: null`,
# while the run's own session held the answer all along.
#
# Every `token_count` event carries `rate_limits.primary.used_percent`, so the
# first and last of them bracket exactly this run and nothing else. That is a
# cleaner measurement than any before/after file read: a shared pool moves for
# other reasons between two samples, and a session file cannot.
codex_weekly_pp() {
  local transcript="$1"
  [ -f "$transcript" ] || return 0
  "$PYTHON_BIN" - "$transcript" "$HOME/.codex/sessions" <<'PY' 2>/dev/null || true
import glob
import json
import os
import sys

# The thread id codex announces is the session filename's suffix.
thread = None
try:
    with open(sys.argv[1]) as handle:
        for line in handle:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("type") == "thread.started" and event.get("thread_id"):
                thread = event["thread_id"]
                break
except OSError:
    pass
if not thread:
    raise SystemExit

matches = glob.glob(os.path.join(sys.argv[2], "**", f"*{thread}.jsonl"), recursive=True)
if not matches:
    raise SystemExit

first = last = None
try:
    with open(matches[0]) as handle:
        for line in handle:
            line = line.strip()
            if '"token_count"' not in line:
                continue
            try:
                payload = (json.loads(line).get("payload") or {})
            except ValueError:
                continue
            if payload.get("type") != "token_count":
                continue
            primary = ((payload.get("rate_limits") or {}).get("primary") or {})
            used = primary.get("used_percent")
            if used is None:
                continue
            if first is None:
                first = used
            last = used
except OSError:
    raise SystemExit

if first is not None and last is not None:
    print("{}\t{}".format(first, last))
PY
}

rate_limited() {
  executor_error_text "$1" |
    grep -qiE 'rate.?limit|too many requests|(usage|weekly|5-?hour|daily)[ -]?limit|quota (exceeded|reached|limit)'
}

# Output tokens for one run, or nothing when the output does not say.
#
# Same two-reading shape as executor_error_text, and for the same reason: reading
# the blob as one JSON object is claude's envelope, and codex's newline-delimited
# events make that parse fail, so every codex run recorded tokens_out as null --
# the 3,208 output tokens of the 2026-07-30 AG-132 run existed only in its
# transcript. Codex can report several turns, so they are summed. Its
# `reasoning_output_tokens` is left out: whether it is already inside
# `output_tokens` is not documented, and double-counting would be worse than
# under-reporting a field used for cost-per-run comparisons.
executor_tokens_out() {
  printf '%s' "$1" | "$PYTHON_BIN" -c '
import json, sys

raw = sys.stdin.read()
total = 0
found = False

# Claude: one result object carrying one usage block.
try:
    doc = json.loads(raw)
except ValueError:
    doc = None
if isinstance(doc, dict):
    value = (doc.get("usage") or {}).get("output_tokens")
    if isinstance(value, int):
        total += value
        found = True

# Codex: one usage block per completed turn.
for line in raw.splitlines():
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        event = json.loads(line)
    except ValueError:
        continue
    if str(event.get("type") or "") != "turn.completed":
        continue
    value = (event.get("usage") or {}).get("output_tokens")
    if isinstance(value, int):
        total += value
        found = True

print(total if found else "")
' 2>/dev/null || printf ''
}

[ -x "$LOOPCTL" ] || { log "loopctl missing at $LOOPCTL; run obsidian-setup"; exit 1; }
[ -f "$CONTRACT" ] || { log "contract missing at $CONTRACT; run obsidian-setup"; exit 1; }
[ -x "$PYTHON_BIN" ] || PYTHON_BIN=$(command -v python3)

# Contract §2 gates are denominated in quota percent, not dollars. BUDGET_USD
# stays as a secondary cap, but on a seat plan the percentages are the real
# limit, so they are checked first and can stop the run on their own.
QUOTA_FILE=${LOOP_QUOTA_FILE:-"$HOME/.local/share/loop-usage-runtime/_system/usage/quota.$MACHINE.json"}
PCT_5H_STOP=${LOOP_PCT_5H_STOP:-80}
PCT_WEEK_STOP=${LOOP_PCT_WEEK_STOP:-90}
PCT_5H_DRAIN=${LOOP_PCT_5H_DRAIN:-60}
PCT_WEEK_DRAIN=${LOOP_PCT_WEEK_DRAIN:-85}

# What a run is allowed to cost, in the unit a seat plan is actually measured in.
# BUDGET_USD stopped the 2026-07-31 AG-130 run at $11.25 having already opened the
# PR -- a dollar figure that says nothing about whether the week can absorb it.
# The same run moved weekly usage 31%->81%, which is the number that decides
# whether the rest of the week is affordable.
#
# Unset means unchanged behaviour: the dollar cap stays the only per-run limit.
# When set, the run stops once observed weekly points exceed the approved figure
# by more than OVERRUN_RATIO -- approval is for an estimate, and an estimate that
# lands slightly over is not a reason to abandon work in progress.
BUDGET_WEEKLY_PP=${LOOP_BUDGET_WEEKLY_PP:-}
OVERRUN_RATIO=${LOOP_OVERRUN_RATIO:-1.5}

# Emits "<verdict>\t<five_hour_pct>\t<weekly_pct>". Verdict is one of
# stop / drain / ok / unknown; unknown keeps the contract's conservative path.
# Emits "<verdict>\t<claude_5h>\t<claude_week>\t<codex_5h>\t<codex_week>".
# Verdict is stop / drain / ok / unknown; unknown keeps the conservative path.
#
# Both pools, because this read only `claude` while the loop routes work to Codex
# too. Measured 2026-07-31: the AG-297 Sol run recorded `weekly 31%->31% (~0pp)`
# while spending Codex, and a Claude pool sitting at 82% would have blocked a task
# that costs Claude nothing. Codex has no five-hour window at all, so its slot
# stays empty rather than being invented.
#
# The gate fires before the executor is chosen -- the preset resolves after the
# sweep -- so it is deliberately conservative: whichever pool is worst decides.
# Attribution is a separate question, settled after the run, by provider.
# Seconds until the soonest quota window resets, and which window, as
# "<secs>\t<label>". Empty when the snapshot cannot say -- the caller then falls
# back to the blind interval, which is what every wait did before this.
#
# Waiting the interval was never wrong, only uninformed: the snapshot has carried
# `resets_at` all along, so a run could sleep 1800s to re-read a window with 208
# minutes left on it. Sleeping to the known moment costs the same and wakes once.
reset_wait() {
  "$PYTHON_BIN" - "$QUOTA_FILE" <<'RESETPY' 2>/dev/null || true
import json
import sys
import time

try:
    doc = json.load(open(sys.argv[1]))
except (OSError, ValueError):
    raise SystemExit
if not isinstance(doc, dict):
    raise SystemExit
now = time.time()
soonest = None
for provider, windows in (
    ("claude", ("five_hour", "weekly_all")),
    ("codex", ("five_hour", "weekly")),
):
    block = doc.get(provider) or {}
    for name in windows:
        at = (block.get(name) or {}).get("resets_at")
        if not at:
            continue
        secs = float(at) - now
        # A window that has already rolled over is not something to wait for.
        if secs <= 0:
            continue
        if soonest is None or secs < soonest[0]:
            soonest = (secs, provider + " " + name.replace("_", "-"))
if soonest:
    print(str(int(soonest[0])) + "\t" + soonest[1])
RESETPY
}

quota_state() {
  "$PYTHON_BIN" - "$QUOTA_FILE" "$PCT_5H_STOP" "$PCT_WEEK_STOP" "$PCT_5H_DRAIN" "$PCT_WEEK_DRAIN" <<'PY'
import json
import sys

def pct(bucket):
    return (bucket or {}).get("used_pct")

try:
    doc = json.load(open(sys.argv[1]))
except (OSError, ValueError):
    doc = None
if not isinstance(doc, dict):
    print("unknown\t\t\t\t")
    raise SystemExit

claude = doc.get("claude") or {}
codex = doc.get("codex") or {}
readings = {
    "claude_5h": pct(claude.get("five_hour")),
    "claude_week": pct(claude.get("weekly_all")),
    "codex_5h": pct(codex.get("five_hour")),
    "codex_week": pct(codex.get("weekly")),
}
stop5, stopw, drain5, drainw = (float(value) for value in sys.argv[2:6])
fives = [v for k, v in readings.items() if k.endswith("_5h") and v is not None]
weeks = [v for k, v in readings.items() if k.endswith("_week") and v is not None]

if not fives and not weeks:
    verdict = "unknown"
elif any(v > stop5 for v in fives) or any(v > stopw for v in weeks):
    verdict = "stop"
elif any(v > drain5 for v in fives) or any(v > drainw for v in weeks):
    verdict = "drain"
else:
    verdict = "ok"
print("\t".join([verdict] + [
    "" if readings[k] is None else str(readings[k])
    for k in ("claude_5h", "claude_week", "codex_5h", "codex_week")
]))
PY
}

# Force a fresh provider read before sampling. Without this the before/after
# pair both come from the file the hourly job rewrites, so a run lasting minutes
# reads the same snapshot twice -- which is why every delta recorded up to
# 2026-07-30 was ~0pp. Best-effort: an unavailable tracker must not stop a run,
# it just leaves the delta as approximate as it was before.
refresh_quota() {
  [ -d "$USAGE_RUNTIME" ] || return 0
  (cd "$USAGE_RUNTIME" && "$USAGE_PYTHON" -m scripts.usage.export_quota) \
    >/dev/null 2>&1 || true
}

# Percentage-point delta between two quota readings, for the per-iteration
# estimate.
#
# A quota window that rolls over mid-run reads lower afterwards, and subtracting
# gives a negative "usage" that is arithmetic, not measurement. On 2026-07-31 an
# AG-130 run logged `5h 44%→8.0% (~-36.0pp)`, which reads as if the iteration
# handed 36 points back. Usage within a window cannot fall, so a lower "after" is
# a reset and the iteration's own cost is unmeasurable from these two samples --
# say that instead of printing a number.
pct_delta() {
  [ -n "$1" ] && [ -n "$2" ] || { printf '?'; return; }
  "$PYTHON_BIN" -c \
    'from decimal import Decimal; import sys
before, after = Decimal(sys.argv[1]), Decimal(sys.argv[2])
print("window reset" if after < before else "~{}pp".format(after - before))' \
    "$1" "$2"
}

# Whether a delta can be claimed as this run's cost, or only as a bound on it.
#
# Sampling a shared quota file before and after an iteration measures everything
# that spent the pool in between, and on this machine the loudest spender is
# usually the Claude Code session operating the loop. Measured 2026-08-05: the
# AG-131 iteration cost $4.51 and recorded 36pp, while AG-383 cost $16.34 and
# recorded 1pp -- it ran overnight with nothing else awake. Three and a half
# times the spend, one thirty-sixth the points; the numbers are not noisy, they
# are anti-correlated, and nothing in the row said so.
#
# Only a delta read from inside the run's own session is exact, which is what
# codex_weekly_pp returns when it finds one. Claude publishes quota per account
# and never per session -- its result envelope carries total_cost_usd and no
# percentage at all -- so a claude delta is an upper bound, always, and there is
# no measurement that would make it otherwise.
quota_attribution() {
  local provider="$1" own_bracket="${2:-}"
  if [ "$provider" = "codex" ] && [ -n "$own_bracket" ]; then
    printf 'exact'
  else
    printf 'upper-bound'
  fi
}

# A delta string with its provenance attached, so the number is never read alone.
# Only decorates a real measurement: "window reset" and "?" already say they are
# not one, and marking them would suggest there is a bound where there is none.
mark_bound() {
  case "$2" in
    exact) printf '%s' "$1" ;;
    *) case "$1" in
         '~'*pp) printf '%s, upper bound — shared pool' "$1" ;;
         *) printf '%s' "$1" ;;
       esac ;;
  esac
}

# Whether one spend exceeded the guard, and by how much: "<0|1>\t<amount over>".
usd_over() {
  "$PYTHON_BIN" -c \
    'from decimal import Decimal; import sys
spend, guard = Decimal(sys.argv[1] or 0), Decimal(sys.argv[2])
print("{}\t{}".format(int(spend > guard), max(spend - guard, Decimal(0))))' \
    "$1" "$2" 2>/dev/null || printf '0\t0'
}

# One log-safe line describing how an executor ended: its stop reason and what
# it said. Needed on the failure path most of all -- on 2026-07-29 an executor
# hit the turn limit one step after opening a PR, and the log said only
# "failed (exit=1)", which reads identically to never having started.
executor_verdict() {
  printf '%s' "$1" | "$PYTHON_BIN" -c \
    'import json, sys
data = sys.stdin.read()
try:
    payload = json.loads(data)
except Exception:
    payload = {}
subtype = str(payload.get("subtype") or "")
text = payload.get("result") or ""
# The fallback belongs to the text, not to the whole line: a stop reason with no
# result -- exactly what the turn limit produces -- would otherwise print as a
# bare "[error_max_turns]" and hide the fact that the executor said nothing.
line = " ".join(str(text).split())[:180] or "(executor returned no result text)"
prefix = f"[{subtype}] " if subtype and subtype != "success" else ""
print((prefix + line).strip())' \
    2>/dev/null || echo "(unreadable executor output)"
}

# The executor's own reason for stopping, as the CLI reports it. Measured
# 2026-07-29: exhausting --max-turns exits 1 with subtype "error_max_turns",
# is_error true, and result null -- indistinguishable from a real failure by exit
# code alone, which is the whole reason this is read separately.
executor_subtype() {
  printf '%s' "$1" | "$PYTHON_BIN" -c \
    'import json, sys
try:
    print(json.loads(sys.stdin.read()).get("subtype") or "")
except Exception:
    print("")' \
    2>/dev/null || printf ''
}

# --- attribution ------------------------------------------------------------
#
# OTEL_RESOURCE_ATTRIBUTES is set once before the executor starts and is stamped
# on every metric and event that process emits. That is the whole structural
# point: it cannot be partially applied, which is precisely how the approach it
# replaces went sparse. Cost, tokens, model and task were optional keyword
# arguments to `record-run`, and a caller that did not know a value passed
# nothing and succeeded silently -- across the 19 runs in the live ledger,
# `task_id` landed on 1 and `cost_usd` was 0.00 on 11.

# The attribute string is W3C baggage, where `,` and `=` are the delimiters, so
# a value carrying either silently corrupts every attribute after it -- a Notion
# task ref with a query string is enough. Percent-encode the delimiters, the
# space and the percent itself; URLs and paths are otherwise already safe.
otel_escape() {
  printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/,/%2C/g' -e 's/=/%3D/g' -e 's/ /%20/g'
}

# machine, project, task_id, run_id, executor, model, effort -- plus the
# estimates in force for THIS run.
#
# The estimates are stamped here rather than looked up afterwards, and that is
# not a convenience. A story point lives in the task source and moves as the
# task is refined, so an audit that reads it later compares the actual against a
# number nobody was working to. Capturing it at launch makes the estimate
# immutable per run for free, on the mechanism that already had to exist.
otel_resource_attributes() {
  local executor="$1" slug="$2" task_key="$3"
  local attrs="machine=$(otel_escape "$MACHINE")"
  attrs="$attrs,project=$(otel_escape "$slug")"
  attrs="$attrs,run_id=$(otel_escape "$RUN_ID")"
  attrs="$attrs,executor=$(otel_escape "$executor")"
  [ -n "$task_key" ] && attrs="$attrs,task_id=$(otel_escape "$task_key")"
  [ -n "$PLAN_MODEL" ] && attrs="$attrs,model=$(otel_escape "$PLAN_MODEL")"
  [ -n "$PLAN_EFFORT" ] && attrs="$attrs,effort=$(otel_escape "$PLAN_EFFORT")"
  [ -n "$TASK_POINTS" ] && attrs="$attrs,story_point=$(otel_escape "$TASK_POINTS")"
  attrs="$attrs,budget_usd=$(otel_escape "$BUDGET_USD")"
  attrs="$attrs,max_turns=$(otel_escape "$MAX_TURNS")"
  printf '%s' "$attrs"
}

# Sets OTEL_ENV to the launch environment for a Claude Code run, or to nothing
# when no collector is configured.
otel_claude_env() {
  local executor="$1" slug="$2" task_key="$3"
  OTEL_ENV=()
  [ -n "$OTLP_ENDPOINT" ] || return 0
  OTEL_ENV=(
    CLAUDE_CODE_ENABLE_TELEMETRY=1
    OTEL_METRICS_EXPORTER=otlp
    OTEL_LOGS_EXPORTER=otlp
    OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
    "OTEL_EXPORTER_OTLP_ENDPOINT=$OTLP_ENDPOINT"
    # NOT optional. Claude Code defaults to delta temporality and Alloy's
    # Prometheus converter drops delta silently. Measured 2026-08-21: with the
    # default, only `target_info` arrived -- a gauge synthesised from resource
    # attributes -- while every `claude_code.*` counter vanished and
    # `prometheus_remote_storage_samples_failed_total` stayed at 0. Partial
    # arrival at zero failures is the signature: it clears the whole transport
    # path and points at the data type.
    OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative
    # Every CLI session is a new session.id, and every run is a new run_id.
    # Either on a metric label churns Prometheus series without bound, so both
    # are off and the ids stay in the log line for Loki-side joins. This is not
    # a compromise: exact per-run cost was always Loki's job, and Prometheus was
    # never meant to hold a run_id. INCLUDE_RESOURCE_ATTRIBUTES is the
    # load-bearing one -- OTEL_RESOURCE_ATTRIBUTES applies to both signals, so
    # leaving it true would put run_id on metrics through the back door.
    OTEL_METRICS_INCLUDE_SESSION_ID=false
    OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false
    # Own hardware, so user.email and the account ids are not an exposure --
    # they are simply cardinality nothing here reads.
    OTEL_METRICS_INCLUDE_ACCOUNT_UUID=false
    # The default is 60s. A run shorter than that would depend entirely on the
    # shutdown flush, and the SDK fails silently when that flush does not land.
    OTEL_METRIC_EXPORT_INTERVAL=10000
    "OTEL_RESOURCE_ATTRIBUTES=$(otel_resource_attributes "$executor" "$slug" "$task_key")"
  )
}

# Codex reads OTEL_RESOURCE_ATTRIBUTES without being told to: its provider builds
# the resource with `Resource::builder()`, which carries the default env
# detector, so attribution needs no Codex-specific mechanism. The exporters do --
# they come from config, not env -- and they take FULL signal paths, because
# Codex hands the endpoint to `LogExporter::builder().with_http().with_endpoint()`
# and that uses the URL as given rather than appending `/v1/logs` the way the
# OTEL_EXPORTER_OTLP_ENDPOINT convention does.
#
# Sets OTEL_ENV and OTEL_CODEX_OPTS.
otel_codex_env() {
  local executor="$1" slug="$2" task_key="$3"
  OTEL_ENV=()
  OTEL_CODEX_OPTS=()
  [ -n "$OTLP_ENDPOINT" ] || return 0
  OTEL_ENV=(
    "OTEL_RESOURCE_ATTRIBUTES=$(otel_resource_attributes "$executor" "$slug" "$task_key")"
  )
  OTEL_CODEX_OPTS=(
    -c "otel.exporter={otlp-http={endpoint=\"$OTLP_ENDPOINT/v1/logs\",protocol=\"binary\"}}"
    -c "otel.trace_exporter={otlp-http={endpoint=\"$OTLP_ENDPOINT/v1/traces\",protocol=\"binary\"}}"
    # Codex's metrics exporter defaults to `statsig`, which resolves to an OTLP
    # endpoint at ab.chatgpt.com. Left alone, every loop run would ship metrics
    # to a third party unremarked. Pointing them here instead is not yet
    # justified either: Codex's metric names are not the `claude_code.*` ones the
    # Prometheus queries are written against, and whether the two vocabularies
    # can be compared at all is an open question the parallel window settles.
    # Until then the honest setting is neither.
    -c otel.metrics_exporter=none
  )
}

# Two separate gates, both of which stopped this executor dead before 2026-07-29:
# --permission-mode, because a non-interactive session has nobody to approve a
# prompt and every Bash call was auto-denied; and --add-dir, because the sandbox
# confines tools to project_path while the contract and loopctl live in
# LOOP_HOME -- the executor could not read its own instructions.
run_claude() {
  local slug="$1" project_path="$2" prompt="$3" sid="$4" task_key="$5"
  [ -x "$CLAUDE_BIN" ] || return 127
  # `${opts[@]+...}` because an empty array under `set -u` is an unbound
  # expansion on the bash 3.2 that ships with macOS.
  local opts=()
  [ -n "$PLAN_MODEL" ] && opts+=(--model "$PLAN_MODEL")
  [ -n "$PLAN_EFFORT" ] && opts+=(--effort "$PLAN_EFFORT")
  otel_claude_env claude "$slug" "$task_key"
  (cd "$project_path" && printf '%s' "$prompt" | env ${OTEL_ENV[@]+"${OTEL_ENV[@]}"} \
    LOOP_PROJECT="$slug" LOOP_EXECUTOR=claude \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$CLAUDE_BIN" -p \
    ${opts[@]+"${opts[@]}"} \
    --permission-mode "${LOOP_CLAUDE_PERMISSION_MODE:-auto}" --add-dir "$LOOP_HOME" \
    --session-id "$sid" --output-format json --max-turns "$MAX_TURNS" \
    --max-budget-usd "$BUDGET_USD")
}

run_codex() {
  local slug="$1" project_path="$2" prompt="$3" task_key="$4"
  [ -x "$CODEX_BIN" ] || return 127
  # Codex has no dedicated effort flag; `-c` sets it and the server validates it
  # (a bogus level is a 400, so a typo fails loudly rather than being ignored).
  local opts=()
  [ -n "$PLAN_MODEL" ] && opts+=(-m "$PLAN_MODEL")
  [ -n "$PLAN_EFFORT" ] && opts+=(-c "model_reasoning_effort=$PLAN_EFFORT")
  # No --ephemeral: it kept nothing on disk, which cost a reviewable session for
  # no gain once transcripts were being saved. Dropped 2026-07-30 so a loop run
  # can be reopened with `codex resume` and read in the ChatGPT app, where the
  # reasoning is legible in a way a JSON event stream is not. The cost is one
  # session file per run under ~/.codex/sessions -- unbounded, unlike transcripts,
  # which prune to TRANSCRIPT_KEEP.
  #
  # --add-dir for the same reason claude has had it since 2026-07-29: the sandbox
  # confines writes to project_path, but the contract and loopctl live in
  # LOOP_HOME and `loopctl scan` needs to take a lock there. Without it codex
  # cannot scan its own queue -- measured 2026-07-30, `scan` exited 2 on a lock
  # it could not create, and the executor correctly refused to start work.
  #
  # The network grant, because workspace-write denies the network and every signal
  # the loop turns on crosses it: `loopctl scan` resolves a task's PR with
  # `gh pr list`, which fails inside the sandbox, marking the registry stale -- and
  # a stale registry is a full stop under the contract. Measured 2026-07-30: three
  # AG-132 runs ended exactly there, the executor refusing correctly each time.
  # Pushing a branch and opening the PR need the network too, so without this no
  # codex task could ever finish, while claude -- which runs under no OS sandbox at
  # all -- was unaffected. Scoped to loop runs rather than config.toml, and narrower
  # than danger-full-access: probed with `codex sandbox`, a write outside
  # project_path is still "Operation not permitted" with the grant applied. Inert
  # unless the mode is workspace-write, which --sandbox sets below.
  # The vault usage dir alongside LOOP_HOME, because `loopctl set` mirrors task
  # state to tasks-progress.json there and the sandbox denies it otherwise.
  # Measured 2026-07-30: the executor took AG-132 to pr-ready, the local registry
  # recorded it, and Loop Observatory kept showing "Queued" -- the mirror write
  # had been refused with "Operation not permitted" and nothing surfaced it,
  # because publishing is best-effort by design. claude is unaffected: it runs
  # under no OS sandbox.
  local codex_dirs=(--add-dir "$LOOP_HOME")
  [ -n "$VAULT_USAGE" ] && [ -d "$VAULT_USAGE" ] && codex_dirs+=(--add-dir "$VAULT_USAGE")
  otel_codex_env codex "$slug" "$task_key"
  (cd "$project_path" && printf '%s' "$prompt" | env ${OTEL_ENV[@]+"${OTEL_ENV[@]}"} \
    LOOP_PROJECT="$slug" LOOP_EXECUTOR=codex \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$CODEX_BIN" exec \
    ${opts[@]+"${opts[@]}"} ${OTEL_CODEX_OPTS[@]+"${OTEL_CODEX_OPTS[@]}"} "${codex_dirs[@]}" \
    -c sandbox_workspace_write.network_access=true \
    --json --sandbox workspace-write -C "$project_path" -)
}

# No OTel: agy is a third-party CLI with no OpenTelemetry surface of its own, so
# there is nothing to point at the collector. A run on it is attributable only
# through the ledger row, which is why the row keeps the outcome and the edges.
run_agy() {
  local slug="$1" project_path="$2" prompt="$3"
  [ -x "$AGY_BIN" ] || return 127
  (cd "$project_path" && printf '%s' "$prompt" | LOOP_PROJECT="$slug" LOOP_EXECUTOR=agy \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$AGY_BIN" --print \
    --dangerously-skip-permissions)
}

run_executor() {
  case "$1" in
    claude) run_claude "$2" "$3" "$4" "$5" "$6" ;;
    codex) run_codex "$2" "$3" "$4" "$6" ;;
    agy) run_agy "$2" "$3" "$4" ;;
    *) log "unknown executor '$1'"; return 127 ;;
  esac
}

IFS=',' read -r -a executor_list <<< "$EXECUTORS"
[ "${#executor_list[@]}" -gt 0 ] || { log "no executors configured"; exit 1; }

# Emits "<provider>\t<model>\t<effort>" for a task, or nothing at all.
#
# A task stores only a preset id; the model and effort behind it are resolved
# here, at run time. That is the point of the indirection -- renaming a model in
# the config carries every task forward on its next run, and no task note ever
# pins a model that has since been superseded.
#
# Silence is a valid answer, and the safe one: an unreadable config, an unknown
# preset, or a preset naming an unknown provider all fall through to the
# executor's own defaults, which is exactly how the loop behaved before presets.
preferred_plan() {
  local task_id="$1" item_id="${2:-}"
  [ -n "$AGENT_CONFIG" ] && [ -f "$AGENT_CONFIG" ] || return 0
  "$PYTHON_BIN" - "$AGENT_CONFIG" "$task_id" "$item_id" <<'PY'
import json
import sys
from pathlib import Path

PROVIDERS = {"claude", "codex", "agy"}

try:
    document = json.loads(Path(sys.argv[1]).read_text())
    tasks = document.get("tasks") or {}
    # A Notion-sourced task's `id` is its page URL; the human key the greenlight
    # file and the contract both use is `metadata.item_id` (`AG-132`). Try that
    # first so the config stays keyed by something a person can read, and fall
    # back to the raw id for sources that have no item_id (obsidian-base).
    task = {}
    for key in (str(sys.argv[3]), str(sys.argv[2])):
        if key and key in tasks:
            task = tasks[key] or {}
            break
    presets = document.get("presets") or {}
    name = task.get("preset") or document.get("default_preset")
    preset = presets.get(name) or {} if name else {}
    provider = preset.get("provider") or task.get("agent") or document.get("default_agent") or "claude"
    if provider in PROVIDERS:
        print("{}\t{}\t{}".format(provider, preset.get("model") or "", preset.get("effort") or ""))
except (OSError, ValueError, TypeError, AttributeError):
    pass
PY
}

# "$15 guard" read as a cap and was not one. SPENT accumulates and is compared
# only after an iteration returns, so with max_iter=1 it can never fire at all --
# the AG-383 run was started with a $15 guard, spent $16.34 in its single
# iteration, and the log printed the guard as though it had applied. The only
# bound that operates inside an iteration is RALPH_MAX_TURNS, which counts turns,
# not money. Say which of the two this is, on the line that introduces it.
# Claude enforces the cap inside the run (`--max-budget-usd`, which requires
# --print and so applies to every executor invocation here). The between-iteration
# check remains for the executors that have no equivalent, and for the case the
# cap cannot cover: at MAX_ITER=1 there is no "between iterations" at all, which
# is how a $10 guard sat over a ~$30 run on 2026-08-22 without ever being wrong.
USD_GUARD_NOTE="\$$BUDGET_USD — capped in-run for claude, checked between iterations otherwise"
if [ -n "$BUDGET_WEEKLY_PP" ]; then
  log "start · machine=$MACHINE max_iter=$MAX_ITER · approved ${BUDGET_WEEKLY_PP}pp weekly (stop past ${OVERRUN_RATIO}x) · $USD_GUARD_NOTE"
else
  log "start · machine=$MACHINE max_iter=$MAX_ITER · $USD_GUARD_NOTE"
fi
while [ "$iter" -lt "$MAX_ITER" ]; do
  refresh_quota
  IFS=$'\t' read -r QUOTA_MODE pct5_before pctw_before cx5_before cxw_before <<< "$(quota_state)"
  headroom=$("$PYTHON_BIN" -c \
    'import sys
def room(now, stop):
    try: return "%g" % (float(stop) - float(now))
    except (TypeError, ValueError): return "?"
print("5h {}pp to {}%, weekly {}pp to {}%".format(
    room(sys.argv[1], sys.argv[3]), sys.argv[3],
    room(sys.argv[2], sys.argv[4]), sys.argv[4]))' \
    "${pct5_before:-}" "${pctw_before:-}" "$PCT_5H_STOP" "$PCT_WEEK_STOP" 2>/dev/null || printf '?')
  log "quota · claude 5h=${pct5_before:-?}% weekly=${pctw_before:-?}% · codex weekly=${cxw_before:-?}% · room: $headroom · gate=$QUOTA_MODE"
  case "$QUOTA_MODE" in
    stop)
      log "quota gate: 5h>${PCT_5H_STOP}% or weekly>${PCT_WEEK_STOP}%; checkpointing without starting work"
      break
      ;;
    drain)
      log "quota gate: 5h>${PCT_5H_DRAIN}% or weekly>${PCT_WEEK_DRAIN}%; in-flight work only"
      ;;
    unknown)
      log "quota snapshot unavailable at $QUOTA_FILE; proceeding conservatively"
      ;;
  esac

  sweep=$("$LOOPCTL" sweep --machine "$MACHINE") || {
    log "sweep failed; stopping without changing a project"
    exit 1
  }
  selection=$(printf '%s' "$sweep" | "$PYTHON_BIN" -c \
    'import json, sys; rows=json.load(sys.stdin); row=rows[0] if rows else {}; print("{}\t{}".format(row.get("slug", ""), row.get("path", "")))')
  IFS=$'\t' read -r slug project_path <<< "$selection"
  if [ -z "$slug" ] || [ -z "$project_path" ]; then
    log "queue empty for $MACHINE"
    break
  fi

  # loopctl pins gh per project for its own scans; the executor shells out to gh
  # itself -- to open the PR, most of all -- so it needs the same token. Unset
  # first, or a project with no account inherits the previous project's.
  unset GH_TOKEN
  gh_account=$("$LOOPCTL" show "$slug" 2>/dev/null | "$PYTHON_BIN" -c \
    'import json, sys; print((json.load(sys.stdin) or {}).get("account") or "")' \
    2>/dev/null || printf '')
  if [ -n "$gh_account" ]; then
    if GH_TOKEN=$(gh auth token -u "$gh_account" 2>/dev/null) && [ -n "$GH_TOKEN" ]; then
      export GH_TOKEN
      log "  gh · pinned to $gh_account"
    else
      unset GH_TOKEN
      log "  gh · account '$gh_account' has no token; using the ambient login"
    fi
  fi

  next_json=$("$LOOPCTL" next "$slug" 2>/dev/null || printf '[]')
  # Four fields, because they answer different questions. `id` is the source
  # ref; `item_id` is Notion's human key and also what the PR lookup below
  # matches on; `task_key` is whichever human key this source has, since
  # obsidian-base calls it `task_id` and Notion calls it `item_id` -- reading
  # only the latter is why `--task-id` was empty on every personal run, and it
  # is the attribute the estimate audit joins on. `points` is the estimate.
  #
  # Separated by \x1f, not by tab. Tab is an IFS whitespace character, so `read`
  # collapses a run of them into one delimiter -- an empty middle field shifts
  # every field after it left. A task with no Notion item_id would have been
  # stamped with its story point as its task_id, which is exactly the kind of
  # silently-wrong attribution this change exists to remove.
  task_row=$(printf '%s' "$next_json" | "$PYTHON_BIN" -c \
    'import json, sys
rows = json.load(sys.stdin)
row = rows[0] if rows else {}
meta = row.get("metadata") or {}
item_id = meta.get("item_id") or ""
print("\x1f".join(str(field or "") for field in (
    row.get("id"), item_id, item_id or meta.get("task_id"), meta.get("points"),
)))' \
    2>/dev/null || printf '\x1f\x1f\x1f')
  IFS=$'\x1f' read -r task_id task_item_id task_key TASK_POINTS <<< "$task_row"
  # Reset every iteration: a task with no preset must not inherit the previous
  # task's model.
  preferred=""; PLAN_MODEL=""; PLAN_EFFORT=""
  IFS=$'\t' read -r preferred PLAN_MODEL PLAN_EFFORT <<< "$(preferred_plan "$task_id" "${task_item_id:-}")"
  # Kept aside because the executor loop clears PLAN_* for any non-preferred
  # candidate and needs the originals back if it comes round to the preferred one.
  plan_model_for_preferred="$PLAN_MODEL"
  plan_effort_for_preferred="$PLAN_EFFORT"
  ordered_executors=()
  if [ -n "$preferred" ]; then
    ordered_executors+=("$preferred")
  fi
  for candidate in "${executor_list[@]}"; do
    if [ "$candidate" != "$preferred" ]; then
      ordered_executors+=("$candidate")
    fi
  done
  if [ -n "$preferred" ]; then
    log "task=$task_id executor=$preferred model=${PLAN_MODEL:-default} effort=${PLAN_EFFORT:-default}"
  fi

  prompt=$(printf 'LOOP_PROJECT=%s\n\n' "$slug"; cat "$CONTRACT")
  head_before=$(git -C "$project_path" rev-parse HEAD 2>/dev/null || echo -)
  out=""
  provider=""
  status=1
  provider_rate_limited=0
  for candidate in "${ordered_executors[@]}"; do
    # A model name belongs to one provider. The preset resolved a model for the
    # PREFERRED executor, so a fallback to a different provider must drop it --
    # on 2026-07-30 a codex-routed task fell back to claude still carrying
    # `--model gpt-5.6-terra`, and claude rejected the model instead of running.
    # Fallback is a degraded path by definition; it takes the provider's default.
    if [ "$candidate" = "$preferred" ]; then
      PLAN_MODEL="$plan_model_for_preferred"; PLAN_EFFORT="$plan_effort_for_preferred"
    else
      PLAN_MODEL=""; PLAN_EFFORT=""
    fi
    sid=$(uuidgen)
    # Generated here, before the executor starts, because it is stamped into
    # OTEL_RESOURCE_ATTRIBUTES and that is set once per process -- an id minted
    # when the ledger row is appended, after the executor has exited, could
    # never appear on the telemetry it is meant to join.
    #
    # Opaque and bounded, unlike the id this replaces. That one embedded the
    # task ref, so a Notion-sourced run carried an 80-character URL as its id,
    # in a baggage value where a query string would have broken the encoding --
    # while `task` and `task_id` already say which task it was. The uuid's first
    # group is the suffix, so a run_id and its resumable session id share a
    # visible prefix.
    RUN_ID="$MACHINE-$(date +%s)-${sid%%-*}"
    candidate_out=$(run_executor "$candidate" "$slug" "$project_path" "$prompt" "$sid" "$task_key" 2>&1) || candidate_status=$?
    candidate_status=${candidate_status:-0}
    transcript=$(save_transcript "$candidate" "$candidate_out" "${task_item_id:-$slug}")
    [ -n "$transcript" ] && log "  transcript · $transcript"
    if [ "$candidate_status" -eq 127 ]; then
      log "executor=$candidate unavailable; trying next executor"
      unset candidate_status
      continue
    fi
    if rate_limited "$candidate_out"; then
      log "executor=$candidate rate limited; trying next executor"
      provider_rate_limited=1
      out="$candidate_out"
      unset candidate_status
      continue
    fi
    if [ "$candidate_status" -ne 0 ]; then
      log "executor=$candidate failed (exit=$candidate_status) · $(executor_verdict "$candidate_out")"
      # Exhausting the turn budget means unfinished, not unable, so the fallback
      # chain is the wrong response: the next executor starts the same task from
      # zero with a budget that just proved insufficient, and if the first one had
      # already committed it opens a second PR for the same fix. Checked before
      # the repo-moved guard below, because a run can exhaust its turns without
      # having committed anything yet and still must not be handed on.
      if [ "$(executor_subtype "$candidate_out")" = "error_max_turns" ]; then
        turn_cost=$(printf '%s' "$candidate_out" | "$PYTHON_BIN" -c \
          'import json, sys; data=sys.stdin.read(); print(json.loads(data).get("total_cost_usd", 0) if data.strip() else 0)' \
          2>/dev/null || echo 0)
        SPENT=$("$PYTHON_BIN" -c \
          'from decimal import Decimal; import sys; print(Decimal(sys.argv[1]) + Decimal(sys.argv[2]))' \
          "$SPENT" "$turn_cost")
        log "  turn limit ($MAX_TURNS) reached — not a provider failure, so the task is NOT passed on"
        log "  spent \$$turn_cost this attempt"
        # This is the path AG-383 took: $16.34 against a $15 guard, and the guard
        # was never consulted, because the between-iterations check lives past the
        # `exit` below. It still cannot stop the spend -- it has already happened --
        # but a run that went over must not exit silently as though it had not.
        IFS=$'\t' read -r turn_over turn_over_by <<< "$(usd_over "$turn_cost" "$BUDGET_USD")"
        if [ "$turn_over" -eq 1 ]; then
          log "  over the \$$BUDGET_USD guard by \$$turn_over_by — the guard is checked between iterations, so it could not stop this one"
        fi
        # The session survives with its full context -- what it understood, what it
        # tried, what it had just done. Print the exact command to pick it up:
        # reconstructing it later means knowing transcripts are keyed by cwd and
        # that the session id appears nowhere but this log.
        resume_hint="cd '$project_path' && claude --resume $sid"
        log "  ralph does not resume, but this session can be continued by hand:"
        log "    $resume_hint"
        # Onto the task card too, so the hint is reachable from Observatory and not
        # only by whoever reads this log. task-note rather than set: the run's
        # outcome is unknown, and any state passed would be a guess.
        "$LOOPCTL" task-note "$slug" "$task_id" \
          --note "Turn limit ($MAX_TURNS) reached, unfinished. Continue: $resume_hint" \
          >/dev/null 2>&1 || log "  (task note not written; the hint above is the only copy)"
        # The outcome, and the run_id that joins it to what the telemetry
        # recorded while it was running. The spend itself is no longer copied
        # here: it arrives on the executor's own events under this same id,
        # where it cannot go missing because a caller did not know it.
        turn_fields=()
        [ -n "${task_key:-}" ] && turn_fields+=(--task-id "$task_key")
        "$LOOPCTL" record-run \
          --project "$slug" \
          --task "$task_id" \
          --executor "$candidate" \
          --machine "$MACHINE" \
          --run-id "$RUN_ID" \
          --status turns_exhausted \
          ${turn_fields[@]+"${turn_fields[@]}"} \
          --note "hit the $MAX_TURNS-turn limit; no fallback attempted" >/dev/null 2>&1 || \
          log "  run ledger unavailable; the spend above is only in this log"
        exit "$candidate_status"
      fi
      # A non-zero exit does not mean nothing happened. On 2026-07-29 an executor
      # exited 1 one step after committing and opening a PR. Handing that task on
      # would have it redo committed work and open a second PR for the same fix.
      if [ "$head_before" != "$(git -C "$project_path" rev-parse HEAD 2>/dev/null || echo -)" ]; then
        log "  the repo moved before this failure; not passing the task on -- inspect the branch, then resume"
        exit "$candidate_status"
      fi
      status="$candidate_status"
      unset candidate_status
      continue
    fi
    out="$candidate_out"
    provider="$candidate"
    status="$candidate_status"
    unset candidate_status
    break
  done

  if [ -z "$provider" ] && [ "$provider_rate_limited" -eq 1 ]; then
    waits=$((waits + 1))
    if [ "$waits" -gt "$MAX_WAITS" ]; then
      log "rate-limited $waits times; stopping for a later resume"
      exit 2
    fi
    # Sleep to the reset rather than at it. MAX_WAITS stays the ceiling on total
    # patience, so a reset further out than the interval would ever have reached
    # is not something to sleep through -- that is a later resume, not a longer
    # nap.
    IFS=$'\t' read -r reset_secs reset_window <<< "$(reset_wait)"
    patience=$(( (MAX_WAITS - waits + 1) * BACKOFF ))
    if [ -n "${reset_secs:-}" ] && [ "$reset_secs" -gt "$patience" ]; then
      log "rate limited; $reset_window resets in $((reset_secs / 60))m, past the $((patience / 60))m left in the budget -- stopping for a later resume"
      exit 2
    fi
    if [ -n "${reset_secs:-}" ]; then
      log "rate limited ($waits/$MAX_WAITS); sleeping $((reset_secs / 60))m until $reset_window resets"
      sleep "$((reset_secs + 30))"
    else
      log "rate limited ($waits/$MAX_WAITS); no reset time in the snapshot, sleeping ${BACKOFF}s"
      sleep "$BACKOFF"
    fi
    continue
  fi
  if [ -z "$provider" ]; then
    log "all configured executors failed; stopping without changing the project"
    exit "${status:-1}"
  fi
  waits=0
  iter=$((iter + 1))
  cost=$(printf '%s' "$out" | "$PYTHON_BIN" -c \
    'import json, sys; data=sys.stdin.read(); print(json.loads(data).get("total_cost_usd", 0) if data.strip() else 0)' \
    2>/dev/null || echo 0)
  SPENT=$("$PYTHON_BIN" -c \
    'from decimal import Decimal; import sys; print(Decimal(sys.argv[1]) + Decimal(sys.argv[2]))' \
    "$SPENT" "$cost")
  tokens_out=$(executor_tokens_out "$out")
  refresh_quota
  IFS=$'\t' read -r _ pct5_after pctw_after cx5_after cxw_after <<< "$(quota_state)"
  d5=$(pct_delta "$pct5_before" "$pct5_after")
  dw=$(pct_delta "$pctw_before" "$pctw_after")
  log "iter $iter/$MAX_ITER · project=$slug · executor=$provider · cost=\$$cost · spent=\$$SPENT"
  # The run_id is the join key for everything the executor emitted, and the log
  # is now the only place a human sees it. The locally parsed cost and token
  # count are printed beside it on purpose: they are the second reading against
  # which the telemetry figures get checked, and one community report has OTel
  # overstating output tokens by an order of magnitude. Two readings under one
  # id is what settles that; one reading would only ever agree with itself.
  log "  run · $RUN_ID · ${tokens_out:-?} output tokens (locally parsed)"
  # Report the pool the executor actually spent. Claude keeps both windows;
  # Codex has only a weekly one, so its five-hour slot is left out rather than
  # printed as "?" every time.
  if [ "$provider" = "codex" ]; then
    # The run's own session beats sampling a shared file twice. Fall back to the
    # file only when the session cannot be located -- and when it cannot, the
    # delta is a shared-pool sample like any other, so it loses the exact claim.
    own=$(codex_weekly_pp "${transcript:-}")
    if [ -n "$own" ]; then
      IFS=$'\t' read -r cxw_before cxw_after <<< "$own"
    fi
    attribution=$(quota_attribution codex "$own")
    dw=$(pct_delta "${cxw_before:-}" "${cxw_after:-}")
    d5="n/a"
    log "  quota · codex weekly ${cxw_before:-?}%→${cxw_after:-?}% ($(mark_bound "$dw" "$attribution")) · claude untouched"
  else
    attribution=$(quota_attribution "$provider")
    log "  quota · claude 5h ${pct5_before:-?}%→${pct5_after:-?}% ($(mark_bound "$d5" "$attribution")) · weekly ${pctw_before:-?}%→${pctw_after:-?}% ($(mark_bound "$dw" "$attribution"))"
  fi
  # An executor that stops at step 0 exits 0 and bills normally, so cost alone
  # cannot tell "did the work" from "could not start". Say what it concluded and
  # whether the repo moved -- on 2026-07-29 a run logged `done` having produced
  # nothing, and the only way to find out was reading the session transcript.
  head_after=$(git -C "$project_path" rev-parse HEAD 2>/dev/null || echo -)
  verdict=$(executor_verdict "$out")
  if [ "$head_before" = "$head_after" ]; then
    log "  no commit · $verdict"
  else
    log "  $(git -C "$project_path" rev-list --count "$head_before..$head_after" 2>/dev/null || echo '?') commit(s) · $verdict"
  fi
  # Observatory/retro mirror is append-only and best-effort. The executor's
  # loopctl set remains the authoritative task-state transition.
  run_fields=()
  # Edges, not measurements. `task_id` is the human key every other surface uses
  # -- greenlight, notes, config all speak AG-298, so a row that knows only the
  # source URL cannot be joined against any of them. The branch is read after the
  # executor ran, because the executor is what creates it. The PR comes from the
  # task's own overlay, which the executor set when it reached pr-ready.
  [ -n "${task_key:-}" ] && run_fields+=(--task-id "$task_key")
  run_branch=$(git -C "$project_path" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '')
  [ -n "$run_branch" ] && [ "$run_branch" != "HEAD" ] && run_fields+=(--branch "$run_branch")
  run_pr=$("$LOOPCTL" show "$slug" 2>/dev/null | "$PYTHON_BIN" -c \
    'import json, sys
rows = (json.load(sys.stdin) or {}).get("tasks") or []
want = sys.argv[1]
for row in rows:
    if str((row.get("metadata") or {}).get("item_id") or "") == want:
        print(row.get("pr") or "")
        break' "${task_item_id:-}" 2>/dev/null || printf '')
  [ -n "$run_pr" ] && run_fields+=(--pr "$run_pr")
  # Model, effort, cost and output tokens are deliberately absent. They were
  # optional arguments here, which made them sparse -- cost was 0.00 on 11 of
  # 19 rows -- and they now ride on OTEL_RESOURCE_ATTRIBUTES and the executor's
  # own metrics, stamped at launch under this run_id. What stays is the part
  # telemetry cannot know: how the run ended, and what it was attached to.
  # Whether the numbers below are this run's cost or a ceiling on it. Recorded as
  # a field rather than left to the reader: a shared-pool sample and a
  # session-bracketed one look identical once they are both a number in a row.
  run_fields+=(--quota-attribution "$attribution")
  # Record the allowance the executor actually spent. A Codex run leaves the
  # Claude pool untouched, so filing Claude's numbers against it says the run was
  # free -- which is how AG-297 came to be recorded as 0pp while spending Codex.
  if [ "$provider" = "codex" ]; then
    run_fields+=(--quota-pool codex)
    [ -n "$cxw_before" ] && run_fields+=(--quota-week-before "$cxw_before")
    [ -n "$cxw_after" ] && run_fields+=(--quota-week-after "$cxw_after")
  else
    run_fields+=(--quota-pool claude)
    [ -n "$pct5_before" ] && run_fields+=(--quota-5h-before "$pct5_before")
    [ -n "$pct5_after" ] && run_fields+=(--quota-5h-after "$pct5_after")
    [ -n "$pctw_before" ] && run_fields+=(--quota-week-before "$pctw_before")
    [ -n "$pctw_after" ] && run_fields+=(--quota-week-after "$pctw_after")
  fi
  # `completed` said the executor returned cleanly, which is not the same as the
  # task reaching stop_at -- 14 of the 19 rows in the live ledger say `completed`
  # and only one of them has a PR. Decide it here, where the PR is known, rather
  # than leaving a reader to infer it later from a field that may be absent for
  # either reason.
  if [ -n "${run_pr:-}" ]; then run_outcome=reached_stop_at; else run_outcome=advanced; fi
  [ "$status" -ne 0 ] && run_outcome=executor_failed
  "$LOOPCTL" record-run \
    --project "$slug" \
    --task "$task_id" \
    --executor "$provider" \
    --machine "$MACHINE" \
    --run-id "$RUN_ID" \
    --status "$run_outcome" \
    ${run_fields[@]+"${run_fields[@]}"} \
    --note "iteration $iter/$MAX_ITER; exit=$status" >/dev/null 2>&1 || \
    log "run ledger unavailable; continuing"
  # Points actually consumed this iteration. `pct_delta` says "window reset" when
  # the window rolled over, which is not a measurement -- carry nothing rather
  # than guess, and say so, or the approved figure quietly stops meaning anything.
  #
  # An upper bound is not a verdict. The AG-131 run printed "36.0pp exceeds 10pp
  # by more than 1.5x" and stopped the loop over a figure that was mostly the
  # operating session's spend -- a conclusion the engine had no basis to draw.
  # Only a delta the run can claim advances the approval or ends the run; an
  # unattributable one is reported and left alone. That is not a hole in the
  # brakes: the pre-iteration gate above reads absolute pool levels, which no
  # concurrent process can distort, and still stops the loop past PCT_WEEK_STOP.
  if [ -n "$BUDGET_WEEKLY_PP" ]; then
    if [ "$attribution" != "exact" ]; then
      log "  weekly points · ${dw} observed on a shared pool, an upper bound; the ${BUDGET_WEEKLY_PP}pp approval cannot be checked against it"
    else
      case "$dw" in
        '~'*pp)
          WEEK_PP_SPENT=$("$PYTHON_BIN" -c \
            'from decimal import Decimal; import sys
print(Decimal(sys.argv[1]) + Decimal(sys.argv[2].strip("~pp")))' \
            "$WEEK_PP_SPENT" "$dw")
          ;;
        *)
          log "  weekly points unmeasurable this iteration ($dw); approved budget not advanced"
          ;;
      esac
      ceiling=$("$PYTHON_BIN" -c \
        'from decimal import Decimal; import sys; print(Decimal(sys.argv[1]) * Decimal(sys.argv[2]))' \
        "$BUDGET_WEEKLY_PP" "$OVERRUN_RATIO")
      over_pp=$("$PYTHON_BIN" -c \
        'from decimal import Decimal; import sys; print(int(Decimal(sys.argv[1]) > Decimal(sys.argv[2])))' \
        "$WEEK_PP_SPENT" "$ceiling")
      log "  weekly points · ${WEEK_PP_SPENT}pp of ${BUDGET_WEEKLY_PP}pp approved (stop past ${ceiling}pp)"
      if [ "$over_pp" -eq 1 ]; then
        log "over the approved weekly points: ${WEEK_PP_SPENT}pp exceeds ${BUDGET_WEEKLY_PP}pp by more than ${OVERRUN_RATIO}x"
        break
      fi
    fi
  fi
  # What this one iteration cost, against the guard that could not have stopped
  # it. Reported whether or not the cumulative check below fires: on the last
  # iteration -- and on every iteration when max_iter=1 -- that check is the only
  # one there is, and it runs too late to matter.
  IFS=$'\t' read -r iter_over iter_over_by <<< "$(usd_over "$cost" "$BUDGET_USD")"
  if [ "$iter_over" -eq 1 ]; then
    log "  this iteration alone spent \$$cost, over the \$$BUDGET_USD guard by \$$iter_over_by — the guard is checked between iterations, so it could not stop it"
  fi
  over_budget=$("$PYTHON_BIN" -c "from decimal import Decimal; import sys; print(int(Decimal(sys.argv[1]) > Decimal(sys.argv[2])))" \
    "${SPENT:-0}" "$BUDGET_USD")
  if [ "$over_budget" -eq 1 ]; then
    log "no further iterations (\$$SPENT over the \$$BUDGET_USD guard)"
    break
  fi
done
log "done · $iter iteration(s), spent \$$SPENT"
