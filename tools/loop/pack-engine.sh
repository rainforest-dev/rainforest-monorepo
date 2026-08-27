#!/usr/bin/env bash
# tools/loop/pack-engine.sh — build the artifact a machine installs.
#
# Deliberately excludes owner-maintained state. `install.sh` never overwrites
# config.yaml or greenlight/, and a bundle carrying either would ship one
# machine's authorisations to another.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?usage: pack-engine.sh <output.tar.gz>}"

tar -czf "$OUT" -C "$HERE" \
  --exclude '__pycache__' \
  --exclude '.venv' \
  --exclude 'greenlight' \
  --exclude 'config.yaml' \
  --exclude 'tests' \
  engine hosts.yaml install.sh telemetry usage relay launchd config.example.yaml
