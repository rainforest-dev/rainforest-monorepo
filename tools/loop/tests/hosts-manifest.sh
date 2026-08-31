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

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
