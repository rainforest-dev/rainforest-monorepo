#!/usr/bin/env bash
# install.sh must DISABLE the executor, not merely say that it did.
#
# Until 2026-08-28 it printed "left DISABLED — see README 'Enabling'" and called
# no launchctl at all. No plist in launchd/ carries a Disabled key, and
# tools.rainforest.loop-ralph has RunAtLoad with StartInterval 1800, so a plist
# copied into ~/Library/LaunchAgents loads at the next login and runs. On a
# machine with no pre-existing `launchctl disable` override, `./install.sh` plus
# a logout started an unsupervised executor while reporting that nothing had
# been enabled.
#
# Everything here runs through --dry-run, so no launchctl state is touched.
set -uo pipefail
cd "$(dirname "$0")/.."

pass=0
fail=0
check() { # name, actual, expected
  if [ "$2" = "$3" ]; then
    printf '  PASS  %s\n' "$1"
    pass=$((pass + 1))
  else
    printf '  FAIL  %s\n        got:  %s\n        want: %s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

UID_NOW=$(id -u)
OUT=$(./install.sh --host=rainforest-angible --dry-run 2>&1)

echo "== the executor is disabled, by an actual call =="
check "install.sh disables loop-ralph" \
  "$(printf '%s' "$OUT" | grep -c "would: launchctl disable gui/$UID_NOW/tools.rainforest.loop-ralph")" \
  "1"

echo "== and it is disabled where an override can win =="
# A Disabled key inside the plist is not enough: `launchctl disable`/`enable`
# writes a per-user override that outranks it, and the Air already carries an
# `enabled` override for another label. Assert the launchctl form specifically.
check "uses the gui/<uid>/<label> domain form" \
  "$(printf '%s' "$OUT" | grep -c "launchctl disable gui/$UID_NOW/")" \
  "1"

echo "== supporting services are NOT disabled =="
# Only the executor is dangerous. usage-hourly, the telemetry sink, relay-pull
# and usage-publish are meant to run; disabling them would quietly stop quota
# refresh and throw away this machine's telemetry, which is the failure the
# telemetry-sink role exists to prevent.
for label in com.rainforest.usage-hourly com.homelab.dev-alloy \
  com.rainforest.greenlight-pull com.rainforest.usage-air-publish; do
  check "does not disable $label" \
    "$(printf '%s' "$OUT" | grep -c "launchctl disable gui/$UID_NOW/$label")" \
    "0"
done

echo "== the message no longer claims more than it does =="
check "ralph reports it was disabled via launchctl" \
  "$(printf '%s' "$OUT" | grep -c 'DISABLED via launchctl')" \
  "1"
# "(not loaded)" read as a permanent state. It described one instant.
check "plists are described as loading at next login" \
  "$(printf '%s' "$OUT" | grep -c '(not loaded)')" \
  "0"

echo "== a dry run touches nothing =="
check "no bare launchctl call escapes --dry-run" \
  "$(printf '%s' "$OUT" | grep -c '^\s*launchctl')" \
  "0"

echo
if [ "$fail" -eq 0 ]; then
  echo "  $pass passed, 0 failed"
else
  echo "  $pass passed, $fail failed"
  exit 1
fi
