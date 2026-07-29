export interface ProjectNode {
  id: string;
  label: string;
  /** Ids of the projects this project directly depends on. */
  deps: string[];
}

export interface ChangedFile {
  path: string;
  /** Project ids whose source lives at this path — empty for files like README.md. */
  hits: string[];
}

/** Mirrors the real Nx project graph for `apps/opencgt`. */
export const PROJECTS: ProjectNode[] = [
  { id: 'ui', label: '@opencgt/ui', deps: [] },
  { id: 'api-client', label: '@opencgt/api-client', deps: [] },
  { id: 'auth', label: '@opencgt/auth', deps: ['api-client'] },
  { id: 'web', label: '@opencgt/web', deps: ['ui', 'api-client', 'auth'] },
  { id: 'e2e', label: 'web-e2e', deps: ['web'] },
  { id: 'load', label: 'web-load', deps: ['web'] },
];

export const CHANGED_FILES: ChangedFile[] = [
  { path: 'libs/ui/src/DataTable.tsx', hits: ['ui'] },
  { path: 'libs/auth/src/getRolesFromJwt.ts', hits: ['auth'] },
  { path: 'apps/web/middleware.ts', hits: ['web'] },
  { path: 'libs/api-client/src/orders.ts', hits: ['api-client'] },
  { path: 'README.md', hits: [] },
];

/**
 * Walks the Nx project graph forward from a seed set of directly-touched
 * project ids: any project with a dependency already in the affected set
 * is itself affected, repeated to a fixed point — the same walk `nx
 * affected` runs over the real graph.
 */
export function affectedFrom(
  seedIds: Iterable<string>,
  projects: ProjectNode[] = PROJECTS,
): Set<string> {
  const affected = new Set(seedIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const project of projects) {
      if (
        !affected.has(project.id) &&
        project.deps.some((dep) => affected.has(dep))
      ) {
        affected.add(project.id);
        grew = true;
      }
    }
  }
  return affected;
}

/** Resolves a set of "changed" file paths to the affected project ids. */
export function affectedFromFiles(
  changedPaths: Iterable<string>,
  files: ChangedFile[] = CHANGED_FILES,
  projects: ProjectNode[] = PROJECTS,
): Set<string> {
  const changedSet = new Set(changedPaths);
  const seed = new Set<string>();
  for (const file of files) {
    if (changedSet.has(file.path)) {
      file.hits.forEach((id) => seed.add(id));
    }
  }
  return affectedFrom(seed, projects);
}

export type PipelineEvent = 'pr' | 'push';

/** The signed image push + Helm rollout only run on a push to main, never on a PR. */
export function shouldDeploy(event: PipelineEvent): boolean {
  return event === 'push';
}

/**
 * Renders the CI log lines for a run — `nx-set-shas` then `nx affected`,
 * and on a push to main, the container push + Helm upgrade, gated further
 * by whether `web` itself is affected before running the Playwright/k6
 * suites.
 */
export function renderPipelineLog(
  affected: Set<string>,
  event: PipelineEvent,
  projects: ProjectNode[] = PROJECTS,
): string[] {
  const built = projects.filter(
    (p) => affected.has(p.id) && p.id !== 'e2e' && p.id !== 'load',
  );
  const lines = [
    '$ npx nx-set-shas',
    '  base=origin/main  head=HEAD',
    '$ nx affected -t test,build --exclude=tag:e2e',
  ];
  if (built.length === 0) {
    lines.push('  nothing affected — 0 projects');
  } else {
    built.forEach((p) => lines.push(`  ✓ ${p.label}  test build`));
  }
  if (shouldDeploy(event)) {
    lines.push('$ nx affected -t container --configuration=production');
    lines.push('  → push registry.opencgt.app/web:sha-9f2a1c');
    lines.push('$ helm upgrade opencgt ./chart -n prod');
    lines.push('  Deployment/web rolled · 3/3 Ready');
    if (affected.has('web')) {
      lines.push('$ nx run web-e2e:e2e   playwright · 3 roles');
      lines.push('$ nx run web-load:k6    100 VUs · checks 1.00');
    }
  } else {
    lines.push('  PR check · image push runs on main only');
  }
  return lines;
}
