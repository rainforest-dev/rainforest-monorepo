#!/usr/bin/env bash
# Air-only bridge: launchd cannot read the iCloud vault under TCC, so run the
# usage producers from a local runtime copy and publish only this machine's two
# dashboard partitions to the mini. No session logs or vault content leave Air.
set -u

RUNTIME=${LOOP_USAGE_RUNTIME:-"$HOME/.local/share/loop-usage-runtime"}
# The iCloud vault, which is now the only copy. This pointed at
# ~/Repositories/rainforest-obsidian -- a clone that was retired on
# 2026-08-24 when the vault was consolidated onto iCloud. The bridge kept
# running and kept succeeding, so nothing looked broken; it was just
# delivering to a directory nobody reads any more. Air's quota on the
# dashboard was 30 days old and no error had ever been raised.
# A symlink on the mini to the vault's usage dir, not the path itself. Two
# reasons. It pointed at ~/Repositories/rainforest-obsidian -- a clone
# retired on 2026-08-24 when the vault was consolidated onto iCloud -- and
# the bridge kept running and kept succeeding, delivering to a directory
# nobody reads any more; Air's quota sat 30 days stale on the dashboard
# with no error ever raised. The indirection means the next such move is a
# one-line change on the mini rather than a silent nothing here. And the
# real path contains a space ("Mobile Documents"), which scp hands to a
# remote shell that would split it -- correct only with backslashes that
# survive two levels of quoting, which is its own way to fail quietly.
REMOTE=${LOOP_USAGE_REMOTE:-"rainforest-mini:.local/share/loop-usage-inbox"}
ROOT="$RUNTIME"

# Deliver a file. The rename onto its final name happens on the OTHER side.
#
# An ssh session on macOS is outside the GUI security session, which for a
# CloudDocs directory means it may only modify files it created itself.
# Renaming onto -- or even unlinking -- a file a GUI-session process wrote
# returns `Operation not permitted`, from a session that owns the directory and
# the file by every POSIX measure. Measured 2026-08-26: the 61 MB ledger was
# copied in full every hour, landed as `.<name>.incoming`, and was dropped at
# the final rename, leaving a 27,205-line file from 27 July in place while a
# complete 167,408-line one sat beside it for a month. `|| true` swallowed it,
# and the destination mtime never moved because deliveries land on another name.
#
# So this side stops at the bytes. Two names, both ours, so both permitted:
# `.<name>.partial` while transferring, renamed to `.<name>.incoming` once
# complete. Only a fully-transferred file ever carries `.incoming`, so the
# receiver never promotes a partial write. scripts/usage/inbox does the rest.
publish() { # local_file
  local src="$1" name host dir
  name=$(basename "$src")
  host="${REMOTE%%:*}"
  dir="${REMOTE#*:}"
  scp -q -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 \
    "$src" "$host:$dir/.$name.partial" || return 1
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$host" \
    "mv -f '$dir/.$name.partial' '$dir/.$name.incoming'" || return 1
}

cd "$ROOT" || exit 1
PYTHONPATH="$ROOT" USAGE_MACHINE="${USAGE_MACHINE:-rainforest-air}" \
  /opt/homebrew/bin/python3 -m scripts.usage.export_quota || true

publish "$ROOT/_system/usage/quota.${USAGE_MACHINE:-rainforest-air}.json" || true

# Ledger enrichment is substantially heavier than the quota heartbeat. Keep the
# machine card fresh every five minutes, but rebuild/copy the ledger at most
# hourly. Quota is published first, so a slow ledger pass cannot make the Air
# appear offline.
LEDGER="$ROOT/_system/usage/ledger.${USAGE_MACHINE:-rainforest-air}.jsonl"
LEDGER_MTIME=$(stat -f %m "$LEDGER" 2>/dev/null || echo 0)
if (( $(date +%s) - LEDGER_MTIME >= 3600 )); then
  PYTHONPATH="$ROOT" USAGE_MACHINE="${USAGE_MACHINE:-rainforest-air}" \
    /opt/homebrew/bin/python3 -m scripts.usage.enrich || true
  publish "$LEDGER" || true
fi
