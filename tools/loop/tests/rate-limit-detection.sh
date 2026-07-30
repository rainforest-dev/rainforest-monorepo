#!/usr/bin/env bash
# Does ralph tell a provider rate-limiting us apart from an executor merely
# talking about rate limits?
#
# It did not, and it cost the first preset run. `rate_limited()` grepped the whole
# executor output, and this contract instructs the executor to "rely on the outer
# runner's rate-limit handling" -- so an executor reporting that it followed its
# instructions was read as a provider rate limit. ralph then fell back to another
# provider and the run died on a model-name error.
#
# A pure unit test: the two functions are extracted from the engine under review
# and driven directly, so it needs no sandbox, no executors and no network.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE=${LOOP_TEST_ENGINE:-"$HERE/../engine"}
VENV=${LOOP_TEST_VENV:-"$HOME/.claude/loop/.venv"}

[ -f "$ENGINE/ralph.sh" ] || { echo "engine not found at $ENGINE"; exit 2; }
[ -x "$VENV/bin/python" ] || { echo "no venv at $VENV — set LOOP_TEST_VENV"; exit 2; }

export PYTHON_BIN="$VENV/bin/python"
LIB=$(mktemp /tmp/ralph-ratelimit-lib-XXXXXX.sh)
trap 'rm -f "$LIB"' EXIT
awk '/^executor_error_text\(\) \{/,/^}/' "$ENGINE/ralph.sh" >  "$LIB"
awk '/^rate_limited\(\) \{/,/^}/'        "$ENGINE/ralph.sh" >> "$LIB"
# shellcheck disable=SC1090
. "$LIB"

# Assert the harness itself loaded. Without this the suite reports a cheerful row
# of passes when the functions are missing: every call fails, every result reads
# as "not limited", and every open-expecting case passes for the wrong reason.
for fn in executor_error_text rate_limited; do
  type "$fn" >/dev/null 2>&1 || {
    echo "FATAL: $fn did not load from $ENGINE/ralph.sh — the suite would pass vacuously"
    exit 2
  }
done

pass=0; fail=0
expect() { # expect <name> <limited|open> <payload>
  local want="$2" got
  if rate_limited "$3"; then got=limited; else got=open; fi
  if [ "$got" = "$want" ]; then pass=$((pass+1)); printf '  PASS  %s\n' "$1"
  else fail=$((fail+1)); printf '  FAIL  %s\n        got=%s want=%s\n' "$1" "$got" "$want"; fi
}

echo "  the model talking is never provider state:"
# The exact shape that killed the run on 2026-07-30.
expect "codex agent prose quoting the contract" open '{"type":"thread.started","thread_id":"x"}
{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"Done. I relied on the outer runner rate-limit handling as the contract asks."}}
{"type":"turn.completed","usage":{"output_tokens":9}}'
expect "claude result mentioning rate limits" open \
  '{"type":"result","subtype":"success","is_error":false,"result":"I noted the rate-limit handling in the contract."}'
# A real warning observed from codex, 2026-07-30. Contains "budget"; not a limit.
expect "codex skills-budget warning" open \
  '{"type":"item.completed","item":{"id":"i0","type":"error","message":"Skill descriptions were shortened to fit the 2% skills context budget."}}'
expect "turn limit is not a rate limit" open \
  '{"type":"result","subtype":"error_max_turns","is_error":true,"result":null}'

echo "  a real limit is still caught:"
# Single-line codex output parses as one JSON object. Routing by "parses as a
# dict" therefore read it as claude, found no is_error, and missed the limit --
# a false negative, which is worse: the loop would treat it as a hard failure.
expect "codex error item, single line" limited \
  '{"type":"item.completed","item":{"id":"i0","type":"error","message":"You have hit your rate limit. Try again later."}}'
expect "codex failed turn among agent output" limited '{"type":"turn.started"}
{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"working"}}
{"type":"turn.failed","message":"usage limit reached for this week"}'
expect "claude error result" limited \
  '{"type":"result","subtype":"error_rate_limit","is_error":true,"result":"5-hour limit reached"}'
expect "quota wording" limited \
  '{"type":"item.completed","item":{"id":"i0","type":"error","message":"quota exceeded"}}'

echo "  non-JSON executors keep the old behaviour:"
# agy prints plain text, so there is no envelope to read and the whole output is
# all there is. Narrowing must not make these blind.
expect "agy plain-text limit" limited 'error: too many requests, back off'
expect "agy plain-text success" open 'wrote three files and committed'
expect "empty output" open ''

printf '\n  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
