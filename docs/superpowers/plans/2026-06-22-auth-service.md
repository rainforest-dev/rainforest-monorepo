# auth-service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a passkey-only SSO auth service that acts as Traefik's ForwardAuth endpoint, protecting all homelab tools behind a single `.rainforest.tools` session cookie.

**Architecture:** Astro SSR app (`@astrojs/node` standalone) with three concerns: a `/verify` ForwardAuth endpoint Traefik calls on every request, a passkey login/register flow via `@simplewebauthn`, and a SQLite credential store. Sessions are stateless JWTs signed with `jose`. Challenge state lives in-memory (single user, 5-minute TTL).

**Tech Stack:** Astro 5, `@astrojs/node`, `@simplewebauthn/server`, `@simplewebauthn/browser`, `better-sqlite3`, `jose`, React (login UI island), Tailwind CSS 4, Vitest, pnpm, Nx

**Spec:** `docs/superpowers/specs/2026-06-22-personal-tools-monorepo-design.md` §4–5

---

## File Map

```
apps/auth-service/
  src/
    pages/
      login.astro                  ← login page shell (reads ?redirect param)
      register.astro               ← one-time setup page (REGISTRATION_TOKEN gated)
      api/
        verify.ts                  ← GET — Traefik ForwardAuth endpoint
        logout.ts                  ← POST — clear rf_session cookie
        login/
          begin.ts                 ← POST — generate WebAuthn authentication options
          finish.ts                ← POST — verify assertion, set cookie, return redirect
        register/
          begin.ts                 ← POST — generate WebAuthn registration options
          finish.ts                ← POST — verify attestation, save credential
    components/
      PasskeyLogin.tsx             ← React island: passkey prompt + redirect on success
      PasskeyRegister.tsx          ← React island: passkey registration flow
    lib/
      db.ts                        ← SQLite singleton + credential CRUD
      session.ts                   ← JWT sign/verify with jose
      webauthn.ts                  ← SimpleWebAuthn wrappers + in-memory challenge store
    env.d.ts                       ← Astro env type declarations
  astro.config.mjs
  package.json
  tsconfig.json
  Dockerfile
```

---

## Environment Variables

```
JWT_SECRET=<random 64-char string>          # required — signs session cookies
REGISTRATION_TOKEN=<random string>          # required at first run, unset after
AUTH_DB_PATH=/app/db/auth.db                # optional, default: /app/db/auth.db
WEBAUTHN_RP_ID=rainforest.tools             # optional, default: rainforest.tools
WEBAUTHN_ORIGIN=https://auth.rainforest.tools  # optional, default: https://auth.rainforest.tools
COOKIE_DOMAIN=.rainforest.tools             # optional, default: .rainforest.tools
```

---

### Task 1: Scaffold the Astro SSR app

**Files:**
- Create: `apps/auth-service/package.json`
- Create: `apps/auth-service/astro.config.mjs`
- Create: `apps/auth-service/tsconfig.json`
- Create: `apps/auth-service/src/env.d.ts`

- [ ] **Step 1: Create `apps/auth-service/package.json`**

```json
{
  "name": "@rainforest-monorepo/auth-service",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev --port 3001 --host 0.0.0.0",
    "build": "astro check && astro build",
    "preview": "astro preview --port 3001"
  },
  "nx": {
    "targets": {
      "dev": { "dependsOn": ["^build"] },
      "build": { "dependsOn": ["^build"], "cache": true }
    }
  },
  "dependencies": {
    "@astrojs/node": "^9.1.3",
    "@astrojs/react": "^4.3.0",
    "@simplewebauthn/browser": "^13.1.0",
    "@simplewebauthn/server": "^13.1.0",
    "@tailwindcss/vite": "catalog:",
    "astro": "^5.10.2",
    "better-sqlite3": "^11.10.0",
    "jose": "^6.0.11",
    "react": "catalog:",
    "react-dom": "catalog:",
    "tailwindcss": "catalog:"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `apps/auth-service/astro.config.mjs`**

```js
// @ts-check
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
});
```

- [ ] **Step 3: Create `apps/auth-service/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "allowJs": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/auth-service/src/env.d.ts`**

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
```

- [ ] **Step 5: Install dependencies**

```bash
cd ~/Repositories/rainforest-monorepo
pnpm install --filter @rainforest-monorepo/auth-service
```

- [ ] **Step 6: Verify Nx detects the project**

```bash
cd ~/Repositories/rainforest-monorepo
pnpm nx show project auth-service
```

Expected: prints project info including `dev`, `build` targets.

- [ ] **Step 7: Commit**

```bash
git add apps/auth-service/
git commit -m "feat(auth-service): scaffold Astro SSR app"
```

---

### Task 2: DB layer — SQLite credential store

**Files:**
- Create: `apps/auth-service/src/lib/db.ts`
- Create: `apps/auth-service/src/lib/db.test.ts`
- Create: `apps/auth-service/vitest.config.ts`

- [ ] **Step 1: Create `apps/auth-service/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `apps/auth-service/src/lib/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Use in-memory DB for tests
process.env.AUTH_DB_PATH = ':memory:';

const { saveCredential, getCredential, listCredentials, updateCounter } =
  await import('./db.js');

describe('db', () => {
  const cred = {
    id: 'cred-id-1',
    publicKey: 'base64pubkey==',
    counter: 0,
    transports: ['internal'] as string[],
  };

  it('saves and retrieves a credential', () => {
    saveCredential(cred);
    const result = getCredential('cred-id-1');
    expect(result).toMatchObject({ id: 'cred-id-1', publicKey: 'base64pubkey==' });
  });

  it('lists all credentials', () => {
    const all = listCredentials();
    expect(all.length).toBeGreaterThan(0);
  });

  it('updates counter', () => {
    updateCounter('cred-id-1', 5);
    const result = getCredential('cred-id-1');
    expect(result?.counter).toBe(5);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd ~/Repositories/rainforest-monorepo
pnpm nx test auth-service
```

Expected: FAIL — `Cannot find module './db.js'`

- [ ] **Step 4: Implement `apps/auth-service/src/lib/db.ts`**

```typescript
import Database from 'better-sqlite3';

export type StoredCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
};

let _db: ReturnType<typeof Database> | null = null;

function getDb(): ReturnType<typeof Database> {
  if (_db) return _db;
  const path = process.env.AUTH_DB_PATH ?? '/app/db/auth.db';
  _db = new Database(path);
  _db.prepare(`
    CREATE TABLE IF NOT EXISTS credentials (
      id          TEXT PRIMARY KEY,
      public_key  TEXT NOT NULL,
      counter     INTEGER NOT NULL DEFAULT 0,
      transports  TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();
  return _db;
}

export function saveCredential(cred: StoredCredential): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO credentials (id, public_key, counter, transports)
       VALUES (?, ?, ?, ?)`,
    )
    .run(cred.id, cred.publicKey, cred.counter, JSON.stringify(cred.transports));
}

export function getCredential(id: string): StoredCredential | null {
  const row = getDb()
    .prepare('SELECT * FROM credentials WHERE id = ?')
    .get(id) as
    | { id: string; public_key: string; counter: number; transports: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: JSON.parse(row.transports) as string[],
  };
}

export function listCredentials(): StoredCredential[] {
  const rows = getDb()
    .prepare('SELECT * FROM credentials ORDER BY created_at ASC')
    .all() as { id: string; public_key: string; counter: number; transports: string }[];
  return rows.map((r) => ({
    id: r.id,
    publicKey: r.public_key,
    counter: r.counter,
    transports: JSON.parse(r.transports) as string[],
  }));
}

export function updateCounter(id: string, counter: number): void {
  getDb().prepare('UPDATE credentials SET counter = ? WHERE id = ?').run(counter, id);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm nx test auth-service
```

Expected: PASS — 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/auth-service/src/lib/db.ts apps/auth-service/src/lib/db.test.ts apps/auth-service/vitest.config.ts
git commit -m "feat(auth-service): add SQLite credential store"
```

---

### Task 3: Session layer — JWT sign/verify

**Files:**
- Create: `apps/auth-service/src/lib/session.ts`
- Create: `apps/auth-service/src/lib/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/auth-service/src/lib/session.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';

const { signSession, verifySession } = await import('./session.js');

describe('session', () => {
  it('signs and verifies a valid token', async () => {
    const token = await signSession();
    expect(typeof token).toBe('string');
    expect(await verifySession(token)).toBe(true);
  });

  it('rejects a tampered token', async () => {
    const token = await signSession();
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifySession(tampered)).toBe(false);
  });

  it('rejects an empty string', async () => {
    expect(await verifySession('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm nx test auth-service
```

Expected: FAIL — `Cannot find module './session.js'`

- [ ] **Step 3: Implement `apps/auth-service/src/lib/session.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function signSession(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm nx test auth-service
```

Expected: PASS — 6 tests passing (3 db + 3 session).

- [ ] **Step 5: Commit**

```bash
git add apps/auth-service/src/lib/session.ts apps/auth-service/src/lib/session.test.ts
git commit -m "feat(auth-service): add JWT session sign/verify"
```

---

### Task 4: WebAuthn helpers + challenge store

**Files:**
- Create: `apps/auth-service/src/lib/webauthn.ts`
- Create: `apps/auth-service/src/lib/webauthn.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/auth-service/src/lib/webauthn.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

const { storeChallenge, consumeChallenge, getRpConfig } = await import('./webauthn.js');

describe('challenge store', () => {
  it('stores and consumes a challenge once', () => {
    storeChallenge('reg', 'abc123');
    expect(consumeChallenge('reg')).toBe('abc123');
    expect(consumeChallenge('reg')).toBeNull(); // consumed
  });

  it('returns null for unknown key', () => {
    expect(consumeChallenge('unknown')).toBeNull();
  });
});

describe('getRpConfig', () => {
  it('returns rpID and origin from defaults', () => {
    const config = getRpConfig();
    expect(config.rpID).toBe('rainforest.tools');
    expect(config.origin).toBe('https://auth.rainforest.tools');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm nx test auth-service
```

Expected: FAIL — `Cannot find module './webauthn.js'`

- [ ] **Step 3: Implement `apps/auth-service/src/lib/webauthn.ts`**

```typescript
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { listCredentials, getCredential } from './db.js';

// In-memory challenge store — single user, 5-minute TTL
const challenges = new Map<string, { value: string; expiresAt: number }>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function storeChallenge(key: string, challenge: string): void {
  challenges.set(key, { value: challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

export function consumeChallenge(key: string): string | null {
  const entry = challenges.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    challenges.delete(key);
    return null;
  }
  challenges.delete(key);
  return entry.value;
}

export function getRpConfig(): { rpID: string; rpName: string; origin: string } {
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? 'rainforest.tools',
    rpName: 'Rainforest Tools',
    origin: process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools',
  };
}

export async function createRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = getRpConfig();
  const existingCredentials = listCredentials().map((c) => ({
    id: c.id,
    transports: c.transports as AuthenticatorTransport[],
  }));
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode('rainforest'),
    userName: 'rainforest',
    attestationType: 'none',
    excludeCredentials: existingCredentials,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  storeChallenge('registration', options.challenge);
  return options;
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
): Promise<VerifiedRegistrationResponse> {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = consumeChallenge('registration');
  if (!expectedChallenge) throw new Error('No pending registration challenge');
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedRPID: rpID,
    expectedOrigin: origin,
    requireUserVerification: true,
  });
}

export async function createAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getRpConfig();
  const allowCredentials = listCredentials().map((c) => ({
    id: c.id,
    transports: c.transports as AuthenticatorTransport[],
  }));
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
  });
  storeChallenge('authentication', options.challenge);
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<VerifiedAuthenticationResponse> {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = consumeChallenge('authentication');
  if (!expectedChallenge) throw new Error('No pending authentication challenge');
  const credential = getCredential(response.id);
  if (!credential) throw new Error('Credential not found');
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedRPID: rpID,
    expectedOrigin: origin,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[],
    },
    requireUserVerification: true,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm nx test auth-service
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/auth-service/src/lib/webauthn.ts apps/auth-service/src/lib/webauthn.test.ts
git commit -m "feat(auth-service): add WebAuthn helpers and challenge store"
```

---

### Task 5: Registration API routes

**Files:**
- Create: `apps/auth-service/src/pages/api/register/begin.ts`
- Create: `apps/auth-service/src/pages/api/register/finish.ts`

- [ ] **Step 1: Create `apps/auth-service/src/pages/api/register/begin.ts`**

```typescript
import type { APIRoute } from 'astro';
import { createRegistrationOptions } from '../../../lib/webauthn.js';

export const POST: APIRoute = async () => {
  try {
    const options = await createRegistrationOptions();
    return Response.json(options);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 2: Create `apps/auth-service/src/pages/api/register/finish.ts`**

```typescript
import type { APIRoute } from 'astro';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { verifyRegistration } from '../../../lib/webauthn.js';
import { saveCredential } from '../../../lib/db.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as RegistrationResponseJSON;
    const verification = await verifyRegistration(body);
    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: 'Verification failed' }, { status: 400 });
    }
    const { credential } = verification.registrationInfo;
    saveCredential({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: (body.response.transports ?? []) as string[],
    });
    return Response.json({ verified: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }
};
```

- [ ] **Step 3: Smoke-test the route**

```bash
pnpm nx dev auth-service &
curl -s -X POST http://localhost:3001/api/register/begin | head -c 100
# Expected: JSON with challenge, rp, user fields
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add apps/auth-service/src/pages/api/register/
git commit -m "feat(auth-service): add registration API routes"
```

---

### Task 6: Registration page + PasskeyRegister component

**Files:**
- Create: `apps/auth-service/src/components/PasskeyRegister.tsx`
- Create: `apps/auth-service/src/pages/register.astro`

- [ ] **Step 1: Create `apps/auth-service/src/components/PasskeyRegister.tsx`**

```tsx
import { startRegistration } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function PasskeyRegister() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleRegister() {
    setStatus('loading');
    setMessage('');
    try {
      const optRes = await fetch('/api/register/begin', { method: 'POST' });
      if (!optRes.ok) throw new Error('Failed to get registration options');
      const options = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const finishRes = await fetch('/api/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      const result = await finishRes.json();
      if (!result.verified) throw new Error('Registration not verified');

      setStatus('success');
      setMessage('Passkey registered. You can now log in.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleRegister}
        disabled={status === 'loading' || status === 'success'}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === 'loading' ? 'Registering…' : 'Register Passkey'}
      </button>
      {message && (
        <p className={status === 'error' ? 'text-red-400' : 'text-green-400'}>{message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/auth-service/src/pages/register.astro`**

```astro
---
import PasskeyRegister from '../components/PasskeyRegister.tsx';

const token = Astro.url.searchParams.get('token');
const registrationToken = import.meta.env.REGISTRATION_TOKEN;

if (!registrationToken || token !== registrationToken) {
  return Astro.redirect('/login');
}
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Register Passkey — Rainforest Tools</title>
    <style>
      body { background: #0f1117; color: #e2e4ed; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-6">
      <h1 class="text-2xl font-semibold">Register Passkey</h1>
      <p class="text-gray-400 text-sm">One-time setup. Use your device's biometric or PIN.</p>
      <PasskeyRegister client:load />
    </div>
  </body>
</html>
```

- [ ] **Step 3: Verify registration page is token-gated**

```bash
pnpm nx dev auth-service &
# Without token — should redirect to /login
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/register"
# Expected: 302
# With wrong token — should redirect to /login
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/register?token=wrong"
# Expected: 302
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add apps/auth-service/src/pages/register.astro apps/auth-service/src/components/PasskeyRegister.tsx
git commit -m "feat(auth-service): add registration page and PasskeyRegister component"
```

---

### Task 7: Login API routes

**Files:**
- Create: `apps/auth-service/src/pages/api/login/begin.ts`
- Create: `apps/auth-service/src/pages/api/login/finish.ts`

- [ ] **Step 1: Create `apps/auth-service/src/pages/api/login/begin.ts`**

```typescript
import type { APIRoute } from 'astro';
import { createAuthenticationOptions } from '../../../lib/webauthn.js';

export const POST: APIRoute = async () => {
  try {
    const options = await createAuthenticationOptions();
    return Response.json(options);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
};
```

- [ ] **Step 2: Create `apps/auth-service/src/pages/api/login/finish.ts`**

```typescript
import type { APIRoute } from 'astro';
import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { verifyAuthentication } from '../../../lib/webauthn.js';
import { updateCounter } from '../../../lib/db.js';
import { signSession } from '../../../lib/session.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = (await request.json()) as AuthenticationResponseJSON & { redirect?: string };
    const { redirect, ...authResponse } = body;

    const verification = await verifyAuthentication(authResponse);
    if (!verification.verified) {
      return Response.json({ error: 'Authentication failed' }, { status: 401 });
    }

    updateCounter(authResponse.id, verification.authenticationInfo.newCounter);

    const token = await signSession();
    const cookieDomain = process.env.COOKIE_DOMAIN ?? '.rainforest.tools';

    cookies.set('rf_session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: cookieDomain,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return Response.json({ verified: true, redirect: redirect ?? '/' });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/auth-service/src/pages/api/login/
git commit -m "feat(auth-service): add login API routes"
```

---

### Task 8: Login page + PasskeyLogin component

**Files:**
- Create: `apps/auth-service/src/components/PasskeyLogin.tsx`
- Create: `apps/auth-service/src/pages/login.astro`

- [ ] **Step 1: Create `apps/auth-service/src/components/PasskeyLogin.tsx`**

```tsx
import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';

export default function PasskeyLogin({ redirect }: { redirect: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleLogin() {
    setStatus('loading');
    setMessage('');
    try {
      const optRes = await fetch('/api/login/begin', { method: 'POST' });
      if (!optRes.ok) throw new Error('Failed to get login options');
      const options = await optRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

      const finishRes = await fetch('/api/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, redirect }),
      });
      const result = await finishRes.json();
      if (!result.verified) throw new Error('Authentication failed');

      window.location.href = result.redirect;
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleLogin}
        disabled={status === 'loading'}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === 'loading' ? 'Authenticating…' : 'Sign in with Passkey'}
      </button>
      {message && <p className="text-red-400 text-sm">{message}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/auth-service/src/pages/login.astro`**

```astro
---
import PasskeyLogin from '../components/PasskeyLogin.tsx';

const redirect = Astro.url.searchParams.get('redirect') ?? '/';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign In — Rainforest Tools</title>
    <style>
      body { background: #0f1117; color: #e2e4ed; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-6">
      <h1 class="text-2xl font-semibold">Rainforest Tools</h1>
      <p class="text-gray-400 text-sm">Use your passkey to sign in.</p>
      <PasskeyLogin redirect={redirect} client:load />
    </div>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add apps/auth-service/src/pages/login.astro apps/auth-service/src/components/PasskeyLogin.tsx
git commit -m "feat(auth-service): add login page and PasskeyLogin component"
```

---

### Task 9: /api/verify endpoint (Traefik ForwardAuth)

**Files:**
- Create: `apps/auth-service/src/pages/api/verify.ts`

The `/verify` endpoint is what Traefik calls on every upstream request. It returns 200 to allow, or a 302 redirect to the login page to block. Traefik passes the original request details via `X-Forwarded-*` headers so the auth service can build the post-login redirect URL.

- [ ] **Step 1: Create `apps/auth-service/src/pages/api/verify.ts`**

```typescript
import type { APIRoute } from 'astro';
import { verifySession } from '../../lib/session.js';

export const GET: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get('rf_session')?.value ?? '';

  if (await verifySession(token)) {
    return new Response(null, { status: 200 });
  }

  // Build original URL from Traefik forwarded headers
  const host = request.headers.get('X-Forwarded-Host') ?? '';
  const proto = request.headers.get('X-Forwarded-Proto') ?? 'https';
  const uri = request.headers.get('X-Forwarded-Uri') ?? '/';

  const loginBase = process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools';
  const loginUrl = new URL(`${loginBase}/login`);
  if (host) {
    loginUrl.searchParams.set('redirect', `${proto}://${host}${uri}`);
  }

  return Response.redirect(loginUrl.toString(), 302);
};
```

- [ ] **Step 2: Test the verify endpoint**

```bash
pnpm nx dev auth-service &

# Without cookie — should redirect
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/verify
# Expected: 302

# Simulate Traefik forwarded headers — check redirect URL includes the original host
curl -s -o /dev/null -w "%{redirect_url}" \
  -H "X-Forwarded-Host: calibre.rainforest.tools" \
  -H "X-Forwarded-Proto: https" \
  -H "X-Forwarded-Uri: /books" \
  http://localhost:3001/api/verify
# Expected: .../login?redirect=https%3A%2F%2Fcalibre.rainforest.tools%2Fbooks

kill %1
```

- [ ] **Step 3: Commit**

```bash
git add apps/auth-service/src/pages/api/verify.ts
git commit -m "feat(auth-service): add ForwardAuth /verify endpoint"
```

---

### Task 10: /api/logout endpoint

**Files:**
- Create: `apps/auth-service/src/pages/api/logout.ts`

- [ ] **Step 1: Create `apps/auth-service/src/pages/api/logout.ts`**

```typescript
import type { APIRoute } from 'astro';

export const POST: APIRoute = ({ cookies }) => {
  cookies.delete('rf_session', {
    domain: process.env.COOKIE_DOMAIN ?? '.rainforest.tools',
    path: '/',
  });
  const loginBase = process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools';
  return Response.redirect(`${loginBase}/login`, 302);
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/auth-service/src/pages/api/logout.ts
git commit -m "feat(auth-service): add logout endpoint"
```

---

### Task 11: Dockerfile

**Files:**
- Create: `apps/auth-service/Dockerfile`

- [ ] **Step 1: Create `apps/auth-service/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests for dependency install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/auth-service/package.json apps/auth-service/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/auth-service... --frozen-lockfile

COPY apps/auth-service apps/auth-service
RUN pnpm --filter @rainforest-monorepo/auth-service run build

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /app/apps/auth-service/dist ./dist
COPY --from=base /app/node_modules ./node_modules

RUN mkdir -p /app/db

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["node", "./dist/server/entry.mjs"]
```

- [ ] **Step 2: Verify Docker build succeeds**

```bash
cd ~/Repositories/rainforest-monorepo
docker build -f apps/auth-service/Dockerfile -t auth-service:local .
```

Expected: image builds successfully.

- [ ] **Step 3: Smoke test the Docker image**

```bash
docker run --rm -p 3001:3001 \
  -e JWT_SECRET="test-secret-at-least-32-chars-long!!" \
  -e WEBAUTHN_RP_ID="localhost" \
  -e WEBAUTHN_ORIGIN="http://localhost:3001" \
  -e COOKIE_DOMAIN="localhost" \
  auth-service:local &

sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/verify
# Expected: 302

docker stop $(docker ps -q --filter ancestor=auth-service:local)
```

- [ ] **Step 4: Commit**

```bash
git add apps/auth-service/Dockerfile
git commit -m "feat(auth-service): add Dockerfile"
```

---

## Self-Review Checklist (do not skip)

After all tasks complete, verify against spec §4–5:

- [ ] `/verify` returns 200 on valid cookie, 302 to `/login?redirect=...` on missing/invalid
- [ ] `/login` page renders passkey prompt, accepts `?redirect=` param
- [ ] `/register` page is gated by `REGISTRATION_TOKEN` — redirects to `/login` without valid token
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, domain `.rainforest.tools`
- [ ] SQLite credential store persists across restarts (Docker volume mount)
- [ ] All 8 unit tests pass: `pnpm nx test auth-service`
- [ ] Docker image builds and smoke test passes
