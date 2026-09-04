#!/usr/bin/env bash
# Does install.sh actually read hosts.yaml as it is written today?
#
# It did not. `roles_for` matched only `/^    roles:/` and pulled the list off
# that one line, which the header comment justified with "which is why they must
# stay on one line". Nothing enforced that, and Prettier formats this repo --
# hosts.yaml included. Once rainforest-air accumulated six roles, Prettier
# wrapped the bracket onto the following line:
#
#     roles:
#       [engine, ralph, relay-pull, usage-hourly, usage-publish, telemetry-sink]
#
# roles_for then returned the literal string "    roles:", ROLES was non-empty so
# the guard did not fire, has_role matched nothing, and
# `./install.sh --host=rainforest-air` printed "roles:     roles:",
# installed NOTHING, and exited 0. Measured 2026-08-27.
#
# A formatter silently invalidating a parser, with no reader to notice, is the
# same shape as everything else this branch fixes. This test is that reader.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

# The real functions, out of the real script, against the real manifest --
# rather than a copy of the awk that could drift from what install.sh runs.
eval "$(sed -n '/^known_hosts()/,/^}/p;/^roles_for()/,/^}/p' "$ROOT/install.sh")"
MANIFEST="$ROOT/hosts.yaml"

echo "== every declared host is discoverable =="
check "known_hosts finds both live hosts" \
  "$(known_hosts | tr '\n' ' ')" "rainforest-air rainforest-mini "

echo "== roles parse in BOTH layouts hosts.yaml contains =="
# Wrapped onto the line after `roles:` (what Prettier produces).
check "rainforest-air (wrapped list)" \
  "$(roles_for rainforest-air)" \
  "engine  ralph  relay-pull  usage-hourly  usage-publish  telemetry-sink"
# Inline on the `roles:` line.
check "rainforest-mini (inline list)" \
  "$(roles_for rainforest-mini)" \
  "engine  ralph  loop-sync  usage-hourly"

echo "== a role check on the parsed value actually matches =="
# The failure was not that parsing errored -- it was that a wrong value flowed
# on into has_role and matched nothing, silently.
for want in engine ralph relay-pull usage-hourly usage-publish telemetry-sink; do
  case " $(roles_for rainforest-air) " in
    *" $want "*) check "Air has_role $want" "yes" "yes" ;;
    *)           check "Air has_role $want" "no"  "yes" ;;
  esac
done

echo "== an unknown host still yields nothing =="
check "roles_for on a host not in the manifest" "$(roles_for not-a-host)" ""

echo "== the plists agree with the one thing that derives them =="
# hosts.yaml's prose and a committed plist are both descriptions of a machine at
# some past moment, and only one of them carries a timestamp. On 2026-09-03 the
# prose said the Air's launchd is DENIED iCloud (probed 2026-08-25); the live
# facts said permitted, measured 2026-08-31 by the probe that was corrected on
# 08-28 to ask launchd rather than the calling shell. Re-measured under launchd
# today: permitted. So the prose is the stale one, and a test asserting a shape
# from it would pin the wrong answer.
#
# What is safe to assert is agreement, not shape: deriveRalphPlist is the single
# renderer, and reproduces-hosts.test.ts already compares its output against
# these files. This checks the part that test cannot -- that the machine name
# each host runs under is the full one, wherever it is carried.
LAUNCHD="$(cd "$(dirname "$0")/../launchd" && pwd)"
envv() { plutil -extract EnvironmentVariables json -o - "$LAUNCHD/$1" 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ''))" "$2"; }

# host_machine() honours LOOP_MACHINE and every per-machine file is keyed on what
# it returns, so a short name opens a second run ledger beside the real one. The
# mini's committed plist said `mini` while the plist on that host said
# rainforest-mini: someone fixed the machine and not the file install.sh copies.
for host in rainforest-air rainforest-mini; do
  check "$host names itself in full" \
    "$(envv "$host.tools.rainforest.loop-ralph.plist" LOOP_MACHINE)" "$host"
done

echo
echo "== install.sh will not silently delete a plist's environment =="

# The mini's installed com.rainforest.usage-hourly carried
# OTEL_EXPORTER_OTLP_ENDPOINT and the repo's copy did not, so `./install.sh`
# would have deleted it. export_quota.emit() resolves the endpoint from exactly
# that variable and `return 0`s when there is none: no error, no log line, an
# hourly metric that just stops. It was caught by diffing the two by hand,
# minutes before the install -- which is luck, not a mechanism.
check "the endpoint export_quota needs is in the file install.sh copies" \
  "$(envv rainforest-mini.com.rainforest.usage-hourly.plist OTEL_EXPORTER_OTLP_ENDPOINT)" \
  "http://127.0.0.1:4318"

# The general reader, not the one-off. Exercised against real plists: a source
# missing a key the destination has must refuse; the same file against itself
# must not.
ALLOW_ENV_LOSS=""; REFUSALS=0; AGENTS="$LAUNCHD"; HOST=rainforest-mini
TMPDIR_ELC=$(mktemp -d); trap 'rm -rf "$TMPDIR_ELC"' EXIT
eval "$(sed -n '/^env_values()/,/^}/p;/^env_loss_check()/,/^}/p' "$ROOT/install.sh")"
say() { printf '%s\n' "$*"; }

# Every committed plist must be well-formed XML, which means no double hyphen
# inside a comment. plutil accepts one and plistlib does not, so such a file
# ships looking fine and is unreadable to anything strict -- including the
# check below, whose "cannot answer" path is a silent pass. Caught 2026-09-04
# in a comment added in this very change.
bad=""
for f in "$LAUNCHD"/*.plist; do
  python3 -c 'import plistlib,sys; plistlib.load(open(sys.argv[1],"rb"))' "$f" 2>/dev/null \
    || bad="$bad $(basename "$f")"
done
check "every launchd plist parses strictly" "$bad" ""

# .plist, and the removal is checked: `plutil -remove` on an extensionless
# temp file leaves the key in place, and a fixture silently identical to the
# original makes the refusal test pass for the wrong reason.
stripped=$(mktemp -t env_loss).plist; trap 'rm -f "$stripped"' EXIT
cp "$LAUNCHD/rainforest-mini.com.rainforest.usage-hourly.plist" "$stripped"
plutil -remove EnvironmentVariables.OTEL_EXPORTER_OTLP_ENDPOINT "$stripped" >/dev/null
check "the fixture really lost the key" \
  "$(plutil -extract EnvironmentVariables.OTEL_EXPORTER_OTLP_ENDPOINT raw -o - "$stripped" \
     >/dev/null 2>&1 && printf 'present' || printf 'gone')" "gone"

# Called in THIS shell. `got=$(verdict ...)` reads correctly and is wrong:
# command substitution forks, so every REFUSALS increment lands in a subshell
# and the counter the script exits on always reads 0.
verdict() { if env_loss_check "$1" "$2" >/dev/null 2>&1; then got=installed; else got=refused; fi; }

# dst is $AGENTS/<label>.plist, so name the label after the file that is there.
verdict rainforest-mini.com.rainforest.usage-hourly "$stripped"
check "a source dropping a key the machine has is refused" "$got" "refused"
check "and the refusal is counted, so the script can exit non-zero" "$REFUSALS" "1"

verdict rainforest-mini.com.rainforest.usage-hourly \
  "$LAUNCHD/rainforest-mini.com.rainforest.usage-hourly.plist"
check "an identical source installs" "$got" "installed"
check "and installing changes no count" "$REFUSALS" "1"
# Nothing installed yet is not a loss. A first install on a fresh machine must
# not be refused for having nothing to compare against.
verdict com.nothing.here.at.all "$stripped"
check "no plist on the machine yet is not a loss" "$got" "installed"

echo
echo "== the wrapper and the scripts it runs are installed together =="

# The Air's launchd is denied read access to iCloud under TCC, so the hourly job
# runs a RUNTIME COPY of the vault's scripts. install.sh copied the wrapper and
# not the scripts, and that copy was five weeks old on 2026-09-04: a field added
# to quota.py was live in the vault, absent from the runtime, and the job kept
# emitting the old shape. The wrapper is the only half anything checked.
hourly=$(sed -n '/^if has_role usage-hourly/,/^fi$/p' "$ROOT/install.sh")
# `check`, not `contains`: this suite has no `contains`, and the first version of
# these three lines called it anyway. bash printed "command not found" to stderr
# and the run still said "0 failed" -- three assertions that vanished without
# failing, which is the same shape as everything else here.
has() { printf '%s' "$hourly" | grep -c -- "$1"; }
check "the wrapper is installed"  "$([ "$(has 'run-hourly-host.sh')" -gt 0 ] && echo yes || echo no)" "yes"
check "and so are its scripts"    "$([ "$(has 'scripts/usage/')" -gt 0 ] && echo yes || echo no)" "yes"
check "resolved through loopctl, not guessed" \
  "$([ "$(has 'from loopctl.writeback import usage_path')" -gt 0 ] && echo yes || echo no)" "yes"
check "and an unresolvable vault warns rather than passing quietly" \
  "$(printf '%s' "$hourly" | grep -c 'WARNING: runtime scripts NOT synced')" "1"
# Order matters: a sync placed after install_plist would leave one wake running
# the old copy.
sync_line=$(printf '%s' "$hourly" | grep -n 'scripts/usage/' | tail -1 | cut -d: -f1)
plist_line=$(printf '%s' "$hourly" | grep -n 'install_plist com.rainforest.usage-hourly' | cut -d: -f1)
check "the scripts are in place before the job is installed" \
  "$([ -n "$sync_line" ] && [ -n "$plist_line" ] && [ "$sync_line" -lt "$plist_line" ] \
     && printf 'yes' || printf 'no')" "yes"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
