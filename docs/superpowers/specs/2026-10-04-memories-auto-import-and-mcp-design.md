# Memories auto-import and a read-only MCP

Date: 2026-10-04. Status: proposed. From the owner's note 「memories app need auto import new data
and mcp to make other agents access it」, with the owner's decisions of the same day. Builds on
the content search (`2026-10-01-memories-content-search-design.md`, done).

## Problem

New data reaches personal-memories only when the owner runs `ingest` by hand on the Mac mini,
and even then the running container keeps serving the old timeline until it restarts.
Agents (claude.ai, the phone, local Claude Code) cannot read the album at all.

## Owner decisions (2026-10-04, final)

1. The MCP is remote and goes through the existing OAuth Worker gateway on Cloudflare, like
   calibre's, so claude.ai, the phone and local agents can all use it.
2. The MCP is read-only: search, read a day, list people, stats and coverage. It never writes
   notes or annotations.
3. Auto-import covers Apple Photos (fully automatic) and LINE (the owner drops an export file
   into a watched iCloud folder; everything after that is automatic). Slack is not
   auto-imported: the other person has left that workspace, so its history is static.

## Decisions

1. **A shared `libs/mcp-kit` comes first.** Memories is its first consumer. Calibre and the
   website move onto it in later slices. See [Shared MCP library](#shared-mcp-library).
2. **Auto-import runs on the host, from the monorepo.** It is a new plain-node CLI,
   `apps/personal-memories/src/cli/auto-import.ts`, started by a launchd agent on the Mac mini.
   The container cannot run it: it mounts the data directory read-only, and the job needs the
   Photos library with Full Disk Access, `uvx osxphotos` and the host's Ollama. The homelab
   Terraform installs the agent the way `modules/comfyui` installs its plist.
3. **The job runs nightly and when a file is dropped.** The plist uses `StartCalendarInterval`
   at 03:30 and `WatchPaths` on the drop folder. One lock covers the auto-import job and a
   manual `ingest`, so two ingests never run at once.
4. **For LINE, the newest export wins over its own date range.** Every export is archived per
   chat. Ingest takes each date from the newest export that covers it, so an export cut short
   by a reinstall cannot erase older history.
5. **The server reloads on mtime, without a restart.** `timeline.json` and `people.json` are
   re-read when their mtime changes, checked at most every 5 s. The search index already
   reloads on mtime. Ingest writes `timeline.json` atomically.
6. **Failures go to one place.** The job writes a log under `~/Library/Logs/` and posts each
   failure to the n8n `ha-events` webhook, which files it into the Obsidian daily note, the same
   path `modules/backup-monitor` uses.
7. **The MCP lives in the memories app.** It is an Astro endpoint at `/mcp` with four read-only
   tools. It is enabled only when `MEMORIES_MCP_SECRET` is set, and it answers only requests that
   carry the gateway's secret header.
8. **Agents get text, never files.** Tool output carries no emails, no absolute media paths, no
   image bytes and no chat file names. Photos reach agents as their Photos metadata plus a link
   to the day page, which still sits behind Access.

## Shared MCP library

There are three MCP servers in the repo today, each built differently:

- **calibre** (`apps/personal-calibre/src/app/api/mcp/route.ts`, re-exported at
  `src/app/mcp/route.ts`) builds an `McpServer` with a stateless
  `WebStandardStreamableHTTPServerTransport` on every request. Results are `JSON.stringify` text
  with no `structuredContent` and no `readOnlyHint`. There is no auth in the app. The only test
  (`route.test.ts`) covers one input schema.
- **website** (`apps/personal-website/src/mcp/{handler,catalog,profile}.ts`) uses `mcp-handler`,
  whose `basePath` must match the mount path exactly (see the comment in `handler.ts`).
  `catalog.ts` has the best piece: a `defineTool` whose single zod v4 shape feeds both MCP
  `registerTool` and the WebMCP JSON Schema, plus a `summarise`.
- **personal-portfolio** (`libs/personal-portfolio/src/mcp.ts`) exports
  `registerPortfolioMcp(server)`.

`libs/mcp-kit` is framework-free. It depends on `@modelcontextprotocol/sdk` ^1.29 (the version
the other three use) and zod v4. The website notes that the SDK's zod-compat layer accepts v4
schemas, and memories' `astro/zod` is v4. It exports:

```ts
createMcpFetchHandler(
  info: { name: string; version: string },
  register: (server: McpServer) => void,
  options?: { auth?: (request: Request) => AuthResult | Promise<AuthResult> },
): (request: Request) => Promise<Response>;

defineTool({ name, description, input /* zod shape */, output? /* zod shape */,
             annotations? /* readOnlyHint, idempotentHint, openWorldHint */, run });
registerTools(server, tools, { onCall? /* audit hook */ });
toJsonSchema(tool);                 // for WebMCP and llms.txt
toolResult(data);                   // text (JSON) + structuredContent
toolError(error);                   // ToolInputError → isError text; anything else → generic

gatewayAuth({ header: string; secret: string | undefined; userHeader?: string });
```

- `createMcpFetchHandler` uses stateless streamable HTTP and has no `basePath`, so the same
  handler mounts in a Next route (`export const POST = handler`) or an Astro endpoint. GET and
  DELETE return 405, and a rejected `auth` returns 401 before the SDK sees the request.
- `defineTool` keeps the website's per-call type inference. `run` returns plain data;
  `registerTools` wraps it with `toolResult` and maps thrown errors with `toolError`.
- `gatewayAuth` hashes both values with SHA-256 and compares them with `timingSafeEqual`, so
  the comparison takes the same time whatever the secret's length. With the secret unset it
  answers `disabled`, which the handler turns into a 404. When `userHeader` is set, it also
  returns that header's value for audit.

## Auto-import

### What the job does

`node apps/personal-memories/src/cli/auto-import.ts` runs these steps, in order:

1. **Lock.** It creates `<MEMORIES_DATA_DIR>/.ingest.lock` with `openSync(path, 'wx')` and writes
   `{pid, startedAt}` into it. A lock whose pid is dead (`process.kill(pid, 0)` throws) is
   stale and gets removed. `cli/ingest.ts` takes the same lock. If another ingest is running,
   the job exits 0 and logs `busy`, and the next trigger retries.
2. **LINE drop folder.** See [LINE](#line).
3. **Photos.** See [Photos](#photos).
4. **Ingest.** It runs the existing `ingest()` and `buildIndex()` from `cli/ingest.ts`, but only
   when an input changed since the last success. The input fingerprint is the path, size and
   mtime of every file under `line/`, plus `photos/index.json` and `people.json`. Ingest is
   already incremental where it costs time: it re-embeds only the docs whose `contentHash`
   changed. Rebuilding `timeline.json` in full takes seconds, so the timeline gets no
   incremental build.
5. **State.** It writes `<MEMORIES_DATA_DIR>/auto-import/state.json` atomically:
   `{ lastRunAt, lastSuccessAt, fingerprint, photos: { exportedAt, count }, line: { archived,
rejected } }`. The container mounts the data directory read-only, so it can read this file;
   `get_coverage` uses it to report freshness.

`--dry-run` prints the plan without moving or writing anything. `--only line|photos` runs one
source.

The ingest code imports only Node built-ins (`src/lib/ingest/*` and the files `cli/ingest.ts`
imports use relative paths, and `eslint.config.js` relaxes the alias rule there). So the host
needs only `node` ≥ 24 (type stripping and `import.meta.main`) and a checkout. It needs no
`pnpm install`.

### LINE

The drop folder defaults to `~/Library/Mobile Documents/com~apple~CloudDocs/Memories Inbox/`
and is set by `MEMORIES_DROP_DIR`. The owner exports a chat on the phone (匯出聊天記錄 → Save to
Files → iCloud Drive/Memories Inbox).

For each top-level entry in the drop folder, the job does the following:

- **iCloud placeholders.** A file that is still dataless (`stat -f %Sf` reports `dataless`) or
  an old-style `.<name>.icloud` stub gets `brctl download <path>` and is skipped this run. The
  file materialising changes the folder, `WatchPaths` fires, and the next run picks it up. The
  nightly run is the fallback. Setup also marks the folder "Keep Downloaded" so placeholders
  are rare.
- **Settle.** A file whose size or mtime changed within the last 10 s is skipped until the next
  run.
- **Validate.** The job parses the file with `parseLineChat`. A file is rejected when it is not
  `.txt`, lacks the `[LINE] Chat history with` header (a zh-TW export, say, which the parser
  does not support), or yields no events. A rejected file moves to `Memories Inbox/rejected/`
  with a `<name>.reason.txt` beside it, and the failure is reported.
- **Dedupe.** The job compares the SHA-256 of the bytes with `line/manifest.json` (hash → chat,
  saved-on date, event count, first and last date). A known hash is deleted from the inbox and
  logged as a duplicate.
- **Match the chat.** The `chatWith` from the header is compared with the manifest. Exactly one
  match uses that chat id. No match creates a new chat id `chat-<first 8 hex of
sha256(chatWith)>`. Several matches reject the file as ambiguous.
- **Archive.** The job copies the file to `line/<chat>/<saved-on YYYY-MM-DD>-<hash8>.txt` through
  a temp file and a rename, updates the manifest the same way, and then deletes it from the inbox.

`ingest` learns a second layout. Flat `line/<stem>.txt` files keep working (chat = stem), and
`line/<chat>/*.txt` holds several exports of one chat. Within a chat, exports are ordered by
their `Saved on` header, with mtime as the fallback. The newest export supplies every event from
its first date onward, and each older export supplies only the dates before the earliest date
already covered. Newest-wins ranges, rather than a union of event ids, handle three cases:
renamed authors (the id hashes the author), messages legitimately repeated in one minute (which
`mergeTimelines` would suffix), and exports cut short by a reinstall. On its first run the job
moves a legacy flat file into `line/<stem>/` with its stem as the chat id. `event.chat` and the
event ids stay the same, so stored annotations still attach.

Slack stays a manual, static source, and `ingest` keeps reading `slack/` as it does now.

### Photos

Photos are exported every night with the command from the README, run through `spawn` with no
shell:

```bash
uvx osxphotos@0.77.2 query --json --library "$MEMORIES_PHOTOS_LIBRARY" \
  --from-date "$MEMORIES_PHOTOS_FROM"
```

stdout streams to `photos/index.json.new`. The job promotes it with a rename only when osxphotos
exits 0, the file parses as a JSON array, and the item count is at least 90% of the previous
export's. A failed or shrunken export keeps the previous `index.json` and is reported. That
guard stops a broken export, or an iCloud library half-way through a sync, from emptying the
album. `MEMORIES_PHOTOS_FROM` is the same fixed start date the owner uses today, so every
night re-exports the whole window. That keeps favourites, deletions and labels in sync.

The current `index.json` is about 110 MB. The first slice times a full export from launchd. If
it takes more than 15 minutes, the job switches to exporting the last 30 days and merging them
into the previous index by uuid. The full window then runs weekly.

### Schedule, install and runtime

The homelab gets a `modules/memories-auto-import` that follows `modules/comfyui` (`local_file`
plist from a `.tftpl`, then `launchctl unload/load` in a `null_resource` keyed on the plist's
md5):

- Label `tools.rainforest.memories-auto-import`, in `~/Library/LaunchAgents/`.
- `ProgramArguments`: `/opt/homebrew/bin/node <runner>/apps/personal-memories/src/cli/auto-import.ts`.
- `StartCalendarInterval` 03:30, `WatchPaths` = the drop folder, `RunAtLoad` false,
  `ThrottleInterval` 60. launchd never starts a second instance of a running label. The job's
  own moves out of the inbox re-trigger it once, and that run finds nothing and exits.
- `EnvironmentVariables`: `PATH` (as in the comfyui plist), `HOME`, `MEMORIES_DATA_DIR`,
  `MEMORIES_DROP_DIR`, `MEMORIES_PHOTOS_LIBRARY`, `MEMORIES_PHOTOS_FROM`,
  `MEMORIES_OLLAMA_URL=http://localhost:11434`, `MEMORIES_IMPORT_WEBHOOK`.
- `StandardOutPath` and `StandardErrorPath` point to `~/Library/Logs/memories-auto-import/`.
- **Runner.** `<runner>` is a dedicated sparse clone of the monorepo at
  `~/.local/share/memories-runner`, checked out at `var.memories_runner_ref`, a commit SHA in
  `terraform.tfvars`. Terraform fetches and checks out that ref when it changes. The job never
  runs from the owner's working checkout, whose branch changes.
- **Full Disk Access.** osxphotos must read the Photos library from a launchd-started process,
  which does not inherit Terminal's grant. Setup grants FDA to the resolved `node` binary and
  to the uv-managed Python, then verifies with `--only photos` started through `launchctl
kickstart`. See Risks.

### Failure reporting

Every run appends to its log. A failed step, a rejected LINE file or a refused photos export
posts `{"event":"memories_import_failed","detail":"<step>: <reason>","ts":"…"}` to
`MEMORIES_IMPORT_WEBHOOK`. That is the n8n `ha-events` webhook, which `modules/backup-monitor`
already uses to file alerts into the daily note, reached from the host through n8n's LAN
address (`/webhook/ha-events`, set as a homelab variable). If the webhook cannot be reached, the job logs a
warning and still exits non-zero. Detail strings carry counts and file hashes, never chat names
or message text. A successful run posts nothing.

The host's files are not in Loki: `modules/grafana-alloy/alloy.river` tails Docker containers
only, so the daily note is the one channel. A dead-man alert for a job that stops running is a
follow-up (see Out of scope).

## Server reload

`getTimeline()` in `src/lib/server/store.ts` caches `timeline.json` for the life of the process
and retries only while the file is missing. The README's claim that the server "picks up the new
`timeline.json` on the next request, without a restart" is wrong today, and so is its people
note (`people-store.ts` also caches once).

- A new `src/lib/server/file-cache.ts` exports `cachedFile(path, load, { checkEveryMs: 5000 })`.
  On a call it `statSync`s the file at most once per interval and reloads when `mtimeMs` or
  `size` changes. A parse or validation error keeps the previous value and logs once per mtime,
  so a bad `people.json` cannot take the app down. `store.ts` and `people-store.ts` use it.
- Everything derived from the timeline is keyed by object identity, so a new timeline object
  invalidates it without extra code. That covers `indexDays`' `WeakMap`, the search index's
  `cached.timeline === state.timeline` check in `search-index.ts`, and the live collection in
  `live.config.ts`.
- `ingest()` writes `timeline.json` through `timeline.json.tmp` and a rename, as
  `search-files.ts` already does for the vectors, so the server never reads half a file.
- **Memory.** Today's `timeline.json` is 11 MB and `vectors.text.bin` is 39 MB. While the
  request that notices a change swaps the state, the old and new timelines and indexes are both
  live. That is a one-off peak, estimated at under 200 MB, against the container's 512Mi limit
  (`modules/personal-memories` default). Slice 2 measures RSS before, during and after a reload
  against a copy of the real data on the host. If the peak leaves less than 150 MB of headroom,
  the homelab raises `memory_limit` to 768Mi.
- The synchronous parse blocks the event loop for one request, about 100 ms, once per import.
  That is acceptable.

## MCP

### Route

`src/pages/mcp.ts` exports `POST = createMcpFetchHandler({ name: 'memories', version }, register,
{ auth: gatewayAuth({ header: 'x-memories-gateway', secret: env.MEMORIES_MCP_SECRET,
userHeader: 'x-forwarded-login' }) })`. Tools live in `src/lib/server/mcp/`, each a `defineTool`
over the same server functions the pages use (`getTimeline`, `indexDays`, `runSearch`,
`getPeople`/`publicPeople`, `notesStore`). They are pure over an injected state, so tests need
no server.

### Tools

All four tools carry `readOnlyHint: true` and `openWorldHint: false`. Dates are `YYYY-MM-DD`
in Asia/Taipei (`DATE_RE` from `src/lib/days.ts`). Sources are
`z.enum(['line', 'slack', 'photo', 'note'])`.

| Tool              | Input (zod)                                                                                                                                       | Output (`structuredContent`)                                                                                                                         | Limits                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `search_memories` | `query: string().trim().min(1).max(200)`, `from?`, `to?`, `people?: array(string).max(10)`, `sources?`, `limit: int().min(1).max(20).default(10)` | `{ results: [{ date, source, snippet, score }], semantic: 'on' \| 'off', reason?, stale? }`                                                          | `from`/`to` together, `from ≤ to`; 20 days max (`MAX_DAYS`)                               |
| `get_day`         | `date`, `sources?`, `cursor: int().min(0).default(0)`, `limit: int().min(1).max(200).default(100)`                                                | `{ date, counts, prev?, next?, url, events: [{ id, time, source, author, text?, photo? }], note?: { body, annotations }, nextCursor? }`              | message text clipped to 2,000 chars, note body to 8,000; unknown day → `prev`/`next` only |
| `list_people`     | `{}`                                                                                                                                              | `{ people: [{ id, name, aliases }], owner? }`                                                                                                        | none                                                                                      |
| `get_coverage`    | `from?`, `to?`, `by: enum(['month', 'day']).default('month')`                                                                                     | `{ firstDate, lastDate, generatedAt, lastImport?: { at, ok }, totals: { line, slack, photo, notes }, buckets: [{ key, line, slack, photo, note }] }` | `by: 'day'` needs a range of 366 days or fewer                                            |

- `search_memories` calls `runSearch` with the same index and embedder as `/search.json`,
  including note vectors, and inherits its lexical fallback and `reason` values. The agent
  resolves natural-language dates itself; the tool does not run `localParser`.
- In `get_day`, `author` is the display name resolved through people (`nameOf`), as the day
  stream shows it. `photo` is `{ labels, place, venues, people, text }`, with OCR text clipped
  to 500 chars, plus `mediaCount`. `url` is `${MEMORIES_PUBLIC_URL}/day/<date>`: the human can
  open it behind Access, and the agent cannot fetch it. `note.annotations` are
  `{ time, source, author, excerpt, by, text }`.
- `list_people` is `publicPeople(getPeople())`, the same as `/people.json`, which already
  leaves out emails.
- `get_coverage` reads `auto-import/state.json` for `lastImport`, so an agent can say how
  fresh the data is.

### Privacy

- Never returned: emails (`ConfiguredPerson.emails`), `media[].path` (absolute host paths and
  Slack export paths), `event.chat` (a LINE chat file stem, which can contain a real name),
  thumbnails and image bytes.
- A unit test JSON-stringifies every tool's output over the fixture and asserts it contains no
  `@`, no `/Users/` and no fixture chat stem.
- Tool names and descriptions contain no personal names. Everything returned does reach the
  agent's model provider, which owner decision 1 accepts; see the open question on consent.

### Audit

`registerTools`' `onCall` hook writes one JSON line to stdout per call:
`{ kind: 'mcp', ts, login, tool, from?, to?, date?, results, ms, ok }`. It never logs the query
text or any result content, because container stdout goes to Loki through
`loki.source.docker` in `modules/grafana-alloy/alloy.river`.

## Auth

### Calibre today

Calibre's MCP is reachable without going through the gateway:

- `locals.tf` publishes `personal-calibre-internal` with `enable_auth = false`, so it has no
  Access application. It is not marked `internal`, so `modules/cloudflare-tunnel` creates a
  proxied DNS record for it.
- The Worker (`workers/oauth-gateway/src/index.ts`) sends the backend `X-Forwarded-User`,
  `X-Forwarded-Login`, `X-GitHub-User` and the user's `X-GitHub-Token`. It sends no secret and
  no Access service token, and the calibre route checks nothing.

Anyone who learns the hostname can therefore call every calibre tool, including `add_tag` and
`remove_delivery`. The name is not secret: it is in the homelab Terraform and in the Worker
source. The Worker also hands each backend the user's GitHub token, which no backend needs.
Memories must not copy this setup. Calibre moves onto `gatewayAuth` in a follow-up slice.

### Memories

- **Worker.** A new hostname, `memories-mcp.rainforest.tools`, maps to
  `https://memories-mcp-internal.rainforest.tools`. For this backend the Worker sets
  `x-memories-gateway: <MEMORIES_GATEWAY_SECRET>` (a Wrangler secret) and forwards
  `X-Forwarded-Login`. It drops `X-GitHub-Token`, `X-GitHub-User` and `X-Forwarded-User` (the
  email). Memories is routed by hostname only, never through the `?backend=` fallback.
  `HOSTNAME_BACKENDS` becomes a per-backend config, `{ url, secretEnv?, forwardGithubToken }`.
  The GitHub allowlist (`ALLOWED_GITHUB_LOGINS = rainforest-dev`) and the `read:user` scope
  stay as they are. The MCP has no per-tool scopes, because it has no write tools.
- **App.** `/mcp` returns 404 while `MEMORIES_MCP_SECRET` is unset. That covers local dev and any
  deployment that has not opted in. A missing or wrong `x-memories-gateway` gets 401. An empty
  `X-Forwarded-Login` also gets 401, so every audited call has a login. This rejects requests
  arriving through the Access-gated `memories` hostname, through the internal hostname without
  the Worker, and directly on the LAN port.
- **Tunnel.** The `memories-mcp-internal` ingress rule matches path `^/mcp$` only, so the
  internal hostname exposes nothing else of the app (pages, `/media`, `/thumb`) without
  Access. `modules/cloudflare-tunnel` gains an optional `path` on each service for this.
- **Port binding.** The memories README says the homelab binds the published port to
  127.0.0.1, but `modules/personal-memories/main.tf` sets no `ip` on `ports`, so port 3004
  listens on every interface. The homelab slice adds `ip = "127.0.0.1"` and checks that
  cloudflared still reaches `host.docker.internal:3004`.
- **Later, defence in depth.** An Access application on `memories-mcp-internal` with a dedicated
  service token, which the Worker sends as `CF-Access-Client-Id`/`-Secret`. Cloudflare needs a
  Service Auth (`non_identity`) policy for service tokens, and the module's `email_policy` only
  creates `allow` policies, so this is a separate homelab change.

Clients connect at `https://memories-mcp.rainforest.tools/mcp`: as a custom connector on
claude.ai (which also covers the phone), or with `claude mcp add --transport http memories
https://memories-mcp.rainforest.tools/mcp` locally.

## Homelab changes

These go in a separate homelab PR, after the monorepo slices it depends on have shipped an image.

1. `modules/oauth-worker/main.tf`: add `cloudflare_workers_domain.memories_mcp_gateway` for
   `memories-mcp.${var.domain_suffix}`.
2. `workers/oauth-gateway/src/index.ts`: add the per-backend config and the memories backend as
   described above. Run `wrangler secret put MEMORIES_GATEWAY_SECRET` and redeploy.
3. `locals.tf`: add the `memories-mcp-internal` service (`service_url =
module.personal-memories[0].tunnel_service_url`, `enable_auth = false`, `path = "^/mcp$"`).
   `modules/cloudflare-tunnel` gains the optional `path`.
4. `modules/personal-memories`: add `ip = "127.0.0.1"` on `ports`, plus the env vars
   `MEMORIES_MCP_SECRET` (a sensitive variable holding the Worker secret's value) and
   `MEMORIES_PUBLIC_URL=https://memories.rainforest.tools`.
5. A new `modules/memories-auto-import`: plist template, runner clone, log directory and
   `launchctl` load, with variables for the drop folder, photos library, photos start date,
   webhook URL and `memories_runner_ref`.

## Testing

All tests use fixture data. Real names, chats and photos never appear in code, tests or PR
evidence, and every slice ends with the privacy grep from the owner's task notes over
`apps/personal-memories`, `apps/personal-memories-e2e` and `libs/mcp-kit`.

- **`libs/mcp-kit` (Vitest).** `createMcpFetchHandler` answers `initialize`, `tools/list` and
  `tools/call` over a `Request`, returns 405 on GET and 401 on an auth reject. `gatewayAuth`
  covers missing, wrong, right and unset secrets, with different-length secrets. `defineTool`
  input validation errors become `isError` results. `toJsonSchema` matches the website's current
  descriptors.
- **Auto-import units.** The LINE planner is pure: an inbox listing plus a manifest yield
  actions, for placeholder, settling, rejected, duplicate, new-chat, matched-chat and ambiguous
  files. The newest-wins merge covers overlapping exports, a truncated newer export, a renamed
  author and the legacy flat file. Also covered: a stale-pid lock, the photos count guard, and
  the input fingerprint.
- **Auto-import integration.** A temp data directory and a fake inbox hold the fixture LINE
  chat. `MEMORIES_PHOTOS_CMD` points at a script that prints the fixture photos JSON (or exits
  1, or prints a shrunken list), `MEMORIES_EMBED=fake`, and a local HTTP server captures the
  webhook posts.
- **Server reload.** `cachedFile` reloads on an mtime change, keeps the old value on a parse
  error, and respects the check interval (fake clock).
- **MCP tools.** Pure handlers over the fixture timeline cover the limits, clipping, an unknown
  day, `by: 'day'` past 366 days, and the privacy assertion.
- **E2E (Playwright).** The fixture server gains `MEMORIES_MCP_SECRET=test-secret`. A new
  `mcp.spec.ts` uses Playwright's `request` to POST JSON-RPC (`Accept: application/json,
text/event-stream`) and checks the following: 401 without the header; `tools/list` returns
  four tools, all marked read-only; `search_memories`「拉麵」 finds the ramen day through the fake
  embedder; `get_day` returns display names; and after a new `timeline.json` with an extra day
  is renamed into the fixture directory, `get_coverage` reports it within 5 s, with no restart.

## Rollout

There is one PR per slice. Slices 1 to 5 are in this monorepo; 6 and 7 are in the homelab.

1. `libs/mcp-kit`: handler, `defineTool`, result and error helpers, `gatewayAuth`.
2. Server reload: `file-cache.ts` for the timeline and people, the atomic `timeline.json`
   write, the RSS measurement, and the README fix.
3. Ingest lock and the per-chat LINE layout with the newest-wins merge.
4. `auto-import.ts`: drop folder, photos export with its guard, state file, webhook,
   `--dry-run`, and the timed full photos export.
5. The `/mcp` endpoint on `mcp-kit` with the four tools, the audit log and `mcp.spec.ts`.
   It depends on 1 and 2 and can land in parallel with 3 and 4.
6. Homelab: port binding, tunnel `path`, the internal hostname, the Worker backend and domain,
   and the MCP env vars. It ships after the image from slice 5.
7. Homelab: `modules/memories-auto-import`, after slice 4, then the FDA setup and a
   `launchctl kickstart` smoke run.

Follow-ups, not prerequisites:

8. Calibre onto `mcp-kit` and `gatewayAuth`, with the Worker sending it a secret and the
   `personal-calibre-internal` ingress restricted to its MCP path.
9. The website's `catalog.ts`/`handler.ts` onto `mcp-kit`, removing `mcp-handler` and its
   `basePath` constraint, with `personal-portfolio` registering through `registerTools`.
10. The Access service-token layer for the internal MCP hostnames.

## Out of scope

- Any write tool: notes, annotations, covers, people.
- Slack auto-import.
- Image content in MCP results. Thumbnails stay behind Access.
- A dead-man alert for a job that stops running. A later option: write
  `memories_import_last_success_timestamp_seconds` into the node_exporter textfile directory
  that `modules/docker-stats-metrics` already sets up, and alert in Grafana.

## Risks

- **Full Disk Access under launchd.** TCC attributes the Photos read to the binary launchd
  starts. If granting FDA to `node` and the uv Python is not enough, the job needs a small signed
  wrapper app holding the grant. Slice 7 proves this before anything else.
- **The shared secret is the only gate until the service-token layer lands.** It lives in
  Wrangler and in `terraform.tfvars`, never in either repo. Rotating it means a Wrangler secret
  update plus a container redeploy.
- **LINE export format drift.** A changed export is rejected and reported rather than parsed
  wrong. Nothing reaches the timeline until the parser handles it.
- **Memory.** The 512Mi limit may be tight during a reload as the photo count grows. Slice 2
  measures it.
- **Calibre's internal MCP** is open to anyone who knows its hostname until slice 8 lands.

## Open questions

1. Has the other person in the album agreed that their LINE messages, notes and annotations
   become readable by the owner's agents, and through them by the agents' model providers? If
   not, the MCP has to leave out their authored content, which changes `get_day` and
   `search_memories`.
2. Should a later version return small photo thumbnails as MCP image content so agents can see
   photos, or stay metadata-only for good?
