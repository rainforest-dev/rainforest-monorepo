# Setup: copyable commands, and both readings side by side

Task `T-20260902130202` (P2), from the `LoopObservatoryDesktop v2.dc.html`
Setup route. Follows `2026-09-02-overview-two-readings.md`, which built the
`readings` block this page's right-hand column consumes — the reason this task
was sequenced after it rather than wiring the same two files twice.

## What is wrong today

`SetupPanel.vue` shows one reading per host and calls it the state. It prints
`enrollment` and `telemetry` ages in a small `<dl>`, but the card's headline —
`stale`, `matches its declaration` — is derived from the enrollment report
alone. Overview now says both readings out loud and refuses to arbitrate; Setup
still quietly answers with the source that happens to be stale, which is how
"this machine is stale" and "this machine answered 4 minutes ago" ended up
printed on two pages about the same machine on the same afternoon.

The five command blocks are also read-only. Every one of them is a command a
person is meant to run on a *different* machine, and the only way to get one
there is to select it by hand out of a `<pre>` that scrolls horizontally.

## Acceptance criteria → where each lands

1. **Copy button per command block; label reads `copied` for ~1.6 s.**
2. **Enrolled hosts become two columns** — left: enrollment report (source,
   last sent, `15 min · nothing re-sends it`, why it cannot be trusted).
   Right: `The other reading of this machine` = quota snapshot (source,
   written, says).
3. **Right column ends with the conflict sentence and `see it on Overview →`**,
   landing on that machine's card.
4. **Actions: `Re-run ./enroll.sh`, `View last payload`.**
5. **Heading carries `enrollment report only · expires 15 min after it is sent`.**

## Decisions

**The steps stay as hand-written template markup.** The panel's own opening
paragraph promises `curl -fsSL .../setup` returns readable steps, so they must
survive with no JavaScript. A new `CommandBlock.vue` wraps the existing
`<pre><code>` in a slot and copies the node's `textContent` — the command text
is never duplicated into a JS array that could drift from what is rendered.

**Clipboard must not be assumed.** This app is served over plain `http` on a
tailnet IP, deliberately (a Cloudflare-fronted origin is unreachable from the
machine being enrolled). That is a non-secure context, so `navigator.clipboard`
is `undefined` in Chrome and Safari. The button falls back to a hidden
`textarea` + `document.execCommand('copy')`, and when *that* fails it says
`select it` rather than `copied`. A button that reports success it did not have
is the same defect as a page that reports health it never checked.

**`snapshotSays` is a pure function in `machineReadings.ts`, not inline.**
That module is `node:`-free precisely so a client island can import its runtime
values; `budget.ts` imports `node:fs` and can only be imported for types. The
sentence the right column prints — `alive · 10.0% of the 5-hour window left`,
or `alive · Claude figures stale · unknown` — is a rule about which readings
count, so it gets unit tests instead of a template expression.

**`Re-run ./enroll.sh` copies; it does not run.** This app cannot execute
anything on the machine the card describes — that machine is the one that has
not reported. Wiring the button to a local endpoint would enrol *this* host
under another host's name. It copies the command and labels itself so.

**`View last payload` renders `records[host].facts`.** `/api/enroll/hosts`
already returns `records` beside `views`; the panel currently drops it. No new
endpoint, and the payload shown is the exact one the age above it describes.

**Overview needs an anchor that survives a client-side fetch.** `MachinesPanel`
renders nothing at SSR because `OverviewDashboard` fetches on mount, so a
`/#machine-<name>` hash arrives before the target exists and the browser gives
up. Overview scrolls to the hash once cards are rendered.

## Verification

- Unit: `snapshotSays` over — no snapshot, snapshot with a live 5-hour window,
  snapshot whose windows have rolled over (unknown, not zero), snapshot with
  only Codex. Plus `snapshotFreshness` colour banding.
- Static: `nx lint loop-observatory`, `astro check`.
- Live: load `/setup` from a running dev server against the real vault; confirm
  both columns render from real files, copy works over plain http, and
  `see it on Overview →` lands on the machine's card.
