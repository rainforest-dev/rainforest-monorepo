# Tech Stack Migration 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the rainforest-monorepo from pnpm 9→11, Nx 22→23, Astro 6.1→6.4, and Storybook 10.3.5→10.4.1 without breaking CI, the dev server, or the Docker build.

**Architecture:** Four sequential upgrades each guarded by a validation checkpoint. pnpm comes first because it is the package manager layer everything else runs through — a lockfile format change here affects every subsequent step. Nx second because it controls CI and task execution. Astro and Storybook third and fourth as app-level upgrades with low blast radius.

**Tech Stack:** pnpm 11.7, Nx 23, Astro 6.4, Storybook 10.4, React 19, Vitest 4, TypeScript 5.9, Node 22

---

## File Map

| File | Change |
|------|--------|
| `package.json` (root) | Update `packageManager` → `pnpm@11.7.0`; remove `pnpm.*` config block |
| `pnpm-workspace.yaml` | Add `peerDependencyRules` + `minimumReleaseAge: 0` for migration safety |
| `nx.json` | Updated by `nx migrate` codemod (consolidates `releaseTagPattern` → `releaseTag.pattern`) |
| `apps/personal-website/package.json` | Bump `astro` → `^6.4.0`; bump `@astrojs/*` integrations |
| `package.json` (root devDeps) | Bump `storybook`, `@storybook/*`, `eslint-plugin-storybook` → `10.4.1` |

---

## Task 1: Capture baseline test results

**Files:** none — read-only

- [ ] **Step 1.1: Run the full test suite and capture output**

```bash
pnpm nx test rainforest-ui 2>&1 | tee /tmp/baseline-tests.txt
echo "Exit: $?"
```

Expected: All tests pass. If any already fail, note them — they are pre-existing and not caused by the migration.

- [ ] **Step 1.2: Verify the build pipeline works end-to-end**

```bash
pnpm nx build rainforest-ui 2>&1 | tail -20
```

Expected: `Successfully ran target build for project rainforest-ui`

- [ ] **Step 1.3: Run lint and typecheck**

```bash
pnpm nx affected -t lint typecheck --all 2>&1 | tail -30
```

Expected: no errors (or note any pre-existing ones).

---

## Task 2: Upgrade pnpm 9 → 11

**Files:**
- Modify: `package.json` (root)
- Modify: `pnpm-workspace.yaml`

### Why this order matters
pnpm 11 ignores the `pnpm.*` field in `package.json` entirely. All config moves to `pnpm-workspace.yaml`. The `packageManager` field in `package.json` triggers Corepack to download pnpm 11 automatically — no global install needed.

- [ ] **Step 2.1: Update `packageManager` field in root `package.json`**

Open `package.json` and change:
```json
"packageManager": "pnpm@9.15.0"
```
to:
```json
"packageManager": "pnpm@11.7.0"
```

- [ ] **Step 2.2: Move pnpm config from `package.json` to `pnpm-workspace.yaml`**

Remove the entire `"pnpm"` block from root `package.json`:
```json
// DELETE this entire block:
"pnpm": {
  "peerDependencyRules": {
    "allowedVersions": {
      "@vite-pwa/astro>astro": "6",
      "@nanostores/lit>nanostores": "1"
    }
  }
}
```

Then add the equivalent config to `pnpm-workspace.yaml`. The file currently ends after the `catalog:` block — append below it:

```yaml
# pnpm 11 settings (moved from package.json pnpm field)
peerDependencyRules:
  allowedVersions:
    '@vite-pwa/astro>astro': '6'
    '@nanostores/lit>nanostores': '1'

# Disable minimumReleaseAge during migration to avoid lockfile instability
# (pnpm 11 default is 1440 — re-enable after lockfile stabilises)
minimumReleaseAge: 0
```

- [ ] **Step 2.3: Enable Corepack and install**

```bash
corepack enable
pnpm install
```

Expected: pnpm 11.7.0 downloads automatically via Corepack, `node_modules` installs without errors. You may see a warning about lockfile version upgrading — this is expected.

If you see `ERR_PNPM_IGNORED_BUILDS` for any package, add it to an `allowBuilds` map in `pnpm-workspace.yaml`:
```yaml
allowBuilds:
  '<package-name>': true
```

- [ ] **Step 2.4: Verify hoisting hasn't broken ESLint tooling**

```bash
pnpm nx lint rainforest-ui 2>&1 | tail -20
```

Expected: lint passes (or same errors as baseline — no new "ESLint not found" style errors). If you see `Cannot find module 'eslint'`, add to `pnpm-workspace.yaml`:
```yaml
hoistingLimits: workspaces
```

- [ ] **Step 2.5: Run tests to confirm React 19 + Vitest/jsdom still works**

```bash
pnpm nx test rainforest-ui 2>&1 | tee /tmp/post-pnpm-tests.txt
diff /tmp/baseline-tests.txt /tmp/post-pnpm-tests.txt | head -40
```

Expected: test results identical to baseline. If you see `TypeError: Cannot read properties of null (reading 'useRef')`, add to `libs/rainforest-ui/vite.config.ts` (inside the `test` block):
```typescript
test: {
  // ...existing config...
  server: {
    deps: {
      inline: ['react', 'react-dom'],
    },
  },
}
```
Or switch the test environment from jsdom to happy-dom:
```typescript
environment: 'happy-dom',
```
Then re-run `pnpm nx test rainforest-ui`.

- [ ] **Step 2.6: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: upgrade pnpm 9 → 11, move config to pnpm-workspace.yaml"
```

---

## Task 3: Upgrade Nx 22 → 23

**Files:**
- Modify: `nx.json` (by codemod)
- Modify: `package.json` and `package.json` in apps/libs (by codemod)
- Possibly modify: `project.json` files (sandbox violation fixes)

### What the codemod changes
`nx migrate` runs deterministic generators first, then can call the Nx AI agent for anything custom. Key automatic changes: `releaseTagPattern` flat key inside release groups → `releaseTag.pattern`; deprecated executor aliases removed; Vitest configuration validated against the split plugin.

- [ ] **Step 3.1: Run the Nx migration**

```bash
pnpm nx migrate nx@23 2>&1 | tee /tmp/nx-migrate.txt
```

Expected: Output lists migrations to apply. A `migrations.json` file is created in the workspace root. If the agentic mode prompt appears, accept it.

- [ ] **Step 3.2: Apply migrations**

```bash
pnpm nx migrate --run-migrations 2>&1 | tee /tmp/nx-migrate-run.txt
```

Expected: Each migration logs `✓ Applied migration`. If any fail, read the error — most are fixable with the manual change described in the migration output.

- [ ] **Step 3.3: Install updated packages**

```bash
pnpm install
```

Expected: Updated Nx packages installed without errors.

- [ ] **Step 3.4: Verify `nx.json` release config was consolidated**

```bash
grep -A5 '"docker-apps"' nx.json
```

Expected: `releaseTagPattern` is gone and replaced with a `releaseTag` object:
```json
"docker-apps": {
  "projects": ["personal-calibre"],
  "releaseTag": {
    "pattern": "{projectName}@{version}"
  },
  ...
}
```

If `releaseTagPattern` still appears (codemod missed it), manually update `nx.json`:
```json
// Before:
"releaseTagPattern": "{projectName}@{version}"

// After:
"releaseTag": {
  "pattern": "{projectName}@{version}"
}
```

- [ ] **Step 3.5: Run the full test suite**

```bash
pnpm nx test rainforest-ui 2>&1 | tail -20
```

Expected: Same results as baseline.

- [ ] **Step 3.6: Run affected lint and typecheck**

```bash
pnpm nx affected -t lint typecheck --all 2>&1 | tail -30
```

Expected: No new errors.

- [ ] **Step 3.7: Validate sandbox violations**

```bash
pnpm nx build rainforest-ui 2>&1 | grep -i "sandbox\|violation" | head -20
```

Expected: No sandbox violations. If violations appear, run:
```bash
npx nx-cloud validate sandbox-violations .nx/workspace-data/sandbox-reports/
```
For each violation:
- Legitimate file access → add to `inputs`/`outputs` in `project.json` using the `"..."` spread token:
  ```json
  "inputs": ["...", "{projectRoot}/some-extra-file"]
  ```
- Benign access (last resort) → exclude in `.nx/workflows/sandboxing-config.yaml`

- [ ] **Step 3.8: Delete the migrations file**

```bash
rm migrations.json
```

- [ ] **Step 3.9: Commit**

```bash
git add nx.json package.json pnpm-lock.yaml
git add $(git diff --name-only --diff-filter=M | grep -E "project\.json|package\.json")
git commit -m "chore: upgrade Nx 22 → 23, apply codemod migrations"
```

---

## Task 4: Upgrade Astro 6.1 → 6.4

**Files:**
- Modify: `apps/personal-website/package.json`

### Risk level: low
Astro 6.2–6.4 are backward-compatible minor releases. The features added (resilient island hydration, Rust Markdown, Hono routing) are all opt-in or automatic improvements with no breaking API changes.

- [ ] **Step 4.1: Update Astro and all `@astrojs/*` integrations to latest**

```bash
cd apps/personal-website
pnpm up "astro@^6.4" "@astrojs/mdx@latest" "@astrojs/react@latest" "@astrojs/rss@latest" "@astrojs/sitemap@latest" "@astrojs/vercel@latest" "@astrojs/vue@latest" 2>&1
cd ../..
```

Expected: All packages update to their latest compatible versions. Check the output for any peer dependency warnings.

- [ ] **Step 4.2: Update dev dependencies for Astro**

```bash
cd apps/personal-website
pnpm up "@astrojs/check@latest" "vite-plugin-pwa@latest" "@vite-pwa/astro@latest" "eslint-plugin-astro@latest" 2>&1
cd ../..
```

- [ ] **Step 4.3: Verify updated versions**

```bash
node -e "const p=require('./apps/personal-website/package.json'); console.log('astro:', p.dependencies.astro, '@astrojs/vercel:', p.dependencies['@astrojs/vercel'])"
```

Expected: `astro: 6.4.x` (or higher patch), `@astrojs/vercel: 10.x` or `11.x`.

- [ ] **Step 4.4: Run a dev build to catch any integration issues**

```bash
pnpm nx build personal-website 2>&1 | tail -30
```

Expected: `✓ Built in Xs`. If you see Astro errors about config changes:
- Check the Astro 6.2, 6.3, 6.4 changelogs for breaking changes in the specific integrations used.
- Common fix: `astro.config.mjs` → verify `output: 'server'` and the Vercel adapter are still compatible.

- [ ] **Step 4.5: Smoke-test the dev server**

```bash
pnpm nx dev personal-website &
sleep 15
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321
kill %1
```

Expected: `200`.

- [ ] **Step 4.6: Commit**

```bash
git add apps/personal-website/package.json pnpm-lock.yaml
git commit -m "chore: upgrade Astro 6.1 → 6.4 + @astrojs integrations"
```

---

## Task 5: Upgrade Storybook 10.3.5 → 10.4.1

**Files:**
- Modify: `package.json` (root devDeps)

### Risk level: minimal
A patch update within the same major. No breaking changes expected.

- [ ] **Step 5.1: Update all Storybook packages to 10.4.1**

```bash
pnpm up "storybook@10.4.1" "@storybook/addon-docs@10.4.1" "@storybook/test-runner@latest" "@storybook/web-components-vite@10.4.1" "eslint-plugin-storybook@10.4.1" -w 2>&1
```

Expected: All packages update to 10.4.1 with no peer dep conflicts.

- [ ] **Step 5.2: Verify Storybook still loads**

```bash
pnpm nx storybook rainforest-ui &
sleep 20
curl -s -o /dev/null -w "%{http_code}" http://localhost:6006
kill %1
```

Expected: `200`.

- [ ] **Step 5.3: Run Storybook test-runner**

```bash
pnpm nx test-storybook rainforest-ui 2>&1 | tail -20
```

Expected: Same pass/fail as baseline (or improvements if tests were flaky with 10.3.5).

- [ ] **Step 5.4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade Storybook 10.3.5 → 10.4.1"
```

---

## Task 6: Post-migration hardening

**Files:**
- Modify: `pnpm-workspace.yaml` — re-enable `minimumReleaseAge`

- [ ] **Step 6.1: Re-enable supply-chain protection**

In `pnpm-workspace.yaml`, remove or comment out the `minimumReleaseAge: 0` override added in Task 2:

```yaml
# Remove this line (or set back to default 1440):
# minimumReleaseAge: 0
```

- [ ] **Step 6.2: Run `pnpm install` to verify lockfile is stable**

```bash
pnpm install
git diff pnpm-lock.yaml | wc -l
```

Expected: `0` (no lockfile changes — all deps are older than 24 hours so the age gate is satisfied).

If the lockfile changes, the deps that changed are under 24 hours old. Either keep `minimumReleaseAge: 0` temporarily and re-run this step in 24 hours, or accept the lockfile churn and commit.

- [ ] **Step 6.3: Run the full validation suite**

```bash
pnpm nx affected -t lint test typecheck --all 2>&1 | tail -40
```

Expected: All pass. Diff against baseline notes from Task 1.

- [ ] **Step 6.4: Verify Docker build still works**

```bash
docker build -f apps/personal-calibre/Dockerfile . -t personal-calibre-test 2>&1 | tail -20
```

Expected: `Successfully built ...`. The Dockerfile uses `corepack enable` which will pick up `pnpm@11.7.0` from the `packageManager` field automatically.

- [ ] **Step 6.5: Final commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: re-enable pnpm 11 supply-chain protection (minimumReleaseAge: 1440)"
```

---

## Skipped: @material/web M3 Expressive

The npm release has not landed yet as of June 20, 2026 (announced at Google I/O May 19). Track the `@material/web` changelog — when a new version with Expressive support publishes, update the catalog entry in `pnpm-workspace.yaml`.

---

## Self-Review Checklist

- [x] pnpm config migration covered (packageManager field + peerDependencyRules move)
- [x] Lockfile instability risk mitigated (`minimumReleaseAge: 0` during migration, re-enabled in Task 6)
- [x] React 19 + jsdom breakage has a fallback fix documented
- [x] Nx sandbox violations have explicit remediation steps
- [x] `releaseTagPattern` consolidation explicitly validated in Step 3.4
- [x] Docker build verified post-migration
- [x] No native modules in Dockerfile — `allowBuilds` not needed
- [x] Storybook MCP not included (separate concern, not a migration)
