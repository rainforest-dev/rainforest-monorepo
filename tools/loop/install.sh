#!/usr/bin/env bash
# Install the loop for this host, per the roles hosts.yaml gives it.
#
# Deliberately does NOT enable anything. It places files and installs LaunchAgent
# plists in a disabled state; starting an unsupervised executor is a separate,
# explicit act. See "Enabling" in README.md.
#
# Never touches config.yaml or greenlight/ -- those are owner-maintained state
# that happens to live in the install directory. See "Not in this repo".
#
# No yaml parser is used: the system python3 has no PyYAML, and loopctl's venv is
# a product of this script, so depending on it here would be circular. The
# `roles: [...]` lines are read with awk instead. The list may wrap onto the
# line after `roles:` -- Prettier formats hosts.yaml and does exactly that once
# the list is long enough -- so roles_for accumulates until the closing bracket.
# tests/hosts-manifest.sh holds both layouts to the same result.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/hosts.yaml"
LOOP_HOME=${LOOP_HOME:-"$HOME/.claude/loop"}
SHARE=${XDG_DATA_HOME:-"$HOME/.local/share"}
AGENTS="$HOME/Library/LaunchAgents"

HOST=""
DRY=0
ALLOW_ENV_LOSS=0
# Counted, because the script ends in `say` and would otherwise exit 0 with a
# refusal three screens up. A caller checking $? -- the relay that installs on
# the Air does -- must see this.
REFUSALS=0
for arg in "$@"; do
  case "$arg" in
    --host=*) HOST="${arg#--host=}" ;;
    --dry-run|-n) DRY=1 ;;
    --allow-plist-env-loss) ALLOW_ENV_LOSS=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$MANIFEST" ] || { echo "manifest missing: $MANIFEST" >&2; exit 1; }
# LocalHostName, not `hostname -s`: the latter follows DHCP and moved
# mid-session on 2026-07-30. Kept identical to ralph.sh and
# loopctl.host_machine -- these must all agree or per-machine files split.
[ -n "$HOST" ] || HOST=$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null)
HOST=${HOST%%.*}

say() { printf '%s\n' "$*"; }
run() { if [ "$DRY" -eq 1 ]; then say "  would: $*"; else "$@"; fi; }

known_hosts() {
  awk '/^hosts:/{h=1;next} h && /^  [A-Za-z][^:]*:/{gsub(/^  |:.*/,"");print}' "$MANIFEST"
}

roles_for() {
  awk -v want="$1" '
    /^hosts:/ { inhosts = 1; next }
    !inhosts { next }
    /^  [A-Za-z][^:]*:/ {
      name = $0; gsub(/^  |:.*/, "", name)
      here = (name == want)
      collecting = 0; buf = ""
      next
    }
    # The [list] may sit on the `roles:` line or on the lines after it.
    # Prettier formats this repo, including hosts.yaml, and wraps the bracket
    # onto the next line once the list is long enough -- which the Air entry
    # already is. Reading only the `roles:` line therefore returned the literal
    # string "    roles:" for that host, has_role matched nothing, and
    # `./install.sh --host=Angibles-MacBook-Air` installed NOTHING while
    # printing "roles:     roles:" and exiting 0. Accumulate until "]".
    here && (/^    roles:/ || collecting) {
      line = $0
      if (!collecting) sub(/^ *roles:/, "", line)
      buf = buf " " line
      collecting = 1
      if (buf ~ /\]/) {
        sub(/.*\[/, "", buf)
        sub(/\].*/, "", buf)
        gsub(/,/, " ", buf)
        print buf
        exit
      }
      next
    }
  ' "$MANIFEST"
}

ROLES=$(roles_for "$HOST")
if [ -z "$ROLES" ]; then
  say "no roles for host '$HOST'."
  say "hosts.yaml knows: $(known_hosts | tr '\n' ' ')"
  say "pass --host=<name> to install as one of them."
  exit 1
fi

say "host: $HOST"
say "roles: $ROLES"
[ "$DRY" -eq 1 ] && say "(dry run -- nothing will be written)"

has_role() { case " $ROLES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# Anything whose content differs per machine is stored as `<host-key>.<name>`,
# where the host key is exactly the one in hosts.yaml. One rule for plists and
# for scripts, so there is nothing to remember and no guessing at install time.
host_file() {
  local dir="$1" name="$2"
  # Separate statement: within one `local`, every right-hand side is expanded
  # before any name is bound, so referring to $dir there reads an unset global --
  # fatal under `set -u`, and it silently made every lookup miss.
  local src="$HERE/$dir/$HOST.$name"
  [ -f "$src" ] && printf '%s' "$src"
}

# Installed under the canonical label, from this host's copy. A missing plist is
# reported, not fatal: a role can legitimately be listed for a host whose
# schedule has not been captured into the repo yet.
install_plist() {
  local label="$1"
  local src
  src=$(host_file launchd "$label.plist")
  if [ -z "$src" ]; then
    say "  skip $label — launchd/$HOST.$label.plist not in the repo"
    return 0
  fi
  env_loss_check "$label" "$src" || return 1
  run mkdir -p "$AGENTS"
  run cp "$src" "$AGENTS/$label.plist"
  # "not loaded" was true only until the next login. A LaunchAgent in
  # ~/Library/LaunchAgents loads when the GUI session starts, and every plist
  # here carries RunAtLoad, so the honest word is "later", not "never".
  say "  $label -> $AGENTS/$label.plist (loads at next login)"
}

# The EnvironmentVariables keys a plist declares, one per line; nothing at all
# when it has none or cannot be read.
env_keys() {
  plutil -extract EnvironmentVariables json -o - "$1" 2>/dev/null \
    | /usr/bin/python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
except ValueError:
    raise SystemExit
print("\n".join(sorted(d or {})))' 2>/dev/null
}
TMPDIR_ELC=$(mktemp -d)
trap 'rm -rf "$TMPDIR_ELC"' EXIT

# Refuse to overwrite a plist whose EnvironmentVariables this one would drop.
#
# On 2026-09-04 the mini's installed com.rainforest.usage-hourly carried
# OTEL_EXPORTER_OTLP_ENDPOINT and the repo's copy did not. Installing would have
# removed it, and export_quota.emit() resolves the endpoint from exactly that
# variable and `return 0`s when it finds none -- no error, no log line, an hourly
# metric that simply stops. It was found by diffing the two by hand before an
# install, which is not a mechanism.
#
# A refusal rather than a warning. This runs perhaps twice a month, in a log
# nobody reads to the end, and the whole failure being prevented is a difference
# that nothing looked at. `install.sh` is the writer; this is the reader.
#
# The repo stays the source of truth: the fix is to commit the key, not to keep
# it on one machine. --allow-plist-env-loss is for when the key is genuinely
# meant to go.
env_loss_check() {
  local label="$1" src="$2" dst="$AGENTS/$1.plist"
  [ "$ALLOW_ENV_LOSS" -eq 1 ] && return 0
  [ -f "$dst" ] || return 0
  # plutil, not plistlib. A double hyphen is illegal inside an XML comment and
  # plutil accepts it regardless, so a plist this project happily ships can be
  # unreadable to a strict parser -- which is a silent "cannot answer" here, and
  # therefore a silent pass. Reading it with the same lenient tool that the rest
  # of this repo and launchd itself use removes the mismatch.
  local lost
  lost=$(env_keys "$dst" | sort > "$TMPDIR_ELC/dst" 2>/dev/null
         env_keys "$src" | sort > "$TMPDIR_ELC/src" 2>/dev/null
         comm -23 "$TMPDIR_ELC/dst" "$TMPDIR_ELC/src" | tr '\n' ' ' | sed 's/ *$//')
  [ -z "$lost" ] && return 0
  say "  REFUSING to install $label" >&2
  say "    the copy already on this machine sets: $lost" >&2
  say "    and $HOST.$label.plist does not." >&2
  say "    Overwriting would delete those, silently." >&2
  say "" >&2
  say "    Commit them to launchd/$HOST.$label.plist if they are load-bearing," >&2
  say "    or re-run with --allow-plist-env-loss if they are genuinely going." >&2
  REFUSALS=$((REFUSALS + 1))
  return 1
}

# Refuse to let a job start on its own.
#
# `launchctl disable` writes a persistent override keyed by label, and that
# override BEATS a Disabled key inside the plist -- which is why this is the
# mechanism and not a key in the file. rainforest-air proves the point:
# `launchctl print-disabled gui/501` there lists
# `com.rainforest.usage-hourly => enabled`, an explicit override that would have
# silently outranked anything written into the plist.
disable_agent() {
  local label="$1"
  run launchctl disable "gui/$(id -u)/$label"
}

if has_role engine; then
  say "engine:"
  run mkdir -p "$LOOP_HOME"
  # --ignore-existing on the owner-maintained files only; code is always refreshed.
  run rsync -a --exclude '__pycache__' "$HERE/engine/lib/" "$LOOP_HOME/lib/"
  # What this machine is running, so the dashboard can say when a host is
  # behind instead of that answer needing an ssh and a grep. Absent when the
  # engine was copied by hand rather than installed from a bundle, and absent
  # is the truthful reading: nothing here can name a version it never had.
  if [ -f "$HERE/engine/.engine-version" ]; then
    run cp "$HERE/engine/.engine-version" "$LOOP_HOME/.engine-version"
  fi
  for f in loopctl ralph.sh contract.md pyproject.toml uv.lock; do
    run rsync -a "$HERE/engine/$f" "$LOOP_HOME/$f"
  done
  run chmod +x "$LOOP_HOME/loopctl" "$LOOP_HOME/ralph.sh"
  if [ ! -f "$LOOP_HOME/config.yaml" ]; then
    run cp "$HERE/config.example.yaml" "$LOOP_HOME/config.yaml"
    say "  config.yaml seeded from the example — edit it before the first scan"
  else
    say "  config.yaml left alone (owner-maintained)"
  fi
  if [ ! -d "$LOOP_HOME/.venv" ]; then
    say "  creating venv"
    run "${UV_BIN:-uv}" sync --project "$LOOP_HOME" 2>/dev/null \
      || say "  venv not created — run 'uv sync' in $LOOP_HOME by hand"
  else
    say "  venv present"
  fi
fi

if has_role ralph; then
  say "ralph:"
  install_plist tools.rainforest.loop-ralph
  # This line used to only SAY it. Nothing in this script called launchctl, no
  # plist here carries a Disabled key, and the ralph plist has RunAtLoad with a
  # 1800s StartInterval -- so on a machine with no pre-existing override,
  # install.sh followed by a logout would have started an unsupervised executor
  # while printing that it had not. Found 2026-08-28 by the agent enrolling the
  # Air, which noticed print-disabled disagreeing with the claim and stopped
  # rather than reconciling it.
  disable_agent tools.rainforest.loop-ralph
  say "  DISABLED via launchctl — enabling is a separate act, see README 'Enabling'"
fi

if has_role relay-pull; then
  say "relay-pull:"
  run mkdir -p "$SHARE/loop-greenlight-pull"
  run rsync -a "$HERE/relay/pull.sh" "$SHARE/loop-greenlight-pull/pull.sh"
  run chmod +x "$SHARE/loop-greenlight-pull/pull.sh"
  install_plist com.rainforest.greenlight-pull
fi

if has_role usage-hourly; then
  say "usage-hourly:"
  # A wrapper only where the host needs one. Air does, because launchd there
  # cannot read iCloud; the Observatory host runs the vault's own script. Copying
  # every wrapper found would hand each machine the other's workaround.
  wrapper=$(host_file usage "run-hourly.sh")
  if [ -n "$wrapper" ]; then
    run mkdir -p "$SHARE/loop-usage-runtime"
    run rsync -a "$wrapper" "$SHARE/loop-usage-runtime/run-hourly-host.sh"
    run chmod +x "$SHARE/loop-usage-runtime/run-hourly-host.sh"
    say "  wrapper installed as run-hourly-host.sh"
  else
    say "  no wrapper for this host — the plist runs the vault script directly"
  fi
  install_plist com.rainforest.usage-hourly
fi

if has_role usage-publish; then
  say "usage-publish:"
  run mkdir -p "$SHARE/loop-usage-runtime"
  run rsync -a "$HERE/usage/publish-air-to-mini.sh" "$SHARE/loop-usage-runtime/"
  run chmod +x "$SHARE/loop-usage-runtime/publish-air-to-mini.sh"
  install_plist com.rainforest.usage-air-publish
fi

if has_role telemetry-sink; then
  say "telemetry-sink:"
  # Host-specific, like the plists: the mini's sink is the homelab's
  # containerised Alloy and is not installed from here at all. See the role note
  # in hosts.yaml.
  alloy_src=$(host_file telemetry "config.alloy")
  if [ -z "$alloy_src" ]; then
    say "  skip config — telemetry/$HOST.config.alloy not in the repo"
  else
    run mkdir -p "$HOME/.config/dev-telemetry/alloy"
    run cp "$alloy_src" "$HOME/.config/dev-telemetry/alloy/config.alloy"
    say "  config -> ~/.config/dev-telemetry/alloy/config.alloy"
  fi
  install_plist com.homelab.dev-alloy
  # Worth saying out loud, because the failure it prevents is silent: ralph
  # exports to this port whether or not anything is listening, and the OTel SDK
  # does not complain when nothing is.
  say "  ralph exports to \$OTLP_ENDPOINT (default http://localhost:4318);"
  say "  nothing warns if this is not running."
fi

if has_role loop-sync; then
  say "loop-sync:"
  install_plist com.rainforest.loop-sync
  say "  tokens are read from ~/.config/loop/ — not installed from this repo"
fi

# icloud-mirror was retired 2026-08-25 (see hosts.yaml). No host declares it, so
# this block was unreachable -- and a reader scanning install.sh would have
# concluded the role still existed.

say ""
if [ "$REFUSALS" -gt 0 ]; then
  say "INCOMPLETE: $REFUSALS plist(s) refused above. Everything else was installed." >&2
  exit 1
fi
say "done. Nothing was loaded or enabled."
say "To load a job:      launchctl bootstrap gui/\$(id -u) $AGENTS/<label>.plist"
say "To check disabled:  launchctl print-disabled gui/\$(id -u) | grep rainforest"
