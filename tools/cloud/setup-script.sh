#!/bin/bash
set -u

PNPM_VERSION=11.7.0
PLAYWRIGHT_VERSION=1.63.0
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
LOG=/var/log/cloud-setup.log

step() {
  local name=$1
  shift
  "$@" >>"$LOG" 2>&1
  local rc=$?
  echo "$(date -u +%FT%TZ) step=${name} exit=${rc}" >>"$LOG"
  return "$rc"
}

step pnpm bash -c "corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate || npm install -g pnpm@${PNPM_VERSION}"

# --with-deps runs apt-get update, which fails on the image's blocked PPAs; the libraries are already there.
step playwright-chromium npx -y "playwright@${PLAYWRIGHT_VERSION}" install chromium

exit 0
