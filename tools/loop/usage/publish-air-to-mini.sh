#!/usr/bin/env bash
# Air-only bridge: launchd cannot read the iCloud vault under TCC, so run the
# usage producers from a local runtime copy and publish only this machine's two
# dashboard partitions to the mini. No session logs or vault content leave Air.
set -u

RUNTIME=${LOOP_USAGE_RUNTIME:-"$HOME/.local/share/loop-usage-runtime"}
REMOTE=${LOOP_USAGE_REMOTE:-"rainforest-mini:/Users/rainforest/Repositories/rainforest-obsidian/_system/usage"}
ROOT="$RUNTIME"

cd "$ROOT" || exit 1
PYTHONPATH="$ROOT" USAGE_MACHINE="${USAGE_MACHINE:-Angibles-MacBook-Air}" \
  /opt/homebrew/bin/python3 -m scripts.usage.export_quota || true

scp -q \
  -o BatchMode=yes \
  -o ConnectTimeout=10 \
  -o ConnectionAttempts=1 \
  "$ROOT/_system/usage/quota.${USAGE_MACHINE:-Angibles-MacBook-Air}.json" \
  "$REMOTE/" || true

# Ledger enrichment is substantially heavier than the quota heartbeat. Keep the
# machine card fresh every five minutes, but rebuild/copy the ledger at most
# hourly. Quota is published first, so a slow ledger pass cannot make the Air
# appear offline.
LEDGER="$ROOT/_system/usage/ledger.${USAGE_MACHINE:-Angibles-MacBook-Air}.jsonl"
LEDGER_MTIME=$(stat -f %m "$LEDGER" 2>/dev/null || echo 0)
if (( $(date +%s) - LEDGER_MTIME >= 3600 )); then
  PYTHONPATH="$ROOT" USAGE_MACHINE="${USAGE_MACHINE:-Angibles-MacBook-Air}" \
    /opt/homebrew/bin/python3 -m scripts.usage.enrich || true
  scp -q \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    -o ConnectionAttempts=1 \
    "$LEDGER" \
    "$REMOTE/" || true
fi
