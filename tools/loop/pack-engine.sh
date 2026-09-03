#!/usr/bin/env bash
# tools/loop/pack-engine.sh — build the artifact a machine installs.
#
# Deliberately excludes owner-maintained state. `install.sh` never overwrites
# config.yaml or greenlight/, and a bundle carrying either would ship one
# machine's authorisations to another.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?usage: pack-engine.sh <output.tar.gz>}"

# The version the bundle reports once installed.
#
# Derived from the output filename rather than passed separately, because the
# release workflow already builds that name from the CalVer and sha it publishes
# under -- a second source would be a second thing that can disagree with the
# release. A build invoked by hand gets `dev-<sha>`, which is honest: it names a
# commit but is not a release anyone can download.
version=$(basename "$OUT" .tar.gz)
version=${version#loop-engine-}
if [ "$version" = "$(basename "$OUT")" ] || [ -z "$version" ]; then
  version="dev-$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
fi
printf '%s\n' "$version" > "$HERE/engine/.engine-version"
trap 'rm -f "$HERE/engine/.engine-version"' EXIT

tar -czf "$OUT" -C "$HERE" \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'greenlight' \
  --exclude 'config.yaml' \
  --exclude 'tests' \
  engine hosts.yaml install.sh enroll.sh telemetry usage relay launchd config.example.yaml
