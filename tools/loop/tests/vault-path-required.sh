#!/usr/bin/env bash
# Does an unconfigured host refuse to publish, instead of publishing somewhere
# nobody reads?
#
# `vault_path()` fell back to `~/Repositories/rainforest-obsidian` -- the stale
# clone its own docstring warns about, in the same breath. The warning and the
# behaviour contradicted each other and the behaviour won. Measured 2026-08-26:
# the Air carried `defaults.vault_path` and the mini did not, so the run record
# split in half along the fallback -- `loop-runs.Angibles-MacBook-Air.jsonl`
# exists only in the vault, `loop-runs.rainforest-mini.jsonl` only in the clone,
# and `ledger.rainforest-mini.jsonl` holds 50,791 records in the clone the vault
# has never seen.
#
# Nothing ever failed. That is the whole bug: a writer picked a destination and
# no reader checked.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$ROOT/engine/lib"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# Run with an empty config dir so no host's real config leaks in.
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf 'defaults: {}\nprojects: []\n' > "$TMP/config.yaml"

resolve() { # env-assignments...
  env -u LOOP_VAULT_PATH -u VAULT_PATH "$@" \
    LOOP_HOME="$TMP" PYTHONPATH="$LIB" python3 -c '
from loopctl.writeback import vault_path, VaultPathUnset
try:
    print(vault_path())
except VaultPathUnset:
    print("REFUSED")
' 2>/dev/null
}

echo "== unconfigured =="
OUT="$(resolve)"
check "refuses rather than guessing"        "$OUT" "REFUSED"
check "never names the retired clone"       "$(printf '%s' "$OUT" | grep -c 'Repositories/rainforest-obsidian')" "0"

echo "== configured by environment =="
check "LOOP_VAULT_PATH wins"  "$(resolve LOOP_VAULT_PATH=/tmp/vault-a)" "/tmp/vault-a"
check "VAULT_PATH also works" "$(resolve VAULT_PATH=/tmp/vault-b)"      "/tmp/vault-b"

echo "== configured by config file =="
printf 'defaults:\n  vault_path: /tmp/vault-c\nprojects: []\n' > "$TMP/config.yaml"
check "defaults.vault_path is honoured" "$(resolve)" "/tmp/vault-c"
check "environment still beats config"  "$(resolve LOOP_VAULT_PATH=/tmp/vault-a)" "/tmp/vault-a"

echo "== both live machines are configured =="
# The raise is only safe because every host that publishes has the key. If this
# fails on a machine, that machine's runs would start erroring at writeback.
for cfg in "$HOME/.claude/loop/config.yaml"; do
  [ -r "$cfg" ] || continue
  got="$(PYTHONPATH="$LIB" python3 -c "
import yaml, sys
d = (yaml.safe_load(open(sys.argv[1])) or {}).get('defaults') or {}
print('set' if d.get('vault_path') else 'MISSING')
" "$cfg")"
  check "this host has defaults.vault_path" "$got" "set"
done

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
