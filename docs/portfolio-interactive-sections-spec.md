# Portfolio Interactive Case Studies — Build Spec (Dex, Swap, OpenCGT)

> **STATUS — COMPLETE (2026-07-21).** All four case-study variants are built and verified in
> the Portfolio project's `CaseStudy.dc.html` (`project` prop = hoogii/dex/swap/opencgt):
> - **Hoogii** ✓ 5 sections (React/Tailwind/Mobx/Ably; Mnemonic phrase grid, messaging relay, etc.)
> - **Dex** ✓ 5 sections (Next.js 12/daisyUI; TableVirtuoso, MarketStore, react-popper, useAbly)
> - **Swap** ✓ 5 sections (Next.js 13/Radix/RTK; calcUserSwap log-AMM, createOffer, Zap, 4-env Helm, i18next — teal #00F8CB)
> - **OpenCGT** ✓ 5 sections (Next.js 14/Refine/MUI; getRolesFromJwt, CanAccess+middleware, Casbin, hybrid RSA-OAEP/AES E2EE, nx-affected — monochrome-blue #1976D2). **Carbon-credit copy corrected to cell & gene therapy.**
> All three new design systems (Dex/Swap/OpenCGT) generated from their real repos and verified.
> Remaining optional follow-ups: embed the Claude Design pages into apps/personal-website; a final
> reduced-motion audit; polish copy. The sections below are the original build spec (kept for reference).

This is the durable spec for a scheduled/autonomous run to CONTINUE building interactive
portfolio case studies in **Claude Design** (claude.ai/design). Hoogii (project 1) is
already built/building; this spec covers the remaining three: **Dex, HashgreenSwap, OpenCGT**.

## Objective

For each remaining project, build its portfolio case study as **FIVE distinct interactive
sections**, each cleanly separating: (a) a product **FEATURE**, (b) Rainforest's specific
**CONTRIBUTION** (a decision/ownership boundary, not a restatement), (c) a **TECH DETAIL**
(named real symbols), and (d) a hands-on **INTERACTION** — never the same interaction *kind*
twice within a project. Everything is cosmetic/client-side: no real backend, keys, crypto, or
network. Real metrics only (don't invent numbers). First-person, calm, precise, no emoji.
Honor prefers-reduced-motion.

## Key IDs / URLs

- **Portfolio project (build case studies here):** `0c5411d1-48e7-4514-aef9-9dab9d268b9b`
  → https://claude.ai/design/p/0c5411d1-48e7-4514-aef9-9dab9d268b9b
  Its `CaseStudy.dc.html` has a `project` prop enum (hoogii/dex/swap/opencgt). Build each
  project's 5 sections into its variant. **Do not touch other variants when editing one.**
- **rainforest.tools base design system:** `b6041f7f-6f56-4c79-bb21-a8f8555108ea`
- **Hoogii design system (already built from repo, reference pattern):** `c0f4c382-44ac-450e-8157-9da17161608e`
- **Dex design system (generating/built):** `5482724c-a6c2-4beb-a58e-981e7ee6f677`
- **Swap (Pyke) design system (generating/built):** `10a8ed1e-dca1-4af7-b934-ba2c1b422c71`
- **OpenCGT design system (generating/built):** `78001acd-f404-43d5-bd2d-f5a32cdd0d98`
- **Plan artifact (human-readable):** https://claude.ai/code/artifact/1db7a9d2-4450-4116-aa8e-dad4e8870091

## Per-project design systems (create like Hoogii's, then reference & rebuild inline)

The established pattern (from Hoogii): create a Claude Design *design system* from the real
repo (claude.ai/design → Design systems → Create design system → "Create here" → paste GitHub
repo URL + a blurb + notes), let it generate (~5 min), then in the Portfolio project reference
that design-system project URL in the composer and rebuild the case-study sections inline with
the project's brand tokens. GitHub is already connected in Claude Design (authed as
rainforest-dev). The user chose "rebuild demos inside the portfolio project" for integration.

Repos:
- **Dex:** `rainforest-dev/hashgreen-zed-frontend` — brand: primary #008C15 green, bid #19C08E, ask #FF4938, warning #FFB800; light+dark; daisyUI feel.
- **Swap:** `rainforest-dev/hashgreen-pyke-frontend` — brand: accent orange #FA892A / #FFB84D; dark-first; Radix UI.
- **OpenCGT:** `rainforest-dev/codegreen-monorepo` (focus `apps/opencgt`) — NO bespoke brand (stock Refine MUI blue). Give it a deliberate architecture-neutral monochrome-blue system so it looks intentional.

Priority: if generating all three design systems is too slow, you may build the case-study
sections referencing the repos directly (repo is higher fidelity than figma anyway). Do Dex
fully first, then Swap, then OpenCGT.

## CRITICAL CORRECTION — OpenCGT domain

OpenCGT is a **cell & gene therapy (CGT) supply-chain / treatment-orchestration admin
platform**, NOT a carbon-credit platform. Verified in the repo: `apps/opencgt/app/@authenticated/patients/[coi]`
(Chain-of-Identity), `@shipments` (material-card/product-card/shipment-card), `@schedule`,
`@auditLog`, a `@synopsis/@hospital` vs `@synopsis/@manufacturer` split, `capacity` mgmt, a
patient-enrollment wizard with an access-control step. **The existing OpenCGT case-study
variant currently says "carbon-credit" — FIX that to cell & gene therapy when you build it.**

---

## DEX — 5 sections (repo: hashgreen-zed-frontend; Next.js 12 pages, Tailwind+daisyUI, Mobx, Ably)

Theme across all five: "keeping a fast, correct UI on top of data that never stops moving."

1. **500+ CATs, one searchable list** — Feature: tabbed, fuzzy-searchable, virtualized market
   list (Favorites/All/tags/Others, star per row, last price). Contribution: led the frontend
   and owned this list; refused to trade rendering speed vs searchability, layered three
   independent mechanisms, each solving one axis; picked Fuse threshold 0.1 (short collision-prone
   tickers). Tech: `TableVirtuoso` mounts only on-screen rows; `MarketStore` uses
   `onBecomeObserved`/`onBecomeUnobserved` (fetch defers until observed); Fuse `threshold 0.1`
   over currency code/name. Interaction (search-with-scoring + live windowing counter): search
   with Fuse scores beside hits; switch tabs; star a row (persists); scroll and watch a
   "~15 of 512 rows mounted" counter stay flat. Mock: ~512 fabricated CAT markets, favorites in localStorage.
2. **Reading the book without acting on a ghost** — Feature: live bid/ask order book, click a
   level for an offer tooltip, collapse to one side. Contribution: owned an invariant — a trader
   must never act on a level that already moved; a stale tooltip over a replaced row is a
   first-class event that closes the popover. Tech: `react-popper` side-aware tooltip; a
   reconciliation `useEffect` keys each level by `key(market,price,amount,total)` and deselects
   when that key stops matching. Interaction (click-anchor + shuffle-to-invalidate): click a
   level → tooltip anchors; toggle collapse → placement flips; "shuffle the book" with a tooltip
   open → it auto-closes. Mock: generated bid/ask ladders around a mid-price.
3. **Fetch once, then stream** — Feature: market stats + trade-history tape loaded once then
   live, with a navbar connection dot. Contribution: built streaming as one reusable contract —
   every live surface hydrates the same way (one REST fetch, then one hook), each subscription
   tears down on unmount and re-subscribes on channel change. Tech: `useAbly({channelName,events,callback})`
   owns the lifecycle; `ablyIndicator` reads connection state. Interaction (live toggle + event
   log): flip "Live" → trades push into the tape, last-price flashes, dot animates connecting→live,
   with `subscribe()`/`unsubscribe()` printed; change market to swap channels. Mock: a trade generator + subscription log.
4. **One state machine, three wallets** — Feature: wallet connection across Goby/Hoogii/Chia +
   WalletConnect, resolving to a shortened address; navbar+book reshape when connected.
   Contribution: built it around one source of truth (`WalletStageEnum`) and modelled
   WalletConnect pairing as its own explicit stage (it can be rejected/time out — first-class
   states). Tech: a small machine (Unspecific→Initial→pairing→Connected) over Wallet classes;
   account exposes `shortenAddress`/`iconUrl`. Interaction (drive-a-state-diagram + trigger edge
   cases): a stage diagram lights the active node as you Connect→pick wallet→pairing→Connected;
   then fire "reject pairing" and "pairing timeout" to watch it hit the error stage instead of
   hanging. Mock: fabricated bech32 address, per-wallet icons, scripted transitions with latency.
5. **Patch one row, or refetch the page?** — Feature: user's order history — paginated,
   filterable by market/status/date, orders update live as fills arrive. Contribution: owned the
   sync strategy; the decision: when a live update lands, does it still belong on the current
   screen? Refetch only when it changes page membership; patch otherwise. Tech: a page-keyed
   cache fed by Ably channel = `auth.id`; each event runs `needRefetch()` = checkMarket &&
   checkStatus && checkDateRange, else `checkUserOrderCached()` swaps the row in place.
   Interaction (filter + simulate-fill with branch readout): set filters, "simulate a fill", a
   readout announces PATCH-IN-PLACE vs PAGE-REFETCH; narrow filter to "Active" and the same
   button flips branches. Mock: ~30 fabricated orders across pages/statuses.

## SWAP (Pyke) — 5 sections (repo: hashgreen-pyke-frontend; Next.js 13 app, Radix+Tailwind, Redux Toolkit)

Arc: the life of a trade, then how it ships.

1. **Swapping on a logarithmic curve** — Feature: type an amount, get a live quote (min received,
   price impact, fee), both exact-in and exact-out. Contribution: built the swap engine; ported
   Pyke's AMM pricing from the implementation paper into one pure function and wired both quote
   directions (exact-out inverts the same invariant). Tech: Pyke is NOT constant-product (x·y=k) —
   `calcUserSwap` in `utils/swap.ts` solves a log-space invariant with pool fee φ + safety margin
   ε (1e-5); price impact = |1 − actual/spot|. Interaction (type-and-recompute with live formula):
   type into "You pay"; "You receive" recomputes live (the real pure function runs client-side); a
   segmented control flips exact-in/out; a slippage control + "show the math" update rows.
   Mock: one hard-coded pool (reserveA XCH, reserveB, fee 300 bps); calcUserSwap runs client-side.
2. **Sign once, settle on-chain** — Feature: execute with no centralized order book — browser
   assembles a signed Chia offer, chain settles it, UI tracks to confirmation. Contribution:
   unified three wallet backends behind one `IWallet.createOffer` interface (Goby & Hoogii
   extensions + Chia over WalletConnect) so the app never knows which wallet signed; built the
   recent-tx tracker. Tech: a swap is a Chia "offer" signed with BLS keys in the wallet; CLVM
   puzzle reveals bundle client-side; the offer walks VALID→IN_MEMPOOL→ON_CHAIN (INVALID =
   failure). Interaction (connect/approve/poll state-machine): connect (Chia pops a mock
   WalletConnect QR); an approval sheet lists offered vs requested assets + fee; approve → a live
   tracker advances Pending→mempool→on-chain; a "view offer" toggle reveals the offer string.
   Mock: fabricated fingerprint/offer id/puzzle hash, a placeholder QR, scripted setTimeouts.
3. **One-sided liquidity, and the pool-share math** — Feature: Add Liquidity incl. Zap (deposit a
   single asset) with share-of-pool and LP-minted shown as you type. Contribution: built the
   liquidity forms, the paired-input hook (`useAssetInputPair`) locking two deposits to the pool
   ratio, and the Zap toggle collapsing them into one. Tech: balanced mode pins the other side via
   reserve ratio; Zap converts part of one asset before minting — which is why the backend counts
   `add_liquidity` and `add_liquidity_zap` as distinct tx types. Interaction (mode-morphing toggle
   with linked inputs): a toggle flips the panel — OFF two linked inputs auto-fill to hold ratio;
   ON it morphs to one input with a split animation; share-of-pool + LP received recompute live.
   Mock: same mock pool reserves as §1 (shared), a fabricated LP supply.
4. **Shipping it: one image, four environments** — Feature: one container image promoted through
   sandbox→UAT→staging→prod on Kubernetes, each with own config + autoscaling. Contribution: owned
   delivery — multi-stage Dockerfile shipping Next standalone as non-root, the Helm chart with
   per-env values, and the GitHub Actions that build/push/helm-upgrade. Tech: base→deps→builder→runner
   on node:20-alpine; an ARG selects `.env.{uat|stg|sandbox|prod}`; `output:'standalone'` keeps the
   image tiny; runner drops to uid-1001. Interaction (tab-swap config + animated pipeline): four
   env tabs live-swap a rendered `values.yaml` (image tag, replicas, ingress, HPA); a "Deploy"
   button animates build→push→helm upgrade→pods Ready with streaming logs; a replicas slider nudges
   the HPA range. Mock: fabricated image tags, per-env hostnames, scripted log lines.
   REAL METRIC available (verified in repo comments): TVL ~$780k, all-time volume ~$731k, ~21,494
   txns (swap 11,149 / add_liq 6,867 / zap 1,621 / remove 3,478). Use these real figures for Swap only.
5. **One library, three languages** — Feature: every page reuses the same primitives/tokens and
   the UI switches EN / Simplified / Traditional Chinese at runtime, no reload. Contribution: built
   the shared `@hashgreen/ui-libraries` package the app consumes, and wired `next-i18next` with a
   chained backend. Tech: `i18next-chained-backend` (localStorage first, HTTP second) with
   per-namespace JSON in `public/locales/{en,zh-CN,zh-TW}`; shared tokens live once in the package.
   Interaction (language + theme switcher re-rendering a real card): an EN/简/繁 control re-renders
   a real swap-summary card in place (labels, min-received, locale number formatting flip); a
   light/dark toggle recolours it from shared tokens. Mock: a small dictionary + a couple token values.

## OPENCGT — 5 sections (repo: codegreen-monorepo apps/opencgt; Next.js 14 + Refine + MUI; cell & gene therapy)

Arc: "who is allowed to see and do what?" from login down to the pipeline. Architecture-neutral
monochrome-blue (no brand). Correct the existing "carbon-credit" copy to cell & gene therapy.

1. **The front door: a token that already knows your role** — Feature: one "Log in" hands off to
   Auth0 and the app returns already knowing the org role (no separate permissions round-trip).
   Contribution: owned auth — the NextAuth+Auth0 config and the decision to read roles out of the
   access token in the jwt/session callbacks so components read role synchronously. Tech: Auth0's
   roles claim key isn't stable, so `getRolesFromJwt()` base64url-decodes the payload, finds the
   claim by scanning keys for "roles", then narrows to `RoleEnum` (hospital_admin, manufacturer_admin,
   root). Interaction (persona pick + JWT decode-and-reveal): pick a persona, click Log in; a
   three-hop animation plays, then a JWT visualizer flips from opaque to decoded, drawing a line
   from the namespaced roles claim to the extracted role. Mock: a structurally-real fabricated JWT.
2. **One deployment, two products** — Feature: hospital vs manufacturer staff sign into the same
   deployment but see materially different apps; a forbidden route returns a real 404, not a leak.
   Contribution: built the role-aware shell — every sidebar item wrapped in Refine `<CanAccess>` so
   nav is computed from policy, and middleware rewriting a disallowed route to /not-found server-side.
   Tech: gating in two places that must agree — client `CanAccess` + `middleware.ts` server rewrite;
   verified: a `@synopsis/@hospital` vs `@synopsis/@manufacturer` split. Interaction (persistent
   role toggle re-skins the shell): a hospital/manufacturer/root toggle re-renders the app shell
   with no reload — sidebar entries + action buttons appear/disappear; clicking a forbidden nav item
   animates a 404 rewrite. Mock: a static resource/menu map + per-role allow list + one patient row.
3. **The rule behind the gate: a Casbin playground** — Feature: authorization is one Casbin model
   evaluated the same on client and server, so any decision is explainable/auditable. Contribution:
   designed the dual-enforcement strategy — a local `casbin-core` enforcer answers common cases
   instantly; denials fall through to the remote authorizer with the full policy set. Tech: the
   matcher `g(r.sub,p.sub) && keyMatch(r.obj,p.obj) && (p.act=='*' || regexMatch(r.act,p.act))` —
   objects by path prefix, actions by regex, `*` a wildcard. Interaction (compose-and-enforce
   policy playground): compose subject/object/action from dropdowns, click Enforce, the matcher
   animates left→right to green ALLOW / red DENY; edit a policy row and re-run to watch it flip.
   Mock: the real model + two real policy rows + a few demo-only rows; client-side keyMatch/regexMatch.
4. **Encrypted before it leaves the browser** — Feature: during enrollment, patient PHI is
   encrypted in the browser and each org granted "phi" or "non-phi"; only the right private key can
   read it; server stores only ciphertext. Contribution: implemented the WebCrypto E2EE utils and
   the enrollment access-control step (the useFieldArray UI deciding who can decrypt what). Tech:
   hybrid, not plain RSA — body AES-CBC encrypted; the AES key+IV RSA-OAEP-2048 wrapped with the
   recipient's public key; keeps big records fast while binding read access to the private key.
   Interaction (type-encrypt-then-open-as-role): type a mock patient's details, add orgs with
   phi/non-phi each; "Encrypt & submit" animates generate-AES→encrypt→RSA-wrap; then "open as
   St. Mary's (phi)" decrypts fully vs a redacted non-phi view. Mock: fabricated patient + fake
   PEM keypair + canned encrypted blob; cosmetic animation, no crypto.subtle.
5. **Build only what changed** — Feature: one Nx pipeline that runs/ships only the projects a
   change touches — affected tests+builds on PR, then a signed image push + Helm rollout, guarded
   by role-scoped Playwright e2e and a k6 load test. Contribution: focused on parts closest to the
   app — wiring `nx affected` with tag exclusions, the container build configs, and both suites
   (Playwright logging in as each role, k6 ramping real VUs through the actual Auth0 login).
   Tech: driven by the Nx project graph, not a job list — `nx-set-shas` computes base/head, `nx
   affected` walks the graph; the k6 *browser* test drives the real Auth0 form under 100 ramping
   VUs asserting a 1.0 checks rate. Interaction (tick-changed-files + simulate-pipeline): tick which
   files "changed" + flip PR↔push-to-main; "Run pipeline" lights only affected nodes in a project-graph
   DAG and streams a matching CI log; a side panel replays the Playwright role matrix + a k6 VU-ramp
   chart. Mock: a hand-built project graph + per-file→affected lookup + canned timed log lines.

## Execution playbook (drive Claude Design via the browser)

Claude Design is a WEB app; drive it with the claude-in-chrome browser tools (the user's logged-in
session). For each project (Dex → Swap → OpenCGT in order):

1. (Optional, matches Hoogii) Create a design system from the repo: claude.ai/design → Design
   systems tab → "Create design system" → "Create here" → paste the GitHub repo URL + a one-line
   blurb + notes (brand colors, key features to demo) → Continue to generation → Generate (~5 min).
2. Open the Portfolio project (`0c5411d1-...`). Set the Tweaks `project` combobox to the target
   variant (dex/swap/opencgt). If you made a design system, paste its project URL into the composer
   to reference it. Then paste the 5-section spec for that project (from this file) with the same
   build conventions used for Hoogii (reusable section scaffold; feature/contribution/tech/interaction
   per section; distinct interaction kinds; brand takeover; cosmetic/mocked; honest disclosure;
   prefers-reduced-motion; first person). Instruct: keep other variants untouched; build all five;
   verify each interaction.
3. Wait for the build; verify via screenshots/DOM; step through interactions where possible.

CAVEATS:
- The Portfolio project's main chat is heavy (~150k tokens) and the renderer froze once mid-typing.
  Prefer starting a NEW chat in the Portfolio project per remaining project ("Start a new chat" keeps
  all files + carries a summary) to stay responsive. Send long instructions via the Send BUTTON, not
  Enter (Enter can insert a newline on long multi-line text).
- Claude Design generation runs server-side; you don't need to watch continuously, but you must keep
  the tab open and check back.
- Autonomous/unattended browser runs may hit permission prompts. If a tool is blocked, note it and
  continue what you can.

## When done / if interrupted

- Mark progress in the task tracker (TaskUpdate). Task #3 covers Dex/Swap/OpenCGT.
- If you finish all three, post a summary and (if this was a scheduled task) self-disable it.
- If you run out of usage or can't finish, leave things in a clean state and reschedule a fresh
  one-time fireAt ~5 hours ahead (get current time via `date`, add 5h, ISO 8601 with +08:00 offset).
  Do Dex first, then Swap, then OpenCGT — partial progress is fine and resumable.
