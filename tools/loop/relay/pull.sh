#!/usr/bin/env bash
# Pull owner greenlight requests from the Observatory host and apply them here.
#
# Air stays the initiator: no inbound port and no key from mini to Air. The
# allowlist is written only by loopctl on this machine; mini merely asks.
set -uo pipefail

REMOTE=${GREENLIGHT_REMOTE:-rainforest-mini}
REMOTE_DIR=${GREENLIGHT_REMOTE_DIR:-/Users/rainforest/.claude/loop/greenlight-outbox}
LOOPCTL=${LOOPCTL:-$HOME/.claude/loop/loopctl}
# LocalHostName, not `hostname -s`: the latter follows DHCP and moved
# mid-session on 2026-07-30. Kept identical to ralph.sh and
# loopctl.host_machine -- these must all agree or per-machine files split.
MACHINE=${LOOP_MACHINE:-$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null)}
MACHINE=${MACHINE%%.*}
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] greenlight-pull: $*"; }

WORK=$(mktemp -d) || exit 1
trap 'rm -rf "$WORK"' EXIT

# Outstanding == a request with no ack beside it. That pair is the whole state,
# so there is no index to fall out of sync.
outstanding=$(ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "cd '$REMOTE_DIR' 2>/dev/null || exit 0
   find . -mindepth 2 -maxdepth 2 -type f -name '*.json' ! -name '*.ack.json' 2>/dev/null |
     while IFS= read -r f; do
       rel=\${f#./}
       [ -e \"\${rel%.json}.ack.json\" ] || printf '%s\n' \"\$rel\"
     done") || { log "mini unreachable; leaving requests queued"; exit 0; }

[ -n "$outstanding" ] || exit 0

while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  slug=${rel%%/*}
  case "$slug" in
    ''|*[!A-Za-z0-9-]*) log "skipping entry with unsafe slug '$slug'"; continue ;;
  esac
  base=${rel##*/}
  id=${base%.json}
  case "$id" in
    ''|*[!A-Za-z0-9-]*) log "skipping unsafe id '$id'"; continue ;;
  esac

  if ! scp -q "${SSH_OPTS[@]}" "$REMOTE:$REMOTE_DIR/$rel" "$WORK/$base"; then
    log "could not fetch $rel; will retry next tick"
    continue
  fi

  err="$WORK/$base.err"
  if ! result=$("$LOOPCTL" greenlight-apply --project "$slug" --request "$WORK/$base" 2>"$err"); then
    log "loopctl exited non-zero for $slug/$id, which its contract forbids; leaving request outstanding"
    [ -s "$err" ] && log "  loopctl stderr: $(tr '\n' ' ' < "$err")"
    continue
  fi
  [ -s "$err" ] && log "loopctl stderr for $slug/$id: $(tr '\n' ' ' < "$err")"

  if ! parsed=$(printf '%s' "$result" | python3 -c '
import json, sys
raw = sys.stdin.read().strip()
try:
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("not a JSON object")
    # Must match the verdicts loopctl greenlight-apply emits (scan.py) and,
    # for the three that get acked, OutboxResult in greenlightOutbox.ts on
    # mini. busy is deliberately absent from that last one: it is retryable
    # and never reaches an ack file.
    # NB this whole program is a single-quoted shell string -- no apostrophes.
    verdict = payload.get("result")
    if verdict not in ("applied", "duplicate", "failed", "busy"):
        raise ValueError("unrecognised result %r" % (verdict,))
except Exception as exc:
    print("cannot read verdict: %s" % exc, file=sys.stderr)
    sys.exit(1)
print(verdict)
print(json.dumps(payload.get("reason")))
' 2>>"$err"); then
    log "could not read loopctl's verdict for $slug/$id; leaving request outstanding for retry"
    [ -s "$err" ] && log "  detail: $(tr '\n' ' ' < "$err")"
    continue
  fi
  # verdict is restricted to the enum values checked above, so it can never
  # contain a newline — the sed -n 1p/2p line split is safe by construction, no
  # matter what reason (which does go through json.dumps) might contain.
  verdict=$(printf '%s' "$parsed" | sed -n 1p)
  reason=$(printf '%s' "$parsed" | sed -n 2p)

  log "$slug/$id -> $verdict"

  # Retryable, so it must not be acked. An ack — of any verdict — is the only
  # thing that marks a request answered, and a `failed` ack is never pruned, so
  # acking a transient lock collision would kill the authorisation permanently:
  # re-pressing Greenlight would rewrite the request, find the stale terminal
  # ack still beside it, and be skipped forever. Leave it outstanding instead.
  if [ "$verdict" = "busy" ]; then
    log "  $slug/$id is retryable (${reason:-lock busy}); leaving request outstanding for the next tick"
    continue
  fi

  python3 - "$WORK/$base.ack" "$id" "$verdict" "$reason" "$MACHINE" <<'PY'
import json, sys, datetime
out, task_id, verdict, reason_json, machine = sys.argv[1:6]
try:
    reason = json.loads(reason_json)
except ValueError:
    reason = None
json.dump({
    "version": 1,
    "id": task_id,
    "result": verdict,
    "reason": reason,
    "appliedAt": datetime.datetime.now(datetime.timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%SZ"),
    "machine": machine,
}, open(out, "w"), indent=2)
open(out, "a").write("\n")
PY

  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$WORK/$base.ack" 2>/dev/null; then
    log "ack for $slug/$id was not written cleanly; leaving request outstanding for retry"
    continue
  fi

  # If the upload fails to land, the next tick re-applies and gets `duplicate`,
  # then re-sends the ack. Safe because apply is idempotent.
  scp -q "${SSH_OPTS[@]}" "$WORK/$base.ack" \
    "$REMOTE:$REMOTE_DIR/$slug/$id.ack.json" \
    || log "ack for $slug/$id failed to upload; will resend next tick"
done <<< "$outstanding"
