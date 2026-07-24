import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAgentConfig, setDefaultAgent, setTaskAgent } from './agents.js';

describe('agent configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to Claude when no config exists', () => {
    vi.stubEnv('VAULT_PATH', mkdtempSync(join(tmpdir(), 'loop-agents-')));
    expect(readAgentConfig()).toEqual({ default_agent: 'claude', tasks: {} });
  });

  it('persists the default and per-task overrides', () => {
    const vault = mkdtempSync(join(tmpdir(), 'loop-agents-'));
    vi.stubEnv('VAULT_PATH', vault);

    setDefaultAgent('codex');
    setTaskAgent('105', 'claude');
    expect(readAgentConfig()).toEqual({ default_agent: 'codex', tasks: { '105': 'claude' } });

    setTaskAgent('105', null);
    expect(readAgentConfig()).toEqual({ default_agent: 'codex', tasks: {} });
    expect(readFileSync(join(vault, '_system/usage/loop-agents.json'), 'utf-8')).toContain(
      '"default_agent": "codex"',
    );
  });
});
