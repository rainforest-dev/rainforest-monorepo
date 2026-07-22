import type { CaseStudy } from './types';

export const opencgt: CaseStudy = {
  slug: 'opencgt',
  variant: 'opencgt',
  title: 'OpenCGT',
  tagline:
    'An admin platform that orchestrates cell & gene therapy treatments end to end — patient Chain-of-Identity, material and shipment tracking, and the hospital and manufacturer orgs that hand a therapy between them.',
  role: 'Senior Frontend Developer · CodeGreen',
  period: '2024 — Present',
  stack: ['Next.js', 'Refine', 'Auth0', 'Casbin', 'WebCrypto', 'Nx'],
  sections: [
    {
      id: 'the-front-door-a-token-that-already-knows-your-role',
      title: 'The front door: a token that already knows your role',
      feature:
        'One "Log in" hands off to Auth0 and the app comes back already knowing the org role — no separate permissions call.',
      contribution:
        'I owned auth — the NextAuth + Auth0 config, and the decision to read roles out of the access token in the jwt/session callbacks so components read the role synchronously, with no extra round-trip.',
      tech: 'Auth0\'s roles claim key isn\'t stable, so `getRolesFromJwt()` base64url-decodes the payload, scans keys for one containing "roles", then narrows the match to `RoleEnum` — hospital_admin, manufacturer_admin, root.',
      interaction: 'jwt-decode',
      sourceRef: 'auth.ts · lib/getRolesFromJwt.ts',
    },
    {
      id: 'one-deployment-two-products',
      title: 'One deployment, two products',
      feature:
        'Hospital and manufacturer staff sign into the same deployment but see materially different apps — and a forbidden route returns a real 404, not a leak.',
      contribution:
        "I built the role-aware shell: every sidebar item wrapped in Refine's <CanAccess> so the nav is computed from policy, plus middleware that rewrites a disallowed route to /not-found server-side.",
      tech: 'Two gates that must agree — client `<CanAccess>` and the `middleware.ts` server rewrite. The app even splits `@synopsis/@hospital` vs `@synopsis/@manufacturer` so each product is its own segment.',
      interaction: 'role-shell',
      sourceRef:
        'app/(protected)/layout.tsx · middleware.ts · providers/accessControl.ts',
    },
    {
      id: 'the-rule-behind-the-gate-a-casbin-playground',
      title: 'The rule behind the gate: a Casbin playground',
      feature:
        'Authorization is one Casbin model, evaluated identically on the client and the server — so every decision is explainable and auditable.',
      contribution:
        'I designed the dual-enforcement strategy: a local casbin-core enforcer answers the common cases instantly, and denials fall through to the remote authorizer holding the full policy set.',
      tech: "The matcher is `g(r.sub, p.sub) && keyMatch(r.obj, p.obj) && (p.act == '*' || regexMatch(r.act, p.act))` — objects matched by path prefix, actions by regex, `*` a wildcard.",
      interaction: 'casbin-playground',
      sourceRef: 'lib/casbin/model.conf · lib/casbin/policy.csv · enforcer.ts',
    },
    {
      id: 'encrypted-before-it-leaves-the-browser',
      title: 'Encrypted before it leaves the browser',
      feature:
        'During enrollment, a patient\'s PHI is encrypted in the browser; each org is granted "phi" or "non-phi", and only the right private key can read it. The server only ever stores ciphertext.',
      contribution:
        'I implemented the WebCrypto E2EE utilities and the enrollment access-control step — the useFieldArray UI that decides who can decrypt what.',
      tech: "Hybrid, not plain RSA: the record body is `AES-CBC` encrypted, and the AES key + IV are `RSA-OAEP-2048` wrapped with each recipient's public key — big records stay fast while read access is bound to the private key.",
      interaction: 'phi-encrypt',
      sourceRef: 'lib/crypto/e2ee.ts · app/enroll/AccessControlFields.tsx',
    },
    {
      id: 'build-only-what-changed',
      title: 'Build only what changed',
      feature:
        'One Nx pipeline ships only the projects a change touches — affected tests and builds on a PR, then a signed image push and Helm rollout on main, guarded by role-scoped Playwright e2e and a k6 load test.',
      contribution:
        'I focused on the parts closest to the app — wiring nx affected with tag exclusions, the container build configs, and both suites: Playwright logging in as each role, and k6 ramping real VUs through the actual Auth0 login.',
      tech: "It's driven by the Nx project graph, not a job list — `nx-set-shas` computes base/head and `nx affected` walks the graph. The k6 browser test drives the real Auth0 form under 100 ramping VUs, asserting a `1.00` checks rate.",
      interaction: 'affected-pipeline',
      sourceRef: 'nx.json · .github/workflows/ci.yml · apps/web-e2e · apps/web-load',
    },
  ],
  // Placeholder gallery — drop real screenshots into
  // apps/personal-website/public/images/portfolio/opencgt/ and set `src`.
  gallery: [
    { alt: 'OpenCGT admin dashboard for cell & gene therapy orchestration', caption: 'Admin dashboard' },
    { alt: 'Patient Chain-of-Identity enrollment form', caption: 'Patient enrollment' },
    { alt: 'Material and shipment tracking timeline', caption: 'Material & shipment tracking' },
    { alt: 'Role-based access with hospital / manufacturer / root shells', caption: 'Role-based shells' },
  ],
};
