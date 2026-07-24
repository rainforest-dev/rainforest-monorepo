import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { usageDir } from './ledger.js';

export const LOOP_AGENTS = ['claude', 'codex', 'agy'] as const;
export type LoopAgent = (typeof LOOP_AGENTS)[number];

export interface AgentConfig {
  default_agent: LoopAgent;
  tasks: Record<string, LoopAgent>;
}

export function isLoopAgent(value: unknown): value is LoopAgent {
  return typeof value === 'string' && LOOP_AGENTS.includes(value as LoopAgent);
}

export function agentConfigPath(): string {
  return join(usageDir(), 'loop-agents.json');
}

export function readAgentConfig(): AgentConfig {
  let raw: unknown = {};
  try {
    raw = JSON.parse(readFileSync(agentConfigPath(), 'utf-8'));
  } catch {
    // A missing or malformed config intentionally falls back to Claude.
  }

  const object = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const tasks: Record<string, LoopAgent> = {};
  const rawTasks = object.tasks;
  if (rawTasks && typeof rawTasks === 'object' && !Array.isArray(rawTasks)) {
    for (const [id, value] of Object.entries(rawTasks)) {
      if (isLoopAgent(value)) tasks[id] = value;
    }
  }

  return {
    default_agent: isLoopAgent(object.default_agent) ? object.default_agent : 'claude',
    tasks,
  };
}

function writeAgentConfig(config: AgentConfig): AgentConfig {
  const path = agentConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  renameSync(temporary, path);
  return config;
}

export function setDefaultAgent(agent: LoopAgent): AgentConfig {
  return writeAgentConfig({ ...readAgentConfig(), default_agent: agent });
}

export function setTaskAgent(id: string, agent: LoopAgent | null): AgentConfig {
  const config = readAgentConfig();
  if (agent === null) delete config.tasks[id];
  else config.tasks[id] = agent;
  return writeAgentConfig(config);
}
