#!/usr/bin/env bash
# tools/loop/tests/engine-bundle.sh
#
# The bundle is what a machine installs, so what it contains is what an executor
# becomes. A bundle missing loopctl produces a host that enrolls and cannot run.
#
# Looking for the gate that proves the enrollment generator reproduces the two
# live per-host plists in tools/loop/launchd/? That lives at
# apps/loop-observatory/src/lib/enroll/reproduces-hosts.test.ts (a Vitest test,
# not a script here, because it shells out to plutil rather than needing tsx).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="$ROOT/install.sh"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
bash "$ROOT/pack-engine.sh" "$TMP/bundle.tar.gz" >/dev/null 2>&1
check "pack-engine.sh produces an archive" "$([ -s "$TMP/bundle.tar.gz" ] && echo yes || echo no)" "yes"

tar -tzf "$TMP/bundle.tar.gz" > "$TMP/list" 2>/dev/null
# enroll.sh is in this list because its absence is silent: the setup page would
# name a script the bundle does not carry, and a machine following the page
# would simply skip reporting its facts -- which is the state the whole
# enrollment surface sat in until 2026-08-28.
for f in engine/ralph.sh engine/loopctl engine/contract.md hosts.yaml install.sh enroll.sh; do
  check "carries $f" "$(grep -c "^$f\$" "$TMP/list")" "1"
done

# This pair was the whole reason for this task's fix round: install.sh:123
# seeds config.yaml FROM config.example.yaml, and install_plist reads
# launchd/<host>.<label>.plist. Neither was in the original hand-typed list
# above, so a bundle missing either shipped silently -- a freshly enrolled
# engine host got told "config.yaml seeded from the example" while `cp`
# failed under `set -uo pipefail` (no `-e`, so the failure did not abort).
check "carries config.example.yaml" "$(grep -c '^config\.example\.yaml$' "$TMP/list")" "1"
check "carries launchd/"            "$(grep -c '^launchd/$' "$TMP/list")" "1"

# The bundle is served over the tailnet and unpacked by a machine. A tarball that
# can write outside its extraction root is a remote file overwrite.
check "no absolute paths"  "$(grep -c '^/' "$TMP/list")" "0"
check "no parent traversal" "$(grep -c '\.\./' "$TMP/list")" "0"

# Runtime state is per-machine and must not ride along.
check "no greenlight state" "$(grep -c 'greenlight/' "$TMP/list")" "0"
check "no config.yaml"      "$(grep -c 'config\.yaml$' "$TMP/list")" "0"

# --- Derived cross-check: every path install.sh reads relative to its own
# directory ($HERE/...) must be in the packed archive. A hand-typed list (like
# the checks above) only catches what its author thought to type -- it cannot
# catch a file install.sh starts depending on later. This check reads
# install.sh itself, so adding a new $HERE/... reference there without
# teaching pack-engine.sh about it fails here automatically.
#
# Exclusion (the one install.sh reference this cannot resolve mechanically):
#   $HERE/$dir/$HOST.$name  (host_file(), line ~93) -- $dir, $HOST and $name
#   are all runtime values (the enrolling host's own name, chosen at install
#   time), so no single literal filename exists in the script text. What IS
#   static is which directories host_file() draws from -- its first argument
#   at each call site (`host_file launchd ...`, `host_file usage ...`,
#   `host_file telemetry ...`) -- so those directories are asserted instead:
#   without the directory, no per-host file under it could ever be found
#   regardless of which host asks.
here_refs() {
  grep -oE '\$HERE/[A-Za-z0-9_./$-]+' "$INSTALL" | sed 's/^\$HERE\///' | sort -u
}
host_file_dirs() {
  grep -oE 'host_file [A-Za-z0-9_-]+' "$INSTALL" | awk '{print $2}' | sort -u
}

required=()
while IFS= read -r ref; do
  case "$ref" in
    '$dir/$HOST.$name')
      : # excluded -- see host_file_dirs handling below
      ;;
    'engine/$f')
      # $f ranges over install.sh's own `for f in ...` list a few lines above
      # -- enumerable, not opaque, so expand it rather than excluding it.
      for name in $(grep -oE '^ *for f in [^;]+' "$INSTALL" | sed -E 's/^ *for f in //'); do
        required+=("engine/$name")
      done
      ;;
    *'$'*)
      echo "engine-bundle.sh: unhandled variable path in install.sh: \$HERE/$ref" >&2
      echo "  add it to the exclusion list above with a reason, or expand it." >&2
      exit 2
      ;;
    *)
      required+=("$ref")
      ;;
  esac
done < <(here_refs)

while IFS= read -r d; do
  required+=("$d/")
done < <(host_file_dirs)

for r in "${required[@]}"; do
  # Directories were rsync'd/copied whole and appear in the tar listing with a
  # trailing slash; both files and directories are checked the same way.
  check "install.sh needs $r (derived)" "$(grep -c "^$r\$" "$TMP/list")" "1"
done

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
