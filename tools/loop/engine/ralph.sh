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
MACHINE=${LOOP_MACHINE:-${USAGE_MACHINE:-$(hostname -s)}}
EXECUTORS=${LOOP_EXECUTORS:-claude,codex,agy}
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
SPENT=0
waits=0
iter=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ralph: $*"; }

# Executor output was read for a cost figure and a verdict line, then dropped. So
# when the first preset run died on 2026-07-30 there was no way to see what the
# executor had actually said -- and for codex there is no session either, since
# `--ephemeral` persists nothing. The log said "rate limited" and that was the
# entire evidence trail. Keep the output.
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

rate_limited() {
  executor_error_text "$1" |
    grep -qiE 'rate.?limit|too many requests|(usage|weekly|5-?hour|daily)[ -]?limit|quota (exceeded|reached|limit)'
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

# Emits "<verdict>\t<five_hour_pct>\t<weekly_pct>". Verdict is one of
# stop / drain / ok / unknown; unknown keeps the contract's conservative path.
quota_state() {
  "$PYTHON_BIN" - "$QUOTA_FILE" "$PCT_5H_STOP" "$PCT_WEEK_STOP" "$PCT_5H_DRAIN" "$PCT_WEEK_DRAIN" <<'PY'
import json
import sys

try:
    claude = json.load(open(sys.argv[1])).get("claude") or {}
except (OSError, ValueError, AttributeError):
    print("unknown\t\t")
    raise SystemExit
five = (claude.get("five_hour") or {}).get("used_pct")
week = (claude.get("weekly_all") or {}).get("used_pct")
stop5, stopw, drain5, drainw = (float(value) for value in sys.argv[2:6])
if five is None and week is None:
    verdict = "unknown"
elif (five is not None and five > stop5) or (week is not None and week > stopw):
    verdict = "stop"
elif (five is not None and five > drain5) or (week is not None and week > drainw):
    verdict = "drain"
else:
    verdict = "ok"
print("{}\t{}\t{}".format(verdict, "" if five is None else five, "" if week is None else week))
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
pct_delta() {
  [ -n "$1" ] && [ -n "$2" ] || { printf '?'; return; }
  "$PYTHON_BIN" -c \
    'from decimal import Decimal; import sys; print(Decimal(sys.argv[2]) - Decimal(sys.argv[1]))' \
    "$1" "$2"
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

# Two separate gates, both of which stopped this executor dead before 2026-07-29:
# --permission-mode, because a non-interactive session has nobody to approve a
# prompt and every Bash call was auto-denied; and --add-dir, because the sandbox
# confines tools to project_path while the contract and loopctl live in
# LOOP_HOME -- the executor could not read its own instructions.
run_claude() {
  local slug="$1" project_path="$2" prompt="$3" sid="$4"
  [ -x "$CLAUDE_BIN" ] || return 127
  # `${opts[@]+...}` because an empty array under `set -u` is an unbound
  # expansion on the bash 3.2 that ships with macOS.
  local opts=()
  [ -n "$PLAN_MODEL" ] && opts+=(--model "$PLAN_MODEL")
  [ -n "$PLAN_EFFORT" ] && opts+=(--effort "$PLAN_EFFORT")
  (cd "$project_path" && printf '%s' "$prompt" | LOOP_PROJECT="$slug" LOOP_EXECUTOR=claude \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$CLAUDE_BIN" -p \
    ${opts[@]+"${opts[@]}"} \
    --permission-mode "${LOOP_CLAUDE_PERMISSION_MODE:-auto}" --add-dir "$LOOP_HOME" \
    --session-id "$sid" --output-format json --max-turns "$MAX_TURNS")
}

run_codex() {
  local slug="$1" project_path="$2" prompt="$3"
  [ -x "$CODEX_BIN" ] || return 127
  # Codex has no dedicated effort flag; `-c` sets it and the server validates it
  # (a bogus level is a 400, so a typo fails loudly rather than being ignored).
  local opts=()
  [ -n "$PLAN_MODEL" ] && opts+=(-m "$PLAN_MODEL")
  [ -n "$PLAN_EFFORT" ] && opts+=(-c "model_reasoning_effort=$PLAN_EFFORT")
  # --add-dir for the same reason claude has had it since 2026-07-29: the sandbox
  # confines writes to project_path, but the contract and loopctl live in
  # LOOP_HOME and `loopctl scan` needs to take a lock there. Without it codex
  # cannot scan its own queue -- measured 2026-07-30, `scan` exited 2 on a lock
  # it could not create, and the executor correctly refused to start work.
  (cd "$project_path" && printf '%s' "$prompt" | LOOP_PROJECT="$slug" LOOP_EXECUTOR=codex \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$CODEX_BIN" exec \
    ${opts[@]+"${opts[@]}"} --add-dir "$LOOP_HOME" \
    --json --ephemeral --sandbox workspace-write -C "$project_path" -)
}

run_agy() {
  local slug="$1" project_path="$2" prompt="$3"
  [ -x "$AGY_BIN" ] || return 127
  (cd "$project_path" && printf '%s' "$prompt" | LOOP_PROJECT="$slug" LOOP_EXECUTOR=agy \
    LOOP_QUOTA_MODE="${QUOTA_MODE:-ok}" "$AGY_BIN" --print \
    --dangerously-skip-permissions)
}

run_executor() {
  case "$1" in
    claude) run_claude "$2" "$3" "$4" "$5" ;;
    codex) run_codex "$2" "$3" "$4" ;;
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

log "start · machine=$MACHINE max_iter=$MAX_ITER budget=\$$BUDGET_USD"
while [ "$iter" -lt "$MAX_ITER" ]; do
  refresh_quota
  IFS=$'\t' read -r QUOTA_MODE pct5_before pctw_before <<< "$(quota_state)"
  log "quota · 5h=${pct5_before:-?}% weekly=${pctw_before:-?}% · gate=$QUOTA_MODE"
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

  next_json=$("$LOOPCTL" next "$slug" 2>/dev/null || printf '[]')
  task_pair=$(printf '%s' "$next_json" | "$PYTHON_BIN" -c \
    'import json, sys; rows=json.load(sys.stdin); row=rows[0] if rows else {}; print("{}\t{}".format(row.get("id") or "", (row.get("metadata") or {}).get("item_id") or ""))' \
    2>/dev/null || printf '\t')
  IFS=$'\t' read -r task_id task_item_id <<< "$task_pair"
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
    candidate_out=$(run_executor "$candidate" "$slug" "$project_path" "$prompt" "$sid" 2>&1) || candidate_status=$?
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
        # The spend happened whether or not the task finished; a ledger that omits
        # it understates what the task has cost so far.
        turn_fields=()
        [ -n "$PLAN_MODEL" ] && turn_fields+=(--model "$PLAN_MODEL")
        [ -n "$PLAN_EFFORT" ] && turn_fields+=(--effort "$PLAN_EFFORT")
        "$LOOPCTL" record-run \
          --project "$slug" \
          --task "$task_id" \
          --executor "$candidate" \
          --machine "$MACHINE" \
          --cost "$turn_cost" \
          --status incomplete \
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
    log "rate limited ($waits/$MAX_WAITS); sleeping ${BACKOFF}s"
    sleep "$BACKOFF"
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
  tokens_out=$(printf '%s' "$out" | "$PYTHON_BIN" -c \
    'import json, sys; data=sys.stdin.read(); print((json.loads(data).get("usage") or {}).get("output_tokens", "") if data.strip() else "")' \
    2>/dev/null || printf '')
  refresh_quota
  IFS=$'\t' read -r _ pct5_after pctw_after <<< "$(quota_state)"
  d5=$(pct_delta "$pct5_before" "$pct5_after")
  dw=$(pct_delta "$pctw_before" "$pctw_after")
  log "iter $iter/$MAX_ITER · project=$slug · executor=$provider · cost=\$$cost · spent=\$$SPENT"
  log "  quota · 5h ${pct5_before:-?}%→${pct5_after:-?}% (~${d5}pp) · weekly ${pctw_before:-?}%→${pctw_after:-?}% (~${dw}pp)"
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
  [ -n "$PLAN_MODEL" ] && run_fields+=(--model "$PLAN_MODEL")
  [ -n "$PLAN_EFFORT" ] && run_fields+=(--effort "$PLAN_EFFORT")
  [ -n "$tokens_out" ] && run_fields+=(--tokens-out "$tokens_out")
  [ -n "$pct5_before" ] && run_fields+=(--quota-5h-before "$pct5_before")
  [ -n "$pct5_after" ] && run_fields+=(--quota-5h-after "$pct5_after")
  [ -n "$pctw_before" ] && run_fields+=(--quota-week-before "$pctw_before")
  [ -n "$pctw_after" ] && run_fields+=(--quota-week-after "$pctw_after")
  "$LOOPCTL" record-run \
    --project "$slug" \
    --task "$task_id" \
    --executor "$provider" \
    --machine "$MACHINE" \
    --cost "$cost" \
    ${run_fields[@]+"${run_fields[@]}"} \
    --note "iteration $iter/$MAX_ITER; exit=$status" >/dev/null 2>&1 || \
    log "run ledger unavailable; continuing"
  over_budget=$("$PYTHON_BIN" -c "from decimal import Decimal; import sys; print(int(Decimal(sys.argv[1]) > Decimal(sys.argv[2])))" \
    "${SPENT:-0}" "$BUDGET_USD")
  if [ "$over_budget" -eq 1 ]; then
    log "budget exhausted"
    break
  fi
done
log "done · $iter iteration(s), spent \$$SPENT"
