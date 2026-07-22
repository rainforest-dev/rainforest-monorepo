import { describe, expect, it } from 'vitest';

import {
  affectedFrom,
  affectedFromFiles,
  CHANGED_FILES,
  PROJECTS,
  renderPipelineLog,
  shouldDeploy,
} from './logic';

describe('affected-pipeline logic — affectedFrom', () => {
  it('returns an empty set for an empty seed', () => {
    expect(affectedFrom([])).toEqual(new Set());
  });

  it('walks forward: a leaf dependency affects everything that (transitively) depends on it', () => {
    const result = affectedFrom(['api-client']);
    expect(result).toEqual(new Set(['api-client', 'auth', 'web', 'e2e', 'load']));
    expect(result.has('ui')).toBe(false);
  });

  it('a different leaf only affects its own dependents', () => {
    const result = affectedFrom(['ui']);
    expect(result).toEqual(new Set(['ui', 'web', 'e2e', 'load']));
    expect(result.has('auth')).toBe(false);
    expect(result.has('api-client')).toBe(false);
  });

  it('an unrelated seed id does not spuriously affect anything else', () => {
    expect(affectedFrom(['e2e'])).toEqual(new Set(['e2e']));
  });
});

describe('affected-pipeline logic — affectedFromFiles', () => {
  it('a file with no hits (e.g. README.md) affects nothing', () => {
    expect(affectedFromFiles(['README.md'])).toEqual(new Set());
  });

  it('a middleware change affects web and its e2e/load consumers', () => {
    expect(affectedFromFiles(['apps/web/middleware.ts'])).toEqual(
      new Set(['web', 'e2e', 'load']),
    );
  });

  it('an auth-lib change affects auth, web, e2e, and load', () => {
    expect(
      affectedFromFiles(['libs/auth/src/getRolesFromJwt.ts']),
    ).toEqual(new Set(['auth', 'web', 'e2e', 'load']));
  });

  it('resolves against the real CHANGED_FILES/PROJECTS graph by default', () => {
    expect(CHANGED_FILES.length).toBeGreaterThan(0);
    expect(PROJECTS.find((p) => p.id === 'web')?.deps).toContain('auth');
  });
});

describe('affected-pipeline logic — shouldDeploy', () => {
  it('only deploys on a push to main, never on a PR', () => {
    expect(shouldDeploy('pr')).toBe(false);
    expect(shouldDeploy('push')).toBe(true);
  });
});

describe('affected-pipeline logic — renderPipelineLog', () => {
  it('reports nothing affected and a PR-only note when nothing changed on a PR', () => {
    const lines = renderPipelineLog(new Set(), 'pr');
    expect(lines).toContain('  nothing affected — 0 projects');
    expect(lines).toContain('  PR check · image push runs on main only');
    expect(lines.some((l) => l.includes('helm upgrade'))).toBe(false);
  });

  it('lists each built project once test/build has run', () => {
    const lines = renderPipelineLog(affectedFrom(['ui']), 'pr');
    expect(lines).toContain('  ✓ @opencgt/ui  test build');
    expect(lines).toContain('  ✓ @opencgt/web  test build');
    expect(lines.some((l) => l.includes('web-e2e:e2e'))).toBe(false);
  });

  it('pushes the image and runs the Playwright/k6 suites when web is affected on push', () => {
    const lines = renderPipelineLog(affectedFrom(['ui']), 'push');
    expect(lines.some((l) => l.includes('helm upgrade opencgt'))).toBe(true);
    expect(lines.some((l) => l.includes('web-e2e:e2e'))).toBe(true);
    expect(lines.some((l) => l.includes('web-load:k6'))).toBe(true);
  });

  it('still deploys the image on push even when web itself is not affected, but skips e2e/k6', () => {
    const lines = renderPipelineLog(new Set(), 'push');
    expect(lines.some((l) => l.includes('helm upgrade opencgt'))).toBe(true);
    expect(lines.some((l) => l.includes('web-e2e:e2e'))).toBe(false);
    expect(lines.some((l) => l.includes('web-load:k6'))).toBe(false);
  });
});
