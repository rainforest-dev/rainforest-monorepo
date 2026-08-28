#!/usr/bin/env bash
# Report this machine's facts to the Observatory.
#
# The app has had a probe list and a facts endpoint since the enrollment work
# landed, and until 2026-08-28 nothing ever called either: the setup page
# described the older flow (download the bundle, edit hosts.yaml, run
# install.sh) and never mentioned them. `/api/enroll/hosts` answered
# `recorded devices: (none)` and every host read `stale`, forever. This is the
# caller that was missing.
#
# What it does NOT do: it reports, it does not decide. Derivation is pure and
# happens in the app; applying the derived files happens through install.sh.
# A machine cannot declare what it should be by talking to this endpoint --
# that lives in hosts.yaml, which is version-controlled precisely so a host
# cannot promote itself.
set -uo pipefail

APP="${LOOP_APP_URL:-http://100.86.67.66:3099}"
# LocalHostName, not ComputerName. ComputerName is the display name -- on the
# mini it is "Rainforest's Mac mini", complete with a curly apostrophe and
# spaces, which the endpoint rejects and which matches no declaration key.
# LocalHostName is `rainforest-mini`, which is what hosts.yaml calls it.
HOST="${1:-$(scutil --get LocalHostName 2>/dev/null || hostname -s)}"

# The shape of `facts` is not generic: `executors` is an array, `otlpListening`
# a boolean, `vaultPath` nullable, and `accounts` splits one probe's output into
# two fields. A runner therefore has to KNOW the contract, which is exactly why
# the endpoint carries a version. If the server has moved past what this script
# understands, stop -- a wrong shape is rejected by the endpoint anyway, and a
# silently half-right one would be worse.
KNOWN_PROBE_VERSION=2

die() {
  printf 'enroll: %s\n' "$1" >&2
  exit 1
}

command -v python3 >/dev/null 2>&1 || die "python3 is required (the engine already depends on it)"

printf 'enroll: reporting %s to %s\n' "$HOST" "$APP"

PROBES=$(curl -fsS --max-time 20 "$APP/api/enroll/probes") ||
  die "cannot reach $APP/api/enroll/probes — is this machine on the tailnet?"

SERVER_VERSION=$(printf '%s' "$PROBES" | python3 -c 'import sys,json; print(json.load(sys.stdin)["version"])') ||
  die "probe list is not readable JSON"

if [ "$SERVER_VERSION" != "$KNOWN_PROBE_VERSION" ]; then
  die "probe version mismatch: this bundle understands $KNOWN_PROBE_VERSION, the app serves $SERVER_VERSION.
       Fetch a newer engine bundle rather than reporting a shape neither side agrees on."
fi

# Run each probe by id, in the app's own words. The shells come from the server
# so the questions cannot drift from the ones it asks; only the assembly below
# is local, and the version check above is what guards it.
probe() { # id -> stdout of that probe's shell
  local id="$1" src
  src=$(printf '%s' "$PROBES" | python3 -c '
import sys, json
want = sys.argv[1]
for p in json.load(sys.stdin)["probes"]:
    if p["id"] == want:
        sys.stdout.write(p["shell"])
        break
' "$id")
  [ -n "$src" ] || die "the app served no probe called $id"
  sh -c "$src" 2>/dev/null || true
}

TCC=$(probe tccICloud)
EXECUTORS=$(probe executors)
BREW=$(probe brewPrefix)
OTLP=$(probe otlpListening)
VAULT=$(probe vaultPath)
ACCOUNTS=$(probe accounts)

printf '  tccICloud=%s otlpListening=%s executors=[%s]\n' \
  "${TCC:-<empty>}" "${OTLP:-<empty>}" "$(printf '%s' "$EXECUTORS" | tr '\n' ' ')"

BODY=$(
  python3 - "$HOST" "$TCC" "$EXECUTORS" "$BREW" "$OTLP" "$VAULT" "$ACCOUNTS" <<'PY'
import json, sys, datetime
host, tcc, executors, brew, otlp, vault, accounts = sys.argv[1:8]
# "ok|login" -- the login half is empty when gh reports no account, which the
# app reads as account-unverified rather than as a login named "".
claude_available, _, gh_login = accounts.partition("|")
print(json.dumps({
    "host": host,
    "facts": {
        "tccICloud": tcc.strip(),
        "executors": [l for l in executors.splitlines() if l.strip()],
        "brewPrefix": brew.strip(),
        "otlpListening": otlp.strip() == "true",
        "vaultPath": vault.strip() or None,
        "accounts": {
            "claudeAvailable": claude_available.strip() or None,
            "ghLogin": gh_login.strip() or None,
        },
        "probedAt": datetime.datetime.now(datetime.timezone.utc)
                    .replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    },
}))
PY
) || die "could not assemble the report"

# No -f here. `curl -f` fails the whole command on an HTTP error, so the status
# code never reaches -w and a 400 arrives looking like a connection failure --
# the endpoint's own explanation of what was wrong with the report gets thrown
# away at the moment it is most needed.
CODE=$(curl -sS -o "/tmp/enroll-response.$$" -w '%{http_code}' --max-time 30 \
  -X POST "$APP/api/enroll/facts" \
  -H 'content-type: application/json' \
  -d "$BODY" 2>/dev/null) || CODE="000"
RESPONSE=$(cat "/tmp/enroll-response.$$" 2>/dev/null)
rm -f "/tmp/enroll-response.$$"

case "$CODE" in
200)
  printf 'enroll: recorded. %s\n' "$RESPONSE"
  printf 'enroll: see %s/setup for what this host now derives, and any drift.\n' "$APP"
  ;;
400)
  die "the app rejected the report: $RESPONSE
       This is a bug in this script or a probe that answered something unexpected,
       not something to work around by editing the payload."
  ;;
000) die "no response from $APP/api/enroll/facts" ;;
*) die "unexpected $CODE from the app: $RESPONSE" ;;
esac
