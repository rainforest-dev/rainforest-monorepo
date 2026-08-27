# Executor Self-Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A machine becomes a loop executor by talking to the Observatory instead of cloning the monorepo, and its configuration is derived from probed facts rather than hand-authored.

**Architecture:** One pure function, `derive(declaration, facts) → files`, with no I/O. The Observatory serves a probe list and a release artifact, accepts probed facts, and renders the derived result on a setup page. The device runs the probes, applies the files, and re-posts its facts periodically — the same call, which is what makes drift detection fall out of enrollment rather than being a second feature.

**Tech Stack:** TypeScript, Astro 6 SSR (`@astrojs/node`), Vue 3 islands, Vitest (node environment), plain-bash test scripts under `tools/loop/tests/`, GitHub Actions + `nx release`.

**Spec:** `docs/superpowers/specs/2026-08-27-executor-self-enrollment-design.md`

## Global Constraints

- **Nothing is enabled.** Every LaunchAgent is written in a disabled state. `install.sh` says "starting an unsupervised executor is a separate, explicit act"; self-enrollment inherits that exactly.
- **`derive()` is pure.** No `node:fs`, no `fetch`, no `Date.now()`, no `process.env`. Every input arrives as an argument. This is what lets the page and any future WebMCP surface share one implementation and never disagree.
- **Client islands import types only** from `src/lib/`. Those modules pull in `node:fs`/`node:path`; a runtime import drags them into the browser bundle. See the comment at `apps/loop-observatory/src/components/MachinesPanel.vue:9-12`.
- **Security defaults are declared, never probed.** The OTLP bind address comes from the declaration. No probe result may produce `0.0.0.0`.
- **No `--` inside generated XML comments.** XML forbids it. `plutil` accepts it and expat does not; the committed Air plist already trips this. Use `—` or `;` instead.
- **Facts are never committed.** `_system/usage/hosts.json` needs a `.gitignore` entry, and that directory ignores runtime files individually rather than by directory.
- **Credentials never reach the app.** Probes report what `claude` and `gh` resolved to; they never read or transmit a token.
- **Verify commands run from the repo root:** `/Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/bridge-cse_018kvTgteaeKiAJLZhFyUasn`.

## File Structure

| File                                                   | Responsibility                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `apps/loop-observatory/src/lib/enroll/types.ts`        | `HostDeclaration`, `HostFacts`, `DerivedFile`, `UnknownFact`                       |
| `apps/loop-observatory/src/lib/enroll/plist.ts`        | Serialise a plain object to a launchd plist string                                 |
| `apps/loop-observatory/src/lib/enroll/derive.ts`       | The pure derivation. Imports only `types.ts` and `plist.ts`                        |
| `apps/loop-observatory/src/lib/enroll/probes.ts`       | The versioned probe list, as data                                                  |
| `apps/loop-observatory/src/lib/enroll/store.ts`        | Reads/writes `_system/usage/hosts.json`. The only file here that touches `node:fs` |
| `apps/loop-observatory/src/pages/api/enroll/facts.ts`  | `POST` — accepts facts, records them                                               |
| `apps/loop-observatory/src/pages/api/enroll/probes.ts` | `GET` — serves the probe list                                                      |
| `apps/loop-observatory/src/pages/api/enroll/bundle.ts` | `GET` — serves the mounted release artifact                                        |
| `apps/loop-observatory/src/pages/setup.astro`          | The page                                                                           |
| `apps/loop-observatory/src/components/SetupPanel.vue`  | The island                                                                         |
| `.github/workflows/release-loop-engine.yml`            | Builds and publishes the artifact                                                  |

Tasks 1–5 deliver a tested generator that is useful on its own: it settles the migration gate before any endpoint exists. That is the natural review checkpoint.

---

### Task 1: The plist serialiser

**Files:**

- Create: `apps/loop-observatory/src/lib/enroll/plist.ts`
- Test: `apps/loop-observatory/src/lib/enroll/plist.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `toPlist(obj: PlistValue, comments?: Record<string, string>): string`, where `type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/loop-observatory/src/lib/enroll/plist.test.ts
import { describe, expect, it } from 'vitest';

import { toPlist } from './plist.js';

describe('toPlist', () => {
  it('emits a launchd plist plutil can parse', () => {
    const out = toPlist({
      Label: 'tools.rainforest.loop-ralph',
      ProgramArguments: ['/bin/sh', '-c', 'true'],
      RunAtLoad: true,
      StartInterval: 1800,
      EnvironmentVariables: { PATH: '/usr/bin:/bin' },
    });

    expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(out).toContain('<key>Label</key>');
    expect(out).toContain('<string>tools.rainforest.loop-ralph</string>');
    expect(out).toContain('<true/>');
    expect(out).toContain('<integer>1800</integer>');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('escapes XML metacharacters in values', () => {
    const out = toPlist({ Label: 'a & b <c>' });
    expect(out).toContain('<string>a &amp; b &lt;c&gt;</string>');
  });

  it('never emits a double hyphen inside a comment', () => {
    // XML forbids `--` in comments. plutil accepts it and expat refuses it, so a
    // generated plist containing one would parse only on Apple's parser — a
    // strictly worse artefact than the hand-written file it replaces. The
    // committed Air plist already has this defect.
    const out = toPlist(
      { Label: 'x' },
      { Label: 'probed 2026-08-25 -- DENIED here' },
    );
    const comments = out.match(/<!--[\s\S]*?-->/g) ?? [];
    expect(comments.length).toBeGreaterThan(0);
    for (const c of comments) {
      expect(c.slice(4, -3)).not.toContain('--');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/plist.test.ts`
Expected: FAIL — `Cannot find module './plist.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/plist.ts

/**
 * Serialise a plain object to a launchd plist.
 *
 * Hand-written by design rather than reached for from a library: the output is
 * compared against files macOS already loads, so controlling the exact shape
 * matters more than generality.
 */
export type PlistValue =
  | string
  | number
  | boolean
  | PlistValue[]
  | { [k: string]: PlistValue };

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESCAPES[c] ?? c);
}

/**
 * XML forbids `--` inside a comment. `plutil` accepts it anyway and Python's
 * expat refuses the whole file, which is exactly the state the committed
 * `Angibles-MacBook-Air.tools.rainforest.loop-ralph.plist` is in: it carries
 * `probed 2026-08-25 -- DENIED here`, loads fine under launchd, and cannot be
 * read by a standards-conforming parser. Generated files must not inherit that,
 * so the sequence is rewritten rather than rejected — a comment explaining a
 * decision is worth more than a build failure over punctuation.
 */
function safeComment(text: string): string {
  return text.replace(/--+/g, '—');
}

function render(value: PlistValue, indent: string): string {
  if (typeof value === 'string')
    return `${indent}<string>${esc(value)}</string>\n`;
  if (typeof value === 'boolean')
    return `${indent}${value ? '<true/>' : '<false/>'}\n`;
  if (typeof value === 'number')
    return `${indent}<integer>${value}</integer>\n`;
  if (Array.isArray(value)) {
    const inner = value.map((v) => render(v, `${indent}  `)).join('');
    return `${indent}<array>\n${inner}${indent}</array>\n`;
  }
  const inner = Object.entries(value)
    .map(
      ([k, v]) =>
        `${indent}  <key>${esc(k)}</key>\n${render(v, `${indent}  `)}`,
    )
    .join('');
  return `${indent}<dict>\n${inner}${indent}</dict>\n`;
}

export function toPlist(
  obj: PlistValue,
  comments: Record<string, string> = {},
): string {
  let body: string;
  if (!Array.isArray(obj) && typeof obj === 'object') {
    const inner = Object.entries(obj)
      .map(([k, v]) => {
        const note = comments[k]
          ? `  <!-- ${safeComment(comments[k])} -->\n`
          : '';
        return `${note}  <key>${esc(k)}</key>\n${render(v, '  ')}`;
      })
      .join('');
    body = `<dict>\n${inner}</dict>\n`;
  } else {
    body = render(obj, '');
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
    '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    `<plist version="1.0">\n${body}</plist>\n`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/plist.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/plist.ts apps/loop-observatory/src/lib/enroll/plist.test.ts
git commit -m "feat(observatory): plist serialiser that cannot emit invalid XML comments"
```

---

### Task 2: Types, and the ralph plist for a TCC-permitted host

**Files:**

- Create: `apps/loop-observatory/src/lib/enroll/types.ts`
- Create: `apps/loop-observatory/src/lib/enroll/derive.ts`
- Test: `apps/loop-observatory/src/lib/enroll/derive.test.ts`

**Interfaces:**

- Consumes: `toPlist` from Task 1
- Produces: `HostDeclaration`, `HostFacts`, `DerivedFile`, `UnknownFact`, and `deriveRalphPlist(d: HostDeclaration, f: HostFacts): DerivedFile`

- [ ] **Step 1: Write the failing test**

The expected values are the mini's live plist, read with `plutil -convert json`. This is the migration gate for the permitted branch.

```ts
// apps/loop-observatory/src/lib/enroll/derive.test.ts
import { describe, expect, it } from 'vitest';

import { deriveRalphPlist } from './derive.js';
import type { HostDeclaration, HostFacts } from './types.js';

export const MINI_DECL: HostDeclaration = {
  host: 'rainforest-mini',
  home: '/Users/rainforest',
  roles: ['engine', 'ralph', 'observatory', 'loop-sync', 'usage-hourly'],
  scope: 'personal',
  otlpBind: '0.0.0.0',
  intervalSeconds: 1800,
};

export const MINI_FACTS: HostFacts = {
  tccICloud: 'permitted',
  executors: ['claude', 'agy'],
  brewPrefix: '/opt/homebrew',
  otlpListening: true,
  vaultPath:
    '/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian',
  accounts: { claudePlan: 'max', ghLogin: 'rainforest-dev' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

describe('deriveRalphPlist, TCC permitted', () => {
  it('runs ralph.sh directly', () => {
    const file = deriveRalphPlist(MINI_DECL, MINI_FACTS);
    expect(file.path).toBe(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(file.contents).toContain(
      '<string>/Users/rainforest/.claude/loop/ralph.sh</string>',
    );
    expect(file.contents).not.toContain('osascript');
  });

  it('names the machine by its host, not a short alias', () => {
    // The live plist carries LOOP_MACHINE=mini while LocalHostName is
    // rainforest-mini, and its own comment admits the absolute LOOP_QUOTA_FILE
    // exists to route around that split. `mini` was simply wrong: the vault file
    // is quota.rainforest-mini.json. Consistent generation removes the split and
    // the workaround's reason for existing.
    const out = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents;
    expect(out).toContain('<string>rainforest-mini</string>');
    expect(out).not.toContain('<string>mini</string>');
  });

  it('sets LOOP_QUOTA_FILE when quota lives in the vault', () => {
    // ralph.sh:314 defaults to ~/.local/share/loop-usage-runtime/..., which is
    // the Air's layout. A host reading the vault directly needs the override
    // regardless of what LOOP_MACHINE says, so this is derived from vaultPath,
    // not from the machine name.
    const out = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents;
    expect(out).toContain(
      `${MINI_FACTS.vaultPath}/_system/usage/quota.rainforest-mini.json`,
    );
  });

  it('carries the probed executors', () => {
    expect(deriveRalphPlist(MINI_DECL, MINI_FACTS).contents).toContain(
      '<string>claude,agy</string>',
    );
  });

  it('puts the brew prefix on PATH', () => {
    expect(deriveRalphPlist(MINI_DECL, MINI_FACTS).contents).toContain(
      '/opt/homebrew/bin',
    );
  });

  it('does not bake iteration parameters into ProgramArguments', () => {
    // `ralph.sh 1 10` in the live plist is policy; it belongs in config.yaml.
    const args = deriveRalphPlist(MINI_DECL, MINI_FACTS).contents.split(
      '</array>',
    )[0];
    expect(args).not.toContain('<string>1</string>');
    expect(args).not.toContain('<string>10</string>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: FAIL — `Cannot find module './derive.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/types.ts

/** What the owner declares about a host. Version-controlled, never probed. */
export interface HostDeclaration {
  host: string;
  home: string;
  roles: string[];
  scope: 'personal' | 'work';
  /**
   * Declared, never derived from a probe. Whether a machine opens a port to the
   * network must not be a side effect of what a probe happened to find. The mini
   * binds wide because its Alloy also serves a Docker bridge; a laptop that
   * joins untrusted networks must not.
   */
  otlpBind: '127.0.0.1' | '0.0.0.0';
  intervalSeconds: number;
}

/** What the device reports about itself. Re-read every run, never stored as truth. */
export interface HostFacts {
  tccICloud: 'permitted' | 'denied' | 'unknown';
  executors: string[];
  brewPrefix: string;
  otlpListening: boolean;
  vaultPath: string | null;
  accounts: { claudePlan: string | null; ghLogin: string | null };
  probedAt: string;
}

export interface DerivedFile {
  /** Relative to the host's home directory. */
  path: string;
  contents: string;
}

/**
 * Thrown when derivation would have to guess. Guessing is how `vault_path()`
 * silently published a machine's entire run record to a retired clone.
 */
export class UnknownFact extends Error {
  constructor(readonly fact: string) {
    super(`cannot derive while ${fact} is unknown`);
    this.name = 'UnknownFact';
  }
}
```

```ts
// apps/loop-observatory/src/lib/enroll/derive.ts
import { toPlist, type PlistValue } from './plist.js';
import {
  type DerivedFile,
  type HostDeclaration,
  type HostFacts,
  UnknownFact,
} from './types.js';

const RALPH_LABEL = 'tools.rainforest.loop-ralph';

function loopHome(d: HostDeclaration): string {
  return `${d.home}/.claude/loop`;
}

function quotaFile(d: HostDeclaration, f: HostFacts): string | null {
  // ralph.sh:314 defaults to $HOME/.local/share/loop-usage-runtime/..., which is
  // the layout of a host that keeps a runtime copy because launchd there cannot
  // read iCloud. A host reading the vault directly needs an explicit path, and
  // that is a property of where its quota lives, not of its name.
  if (!f.vaultPath) return null;
  return `${f.vaultPath}/_system/usage/quota.${d.host}.json`;
}

export function deriveRalphPlist(
  d: HostDeclaration,
  f: HostFacts,
): DerivedFile {
  if (f.tccICloud === 'unknown') throw new UnknownFact('tccICloud');

  const env: Record<string, string> = {
    PATH: `${d.home}/.local/bin:${f.brewPrefix}/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  };
  const body: Record<string, PlistValue> = {
    Label: RALPH_LABEL,
    ProgramArguments: [`${loopHome(d)}/ralph.sh`],
    EnvironmentVariables: env,
    RunAtLoad: true,
    StartInterval: d.intervalSeconds,
    ThrottleInterval: 60,
    StandardOutPath: `${loopHome(d)}/ralph.log`,
    StandardErrorPath: `${loopHome(d)}/ralph.err.log`,
  };

  env.LOOP_MACHINE = d.host;
  if (f.executors.length > 0) env.LOOP_EXECUTORS = f.executors.join(',');
  const quota = quotaFile(d, f);
  if (quota) env.LOOP_QUOTA_FILE = quota;
  if (f.vaultPath)
    env.LOOP_AGENT_CONFIG = `${f.vaultPath}/_system/usage/loop-agents.json`;

  return {
    path: `Library/LaunchAgents/${RALPH_LABEL}.plist`,
    contents: toPlist(body),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/types.ts apps/loop-observatory/src/lib/enroll/derive.ts apps/loop-observatory/src/lib/enroll/derive.test.ts
git commit -m "feat(observatory): derive the ralph plist for a TCC-permitted host"
```

---

### Task 3: The TCC-denied branch

**Files:**

- Modify: `apps/loop-observatory/src/lib/enroll/derive.ts`
- Test: `apps/loop-observatory/src/lib/enroll/derive.test.ts` (append)

**Interfaces:**

- Consumes: `deriveRalphPlist` from Task 2
- Produces: no new exports; `deriveRalphPlist` gains the denied branch

- [ ] **Step 1: Write the failing test**

Expected values are the Air's live plist, read with `plutil -convert json`: `ProgramArguments` is `osascript` plus the AppleScript, and `EnvironmentVariables` is `PATH` alone.

```ts
// append to apps/loop-observatory/src/lib/enroll/derive.test.ts
const AIR_DECL: HostDeclaration = {
  host: 'Angibles-MacBook-Air',
  home: '/Users/rainforest',
  roles: [
    'engine',
    'ralph',
    'relay-pull',
    'usage-hourly',
    'usage-publish',
    'telemetry-sink',
  ],
  scope: 'work',
  otlpBind: '127.0.0.1',
  intervalSeconds: 1800,
};

const AIR_FACTS: HostFacts = {
  tccICloud: 'denied',
  executors: ['claude', 'codex'],
  brewPrefix: '/opt/homebrew',
  otlpListening: true,
  vaultPath: null,
  accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

describe('deriveRalphPlist, TCC denied', () => {
  it('runs ralph through the GUI shim', () => {
    // launchd on this host cannot read ~/Library/Mobile Documents, and both
    // projects it runs read out of the vault. osascript re-enters the logged-in
    // GUI session, which holds the grant.
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<string>/usr/bin/osascript</string>');
    expect(out).toContain(
      '<string>/Users/rainforest/.claude/loop/run-ralph-gui.applescript</string>',
    );
    expect(out).not.toContain('/ralph.sh');
  });

  it('carries only PATH, because the rest moves into the AppleScript', () => {
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<key>PATH</key>');
    expect(out).not.toContain('LOOP_EXECUTORS');
    expect(out).not.toContain('LOOP_MACHINE');
  });

  it('omits LOOP_QUOTA_FILE when there is no readable vault', () => {
    // ralph.sh:314's default is this host's own runtime layout, so the override
    // would be redundant here.
    expect(deriveRalphPlist(AIR_DECL, AIR_FACTS).contents).not.toContain(
      'LOOP_QUOTA_FILE',
    );
  });

  it('still emits the same label and log paths as the permitted branch', () => {
    const out = deriveRalphPlist(AIR_DECL, AIR_FACTS).contents;
    expect(out).toContain('<string>tools.rainforest.loop-ralph</string>');
    expect(out).toContain('/Users/rainforest/.claude/loop/ralph.err.log');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: FAIL — the first test finds `/ralph.sh` because the denied branch does not exist yet

- [ ] **Step 3: Write minimal implementation**

Replace the body of `deriveRalphPlist` after the `UnknownFact` guard:

```ts
export function deriveRalphPlist(
  d: HostDeclaration,
  f: HostFacts,
): DerivedFile {
  if (f.tccICloud === 'unknown') throw new UnknownFact('tccICloud');

  const denied = f.tccICloud === 'denied';

  // On a host whose launchd cannot read the vault, the loop's environment moves
  // into run-ralph-gui.applescript, which re-enters the logged-in GUI session
  // where the grant exists. Only PATH stays here, for osascript itself. The
  // script ships with the engine role, so this branch needs no extra install.
  const env: Record<string, string> = denied
    ? { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }
    : {
        PATH: `${d.home}/.local/bin:${f.brewPrefix}/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
      };

  const body: Record<string, PlistValue> = {
    Label: RALPH_LABEL,
    ProgramArguments: denied
      ? ['/usr/bin/osascript', `${loopHome(d)}/run-ralph-gui.applescript`]
      : [`${loopHome(d)}/ralph.sh`],
    EnvironmentVariables: env,
    RunAtLoad: true,
    StartInterval: d.intervalSeconds,
    ThrottleInterval: 60,
    StandardOutPath: `${loopHome(d)}/ralph.log`,
    StandardErrorPath: `${loopHome(d)}/ralph.err.log`,
  };

  if (!denied) {
    env.LOOP_MACHINE = d.host;
    if (f.executors.length > 0) env.LOOP_EXECUTORS = f.executors.join(',');
    const quota = quotaFile(d, f);
    if (quota) env.LOOP_QUOTA_FILE = quota;
    if (f.vaultPath)
      env.LOOP_AGENT_CONFIG = `${f.vaultPath}/_system/usage/loop-agents.json`;
  }

  return {
    path: `Library/LaunchAgents/${RALPH_LABEL}.plist`,
    contents: toPlist(body),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/derive.ts apps/loop-observatory/src/lib/enroll/derive.test.ts
git commit -m "feat(observatory): derive the GUI-shim ralph plist for a TCC-denied host"
```

---

### Task 4: Refuse to derive from an unknown fact

**Files:**

- Modify: `apps/loop-observatory/src/lib/enroll/derive.ts`
- Test: `apps/loop-observatory/src/lib/enroll/derive.test.ts` (append)

**Interfaces:**

- Consumes: `UnknownFact` from Task 2
- Produces: no new exports

- [ ] **Step 1: Write the failing test**

```ts
// append to apps/loop-observatory/src/lib/enroll/derive.test.ts
import { UnknownFact } from './types.js';

describe('unknown facts refuse rather than default', () => {
  it('refuses when the TCC probe did not run', () => {
    expect(() =>
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, tccICloud: 'unknown' }),
    ).toThrow(UnknownFact);
  });

  it('names the fact that is missing', () => {
    // A failure that says only "cannot derive" is no better than the silent
    // default it replaces.
    try {
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, tccICloud: 'unknown' });
      throw new Error('expected UnknownFact');
    } catch (e) {
      expect((e as UnknownFact).fact).toBe('tccICloud');
      expect((e as Error).message).toContain('tccICloud');
    }
  });

  it('refuses when the brew prefix is empty', () => {
    // An empty prefix would silently produce PATH entries like "/bin/bin".
    expect(() =>
      deriveRalphPlist(MINI_DECL, { ...MINI_FACTS, brewPrefix: '' }),
    ).toThrow(UnknownFact);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: FAIL on the third test — an empty `brewPrefix` currently produces `/bin` silently

- [ ] **Step 3: Write minimal implementation**

Add after the existing `tccICloud` guard in `deriveRalphPlist`:

```ts
// Only checked on the branch that uses it: the denied branch's PATH is a fixed
// system list, so an absent Homebrew is not a missing fact there.
if (f.tccICloud !== 'denied' && !f.brewPrefix)
  throw new UnknownFact('brewPrefix');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/derive.ts apps/loop-observatory/src/lib/enroll/derive.test.ts
git commit -m "feat(observatory): refuse to derive from an unknown fact"
```

---

### Task 5: Alloy config, and the declared-not-probed bind rule

**Files:**

- Modify: `apps/loop-observatory/src/lib/enroll/derive.ts`
- Test: `apps/loop-observatory/src/lib/enroll/derive.test.ts` (append)

**Interfaces:**

- Consumes: `HostDeclaration`, `HostFacts`, `DerivedFile`
- Produces: `deriveAlloyConfig(d: HostDeclaration, f: HostFacts): DerivedFile | null`, and `derive(d: HostDeclaration, f: HostFacts): DerivedFile[]`

- [ ] **Step 1: Write the failing test**

```ts
// append to apps/loop-observatory/src/lib/enroll/derive.test.ts
import { derive, deriveAlloyConfig } from './derive.js';

describe('deriveAlloyConfig', () => {
  it('declares an OTLP receiver on the declared bind address', () => {
    const file = deriveAlloyConfig(AIR_DECL, AIR_FACTS);
    expect(file?.path).toBe('.config/dev-telemetry/alloy/config.alloy');
    expect(file?.contents).toContain('otelcol.receiver.otlp');
    expect(file?.contents).toContain('endpoint = "127.0.0.1:4318"');
  });

  it('forwards both metrics and logs', () => {
    // ralph exports both. A metrics-only path silently drops half of what it
    // measures, and the drop is invisible: the OTel SDK does not complain.
    const out = deriveAlloyConfig(AIR_DECL, AIR_FACTS)?.contents ?? '';
    expect(out).toContain('otelcol.exporter.prometheus');
    expect(out).toContain('otelcol.exporter.loki');
  });

  it('binds wide only when the declaration says so', () => {
    const wide =
      deriveAlloyConfig({ ...AIR_DECL, otlpBind: '0.0.0.0' }, AIR_FACTS)
        ?.contents ?? '';
    expect(wide).toContain('endpoint = "0.0.0.0:4318"');
  });

  it('no combination of facts can produce a wide bind', () => {
    // Security defaults are declared, never derived. Whether a machine opens a
    // port to the network must not be a side effect of what a probe found.
    const variants: HostFacts[] = [
      { ...AIR_FACTS, otlpListening: false },
      { ...AIR_FACTS, executors: [] },
      { ...AIR_FACTS, vaultPath: '/somewhere' },
      { ...AIR_FACTS, accounts: { claudePlan: null, ghLogin: null } },
    ];
    for (const f of variants) {
      const code = (deriveAlloyConfig(AIR_DECL, f)?.contents ?? '').replace(
        /\/\/.*$/gm,
        '',
      );
      expect(code).not.toContain('0.0.0.0');
    }
  });

  it('is omitted for a host without the telemetry-sink role', () => {
    // The mini's sink is the homelab's containerised Alloy, provisioned by
    // terraform. The role names the requirement; the absence names the exception.
    expect(deriveAlloyConfig(MINI_DECL, MINI_FACTS)).toBeNull();
  });
});

describe('derive', () => {
  it('returns every file a host needs, and only those', () => {
    const air = derive(AIR_DECL, AIR_FACTS).map((f) => f.path);
    expect(air).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(air).toContain('.config/dev-telemetry/alloy/config.alloy');

    const mini = derive(MINI_DECL, MINI_FACTS).map((f) => f.path);
    expect(mini).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
    expect(mini).not.toContain('.config/dev-telemetry/alloy/config.alloy');
  });

  it('is deterministic', () => {
    const a = JSON.stringify(derive(AIR_DECL, AIR_FACTS));
    const b = JSON.stringify(derive(AIR_DECL, AIR_FACTS));
    expect(a).toBe(b);
  });

  it('emits no credential-shaped string', () => {
    const all = derive(AIR_DECL, AIR_FACTS)
      .map((f) => f.contents)
      .join('\n');
    expect(all).not.toMatch(
      /sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: FAIL — `deriveAlloyConfig is not a function`

- [ ] **Step 3: Write minimal implementation**

Append to `derive.ts`:

```ts
/**
 * The OTLP intake this executor's own telemetry lands in.
 *
 * `ralph.sh:78` defaults OTLP_ENDPOINT to http://localhost:4318 and injects the
 * exporter env into every `claude -p` it launches. Nothing checks that anything
 * is listening, and the OTel SDK does not complain when nothing is — so a
 * machine can be a healthy executor and throw away everything it measures.
 * Measured 2026-08-26: that was the Air's entire history.
 *
 * Returns null for a host without the role. The mini is the exception that
 * explains the shape: its sink is the homelab's containerised Alloy, already
 * receiving on 4317/4318.
 */
export function deriveAlloyConfig(
  d: HostDeclaration,
  f: HostFacts,
): DerivedFile | null {
  if (!d.roles.includes('telemetry-sink')) return null;
  if (f.tccICloud === 'unknown') throw new UnknownFact('tccICloud');

  const contents = `// Generated by Loop Observatory enrollment. Do not edit by hand;
// re-enroll instead. Inputs: this host's declaration and its probed facts.
//
// Bound to ${d.otlpBind}, which is declared rather than probed: whether this
// machine opens a port to the network must not be a side effect of what a probe
// happened to find.

otelcol.receiver.otlp "agents" {
  http {
    endpoint = "${d.otlpBind}:4318"
  }

  output {
    metrics = [otelcol.processor.batch.agents.input]
    logs    = [otelcol.processor.batch.agents.input]
  }
}

otelcol.processor.batch "agents" {
  timeout = "2s"

  output {
    metrics = [otelcol.exporter.prometheus.agents.input]
    logs    = [otelcol.exporter.loki.agents.input]
  }
}

otelcol.exporter.prometheus "agents" {
  forward_to = [prometheus.remote_write.rpi.receiver]
}

otelcol.exporter.loki "agents" {
  forward_to = [loki.write.rpi.receiver]
}
`;
  return { path: '.config/dev-telemetry/alloy/config.alloy', contents };
}

/** Every file this host needs. Pure: the only entry point callers should use. */
export function derive(d: HostDeclaration, f: HostFacts): DerivedFile[] {
  const files: DerivedFile[] = [];
  if (d.roles.includes('ralph')) files.push(deriveRalphPlist(d, f));
  const alloy = deriveAlloyConfig(d, f);
  if (alloy) files.push(alloy);
  return files;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/derive.test.ts`
Expected: PASS, 21 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/derive.ts apps/loop-observatory/src/lib/enroll/derive.test.ts
git commit -m "feat(observatory): derive the Alloy OTLP sink, with the bind address declared not probed"
```

---

### Task 6: The versioned probe list

**Files:**

- Create: `apps/loop-observatory/src/lib/enroll/probes.ts`
- Create: `apps/loop-observatory/src/pages/api/enroll/probes.ts`
- Test: `apps/loop-observatory/src/lib/enroll/probes.test.ts`

**Interfaces:**

- Consumes: `HostFacts` from Task 2
- Produces: `PROBE_VERSION: number`, `PROBES: Probe[]`, `type Probe = { id: keyof HostFacts; why: string; shell: string }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/loop-observatory/src/lib/enroll/probes.test.ts
import { describe, expect, it } from 'vitest';

import { PROBES, PROBE_VERSION } from './probes.js';
import type { HostFacts } from './types.js';

describe('probe list', () => {
  it('covers every fact derivation consumes', () => {
    // The device is a dumb executor of this list. A fact derivation needs and
    // the list does not gather becomes an UnknownFact at derive time, which is
    // a refusal the owner has to diagnose.
    const needed: (keyof HostFacts)[] = [
      'tccICloud',
      'executors',
      'brewPrefix',
      'otlpListening',
      'vaultPath',
      'accounts',
    ];
    const covered = PROBES.map((p) => p.id);
    for (const n of needed) expect(covered).toContain(n);
  });

  it('explains why each probe exists', () => {
    // A probe with no stated reason is one nobody can safely delete later.
    for (const p of PROBES) expect(p.why.length).toBeGreaterThan(20);
  });

  it('reads no credential', () => {
    // Probes report what `claude` and `gh` resolved to; they never read a token.
    for (const p of PROBES) {
      expect(p.shell).not.toMatch(
        /auth token|--show-token|cat .*token|\.credentials/,
      );
    }
  });

  it('is versioned, so a device can tell the list changed', () => {
    expect(PROBE_VERSION).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/probes.test.ts`
Expected: FAIL — `Cannot find module './probes.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/probes.ts
import type { HostFacts } from './types.js';

export interface Probe {
  id: keyof HostFacts;
  why: string;
  shell: string;
}

/**
 * Bumped whenever the list changes. The device fetches this list rather than
 * embedding it, so adding a derivation input later means adding a probe here and
 * every machine picks it up on its next run — nothing on the machine updates.
 */
export const PROBE_VERSION = 1;

export const PROBES: Probe[] = [
  {
    id: 'tccICloud',
    why: 'Whether launchd on this host may read ~/Library/Mobile Documents. Decides whether ralph runs directly or through the GUI shim. Measured 2026-08-25: denied on the Air, permitted on the mini.',
    shell:
      'if [ -r "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian" ]; then echo permitted; else echo denied; fi',
  },
  {
    id: 'executors',
    why: 'Which agents exist here, for LOOP_EXECUTORS. Absent ones must not be listed or ralph will try to launch a binary that is not there.',
    shell:
      'for b in claude codex agy; do command -v "$b" >/dev/null 2>&1 && printf "%s\\n" "$b"; done',
  },
  {
    id: 'brewPrefix',
    why: 'Apple silicon uses /opt/homebrew and Intel uses /usr/local. Wrong prefix means a PATH that resolves nothing.',
    shell: 'brew --prefix 2>/dev/null || echo ""',
  },
  {
    id: 'otlpListening',
    why: "Whether anything accepts the OTLP ralph exports. False for the Air's entire life, which is the whole of why it never emitted a single claude_code metric.",
    shell:
      'nc -z -G 2 127.0.0.1 4318 >/dev/null 2>&1 && echo true || echo false',
  },
  {
    id: 'vaultPath',
    why: 'Where the vault is, if this host can read it. Decides LOOP_QUOTA_FILE, because ralph.sh:314 defaults to a runtime layout only one host has.',
    shell:
      'p="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"; [ -d "$p" ] && printf "%s" "$p" || printf ""',
  },
  {
    id: 'accounts',
    why: 'Which accounts claude and gh resolved to. Never a token — this is what lets the app catch a company machine logged into a personal account without seeing any credential.',
    shell:
      'printf "%s|%s" "$(claude --version >/dev/null 2>&1 && echo ok || echo missing)" "$(gh api user --jq .login 2>/dev/null || echo unknown)"',
  },
];
```

```ts
// apps/loop-observatory/src/pages/api/enroll/probes.ts
import type { APIRoute } from 'astro';

import { PROBES, PROBE_VERSION } from '../../../lib/enroll/probes.js';

export const GET: APIRoute = () =>
  Response.json({ version: PROBE_VERSION, probes: PROBES });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/probes.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/probes.ts apps/loop-observatory/src/lib/enroll/probes.test.ts apps/loop-observatory/src/pages/api/enroll/probes.ts
git commit -m "feat(observatory): serve a versioned probe list"
```

---

### Task 7: Device records, and the gitignore entry that decision 6 depends on

**Files:**

- Create: `apps/loop-observatory/src/lib/enroll/store.ts`
- Test: `apps/loop-observatory/src/lib/enroll/store.test.ts`
- Modify: the vault's `.gitignore` (not in this repo — see Step 5)

**Interfaces:**

- Consumes: `HostDeclaration`, `HostFacts`, `usageDir` from `../ledger.js`
- Produces: `readHosts(): HostRecordMap`, `recordFacts(host: string, facts: HostFacts, now: number): void`, `type HostRecord = { declaration: HostDeclaration | null; facts: HostFacts | null; reportedAt: number | null }`, `type HostRecordMap = Record<string, HostRecord>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/loop-observatory/src/lib/enroll/store.test.ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { hostsPath, readHosts, recordFacts } from './store.js';
import type { HostFacts } from './types.js';

const FACTS: HostFacts = {
  tccICloud: 'denied',
  executors: ['claude'],
  brewPrefix: '/opt/homebrew',
  otlpListening: false,
  vaultPath: null,
  accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
  probedAt: '2026-08-27T06:00:00.000Z',
};

function withUsageDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'enroll-'));
  vi.stubEnv('VAULT_PATH', dir);
  return join(dir, '_system', 'usage');
}

afterEach(() => vi.unstubAllEnvs());

describe('device records', () => {
  it('returns an empty map before anything has enrolled', () => {
    withUsageDir();
    expect(readHosts()).toEqual({});
  });

  it('records facts under the host name', () => {
    withUsageDir();
    recordFacts('Angibles-MacBook-Air', FACTS, 1_787_000_000_000);
    const hosts = readHosts();
    expect(hosts['Angibles-MacBook-Air']?.facts?.tccICloud).toBe('denied');
    expect(hosts['Angibles-MacBook-Air']?.reportedAt).toBe(1_787_000_000_000);
  });

  it('overwrites the previous facts rather than appending', () => {
    // Facts are re-read every run and are never a history. A stale entry kept
    // beside a fresh one is the snapshot-that-lies this design removes.
    withUsageDir();
    recordFacts('h', FACTS, 1);
    recordFacts('h', { ...FACTS, otlpListening: true }, 2);
    expect(readHosts()['h']?.facts?.otlpListening).toBe(true);
    expect(readHosts()['h']?.reportedAt).toBe(2);
  });

  it('survives a malformed file rather than throwing', () => {
    const usage = withUsageDir();
    writeFileSync(hostsPath(), '{not json');
    expect(readHosts()).toEqual({});
    expect(usage).toBeTruthy();
  });

  it('writes atomically', () => {
    // A reader must never see a half-written record. Same reason the usage
    // bridge publishes by rename.
    withUsageDir();
    recordFacts('h', FACTS, 1);
    expect(() => JSON.parse(readFileSync(hostsPath(), 'utf-8'))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/store.test.ts`
Expected: FAIL — `Cannot find module './store.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/store.ts
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from '../ledger.js';
import type { HostDeclaration, HostFacts } from './types.js';

export interface HostRecord {
  declaration: HostDeclaration | null;
  facts: HostFacts | null;
  reportedAt: number | null;
}

export type HostRecordMap = Record<string, HostRecord>;

export function hostsPath(): string {
  return join(usageDir(), 'hosts.json');
}

/**
 * Device records. Rebuilt by re-enrolling, never a source of truth — which is
 * why this file must stay out of git. `_system/usage/` ignores runtime files
 * individually rather than by directory (its own comment reads "Config files
 * (model-rates.json, task-map.json) stay committed"), so hosts.json inherits
 * nothing and needs its own entry.
 */
export function readHosts(): HostRecordMap {
  try {
    const parsed: unknown = JSON.parse(readFileSync(hostsPath(), 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return parsed as HostRecordMap;
  } catch {
    return {};
  }
}

export function recordFacts(host: string, facts: HostFacts, now: number): void {
  const hosts = readHosts();
  hosts[host] = {
    ...(hosts[host] ?? { declaration: null }),
    facts,
    reportedAt: now,
  };
  const dir = usageDir();
  mkdirSync(dir, { recursive: true });
  // Write beside, then rename: a reader must never see a half-written record.
  const tmp = join(dir, `.hosts.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(hosts, null, 2)}\n`);
  renameSync(tmp, hostsPath());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/store.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Add the gitignore entry and commit**

The vault is a separate repository at `$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian`. Append to its `.gitignore`, beside the other runtime entries:

```bash
cat >> "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/.gitignore" <<'EOF'

# Device records: written by enrollment, rebuilt by re-enrolling. Never a source
# of truth -- a committed copy would go stale while nothing checked it.
_system/usage/hosts.json
EOF

cd "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"
git check-ignore -v _system/usage/hosts.json   # must print the new rule
git add .gitignore && git commit -m "chore: ignore enrollment device records"
cd -

git add apps/loop-observatory/src/lib/enroll/store.ts apps/loop-observatory/src/lib/enroll/store.test.ts
git commit -m "feat(observatory): record device facts outside git"
```

---

### Task 8: POST /api/enroll/facts

**Files:**

- Create: `apps/loop-observatory/src/pages/api/enroll/facts.ts`
- Create: `apps/loop-observatory/src/lib/enroll/parse.ts`
- Test: `apps/loop-observatory/src/lib/enroll/parse.test.ts`

**Interfaces:**

- Consumes: `HostFacts` from Task 2, `recordFacts` from Task 7
- Produces: `parseFactsBody(raw: unknown): { host: string; facts: HostFacts } | null`

- [ ] **Step 1: Write the failing test**

```ts
// apps/loop-observatory/src/lib/enroll/parse.test.ts
import { describe, expect, it } from 'vitest';

import { parseFactsBody } from './parse.js';

const BODY = {
  host: 'Angibles-MacBook-Air',
  facts: {
    tccICloud: 'denied',
    executors: ['claude', 'codex'],
    brewPrefix: '/opt/homebrew',
    otlpListening: true,
    vaultPath: null,
    accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
    probedAt: '2026-08-27T06:00:00.000Z',
  },
};

describe('parseFactsBody', () => {
  it('accepts a well-formed report', () => {
    expect(parseFactsBody(BODY)?.host).toBe('Angibles-MacBook-Air');
  });

  it('rejects a host name that is not a plain hostname', () => {
    // The host name reaches a filesystem key. Anything that could traverse or
    // collide is refused rather than sanitised.
    for (const host of ['../etc', 'a/b', '', 'x'.repeat(200), 'a b']) {
      expect(parseFactsBody({ ...BODY, host })).toBeNull();
    }
  });

  it('rejects an unknown tcc value rather than coercing it', () => {
    expect(
      parseFactsBody({ ...BODY, facts: { ...BODY.facts, tccICloud: 'maybe' } }),
    ).toBeNull();
  });

  it('drops fields it does not know', () => {
    // The endpoint accepts facts, not decisions. A body carrying `roles` must
    // not be able to declare anything.
    const parsed = parseFactsBody({
      ...BODY,
      roles: ['ralph'],
      facts: BODY.facts,
    });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {})).toEqual(['host', 'facts']);
  });

  it('rejects a non-object body', () => {
    for (const raw of [null, 'x', 42, []])
      expect(parseFactsBody(raw)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/parse.test.ts`
Expected: FAIL — `Cannot find module './parse.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/parse.ts
import type { HostFacts } from './types.js';

/** A plain hostname. The value becomes a key in a JSON file and a display label. */
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const TCC = new Set(['permitted', 'denied', 'unknown']);

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

/**
 * Parse a device's report.
 *
 * Accepts facts and nothing else. Submitting facts must not be able to change
 * what a host is declared to be — derivation is pure and application happens on
 * the device, so this endpoint records an observation rather than a decision.
 * Unknown keys are dropped rather than passed through, so a body carrying
 * `roles` cannot declare anything.
 */
export function parseFactsBody(
  raw: unknown,
): { host: string; facts: HostFacts } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const host = body.host;
  if (typeof host !== 'string' || !SAFE_HOST.test(host)) return null;

  const f = body.facts;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const src = f as Record<string, unknown>;

  const executors = strArray(src.executors);
  const acc = src.accounts;
  if (
    typeof src.tccICloud !== 'string' ||
    !TCC.has(src.tccICloud) ||
    executors === null ||
    typeof src.brewPrefix !== 'string' ||
    typeof src.otlpListening !== 'boolean' ||
    (src.vaultPath !== null && typeof src.vaultPath !== 'string') ||
    !acc ||
    typeof acc !== 'object' ||
    typeof src.probedAt !== 'string'
  ) {
    return null;
  }
  const a = acc as Record<string, unknown>;

  return {
    host,
    facts: {
      tccICloud: src.tccICloud as HostFacts['tccICloud'],
      executors,
      brewPrefix: src.brewPrefix,
      otlpListening: src.otlpListening,
      vaultPath: (src.vaultPath as string | null) ?? null,
      accounts: {
        claudePlan: typeof a.claudePlan === 'string' ? a.claudePlan : null,
        ghLogin: typeof a.ghLogin === 'string' ? a.ghLogin : null,
      },
      probedAt: src.probedAt,
    },
  };
}
```

```ts
// apps/loop-observatory/src/pages/api/enroll/facts.ts
import type { APIRoute } from 'astro';

import { parseFactsBody } from '../../../lib/enroll/parse.js';
import { recordFacts } from '../../../lib/enroll/store.js';

export const POST: APIRoute = async ({ request }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response('invalid JSON', { status: 400 });
  }
  const parsed = parseFactsBody(raw);
  if (!parsed) return new Response('invalid facts', { status: 400 });

  recordFacts(parsed.host, parsed.facts, Date.now());
  return Response.json({ recorded: parsed.host });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/parse.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/parse.ts apps/loop-observatory/src/lib/enroll/parse.test.ts apps/loop-observatory/src/pages/api/enroll/facts.ts
git commit -m "feat(observatory): accept device facts, and nothing else"
```

---

### Task 9: Drift — declared versus actual

**Files:**

- Create: `apps/loop-observatory/src/lib/enroll/drift.ts`
- Test: `apps/loop-observatory/src/lib/enroll/drift.test.ts`

**Interfaces:**

- Consumes: `HostRecord` from Task 7, `HostFacts`/`HostDeclaration` from Task 2
- Produces: `driftFor(record: HostRecord, now: number): Drift[]`, `type Drift = { kind: 'stale' | 'role-unsatisfied' | 'account-mismatch'; detail: string }`, `STALE_AFTER_MS: number`

- [ ] **Step 1: Write the failing test**

```ts
// apps/loop-observatory/src/lib/enroll/drift.test.ts
import { describe, expect, it } from 'vitest';

import { STALE_AFTER_MS, driftFor } from './drift.js';
import type { HostRecord } from './store.js';

const NOW = 1_787_000_000_000;

const AIR: HostRecord = {
  declaration: {
    host: 'Angibles-MacBook-Air',
    home: '/Users/rainforest',
    roles: ['engine', 'ralph', 'telemetry-sink'],
    scope: 'work',
    otlpBind: '127.0.0.1',
    intervalSeconds: 1800,
  },
  facts: {
    tccICloud: 'denied',
    executors: ['claude'],
    brewPrefix: '/opt/homebrew',
    otlpListening: true,
    vaultPath: null,
    accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
    probedAt: '2026-08-27T06:00:00.000Z',
  },
  reportedAt: NOW - 60_000,
};

describe('driftFor', () => {
  it('reports nothing when declared and actual agree', () => {
    expect(driftFor(AIR, NOW)).toEqual([]);
  });

  it('reports a declared role the machine cannot satisfy', () => {
    // This is the whole product. The Air declared telemetry-sink and had nothing
    // listening on 4318 for its entire life; that single boolean is the reason it
    // never emitted a claude_code metric.
    const d = driftFor(
      { ...AIR, facts: { ...AIR.facts!, otlpListening: false } },
      NOW,
    );
    expect(d.map((x) => x.kind)).toContain('role-unsatisfied');
    expect(d[0]?.detail).toContain('4318');
  });

  it('reports stale rather than showing the last known good state', () => {
    const d = driftFor({ ...AIR, reportedAt: NOW - STALE_AFTER_MS - 1 }, NOW);
    expect(d.map((x) => x.kind)).toContain('stale');
  });

  it('reports a work machine on a personal account', () => {
    const d = driftFor(
      {
        ...AIR,
        facts: {
          ...AIR.facts!,
          accounts: { claudePlan: 'max', ghLogin: 'rainforest-dev' },
        },
      },
      NOW,
    );
    expect(d.map((x) => x.kind)).toContain('account-mismatch');
  });

  it('reports stale for a host that has never reported', () => {
    expect(
      driftFor({ ...AIR, facts: null, reportedAt: null }, NOW).map(
        (x) => x.kind,
      ),
    ).toContain('stale');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/drift.test.ts`
Expected: FAIL — `Cannot find module './drift.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/drift.ts
import type { HostRecord } from './store.js';

export interface Drift {
  kind: 'stale' | 'role-unsatisfied' | 'account-mismatch';
  detail: string;
}

/** Three device report cycles. Beyond it the host reads stale, not last-known-good. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * What a host declares against what it reports.
 *
 * This is the reader every failure on 2026-08-26 lacked: in each one a writer
 * succeeded and nothing checked the result.
 */
export function driftFor(record: HostRecord, now: number): Drift[] {
  const out: Drift[] = [];
  const { declaration: d, facts: f, reportedAt } = record;

  if (!f || reportedAt === null || now - reportedAt > STALE_AFTER_MS) {
    out.push({
      kind: 'stale',
      detail:
        reportedAt === null
          ? 'never reported'
          : `last reported ${now - reportedAt}ms ago`,
    });
    return out;
  }
  if (!d) return out;

  if (d.roles.includes('telemetry-sink') && !f.otlpListening) {
    out.push({
      kind: 'role-unsatisfied',
      detail:
        'telemetry-sink declared, but nothing is listening on 4318 — ralph exports into a closed socket and the OTel SDK does not complain',
    });
  }
  if (
    d.scope === 'work' &&
    f.accounts.ghLogin &&
    !f.accounts.ghLogin.endsWith('-angible')
  ) {
    out.push({
      kind: 'account-mismatch',
      detail: `work machine resolved gh to ${f.accounts.ghLogin}`,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/drift.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/drift.ts apps/loop-observatory/src/lib/enroll/drift.test.ts
git commit -m "feat(observatory): report declared-versus-actual drift"
```

---

### Task 10: The loop-engine release artifact

**Files:**

- Create: `.github/workflows/release-loop-engine.yml`
- Create: `apps/loop-observatory/src/pages/api/enroll/bundle.ts`
- Test: `tools/loop/tests/engine-bundle.sh`

**Interfaces:**

- Consumes: nothing
- Produces: a `loop-engine-<version>.tar.gz` GitHub Release asset; `GET /api/enroll/bundle` serving `LOOP_ENGINE_BUNDLE`

- [ ] **Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
# tools/loop/tests/engine-bundle.sh
#
# The bundle is what a machine installs, so what it contains is what an executor
# becomes. A bundle missing loopctl produces a host that enrolls and cannot run.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
bash "$ROOT/pack-engine.sh" "$TMP/bundle.tar.gz" >/dev/null 2>&1
check "pack-engine.sh produces an archive" "$([ -s "$TMP/bundle.tar.gz" ] && echo yes || echo no)" "yes"

tar -tzf "$TMP/bundle.tar.gz" > "$TMP/list" 2>/dev/null
for f in engine/ralph.sh engine/loopctl engine/contract.md hosts.yaml install.sh; do
  check "carries $f" "$(grep -c "^$f\$" "$TMP/list")" "1"
done

# The bundle is served over the tailnet and unpacked by a machine. A tarball that
# can write outside its extraction root is a remote file overwrite.
check "no absolute paths"  "$(grep -c '^/' "$TMP/list")" "0"
check "no parent traversal" "$(grep -c '\.\./' "$TMP/list")" "0"

# Runtime state is per-machine and must not ride along.
check "no greenlight state" "$(grep -c 'greenlight/' "$TMP/list")" "0"
check "no config.yaml"      "$(grep -c 'config\.yaml$' "$TMP/list")" "0"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `chmod +x tools/loop/tests/engine-bundle.sh && ./tools/loop/tests/engine-bundle.sh`
Expected: FAIL — `pack-engine.sh` does not exist, so every check fails

- [ ] **Step 3: Write minimal implementation**

```bash
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
  engine hosts.yaml install.sh telemetry usage relay
```

```ts
// apps/loop-observatory/src/pages/api/enroll/bundle.ts
import { createReadStream, statSync } from 'node:fs';
import type { APIRoute } from 'astro';

/**
 * Serve the mounted release artifact.
 *
 * The app serves a build product, never its own working tree: the mini's
 * worktree carries uncommitted changes routinely, and "what code is on the
 * executor" must be a released version rather than whatever a folder happened
 * to contain. The same artifact is on GitHub Releases if this host is down.
 */
export const GET: APIRoute = () => {
  const path = process.env.LOOP_ENGINE_BUNDLE;
  if (!path)
    return new Response('LOOP_ENGINE_BUNDLE is not configured', {
      status: 503,
    });
  try {
    const size = statSync(path).size;
    return new Response(createReadStream(path) as unknown as ReadableStream, {
      headers: {
        'content-type': 'application/gzip',
        'content-length': String(size),
        'content-disposition': 'attachment; filename="loop-engine.tar.gz"',
      },
    });
  } catch {
    return new Response('bundle not readable', { status: 503 });
  }
};
```

```yaml
# .github/workflows/release-loop-engine.yml
name: Release loop-engine

# Follows release-personal-calibre.yml: automatic on push to main when the
# engine changes, publishing a GitHub Release asset. No registry account and no
# package semantics — the maintenance overhead that ruled out an npm package.
on:
  push:
    branches: [main]
    paths:
      - 'tools/loop/**'
      - '.github/workflows/release-loop-engine.yml'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Verify the bundle's contents
        run: ./tools/loop/tests/engine-bundle.sh
      - name: Build
        id: build
        run: |
          version="$(date -u +%Y.%m.%d)-${GITHUB_SHA::7}"
          echo "version=$version" >> "$GITHUB_OUTPUT"
          ./tools/loop/pack-engine.sh "loop-engine-$version.tar.gz"
          shasum -a 256 "loop-engine-$version.tar.gz" > "loop-engine-$version.tar.gz.sha256"
      - name: Publish
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "loop-engine-${{ steps.build.outputs.version }}" \
            --title "loop-engine ${{ steps.build.outputs.version }}" \
            --notes "Engine bundle for executor enrollment. Built from ${GITHUB_SHA}." \
            "loop-engine-${{ steps.build.outputs.version }}.tar.gz" \
            "loop-engine-${{ steps.build.outputs.version }}.tar.gz.sha256"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x tools/loop/pack-engine.sh && ./tools/loop/tests/engine-bundle.sh`
Expected: PASS, 10 assertions

- [ ] **Step 5: Commit**

```bash
git add tools/loop/pack-engine.sh tools/loop/tests/engine-bundle.sh .github/workflows/release-loop-engine.yml apps/loop-observatory/src/pages/api/enroll/bundle.ts
git commit -m "feat(loop): build and serve the engine bundle a machine installs"
```

---

### Task 11: The setup page

**Files:**

- Create: `apps/loop-observatory/src/pages/setup.astro`
- Create: `apps/loop-observatory/src/components/SetupPanel.vue`
- Create: `apps/loop-observatory/src/pages/api/enroll/hosts.ts`
- Modify: `apps/loop-observatory/src/layouts/Layout.astro:7,16-19`

**Interfaces:**

- Consumes: `readHosts` (Task 7), `driftFor` (Task 9), `derive` (Task 5), `PROBES` (Task 6)
- Produces: `GET /api/enroll/hosts` returning `{ hosts: Record<string, { record: HostRecord; drift: Drift[]; files: DerivedFile[] }> }`

- [ ] **Step 1: Write the failing test**

There are no component tests in this app — `vitest.config.ts` is `environment: 'node'` with `include: ['src/**/*.test.ts']`. Test the route's data shaping in `lib`, which is where it belongs anyway.

```ts
// apps/loop-observatory/src/lib/enroll/view.test.ts
import { describe, expect, it } from 'vitest';

import { buildHostViews } from './view.js';
import type { HostRecordMap } from './store.js';

const NOW = 1_787_000_000_000;

const RECORDS: HostRecordMap = {
  'Angibles-MacBook-Air': {
    declaration: {
      host: 'Angibles-MacBook-Air',
      home: '/Users/rainforest',
      roles: ['engine', 'ralph', 'telemetry-sink'],
      scope: 'work',
      otlpBind: '127.0.0.1',
      intervalSeconds: 1800,
    },
    facts: {
      tccICloud: 'denied',
      executors: ['claude'],
      brewPrefix: '/opt/homebrew',
      otlpListening: false,
      vaultPath: null,
      accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
    reportedAt: NOW - 60_000,
  },
};

describe('buildHostViews', () => {
  it('pairs each host with its drift and derived files', () => {
    const views = buildHostViews(RECORDS, NOW);
    const air = views['Angibles-MacBook-Air'];
    expect(air?.drift.map((d) => d.kind)).toContain('role-unsatisfied');
    expect(air?.files.map((f) => f.path)).toContain(
      'Library/LaunchAgents/tools.rainforest.loop-ralph.plist',
    );
  });

  it('surfaces a refusal instead of throwing the page away', () => {
    // One host whose probe did not run must not blank the whole view.
    const broken: HostRecordMap = {
      ...RECORDS,
      bad: {
        ...RECORDS['Angibles-MacBook-Air']!,
        facts: {
          ...RECORDS['Angibles-MacBook-Air']!.facts!,
          tccICloud: 'unknown',
        },
      },
    };
    const views = buildHostViews(broken, NOW);
    expect(views['bad']?.files).toEqual([]);
    expect(views['bad']?.error).toContain('tccICloud');
    expect(views['Angibles-MacBook-Air']?.files.length).toBeGreaterThan(0);
  });

  it('yields no files for a host that has never reported', () => {
    const views = buildHostViews(
      { fresh: { declaration: null, facts: null, reportedAt: null } },
      NOW,
    );
    expect(views['fresh']?.files).toEqual([]);
    expect(views['fresh']?.drift.map((d) => d.kind)).toContain('stale');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test loop-observatory -- src/lib/enroll/view.test.ts`
Expected: FAIL — `Cannot find module './view.js'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/loop-observatory/src/lib/enroll/view.ts
import { derive } from './derive.js';
import { driftFor, type Drift } from './drift.js';
import type { HostRecordMap } from './store.js';
import type { DerivedFile } from './types.js';

export interface HostView {
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
}

/**
 * Pair every host with its drift and its derived files.
 *
 * A host whose derivation refuses shows the refusal; it does not blank the page.
 * One machine with a probe that did not run must not hide the others.
 */
export function buildHostViews(
  records: HostRecordMap,
  now: number,
): Record<string, HostView> {
  const out: Record<string, HostView> = {};
  for (const [host, record] of Object.entries(records)) {
    const drift = driftFor(record, now);
    if (!record.declaration || !record.facts) {
      out[host] = { drift, files: [], error: null };
      continue;
    }
    try {
      out[host] = {
        drift,
        files: derive(record.declaration, record.facts),
        error: null,
      };
    } catch (e) {
      out[host] = { drift, files: [], error: (e as Error).message };
    }
  }
  return out;
}
```

```ts
// apps/loop-observatory/src/pages/api/enroll/hosts.ts
import type { APIRoute } from 'astro';

import { readHosts } from '../../../lib/enroll/store.js';
import { buildHostViews } from '../../../lib/enroll/view.js';

export const GET: APIRoute = () => {
  const records = readHosts();
  return Response.json({ records, views: buildHostViews(records, Date.now()) });
};
```

```astro
---
// apps/loop-observatory/src/pages/setup.astro
import SetupPanel from '../components/SetupPanel.vue';
import Layout from '../layouts/Layout.astro';
---

<Layout title="Loop Observatory — Setup" active="setup">
  <SetupPanel client:load />
</Layout>
```

```vue
<!-- apps/loop-observatory/src/components/SetupPanel.vue -->
<script setup lang="ts">
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from lib/enroll would drag its node:fs deps into the browser bundle.
import { onMounted, ref } from 'vue';

import type { Drift } from '../lib/enroll/drift';
import type { DerivedFile } from '../lib/enroll/types';

interface HostView {
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
}

const views = ref<Record<string, HostView>>({});
const loading = ref(true);

onMounted(async () => {
  const res = await fetch('/api/enroll/hosts');
  views.value = (await res.json()).views ?? {};
  loading.value = false;
});
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="rounded-lg border p-4">
      <h2 class="font-medium">Before you start</h2>
      <ol class="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>Join this machine to the tailnet.</li>
        <li>
          Sign in: <code>claude login</code> and <code>gh auth login</code>.
        </li>
        <li>
          Then run, on the machine being enrolled:
          <pre
            class="bg-muted mt-1 overflow-x-auto rounded p-2"
          ><code>curl -fsSL http://100.86.67.66:3099/api/enroll/bundle | tar xz
./install.sh --enroll --app http://100.86.67.66:3099</code></pre>
        </li>
      </ol>
      <p class="text-muted-foreground mt-2 text-sm">
        Nothing is enabled by enrolling. Every LaunchAgent is written disabled;
        starting an unsupervised executor stays a separate, explicit act.
      </p>
    </div>

    <p v-if="loading" class="text-muted-foreground text-sm">Loading…</p>
    <div
      v-for="(view, host) in views"
      :key="host"
      class="rounded-lg border p-4"
    >
      <h3 class="font-medium">{{ host }}</h3>
      <p v-if="view.error" class="text-sm text-amber-600">{{ view.error }}</p>
      <ul
        v-if="view.drift.length"
        class="mt-2 space-y-1 text-sm text-amber-600"
      >
        <li v-for="d in view.drift" :key="d.kind + d.detail">
          {{ d.kind }}: {{ d.detail }}
        </li>
      </ul>
      <p v-else-if="!view.error" class="mt-2 text-sm text-emerald-600">
        matches its declaration
      </p>
      <details v-if="view.files.length" class="mt-2">
        <summary class="cursor-pointer text-sm">
          {{ view.files.length }} derived files
        </summary>
        <div v-for="f in view.files" :key="f.path" class="mt-2">
          <p class="font-mono text-xs">{{ f.path }}</p>
          <pre
            class="bg-muted overflow-x-auto rounded p-2 text-xs"
          ><code>{{ f.contents }}</code></pre>
        </div>
      </details>
    </div>
  </section>
</template>
```

Then add the nav entry — `Layout.astro:7` widens the union and `:16-19` gains an item:

```
active?: 'overview' | 'tasks' | 'setup';
```

```
const navLinks = [
  { key: 'overview', label: 'Overview', href: '/' },
  { key: 'tasks', label: 'Tasks', href: '/tasks' },
  { key: 'setup', label: 'Setup', href: '/setup' },
] as const;
```

- [ ] **Step 4: Run the tests and the build**

Run: `pnpm nx test loop-observatory && pnpm nx build loop-observatory`
Expected: all tests PASS (3 new), build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/loop-observatory/src/lib/enroll/view.ts apps/loop-observatory/src/lib/enroll/view.test.ts apps/loop-observatory/src/pages/api/enroll/hosts.ts apps/loop-observatory/src/pages/setup.astro apps/loop-observatory/src/components/SetupPanel.vue apps/loop-observatory/src/layouts/Layout.astro
git commit -m "feat(observatory): setup page showing prerequisites, derived files and drift"
```

---

### Task 12: Migration — prove reproduction, then delete the hand-written files

**Files:**

- Create: `tools/loop/tests/derive-reproduces-hosts.sh`
- Delete: `tools/loop/launchd/*.tools.rainforest.loop-ralph.plist`, `tools/loop/telemetry/Angibles-MacBook-Air.config.alloy`
- Modify: `tools/loop/hosts.yaml` (remove the `hosts:` section)

**Interfaces:**

- Consumes: `derive` from Task 5
- Produces: nothing

- [ ] **Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
# tools/loop/tests/derive-reproduces-hosts.sh
#
# The migration gate. The generator must reproduce what the two live hosts run
# before those files stop being the source of truth.
#
# Semantic equality through plutil, not byte equality, and both halves matter:
#
#  * Not byte equality — the committed plists are formatted differently by hand
#    (the Air tab-indented one key per line, the mini two-space with eight
#    <key>x</key><string>y</string> pairs inline). Reproducing both byte-for-byte
#    would mean encoding each host's formatting accidents.
#  * Through plutil — the Air's plist is not well-formed XML. Its comment reads
#    `probed 2026-08-25 -- DENIED here`, and XML forbids `--` inside a comment.
#    plutil accepts it and launchd loads it; Python's expat refuses the file
#    outright. Comparison has to use the parser the platform actually uses.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/../../apps/loop-observatory"
pass=0; fail=0
check() { # name got want
  if [ "$2" = "$3" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass+1))
  else printf '  FAIL  %s\n        got=%s\n        want=%s\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Emit the derived ralph plist for one host, using the fixtures the unit tests use.
derive_ralph() { # host
  (cd "$APP" && npx tsx -e "
    import { deriveRalphPlist } from './src/lib/enroll/derive.js';
    import { FIXTURES } from './src/lib/enroll/fixtures.js';
    const { decl, facts } = FIXTURES['$1'];
    process.stdout.write(deriveRalphPlist(decl, facts).contents);
  ")
}

for host in rainforest-mini Angibles-MacBook-Air; do
  live="$ROOT/launchd/$host.tools.rainforest.loop-ralph.plist"
  derive_ralph "$host" > "$TMP/$host.plist" 2>"$TMP/$host.err"
  check "$host derives without error" "$([ -s "$TMP/$host.plist" ] && echo yes || echo no)" "yes"

  plutil -convert json -o "$TMP/$host.live.json" "$live" 2>/dev/null
  plutil -convert json -o "$TMP/$host.new.json"  "$TMP/$host.plist" 2>/dev/null
  check "$host generated plist is valid to plutil" \
    "$([ -s "$TMP/$host.new.json" ] && echo yes || echo no)" "yes"

  # Compare the parsed dictionaries, key by key, so formatting cannot mask a
  # difference and cannot create one.
  diffout=$(python3 - "$TMP/$host.live.json" "$TMP/$host.new.json" <<'PY'
import json, sys
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
def walk(x, y, path=""):
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            walk(x.get(k), y.get(k), f"{path}.{k}")
    elif x != y:
        print(f"{path}: live={x!r} generated={y!r}")
walk(a, b)
PY
)
  # Differences are expected and named: they are the accidents the generator
  # removes. Anything NOT on this list is a generator bug.
  unexpected=$(printf '%s\n' "$diffout" | grep -v '^$' \
    | grep -vE '\.(LOOP_MACHINE|ProgramArguments)' || true)
  check "$host has no unexplained difference" "$(printf '%s' "$unexpected" | wc -c | tr -d ' ')" "0"
done

# The generated plist must be readable by a standards-conforming parser, which
# the file it replaces is not.
check "generated plists are well-formed XML" \
  "$(python3 -c "
import plistlib
for p in ['$TMP/rainforest-mini.plist','$TMP/Angibles-MacBook-Air.plist']:
    plistlib.load(open(p,'rb'))
print('ok')" 2>/dev/null)" "ok"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `chmod +x tools/loop/tests/derive-reproduces-hosts.sh && ./tools/loop/tests/derive-reproduces-hosts.sh`
Expected: FAIL — `src/lib/enroll/fixtures.js` does not exist

- [ ] **Step 3: Write minimal implementation**

Extract the fixtures the unit tests already carry so both the tests and the gate use one definition:

```ts
// apps/loop-observatory/src/lib/enroll/fixtures.ts
// The two live hosts, as the migration gate and the unit tests both need them.
// One definition, so a fixture that drifts from reality fails in both places.
import type { HostDeclaration, HostFacts } from './types.js';

export const FIXTURES: Record<
  string,
  { decl: HostDeclaration; facts: HostFacts }
> = {
  'rainforest-mini': {
    decl: {
      host: 'rainforest-mini',
      home: '/Users/rainforest',
      roles: ['engine', 'ralph', 'observatory', 'loop-sync', 'usage-hourly'],
      scope: 'personal',
      otlpBind: '0.0.0.0',
      intervalSeconds: 1800,
    },
    facts: {
      tccICloud: 'permitted',
      executors: ['claude', 'agy'],
      brewPrefix: '/opt/homebrew',
      otlpListening: true,
      vaultPath:
        '/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian',
      accounts: { claudePlan: 'max', ghLogin: 'rainforest-dev' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
  },
  'Angibles-MacBook-Air': {
    decl: {
      host: 'Angibles-MacBook-Air',
      home: '/Users/rainforest',
      roles: [
        'engine',
        'ralph',
        'relay-pull',
        'usage-hourly',
        'usage-publish',
        'telemetry-sink',
      ],
      scope: 'work',
      otlpBind: '127.0.0.1',
      intervalSeconds: 1800,
    },
    facts: {
      tccICloud: 'denied',
      executors: ['claude', 'codex'],
      brewPrefix: '/opt/homebrew',
      otlpListening: true,
      vaultPath: null,
      accounts: { claudePlan: 'team', ghLogin: 'rainforest-angible' },
      probedAt: '2026-08-27T06:00:00.000Z',
    },
  },
};
```

Then update `derive.test.ts` to import `FIXTURES` instead of defining `MINI_DECL`/`MINI_FACTS`/`AIR_DECL`/`AIR_FACTS` inline:

```ts
import { FIXTURES } from './fixtures.js';

const MINI_DECL = FIXTURES['rainforest-mini']!.decl;
const MINI_FACTS = FIXTURES['rainforest-mini']!.facts;
const AIR_DECL = FIXTURES['Angibles-MacBook-Air']!.decl;
const AIR_FACTS = FIXTURES['Angibles-MacBook-Air']!.facts;
```

- [ ] **Step 4: Run the gate and the whole suite**

Run:

```bash
./tools/loop/tests/derive-reproduces-hosts.sh
pnpm nx test loop-observatory
for t in tools/loop/tests/*.sh; do "$t" >/dev/null || echo "FAILED $t"; done
```

Expected: the gate passes with the only differences being `LOOP_MACHINE` (`mini` → `rainforest-mini`, the split the design removes) and `ProgramArguments` (the `1 10` iteration parameters that move to `config.yaml`). Any other difference is a generator bug — fix it before continuing, and do not widen the exclusion list to make the gate pass.

- [ ] **Step 5: Cut over and commit**

Only after Step 4 passes:

```bash
# Move the mini's iteration parameters to config.yaml before deleting the plist
# that currently carries them, or the next run loses them silently.
python3 - <<'PY'
import pathlib
p = pathlib.Path.home() / ".claude/loop/config.yaml"
s = p.read_text()
assert "max_iter:" in s, "expected defaults.max_iter to exist"
print("confirm defaults carry the iteration policy before deleting the plist:")
print("\n".join(l for l in s.splitlines()[:12]))
PY

git rm tools/loop/launchd/rainforest-mini.tools.rainforest.loop-ralph.plist \
       tools/loop/launchd/Angibles-MacBook-Air.tools.rainforest.loop-ralph.plist \
       tools/loop/telemetry/Angibles-MacBook-Air.config.alloy

python3 - <<'PY'
import pathlib, re
p = pathlib.Path("tools/loop/hosts.yaml")
s = p.read_text()
s = re.sub(r"\nhosts:\n(?:  .*\n|\n)*", "\n", s)
s += """
# The hosts: section moved to the app's device records on 2026-08-27. Roles stay
# here because they are the generic system; which machine has which role is a
# device record, rebuilt by re-enrolling. This file's note about being "the only
# place that maps a machine to them" was written when install.sh was the only
# mechanism; there is still exactly one place, and it is now the app.
"""
p.write_text(s)
PY

pnpm format:check
git add tools/loop/hosts.yaml apps/loop-observatory/src/lib/enroll/fixtures.ts \
        apps/loop-observatory/src/lib/enroll/derive.test.ts \
        tools/loop/tests/derive-reproduces-hosts.sh
git commit -m "refactor(loop): the per-host plists become generated, not authored"
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: the release artifact and bundle serving to Task 10; the pure derivation to Tasks 1–5; the probe list to Task 6; device records and the gitignore entry to Task 7; the facts endpoint to Task 8; error handling to Tasks 4, 9 and 11; the setup page to Task 11; migration to Task 12. Testing is folded into every task rather than deferred.

**Two spec requirements deliberately deferred, and they should be tracked rather than silently dropped:**

1. **`install.sh --enroll`** — Task 11's page prints the command, and Task 10 produces what it fetches, but the flag itself is not implemented here. The plan delivers the app side end to end; the device side still runs the existing `install.sh`. This is the honest boundary of a first plan, not an oversight.
2. **WebMCP** — recorded in the spec as the experimental next face and correctly absent from every task. Nothing here forecloses it: `derive`, `driftFor` and `buildHostViews` are pure and take no I/O.

**Type consistency.** `HostDeclaration`, `HostFacts`, `DerivedFile` and `UnknownFact` are defined once in Task 2 and imported everywhere after. `HostRecord`/`HostRecordMap` come from Task 7 and are consumed unchanged in Tasks 9 and 11. Task 12 extracts the Task 2 and Task 3 fixtures into `fixtures.ts` and rewires the tests to it, so the gate and the unit tests cannot disagree about what the live hosts look like.

**One risk worth naming before starting.** Task 12's gate compares against files this plan then deletes. Run it, read its output, and only widen the expected-difference list if the difference is an accident you can name — widening it to make the gate pass converts the one step that could catch a generator bug into a step that cannot.
