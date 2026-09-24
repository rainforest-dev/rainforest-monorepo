# Affected Docker Release Implementation Plan

Superseded where it differs by the spec and the fix rounds recorded in PR #406; this plan is kept as written.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three per-app release workflows with one `release.yml` that versions, builds and pushes only the Docker apps `nx affected` reports, with CalVer tags and native arm64 builds.

**Architecture:** `@nx/docker` infers a `docker:build` target from each app's Dockerfile. The `docker-apps` release group uses docker versioning, so `nx release version` builds and tags images and `nx release publish` pushes them. A composite action resolves the affected set; the workflow adds `:latest`. The homelab switches to digest-triggered image pulls in its own repo.

**Tech Stack:** Nx 23.1.0 + `@nx/docker` 23.1.0, pnpm 11.7.0, GitHub Actions (`ubuntu-24.04-arm`), GHCR, Node 22 (`node:test` for the parser), Terraform docker provider (homelab).

**Spec:** `docs/superpowers/specs/2026-09-25-affected-docker-release-design.md`

## Global Constraints

- Nx plugins pinned to the workspace version: `@nx/docker` `23.1.0`.
- Version scheme: `{currentDate|YYYY.MM.DD}.{shortCommitSha}`, scheme name `prod`.
- Registry `ghcr.io`; repositories `rainforest-dev/personal-calibre`, `rainforest-dev/personal-memories`, `rainforest-dev/rss-manager`.
- Project names: `personal-calibre`, `personal-memories`, `@rainforest-monorepo/rss-manager`.
- Images are `linux/arm64` only; build context is the repository root; Dockerfiles are not changed.
- Release tag pattern stays `{projectName}@{version}`; old semver tags are kept.
- Only a `push` to `main` tags, publishes or pushes `:latest`. `workflow_dispatch` and `pull_request` are verify runs.
- Every `run:` step that pipes into `tee` starts with `set -o pipefail`.
- Comments follow the repo allow-list: only an external-constraint one-liner, a lint-suppression reason, or `TODO(<ticket>)`.
- Commits: conventional, path-scoped `git add`, normal signed `git commit`, trailers `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm`.

## Review Focus

- Affected base is all zeros (first push of a branch) or a force-pushed SHA no longer in history: the action must fall back to `HEAD~1`, not fail or release everything. Pinned by the parser tests in Task 2 and the base-guard step in Task 2.
- Nx prints plugin warnings or extra lines on stdout around the JSON: the parser must still find the array; no array at all must fail loudly. Pinned in Task 2.
- A verify run (`pull_request`, `workflow_dispatch`) must never create or push a git tag or an image. Pinned by `--git-tag="$IS_DEPLOY"` and the early exit in Task 3, checked in Task 4.
- A project is affected but `nx release version` produced no tag at `HEAD`: the `:latest` step must fail the job instead of retagging a stale image. Pinned in Task 3.
- Two pushes to `main` in quick succession: the second must queue, not cancel the first mid-publish. Pinned by the concurrency block in Task 3.

---

### Task 1: `@nx/docker` and the docker release group

**Files:**

- Modify: `package.json` (devDependencies), `pnpm-lock.yaml`
- Modify: `nx.json` (`plugins`, `release`)
- Modify: `apps/personal-calibre/package.json`, `apps/personal-memories/package.json`, `apps/rss-manager/package.json` (`nx.tags`, `nx.release`)

**Interfaces:**

- Produces: target `docker:build` on the three apps; tag `docker` on them; release group `docker-apps` in docker mode with scheme `prod`. Task 3 calls `nx release version --projects=<csv> --dockerVersionScheme=prod` and `nx release publish --projects=<csv>`, and reads tags `<projectName>@<version>` at `HEAD`.

- [ ] **Step 1: Show the target does not exist yet**

Run: `pnpm exec nx show project personal-memories --json | node -e 'const p=JSON.parse(require("fs").readFileSync(0));console.log(Object.keys(p.targets).filter(t=>t.startsWith("docker")))'`
Expected: `[]`

- [ ] **Step 2: Add the plugin**

Run: `pnpm add -D -w @nx/docker@23.1.0`

In `nx.json` append to `plugins`:

```json
{
  "plugin": "@nx/docker",
  "options": {
    "buildTarget": {
      "name": "docker:build",
      "cwd": ".",
      "args": ["--file {projectRoot}/Dockerfile", "--platform linux/arm64"]
    },
    "runTarget": "docker:run"
  }
}
```

- [ ] **Step 3: Replace `release` in `nx.json`**

```json
"release": {
  "git": { "commit": false, "tag": true, "push": true, "stageChanges": false },
  "groups": {
    "docker-apps": {
      "projects": ["personal-calibre", "personal-memories", "@rainforest-monorepo/rss-manager"],
      "projectsRelationship": "independent",
      "releaseTag": { "pattern": "{projectName}@{version}" },
      "docker": {
        "groupPreVersionCommand": "pnpm exec nx run-many -t docker:build -p \"${NX_DOCKER_BUILD_PROJECTS:-tag:docker}\"",
        "versionSchemes": { "prod": "{currentDate|YYYY.MM.DD}.{shortCommitSha}" },
        "skipVersionActions": true,
        "registryUrl": "ghcr.io"
      }
    }
  }
}
```

This drops the old `version.preVersionCommand`, the group's `version` block and `changelog`, as the spec says.

- [ ] **Step 4: Per-app repository names and tag**

In each app's `package.json` `nx` object add (shown for personal-memories; use `rainforest-dev/personal-calibre` and `rainforest-dev/rss-manager` for the others):

```json
"tags": ["docker"],
"release": { "docker": { "repositoryName": "rainforest-dev/personal-memories" } }
```

If an app already has `tags`, append `"docker"` instead of replacing them.

- [ ] **Step 5: Verify the inferred target**

Run: `pnpm exec nx show project personal-memories --json | node -e 'const p=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify(p.targets["docker:build"].options))'`
Expected: `cwd` is `.` and `args` contains `--tag apps-personal-memories`, `--file apps/personal-memories/Dockerfile`, `--platform linux/arm64`. Repeat for `personal-calibre` and `@rainforest-monorepo/rss-manager`.

Run: `pnpm exec nx show projects --withTarget=docker:build`
Expected: exactly the three apps.

- [ ] **Step 6: Dry-run one release locally**

Run: `NX_DOCKER_BUILD_PROJECTS=personal-memories pnpm exec nx release version --projects=personal-memories --dockerVersionScheme=prod --git-tag=false --git-commit=false --stage-changes=false --dry-run --verbose`
Expected: the docker build runs and succeeds (it is not skipped by `--dry-run`), and the log names `ghcr.io/rainforest-dev/personal-memories:<YYYY.MM.DD>.<sha7>`. No tag is created (`git tag --points-at HEAD` prints nothing).

If `docker:build` has `dependsOn` that builds the app outside Docker first, note it in the report; do not change it unless the build fails.

- [ ] **Step 7: Lint and commit**

Run: `pnpm exec nx format:check --files nx.json apps/personal-calibre/package.json apps/personal-memories/package.json apps/rss-manager/package.json package.json`
Expected: clean (fix with `nx format:write` on the same files).

```bash
git add package.json pnpm-lock.yaml nx.json apps/personal-calibre/package.json apps/personal-memories/package.json apps/rss-manager/package.json
git commit -m "build(release): version the Docker apps with @nx/docker and CalVer"
```

### Task 2: Affected-apps composite action

**Files:**

- Create: `.github/actions/nx-affected-docker-apps/action.yml`
- Create: `.github/actions/nx-affected-docker-apps/parse-affected.mjs`
- Test: `.github/actions/nx-affected-docker-apps/parse-affected.test.mjs`

**Interfaces:**

- Produces: composite action with inputs `base` (default `''`) and `head` (default `HEAD`), output `affected`: comma-separated nx project names, empty string when none. `parse-affected.mjs` exports `parseAffected(stdout: string): string[]` (throws `Error('no affected-projects JSON array in nx output')` when none is found) and, when run as a script, reads stdin and writes the joined list to stdout, exiting 3 on failure.

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAffected } from './parse-affected.mjs';

test('parses a clean JSON array', () => {
  assert.deepEqual(
    parseAffected('["personal-memories","@rainforest-monorepo/rss-manager"]\n'),
    ['personal-memories', '@rainforest-monorepo/rss-manager'],
  );
});

test('an empty array means nothing affected', () => {
  assert.deepEqual(parseAffected('[]'), []);
});

test('finds the array after plugin noise on stdout', () => {
  const out =
    'warn: next.config loaded\n{"not":"an array"}\n["personal-calibre"]\n';
  assert.deepEqual(parseAffected(out), ['personal-calibre']);
});

test('takes the last array line when several are printed', () => {
  assert.deepEqual(parseAffected('["stale"]\nnoise\n["personal-memories"]'), [
    'personal-memories',
  ]);
});

test('fails loudly when there is no array at all', () => {
  assert.throws(
    () => parseAffected('NX  Failed to process project graph'),
    /no affected-projects JSON array/,
  );
});

test('fails loudly on empty output', () => {
  assert.throws(() => parseAffected(''), /no affected-projects JSON array/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test .github/actions/nx-affected-docker-apps/parse-affected.test.mjs`
Expected: FAIL, cannot find module `./parse-affected.mjs`.

- [ ] **Step 3: Implement the parser**

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const asArray = (text) => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export const parseAffected = (stdout) => {
  const whole = asArray(stdout.trim());
  if (whole) return whole;
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const found = asArray(lines[i]);
    if (found) return found;
  }
  throw new Error('no affected-projects JSON array in nx output');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(parseAffected(readFileSync(0, 'utf8')).join(','));
  } catch (error) {
    console.error(error.message);
    process.exit(3);
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test .github/actions/nx-affected-docker-apps/parse-affected.test.mjs`
Expected: 6 passing.

- [ ] **Step 5: Write the action**

```yaml
name: Resolve affected Docker apps
description: Comma-separated nx projects with a docker:build target affected between base and head.

inputs:
  base:
    description: Base ref. Empty, all zeros or unreachable falls back to HEAD~1.
    required: false
    default: ''
  head:
    description: Head ref.
    required: false
    default: HEAD

outputs:
  affected:
    description: Comma-separated project names, empty when none.
    value: ${{ steps.resolve.outputs.affected }}

runs:
  using: composite
  steps:
    - id: resolve
      shell: bash
      env:
        BASE_IN: ${{ inputs.base }}
        HEAD_IN: ${{ inputs.head }}
      run: |
        set -o pipefail
        BASE="$BASE_IN"
        if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
          BASE="HEAD~1"
        fi
        NX_ERR=$(mktemp)
        trap 'rm -f "$NX_ERR"' EXIT
        if ! NX_OUT=$(pnpm exec nx show projects --affected --base="$BASE" --head="$HEAD_IN" --withTarget=docker:build --json 2>"$NX_ERR"); then
          echo "::error::nx show projects --affected failed"
          cat "$NX_ERR" >&2
          exit 1
        fi
        echo "::group::nx affected stdout"
        printf '%s\n' "$NX_OUT"
        echo "::endgroup::"
        AFFECTED=$(printf '%s' "$NX_OUT" | node "$GITHUB_ACTION_PATH/parse-affected.mjs") || {
          echo "::error::could not find the affected-projects JSON array in nx output"
          exit 1
        }
        echo "affected=$AFFECTED" >> "$GITHUB_OUTPUT"
        echo "::notice::Affected Docker apps since $BASE: ${AFFECTED:-<none>}"
```

- [ ] **Step 6: Exercise the shell part locally**

Run: `pnpm exec nx show projects --affected --base=HEAD~1 --head=HEAD --withTarget=docker:build --json 2>/dev/null | node .github/actions/nx-affected-docker-apps/parse-affected.mjs; echo " exit=$?"`
Expected: a comma-separated list (all three apps while Task 1's `nx.json` change is in `HEAD~1..HEAD`, or empty), `exit=0`.

Run: `echo 'garbage' | node .github/actions/nx-affected-docker-apps/parse-affected.mjs; echo " exit=$?"`
Expected: `no affected-projects JSON array in nx output` on stderr, `exit=3`.

- [ ] **Step 7: Commit**

```bash
git add .github/actions/nx-affected-docker-apps
git commit -m "ci(release): resolve affected Docker apps in a composite action"
```

### Task 3: `release.yml`, and remove the per-app workflows

**Files:**

- Create: `.github/workflows/release.yml`
- Delete: `.github/workflows/release-personal-calibre.yml`, `.github/workflows/release-personal-memories.yml`, `.github/workflows/release-rss-manager.yml`

**Interfaces:**

- Consumes: Task 1's `docker-apps` group and scheme `prod`; Task 2's action output `affected`.

- [ ] **Step 1: Write the workflow**

```yaml
name: Release Docker apps

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    paths:
      - '.github/workflows/release.yml'
      - '.github/actions/nx-affected-docker-apps/**'
      - 'nx.json'
  workflow_dispatch:

permissions:
  actions: read
  contents: write
  packages: write

concurrency:
  group: release-${{ github.ref }}-${{ github.event_name }}
  cancel-in-progress: false

env:
  NX_NO_CLOUD: ${{ vars.NX_NO_CLOUD }}

jobs:
  release:
    name: Release affected Docker apps
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: Configure git user
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Resolve affected base
        id: base
        env:
          EVENT: ${{ github.event_name }}
          BEFORE: ${{ github.event.before }}
        run: |
          if [ "$EVENT" = "push" ]; then
            echo "base=$BEFORE" >> "$GITHUB_OUTPUT"
          else
            echo "base=$(git merge-base origin/main HEAD || echo '')" >> "$GITHUB_OUTPUT"
          fi

      - name: Resolve affected Docker apps
        id: affected
        uses: ./.github/actions/nx-affected-docker-apps
        with:
          base: ${{ steps.base.outputs.base }}

      - name: Version, build and publish
        id: release
        env:
          AFFECTED: ${{ steps.affected.outputs.affected }}
          IS_DEPLOY: ${{ github.event_name == 'push' }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -o pipefail
          if [ -z "$AFFECTED" ]; then
            echo "::notice::No Docker apps affected."
            exit 0
          fi
          export NX_DOCKER_BUILD_PROJECTS="$AFFECTED"
          # release.git.push=true pushes a created tag at once, so a verify run must not create one.
          pnpm exec nx release version --projects="$AFFECTED" --dockerVersionScheme=prod \
            --git-tag="$IS_DEPLOY" --git-commit=false --stage-changes=false --verbose 2>&1 | tee /tmp/nx-release.log
          if [ "$IS_DEPLOY" != "true" ]; then
            echo "::notice::Verify run: built $AFFECTED, published nothing."
            exit 0
          fi
          pnpm exec nx release publish --projects="$AFFECTED" --verbose 2>&1 | tee -a /tmp/nx-release.log
          echo "published=true" >> "$GITHUB_OUTPUT"

      - name: Push latest
        if: steps.release.outputs.published == 'true'
        env:
          AFFECTED: ${{ steps.affected.outputs.affected }}
        run: |
          set -o pipefail
          echo "| Project | Image | Digest |" >> "$GITHUB_STEP_SUMMARY"
          echo "|---|---|---|" >> "$GITHUB_STEP_SUMMARY"
          IFS=',' read -ra PROJECTS <<< "$AFFECTED"
          for PROJECT in "${PROJECTS[@]}"; do
            TAG=$(git tag --points-at HEAD --list "${PROJECT}@*" | head -1)
            if [ -z "$TAG" ]; then
              echo "::error::No ${PROJECT}@<version> tag at HEAD; refusing to move :latest."
              exit 1
            fi
            VERSION="${TAG##*@}"
            REPO=$(node -p "require('./' + process.argv[1] + '/package.json').nx.release.docker.repositoryName" \
              "$(pnpm exec nx show project "$PROJECT" --json | node -p 'JSON.parse(require("fs").readFileSync(0)).root')")
            IMAGE="ghcr.io/${REPO}"
            docker tag "${IMAGE}:${VERSION}" "${IMAGE}:latest"
            docker push "${IMAGE}:latest"
            DIGEST=$(docker buildx imagetools inspect "${IMAGE}:${VERSION}" --format '{{json .Manifest.Digest}}' | tr -d '"')
            echo "| ${PROJECT} | \`${IMAGE}:${VERSION}\` | \`${DIGEST}\` |" >> "$GITHUB_STEP_SUMMARY"
          done
```

- [ ] **Step 2: Delete the per-app workflows**

```bash
git rm .github/workflows/release-personal-calibre.yml .github/workflows/release-personal-memories.yml .github/workflows/release-rss-manager.yml
```

- [ ] **Step 3: Lint the workflow**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/release.yml`
Expected: no findings. Fix any shellcheck finding in the workflow rather than suppressing it.

- [ ] **Step 4: Check no other file references the deleted workflows**

Run: `git grep -nE 'release-(personal-calibre|personal-memories|rss-manager)\.yml'`
Expected: matches only under `docs/` (historical plans and specs); update any README or CLAUDE.md hit to name `release.yml`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): release only the affected Docker apps from one workflow"
```

### Task 4: Verify on the PR, then after merge

**Files:** none changed unless a check fails.

- [ ] **Step 1: Open the PR**

Push the branch and open a draft PR to `main`. The body covers what, why (link the spec), verification, and "Visual evidence: not applicable, CI configuration only".

- [ ] **Step 2: Watch the verify run**

Run: `gh run list --workflow release.yml --branch ci/affected-docker-release --limit 1` then `gh run watch <id> --exit-status`
Expected: success; the "Resolve affected Docker apps" notice names all three apps (the `nx.json` change affects them); the log shows three `docker build` runs and "Verify run: built ..., published nothing".

Run: `git ls-remote --tags origin | grep -E '@20[0-9]{2}\.[0-9]{2}\.[0-9]{2}\.' || echo none`
Expected: `none`.

Record the duration of each `docker build` from the log in the PR body. If one app's cold build exceeds 15 minutes, note it as the registry-cache follow-up the spec names.

- [ ] **Step 3: After the owner merges**

Run: `gh run list --workflow release.yml --branch main --limit 1` then `gh run watch <id> --exit-status`
Expected: success; three `<project>@YYYY.MM.DD.<sha7>` tags on `origin`; `docker buildx imagetools inspect ghcr.io/rainforest-dev/<app>:latest` for each app shows a single `linux/arm64` manifest whose digest equals the versioned tag's.

Then, on a separate small commit that touches only `apps/rss-manager` (the owner's next real change there, not a synthetic one), confirm the run releases only `@rainforest-monorepo/rss-manager`.

### Task 5: Homelab digest-triggered deploys (repo rainforest-dev/rainforest-homelab)

**Files:**

- Modify: `modules/personal-memories/main.tf`, `modules/personal-calibre/main.tf`, `modules/rss-manager/main.tf` (module directory names as found in the repo)
- Modify: `variables.tf` (`personal_calibre_image` default)

- [ ] **Step 1: Add registry-digest resolution to each module**

```hcl
data "docker_registry_image" "this" {
  name = var.image
}

resource "docker_image" "this" {
  name          = var.image
  pull_triggers = [data.docker_registry_image.this.sha256_digest]
  keep_locally  = true
}
```

and in the module's `docker_container`: `image = docker_image.this.image_id`.

A locally built image (a `:local` tag set in `terraform.tfvars`) has no registry entry. For personal-calibre, whose running image is `personal-calibre:local`, stop and ask the owner whether to drop the override before planning; do not read or print `terraform.tfvars`.

- [ ] **Step 2: Fix the calibre default**

`variables.tf`: `personal_calibre_image` default and description example become `ghcr.io/rainforest-dev/personal-calibre:latest`.

- [ ] **Step 3: Plan, review, apply**

Run: `terraform fmt -recursive && terraform validate`
Run: `terraform plan -target=module.personal-memories -target=module.rss-manager -out=<scratchpad>/homelab-digest.tfplan` (add calibre only after the owner's answer), then `terraform show -no-color <plan> | grep -E 'Plan:|will be|must be replaced'`.
Expected: each targeted container replaced once, `docker_image` resources created; nothing else. Apply the saved plan file only. Never `-auto-approve`.

Run: `terraform plan -target=module.personal-memories -target=module.rss-manager`
Expected: `No changes.`

- [ ] **Step 4: Smoke-test and PR**

Run: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3004/` and the rss-manager port from its module.
Expected: `200` each.

Commit (`feat(docker): redeploy the monorepo apps when their registry digest changes`), push a branch, open a PR, report the URL.
