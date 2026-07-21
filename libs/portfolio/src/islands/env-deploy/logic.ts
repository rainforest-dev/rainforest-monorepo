export type SwapEnv = 'sandbox' | 'uat' | 'staging' | 'prod';

export interface EnvConfig {
  tag: string;
  host: string;
  namespace: string;
  minReplicas: number;
  maxReplicas: number;
}

const IMAGE_REPOSITORY = 'registry.hashgreen.net/pyke-swap';

const ENV_CONFIG: Record<SwapEnv, EnvConfig> = {
  sandbox: {
    tag: 'sha-3f9c1a2',
    host: 'swap.sandbox.hashgreen.net',
    namespace: 'pyke-sandbox',
    minReplicas: 1,
    maxReplicas: 2,
  },
  uat: {
    tag: 'sha-3f9c1a2',
    host: 'swap.uat.hashgreen.net',
    namespace: 'pyke-uat',
    minReplicas: 2,
    maxReplicas: 4,
  },
  staging: {
    tag: 'v1.8.0-rc.3',
    host: 'swap.stg.hashgreen.net',
    namespace: 'pyke-stg',
    minReplicas: 2,
    maxReplicas: 6,
  },
  prod: {
    tag: 'v1.8.0',
    host: 'app.hashgreenswap.com',
    namespace: 'pyke-prod',
    minReplicas: 3,
    maxReplicas: 12,
  },
};

export const SWAP_ENVS: SwapEnv[] = ['sandbox', 'uat', 'staging', 'prod'];

/** Resolves the per-environment Helm values for one of the four envs. */
export function resolveEnv(env: SwapEnv): EnvConfig {
  return ENV_CONFIG[env];
}

/** Renders the `values.{env}.yaml` lines shown in the tab panel. */
export function renderValuesYaml(env: SwapEnv, replicas: number): string[] {
  const cfg = resolveEnv(env);
  const minReplicas = Math.max(cfg.minReplicas, replicas);
  const maxReplicas = Math.max(cfg.maxReplicas, replicas);
  return [
    'image:',
    `  repository: ${IMAGE_REPOSITORY}`,
    `  tag: ${cfg.tag}`,
    `replicaCount: ${replicas}`,
    'ingress:',
    `  host: ${cfg.host}`,
    'autoscaling:',
    `  minReplicas: ${minReplicas}`,
    `  maxReplicas: ${maxReplicas}`,
    '  targetCPUUtilizationPercentage: 70',
  ];
}

/** Build → push → helm-upgrade log lines for the deploy animation. */
export function renderDeployLog(env: SwapEnv, replicas: number): string[] {
  const cfg = resolveEnv(env);
  return [
    `→ docker build --build-arg ENV=${env} -t ${IMAGE_REPOSITORY}:${cfg.tag}`,
    '  next build · output: standalone · layers cached',
    `→ docker push ${IMAGE_REPOSITORY}:${cfg.tag}`,
    `→ helm upgrade pyke-swap ./chart -f values.${env}.yaml -n ${cfg.namespace}`,
    `  Deployment/pyke-swap rolled · ${replicas}/${replicas} pods Ready (uid 1001)`,
    `✓ https://${cfg.host} live`,
  ];
}

/**
 * The only real numbers in the portfolio — verified in the repo comments.
 * Do not fabricate additional metrics alongside these.
 */
export const REAL_METRICS = {
  tvl: '$780k',
  volume: '$731k',
  transactions: '21,494',
  breakdown: 'swap 11,149 · add_liquidity 6,867 · zap 1,621 · remove 3,478',
} as const;
