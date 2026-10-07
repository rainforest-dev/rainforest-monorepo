#!/bin/bash
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/ms-playwright}"
log=/tmp/cloud-session-start.log
problems=""

grep -q 'exit=[1-9]' /var/log/cloud-setup.log 2>/dev/null &&
  problems="${problems}- environment setup had failing steps; see /var/log/cloud-setup.log\n"

pnpm install --frozen-lockfile >"$log" 2>&1 ||
  problems="${problems}- pnpm install failed; see ${log}\n"

pnpm exec playwright install chromium >>"$log" 2>&1 ||
  problems="${problems}- playwright browser install failed; see ${log}\n"

cat <<EOF
Cloud session notes for rainforest-monorepo:
- Nx Cloud is unreachable here (NX_NO_CLOUD=true). Tasks run locally in this VM.
- Only chromium is installed. Run e2e with --project=chromium; personal-liff-e2e's
  firefox and webkit projects will fail for lack of a browser, not because of your change.
- VAULT_PATH does not exist here. rss-manager code that reads the vault can only be
  exercised through its fixtures.
$( [ -n "$problems" ] && printf 'Setup problems:\n%b' "$problems" )
EOF
exit 0
