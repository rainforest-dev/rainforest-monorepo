#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL="$HERE/../install.sh"
TMPDIR_ELC=$(mktemp -d)
trap 'rm -rf "$TMPDIR_ELC"' EXIT
AGENTS="$TMPDIR_ELC"; HOST=test; ALLOW_ENV_LOSS=""; REFUSALS=0
eval "$(sed -n '/^env_values()/,/^}/p;/^env_loss_check()/,/^}/p' "$INSTALL")"
say() { printf '%s\n' "$*"; }
python3 - "$TMPDIR_ELC" <<'PY'
import pathlib, plistlib, sys
root = pathlib.Path(sys.argv[1])
for name, doc in {
    'one': {'EnvironmentVariables': {'ENDPOINT': 'before', 'LOOP_EXECUTORS': 'codex'}},
    'two': {'EnvironmentVariables': {'ENDPOINT': 'before', 'LOOP_EXECUTORS': 'codex'}},
    'changed': {'EnvironmentVariables': {'ENDPOINT': 'after', 'LOOP_EXECUTORS': 'codex'}},
    'empty': {},
    'invalid-env': {'EnvironmentVariables': []},
}.items():
    (root / (name + '.plist')).write_bytes(plistlib.dumps(doc))
(root / 'corrupt.plist').write_text('not a plist')
PY
check() {
  local expected="$1" label="$2" src="$3" actual=accepted before="$REFUSALS"
  if ! env_loss_check "$label" "$TMPDIR_ELC/$src.plist" > "$TMPDIR_ELC/output" 2>&1; then actual=refused; fi
  [ "$actual" = "$expected" ] || { cat "$TMPDIR_ELC/output"; exit 1; }
  if [ "$actual" = refused ]; then [ "$REFUSALS" -eq "$((before + 1))" ]; fi
  printf 'PASS %s %s %s\n' "$label" "$src" "$actual"
}
[ "$(env_values "$TMPDIR_ELC/one.plist")" != '{}' ]
[ "$(env_values "$TMPDIR_ELC/empty.plist")" = '{}' ]
check accepted one one
check refused one changed
check refused one empty
check refused one corrupt
check refused corrupt one
check refused one invalid-env
check accepted new empty
check refused new corrupt
ALLOW_ENV_LOSS=one
check accepted one changed
check refused two changed
check refused one corrupt
plutil() { return 127; }
check refused one one
unset -f plutil
python3() { return 1; }
check refused one one
unset -f python3
bash "$INSTALL" --help | grep -q -- '--allow-plist-env-loss=<label>'
if bash "$INSTALL" --allow-plist-env-loss > "$TMPDIR_ELC/legacy" 2>&1; then exit 1; fi
grep -q 'global permission is not supported' "$TMPDIR_ELC/legacy"
