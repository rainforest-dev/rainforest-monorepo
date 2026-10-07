#!/bin/bash
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/ms-playwright}"
log=/tmp/cloud-session-start.log
problems=""

if [ -x /opt/node24/bin/node ]; then
  export PATH="/opt/node24/bin:$PATH"
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo 'export PATH="/opt/node24/bin:$PATH"' >>"$CLAUDE_ENV_FILE"
else
  problems="${problems}- Node 24 is missing from /opt/node24; commands run on the image's Node 22\n"
fi

grep -q 'exit=[1-9]' /var/log/cloud-setup.log 2>/dev/null &&
  problems="${problems}- environment setup had failing steps; see /var/log/cloud-setup.log\n"

pnpm install --frozen-lockfile >"$log" 2>&1 ||
  problems="${problems}- pnpm install failed; see ${log}\n"

pnpm exec playwright install chromium >>"$log" 2>&1 ||
  problems="${problems}- playwright browser install failed; see ${log}\n"

cat <<EOF
Cloud session notes for rainforest-monorepo:
- Nx Cloud is unreachable here (NX_NO_CLOUD=true). Tasks run locally in this VM.
- Only chromium is installed. personal-liff and personal-liff-e2e are unmaintained;
  leave them out of test and e2e runs.
- VAULT_PATH does not exist here. rss-manager code that reads the vault can only be
  exercised through its fixtures.
$( [ -n "$problems" ] && printf 'Setup problems:\n%b' "$problems" )
EOF
exit 0
