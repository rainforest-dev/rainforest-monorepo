# Cloud environment: `personal-web`

Claude Code cloud sessions and Projects threads for this repo run in a cloud environment
configured at claude.ai/code (the cloud icon above the message box). That configuration
lives in the UI only, so this directory is its versioned copy. Change it here first, then
paste.

## Environment settings

**Name** `personal-web`

**Network access** Custom, with "Also include default list of common package managers"
checked, plus:

```text
fonts.gstatic.com
cdn.playwright.dev
playwright.download.prss.microsoft.com
```

`fonts.gstatic.com` is for the Google Fonts the personal-website and `next/font/google`
fetch; `fonts.googleapis.com` is already covered by the default list's `*.googleapis.com`.
The other two serve Playwright's browser downloads.

**Environment variables**

```text
NX_NO_CLOUD=true
ASTRO_TELEMETRY_DISABLED=1
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
```

Values here are readable by every command a session runs. Nothing secret belongs in this
list. `NEXT_PUBLIC_LIFF_ID` stays unset until a LIFF id is chosen for the cloud.
`GA_API_SECRET` and the Sentry and Clarity ids are deliberately absent: builds work without
them.

**Setup script** the contents of [`setup-script.sh`](./setup-script.sh).

## How the pieces divide

|                    | Runs                                                                                                                                     | Does                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `setup-script.sh`  | Once per environment, as root, before Claude launches. Snapshotted for about 7 days; rebuilt when the script or the allowed hosts change | pnpm and a chromium pre-warm, each step's exit code in `/var/log/cloud-setup.log`                                              |
| `session-start.sh` | Every session start and resume, via the hook in `.claude/settings.json`. Exits at once outside the cloud                                 | `pnpm install --frozen-lockfile`, the chromium revision the lockfile wants, and a short briefing printed into Claude's context |

The hook only runs in a session with this repository alone. A session or Projects thread
that clones several repositories starts above the clones and reads no repository's
`.claude/settings.json`, so there the install has to be asked for in the task or the
project instructions.

## Not available in the cloud

- Nx Cloud (`*.nx.app` is not allowlisted; `NX_NO_CLOUD=true` keeps Nx from waiting on it).
- `VAULT_PATH`. The Obsidian vault is not reachable; rss-manager runs on fixtures.
- firefox and webkit. Add them to both scripts if personal-liff-e2e's other projects matter
  more than setup time.
- Plugins, including the `nx` and `polygraph` plugins `.claude/settings.json` enables. Cloud
  sessions install neither user-scoped plugins nor the ones a repository turns on, whatever
  marketplace it declares. The user-scoped MCP servers on the laptop are absent too;
  `.mcp.json` here still loads.

## Verified elsewhere

On another environment built the same way (2026-09-29): sessions run as root, the same user as the setup script, so
`/opt/ms-playwright` needs no permission changes. The image also ships its own chromium under
`/opt/pw-browsers` (chromium-1194), and the platform's instructions to Claude point there and
say not to run `playwright install`; `PLAYWRIGHT_BROWSERS_PATH` overrides that path.

## Unverified until the first session

- Whether corepack's pnpm shim is on the session's `PATH`.

Ask the first session to run `pnpm -v`, `node -v` and
`pnpm exec playwright install --dry-run chromium`, and fix this file from what it reports.
