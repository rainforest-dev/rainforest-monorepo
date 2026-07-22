import { describe, expect, it } from 'vitest';

import {
  REAL_METRICS,
  renderDeployLog,
  renderValuesYaml,
  resolveEnv,
  SWAP_ENVS,
} from './logic';

describe('env-deploy logic — resolveEnv', () => {
  it('resolves distinct config for each of the four environments', () => {
    expect(SWAP_ENVS).toEqual(['sandbox', 'uat', 'staging', 'prod']);
    const configs = SWAP_ENVS.map((env) => resolveEnv(env));
    const hosts = configs.map((c) => c.host);
    expect(new Set(hosts).size).toBe(4);
  });

  it('prod has the widest autoscaling range of the four environments', () => {
    const prod = resolveEnv('prod');
    const sandbox = resolveEnv('sandbox');
    expect(prod.maxReplicas).toBeGreaterThan(sandbox.maxReplicas);
    expect(prod.minReplicas).toBeGreaterThan(sandbox.minReplicas);
  });

  it('sandbox and uat share a build tag (same commit, promoted forward)', () => {
    expect(resolveEnv('sandbox').tag).toBe(resolveEnv('uat').tag);
  });
});

describe('env-deploy logic — renderValuesYaml', () => {
  it('renders the image tag and host for the selected environment', () => {
    const lines = renderValuesYaml('prod', 4);
    expect(lines).toContain('  tag: v1.8.0');
    expect(lines).toContain('  host: app.hashgreenswap.com');
    expect(lines).toContain('replicaCount: 4');
  });

  it('the replicas slider widens the HPA range beyond the env default when higher', () => {
    const lines = renderValuesYaml('sandbox', 5); // sandbox default max is 2
    expect(lines).toContain('  minReplicas: 5');
    expect(lines).toContain('  maxReplicas: 5');
  });

  it('keeps the env default HPA range when replicas is within it', () => {
    const lines = renderValuesYaml('prod', 4); // prod default is 3-12
    expect(lines).toContain('  minReplicas: 4');
    expect(lines).toContain('  maxReplicas: 12');
  });
});

describe('env-deploy logic — renderDeployLog', () => {
  it('walks build -> push -> helm upgrade -> live for the given env', () => {
    const lines = renderDeployLog('uat', 2);
    expect(lines[0]).toContain('docker build');
    expect(lines[0]).toContain('ENV=uat');
    expect(lines.some((l) => l.includes('docker push'))).toBe(true);
    expect(lines.some((l) => l.includes('helm upgrade'))).toBe(true);
    expect(lines[lines.length - 1]).toContain('live');
    expect(lines[lines.length - 1]).toContain(resolveEnv('uat').host);
  });

  it('reports the requested replica count as Ready pods', () => {
    const lines = renderDeployLog('staging', 3);
    expect(lines.some((l) => l.includes('3/3 pods Ready'))).toBe(true);
  });
});

describe('env-deploy logic — REAL_METRICS', () => {
  it('uses the exact, verified TVL and transaction figures', () => {
    expect(REAL_METRICS.tvl).toBe('$780k');
    expect(REAL_METRICS.transactions).toBe('21,494');
    expect(REAL_METRICS.breakdown).toContain('swap 11,149');
  });
});
