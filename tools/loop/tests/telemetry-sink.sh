#!/usr/bin/env bash
# Does enrolling an executor install somewhere for its own telemetry to land?
#
# `ralph.sh` defaults OTLP_ENDPOINT to http://localhost:4318 and injects the
# exporter env into every `claude -p` it launches. Nothing checks that anything
# is listening there, and the OTel SDK does not complain when nothing is -- so a
# machine can be a perfectly healthy executor and throw away everything it
# measures.
#
# Measured 2026-08-26: the Air had run that way for its whole life. Zero
# {job="claude-code"} series in Prometheus and zero Loki lines carried it; every
# series present came from a hand-exported interactive shell on the mini. Its
# Alloy was up and healthy the whole time, shipping host metrics and dev events
# fine. It simply had no `otelcol.receiver.otlp` block.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
y() { python3 -c '
import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
print(eval(sys.argv[2], {"d": d}))
' "$ROOT/hosts.yaml" "$1"; }

echo "== the role exists and is claimed by the hosts that need it =="
check "telemetry-sink is a declared role" "$(y '"telemetry-sink" in d["roles"]')" "True"
# Every host that runs ralph emits OTLP. A host with `ralph` and no sink is the
# exact configuration that measured nothing for months.
for h in $(y '" ".join(k for k,v in d["hosts"].items() if "ralph" in v["roles"])'); do
  has=$(y "'telemetry-sink' in d['hosts']['$h']['roles']")
  # rainforest-mini is the documented exception: its sink is the homelab's
  # containerised Alloy, provisioned by terraform, already receiving on 4318.
  if [ "$h" = "rainforest-mini" ]; then
    check "$h documents why it is exempt" \
      "$(grep -c 'rainforest-mini, which is the exception' "$ROOT/hosts.yaml")" "1"
  else
    check "$h runs ralph, so it has a sink" "$has" "True"
  fi
done

echo "== the files the role promises are actually in the repo =="
for h in $(y '" ".join(k for k,v in d["hosts"].items() if "telemetry-sink" in v["roles"])'); do
  check "$h config.alloy is checked in" \
    "$([ -f "$ROOT/telemetry/$h.config.alloy" ] && echo yes || echo no)" "yes"
  check "$h dev-alloy plist is checked in" \
    "$([ -f "$ROOT/launchd/$h.com.homelab.dev-alloy.plist" ] && echo yes || echo no)" "yes"
done

echo "== the plist points Alloy at the fragment directory, not a single file =="
# The loop's OTLP intake ships as loop-otlp.alloy, a fragment beside the
# hand-maintained config.alloy in the same directory. Alloy only combines
# every *.alloy file in a directory into one unit when given the directory
# itself; pointing it at config.alloy alone would silently drop the fragment,
# with no error, and the OTLP intake would vanish exactly the way it did
# before this role existed. A future hand-edit or re-enrollment could
# restore the single-file form with nothing to catch it -- this is that
# catch.
plist_last_arg() { # plist_path
  plutil -convert json -o - "$1" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(d["ProgramArguments"][-1])
'
}
for h in $(y '" ".join(k for k,v in d["hosts"].items() if "telemetry-sink" in v["roles"])'); do
  last_arg=$(plist_last_arg "$ROOT/launchd/$h.com.homelab.dev-alloy.plist")
  check "$h's Alloy is pointed at a directory, not a .alloy file" \
    "$(echo "$last_arg" | grep -c '\.alloy$')" "0"
  check "$h's Alloy directory is the dev-telemetry alloy config dir" \
    "$(echo "$last_arg" | grep -c '/dev-telemetry/alloy$')" "1"
done

echo "== the config actually receives what ralph sends =="
CFG="$ROOT/telemetry/rainforest-angible.config.alloy"
# Strip `//` comments before matching. The block explaining WHY this binds
# loopback necessarily contains the string "0.0.0.0", and a naive grep counted
# the explanation as the thing it warns about.
code() { sed 's|//.*||' "$CFG"; }
cgrep() { code | grep -c "$1"; }
check "declares an OTLP receiver" "$(cgrep 'otelcol\.receiver\.otlp')" "1"
# ralph sends http/protobuf; a grpc-only receiver would accept nothing from it.
check "the receiver speaks http"    "$(code | grep -A6 'otelcol\.receiver\.otlp' | grep -c 'http {')" "1"
check "listens on ralph's default port" "$(cgrep '4318')" "1"
# A laptop that joins untrusted networks must not expose this to the network.
check "bound to loopback, not 0.0.0.0" "$(cgrep 'endpoint = \"127.0.0.1:4318\"')" "1"
check "no 0.0.0.0 bind anywhere"    "$(cgrep '0\.0\.0\.0')" "0"
# ralph exports metrics AND logs; a metrics-only path drops half of it.
# Match the declaration, not the reference: each exporter appears twice --
# once declared, once named in the batch processor's output.
check "declares a metrics exporter"  "$(code | grep -cE '^otelcol\.exporter\.prometheus ')" "1"
check "declares a logs exporter"     "$(code | grep -cE '^otelcol\.exporter\.loki ')" "1"
# ralph sends both; a metrics-only path silently drops half of what it measures.
check "the receiver outputs metrics" "$(code | grep -cE 'metrics += +\[otelcol\.processor\.batch')" "1"
check "the receiver outputs logs"    "$(code | grep -cE 'logs += +\[otelcol\.processor\.batch')" "1"

echo "== no credentials rode along =="
check "no key-shaped strings" \
  "$(grep -cE '(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-)' "$CFG")" "0"
# Three: the Prometheus URL, the Loki URL, and the dev-events spool path.
check "no endpoint is hard-coded"   "$(code | grep -cE 'url += +"https?://')" "0"
check "endpoints come from the environment" "$(cgrep 'sys.env(')" "3"

echo "== install.sh implements the role it declares =="
check "install.sh handles telemetry-sink" \
  "$(grep -c 'has_role telemetry-sink' "$ROOT/install.sh")" "1"
check "it installs the plist too" \
  "$(grep -c 'install_plist com.homelab.dev-alloy' "$ROOT/install.sh")" "1"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
