#!/bin/bash
set -u

NODE_VERSION=24.21.0
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

case "$(uname -m)" in
  aarch64 | arm64) node_arch=arm64 ;;
  *) node_arch=x64 ;;
esac
node_dir="node-v${NODE_VERSION}-linux-${node_arch}"

# The image ships Node 20-22 only, with /opt/node22/bin first on PATH.
step node bash -c "curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/${node_dir}.tar.xz | tar -xJ -C /opt && ln -sfn /opt/${node_dir} /opt/node24"
export PATH="/opt/node24/bin:$PATH"

step pnpm bash -c "corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate || npm install -g pnpm@${PNPM_VERSION}"

# --with-deps runs apt-get update, which fails on the image's blocked PPAs; the libraries are already there.
step playwright-chromium npx -y "playwright@${PLAYWRIGHT_VERSION}" install chromium

exit 0
