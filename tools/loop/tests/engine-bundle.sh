#!/usr/bin/env bash
# tools/loop/tests/engine-bundle.sh
#
# The bundle is what a machine installs, so what it contains is what an executor
# becomes. A bundle missing loopctl produces a host that enrolls and cannot run.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
bash "$ROOT/pack-engine.sh" "$TMP/bundle.tar.gz" >/dev/null 2>&1
check "pack-engine.sh produces an archive" "$([ -s "$TMP/bundle.tar.gz" ] && echo yes || echo no)" "yes"

tar -tzf "$TMP/bundle.tar.gz" > "$TMP/list" 2>/dev/null
for f in engine/ralph.sh engine/loopctl engine/contract.md hosts.yaml install.sh; do
  check "carries $f" "$(grep -c "^$f\$" "$TMP/list")" "1"
done

# The bundle is served over the tailnet and unpacked by a machine. A tarball that
# can write outside its extraction root is a remote file overwrite.
check "no absolute paths"  "$(grep -c '^/' "$TMP/list")" "0"
check "no parent traversal" "$(grep -c '\.\./' "$TMP/list")" "0"

# Runtime state is per-machine and must not ride along.
check "no greenlight state" "$(grep -c 'greenlight/' "$TMP/list")" "0"
check "no config.yaml"      "$(grep -c 'config\.yaml$' "$TMP/list")" "0"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
