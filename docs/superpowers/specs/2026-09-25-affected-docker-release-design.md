# One release workflow for the Docker apps, driven by `nx affected`

Status: approved in chat 2026-09-25, pending spec review.

## Why

Three near-identical workflows (`release-personal-calibre.yml`, `release-personal-memories.yml`,
`release-rss-manager.yml`) release the three Docker apps. They trigger on `paths:` filters, so a
change to `libs/rainforest-ui`, the lockfile or a shared config never releases the apps that
depend on it. They build `linux/amd64,linux/arm64` under QEMU on an x64 runner, which took over
50 minutes for v2a of personal-memories, and `cancel-in-progress` let a manual dispatch cancel
the push-triggered release of the same commit.

An Nx monorepo the owner works in elsewhere already releases its Docker apps with `@nx/docker`
and one workflow per environment. This design copies that shape for a single environment.

## Outcome

- One workflow, `.github/workflows/release.yml`, releases exactly the Docker apps affected by a
  push to `main`, including through library and lockfile changes.
- Images are built natively for `linux/arm64` only; the homelab (Apple Silicon) is the sole
  consumer.
- Versions are CalVer, `YYYY.MM.DD.<shortSha>`.
- A manual run builds the affected images to verify the pipeline and publishes nothing.
- The homelab redeploys a container whenever the registry digest of its image changes, without
  `-replace` or a manual pull.

## Nx configuration (`nx.json`, app manifests)

Add `@nx/docker` at the workspace's nx version (23.1.0) and register the plugin:

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

The plugin infers `docker:build` for every project that has a Dockerfile: today exactly the three
apps. The target runs `docker build .` in `cwd` with `--tag <imageRef>` prepended to `args`, and
`imageRef` defaults to the project root with slashes turned into dashes
(`apps-personal-memories`). Setting `cwd` to the workspace root and passing `--file` keeps the
existing Dockerfiles, which all expect the repository root as build context, unchanged.

The `docker-apps` release group switches from semver to docker versioning:

```json
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
```

The nx project names are `personal-calibre`, `personal-memories` and
`@rainforest-monorepo/rss-manager` (the last has no `nx.name`, so its scoped package name is the
project name). Each app's `package.json` sets `nx.release.docker.repositoryName` to
`rainforest-dev/<app>` and adds the `docker` tag, which the default in `groupPreVersionCommand`
selects for local runs. The pushed references stay the ones the old workflows used:
`ghcr.io/rainforest-dev/personal-calibre`, `ghcr.io/rainforest-dev/personal-memories` and
`ghcr.io/rainforest-dev/rss-manager`, all public.

Top-level `release.git` becomes `{ "commit": false, "tag": true, "push": false, "stageChanges": false }`.
nx's version step pushes the current branch (`git push --follow-tags --no-verify --atomic`)
whenever `release.git.push` is true, even on a run that passes `--git-tag=false`, so pushing
stays out of nx's hands: nx only tags locally, and the workflow pushes each tag itself once that
project's image and `:latest` are already on the registry.
`release.version.preVersionCommand` (the `rainforest-ui` build) is removed: every Dockerfile
builds the library inside the image. The `version` block of the group (conventional commits,
git-tag resolver) is removed with it. The `changelog` block is removed too: with
`git.commit: false` the generated files were never kept, and no GitHub Release is created today.

Old semver tags (`personal-memories@0.x.y` and the like) stay. CalVer tags use the same
`{projectName}@` prefix and cannot collide with them.

## Workflow (`.github/workflows/release.yml`)

Triggers: `push` to `main`; `workflow_dispatch` on any branch; and `pull_request` to `main`
when the PR touches `.github/workflows/release.yml`, `.github/actions/nx-affected-docker-apps/**`
or `nx.json`. GitHub only dispatches workflows that already exist on the default branch, so the
`pull_request` trigger is how a change to the pipeline itself gets verified before merge. Both
non-push events are verify runs.

One job on `ubuntu-24.04-arm`, so arm64 builds natively without QEMU.

1. Checkout with `fetch-depth: 0`, set the bot git identity, `pnpm/action-setup`, Node 22 with
   the pnpm cache, `pnpm install --frozen-lockfile`.
2. Log in to GHCR with `GITHUB_TOKEN` (`packages: write`).
3. Resolve the base. On `push`: for every Docker project (read fresh from
   `nx show projects --withTarget=docker:build --json`, never hardcoded), find the commit of its
   newest reachable CalVer tag with `git describe --match '<project>@YYYY.MM.DD.*'` and
   `git rev-list -n1`, then take the oldest of those commits as the base. The oldest one is the
   commit that `git merge-base --is-ancestor` finds is an ancestor of every other candidate. Using
   the newest tag per project, not the newest tag across all projects, matters when a run releases
   two projects and one push fails after the other's tag and image already landed: the failed
   project's last release stays the floor for the next run's affected diff. If any project has no
   CalVer tag yet, the base falls back to `github.event.before`. On `workflow_dispatch` and
   `pull_request`: `git merge-base origin/main HEAD`. Either branch logs a notice naming the
   resolved base and where it came from; a manual run from `main` itself notes that it is
   comparing `main` with itself.
4. Resolve affected projects with a composite action,
   `.github/actions/nx-affected-docker-apps`: an empty, all-zero or unreachable base falls back to `HEAD~1`; it runs
   `nx show projects --affected --base --head --withTarget=docker:build --json` with stderr
   captured separately; it fails loudly when no JSON array can be parsed, and outputs a
   comma-separated list, empty when nothing is affected.
5. Nothing affected: a notice, and the job ends green.
6. `export NX_DOCKER_BUILD_PROJECTS="$AFFECTED"`, then
   `pnpm exec nx release version --projects="$AFFECTED" --dockerVersionScheme=prod
--git-tag="$IS_DEPLOY" --git-commit=false --stage-changes=false --verbose`. This builds the
   images through `groupPreVersionCommand` and tags them with the CalVer reference.
   `IS_DEPLOY` is true only for `push`, so a verify run passes `--git-tag=false` and creates no
   tag at all; with `release.git.push: false`, nx itself never pushes on either kind of run.
7. Verify run: a notice, and the job ends here.
8. `pnpm exec nx release publish --projects="$AFFECTED" --verbose` pushes each versioned image.
9. Two passes over the affected projects. First, a validation pass resolves every project's
   `<project>@<version>` tag at `HEAD` and fails the job before any `docker` or `git push` if one
   is missing, so a partial release never starts pushing. Second, a push pass: for each project,
   `docker tag` and `docker push` `:latest`, then, only once `:latest` is on the registry, push
   that project's own tag (`git push origin refs/tags/<project>@<version>`), one project at a
   time, so a tag never reaches origin ahead of its image and `:latest`. The homelab follows
   `:latest`.
10. A step summary table per project: version, image reference, digest.

Every `run:` step that pipes into `tee` uses `set -o pipefail`; the old workflows shipped a
silent-green release through exactly that.

Concurrency: group `release-${{ github.ref }}-${{ github.event_name }}` with
`cancel-in-progress: false`. A manual verify run can no longer cancel a release, and two pushes
to `main` queue instead of the second cancelling the first half-way through a push.

Permissions: `contents: write` (tags), `packages: write`, `actions: read`.

The three `release-*.yml` workflows are deleted in the same change.

## Homelab (rainforest-dev/rainforest-homelab, separate PR)

Each of the three app modules resolves its image by digest:

```hcl
data "docker_registry_image" "this" { name = var.image }

resource "docker_image" "this" {
  name          = var.image
  pull_triggers = [data.docker_registry_image.this.sha256_digest]
  keep_locally  = true
}
```

and the container sets `image = docker_image.this.image_id`. A new push to `:latest` changes the
digest, the plan shows the container replaced, and `apply` pulls the image itself.

`personal_calibre_image` defaults to `ghcr.io/rainforest-dev/rainforest-monorepo/personal-calibre:latest`,
a path nothing pushes to any more (anonymous pulls get 403), and the running container uses a
locally built `personal-calibre:local` set in the gitignored `terraform.tfvars`. The default
moves to `ghcr.io/rainforest-dev/personal-calibre:latest`; the owner decides whether to drop the
local override and follow the registry.

## Verification

- Before merge: the `pull_request` verify run on this PR. The affected list must name the apps the
  branch touches (the change to `nx.json` affects all three), all three images must build on
  the arm runner, and no tag or image may be pushed.
- Measure the build time of the verify run. If a cold build of one app exceeds 15 minutes, add
  a registry cache (`--cache-from`) in a follow-up; it needs a per-project reference that the
  plugin args cannot express today.
- After merge: the first push releases all three apps (the `nx.json` change affects them), each
  with a CalVer tag, a versioned image and `:latest`. A later commit that touches only
  `apps/rss-manager` must release only rss-manager.
- Homelab: after its PR, `terraform plan` shows the three containers replaced once (the image
  attribute changes from a name to an ID), then no changes; after the next release of one app,
  exactly that container is replaced.

## Risks

- `docker_registry_image` needs to read GHCR. The three packages answer anonymous pulls
  (checked 2026-09-25), so no `registry_auth` is needed.
- `nx show projects --affected` computes against the project graph. A change outside every
  project's inputs, such as a workflow file alone, affects nothing and releases nothing. That is
  intended; a manual dispatch covers pipeline changes.
- The private `ghcr.io/rainforest-dev/rainforest-monorepo/personal-calibre` package is stale.
  It is left in place and can be deleted by hand later.
- A pull request that touches only the workflow file or the composite action, without touching
  `nx.json` or any project, is not an input to any project's build. `nx show projects --affected`
  resolves an empty set and the verify run ends at step 5, so it never exercises the version,
  publish or tag-push steps. Reading the diff by hand, or making a change that also touches
  `nx.json`, stays necessary to cover those steps before merge.
