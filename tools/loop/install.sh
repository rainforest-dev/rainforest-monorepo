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
# `roles: [...]` lines are read with awk instead, which is why they must stay on
# one line.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$HERE/hosts.yaml"
LOOP_HOME=${LOOP_HOME:-"$HOME/.claude/loop"}
SHARE=${XDG_DATA_HOME:-"$HOME/.local/share"}
AGENTS="$HOME/Library/LaunchAgents"

HOST=""
DRY=0
for arg in "$@"; do
  case "$arg" in
    --host=*) HOST="${arg#--host=}" ;;
    --dry-run|-n) DRY=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$MANIFEST" ] || { echo "manifest missing: $MANIFEST" >&2; exit 1; }
[ -n "$HOST" ] || HOST=$(hostname -s 2>/dev/null || echo "")

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
      next
    }
    here && /^    roles:/ {
      line = $0
      sub(/^ *roles: *\[/, "", line)
      sub(/\].*/, "", line)
      gsub(/,/, " ", line)
      print line
      exit
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
  run mkdir -p "$AGENTS"
  run cp "$src" "$AGENTS/$label.plist"
  say "  $label -> $AGENTS/$label.plist (not loaded)"
}

if has_role engine; then
  say "engine:"
  run mkdir -p "$LOOP_HOME"
  # --ignore-existing on the owner-maintained files only; code is always refreshed.
  run rsync -a --exclude '__pycache__' "$HERE/engine/lib/" "$LOOP_HOME/lib/"
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
  say "  left DISABLED — see README 'Enabling'"
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

if has_role observatory; then
  say "observatory:"
  install_plist tools.rainforest.loop-observatory
fi

if has_role loop-sync; then
  say "loop-sync:"
  install_plist com.rainforest.loop-sync
  say "  tokens are read from ~/.config/loop/ — not installed from this repo"
fi

if has_role icloud-mirror; then
  say "icloud-mirror:"
  install_plist com.rainforest.icloud-mirror
  say "  the script itself ships from the vault repo, not here"
fi

say ""
say "done. Nothing was loaded or enabled."
say "To load a job:      launchctl bootstrap gui/\$(id -u) $AGENTS/<label>.plist"
say "To check disabled:  launchctl print-disabled gui/\$(id -u) | grep rainforest"
