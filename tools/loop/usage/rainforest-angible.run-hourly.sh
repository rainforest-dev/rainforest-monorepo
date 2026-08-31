#!/usr/bin/env bash
# Air-only wrapper for the hourly usage heartbeat.
#
# Why this exists: the vault's own run-hourly.sh cannot be launched directly on
# Air. launchd is denied read access to iCloud under TCC (measured 2026-07-28 --
# directory enumeration and file reads are refused, writes are allowed), so a
# plist pointing at the iCloud path fails before the script starts, silently.
# This runs the runtime copy instead.
#
# Scope: quota and ledger only. tasks.json is NOT refreshed here -- see below.
set -uo pipefail

RUNTIME=${LOOP_USAGE_RUNTIME:-"$HOME/.local/share/loop-usage-runtime"}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] usage-hourly: $*"; }

[ -d "$RUNTIME" ] || { log "runtime missing at $RUNTIME"; exit 1; }

# NOTION_TOKEN is deliberately not set. run-hourly.sh's Notion step is gated on
# it, so the sprint mirror is skipped here by design: Notion access on this
# machine goes through the Notion MCP, which only a Claude session can drive --
# a launchd job has no MCP client. tasks.json is therefore refreshed on demand
# from a session, not hourly.
#
# Say that out loud every run. tasks.json silently stopped ageing on 2026-07-27
# and nobody noticed until it was found by hand; a log line that explains the
# absence is cheaper than rediscovering it.
log "quota + ledger only; tasks.json is refreshed from a Claude session via Notion MCP, not by this job"

export VAULT_PATH="$RUNTIME"
bash "$RUNTIME/scripts/usage/run-hourly.sh"
log "done"
