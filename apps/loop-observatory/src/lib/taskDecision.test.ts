import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deliveryModeFor,
  greenlitFor,
  REMOTE_EXECUTORS,
  GREENLIGHT_TARGETS,
} from './taskDecision.js';

let savedConfig: string | undefined;
let savedEscape: string | undefined;
let dir: string;

beforeEach(() => {
  savedConfig = process.env.LOOP_CONFIG_PATH;
  savedEscape = process.env.LOOP_ALLOW_COMPANY_GREENLIGHT;
  delete process.env.LOOP_ALLOW_COMPANY_GREENLIGHT;
  dir = mkdtempSync(join(tmpdir(), 'decision-'));
  // Point at a path that cannot exist so executorReady() is false and the
  // remote branch is the one under test.
  process.env.LOOP_CONFIG_PATH = '/nonexistent/loop-config.yaml';
});

afterEach(() => {
  if (savedConfig === undefined) delete process.env.LOOP_CONFIG_PATH;
  else process.env.LOOP_CONFIG_PATH = savedConfig;
  if (savedEscape === undefined)
    delete process.env.LOOP_ALLOW_COMPANY_GREENLIGHT;
  else process.env.LOOP_ALLOW_COMPANY_GREENLIGHT = savedEscape;
  rmSync(dir, { recursive: true, force: true });
});

function configWith(slug: string): string {
  const path = join(dir, 'config.yaml');
  writeFileSync(
    path,
    `projects:\n  - slug: ${slug}\n    path: /somewhere\n`,
    'utf-8',
  );
  return path;
}

describe('deliveryModeFor', () => {
  it('is none without a project', () => {
    expect(deliveryModeFor(null)).toBe('none');
  });

  it('queues remotely for a company slug when this host cannot execute it', () => {
    expect(deliveryModeFor('service-dashboard-frontend')).toBe('remote-queue');
    expect(deliveryModeFor('service-cloud-backend')).toBe('remote-queue');
  });

  it('is none for a slug with neither a local nor a known remote executor', () => {
    expect(deliveryModeFor('obsidian-vault')).toBe('none');
  });

  it('names Air as the remote executor for both company projects', () => {
    expect(REMOTE_EXECUTORS['service-dashboard-frontend']).toBe(
      'rainforest-air',
    );
    expect(REMOTE_EXECUTORS['service-cloud-backend']).toBe('rainforest-air');
  });

  // C2: the escape hatch used to be consulted first, so setting it made a
  // company slug resolve to 'local' and mini wrote an allowlist file that
  // nothing on mini reads and Air never sees.
  it('keeps company slugs remote even with LOOP_ALLOW_COMPANY_GREENLIGHT=1', () => {
    process.env.LOOP_ALLOW_COMPANY_GREENLIGHT = '1';
    expect(deliveryModeFor('service-dashboard-frontend')).toBe('remote-queue');
    expect(deliveryModeFor('service-cloud-backend')).toBe('remote-queue');
  });

  it('keeps company slugs remote even when the local config enrols them', () => {
    process.env.LOOP_CONFIG_PATH = configWith('service-dashboard-frontend');
    expect(deliveryModeFor('service-dashboard-frontend')).toBe('remote-queue');
  });

  it('still lets the escape hatch reach a slug with no declared remote', () => {
    process.env.LOOP_ALLOW_COMPANY_GREENLIGHT = '1';
    expect(deliveryModeFor('obsidian-vault')).toBe('local');
  });
});

describe('executorReady, via deliveryModeFor on a slug with no declared remote', () => {
  it('matches a slug that the config enrols', () => {
    process.env.LOOP_CONFIG_PATH = configWith('obsidian-vault');
    expect(deliveryModeFor('obsidian-vault')).toBe('local');
  });

  // Ledger item 7: the char class was /[.*+?^${}()|[\\]\\]/g, which never
  // matched, and the replacement inserted two backslashes. An unescaped `.`
  // therefore reached the RegExp as a wildcard, so a slug could match a
  // different enrolled project and be declared locally executable.
  it('does not let a regex metacharacter in the slug match a different project', () => {
    process.env.LOOP_CONFIG_PATH = configWith('obsidianXvault');
    expect(deliveryModeFor('obsidian.vault')).toBe('none');
  });
});

describe('greenlitFor', () => {
  it('on the remote path, only an applied or duplicate ack counts as greenlit', () => {
    expect(greenlitFor('remote-queue', 'applied', () => false)).toBe(true);
    expect(greenlitFor('remote-queue', 'duplicate', () => false)).toBe(true);
    expect(greenlitFor('remote-queue', 'none', () => false)).toBe(false);
    expect(greenlitFor('remote-queue', 'pending', () => false)).toBe(false);
    expect(greenlitFor('remote-queue', 'failed', () => false)).toBe(false);
  });

  it('never consults the local allowlist on the remote path', () => {
    let reads = 0;
    const count = () => {
      reads += 1;
      return true;
    };
    for (const state of [
      'none',
      'pending',
      'applied',
      'duplicate',
      'failed',
    ] as const) {
      greenlitFor('remote-queue', state, count);
    }
    expect(reads).toBe(0);
  });

  it('on the local path, defers to the allowlist and ignores the outbox', () => {
    expect(greenlitFor('local', 'none', () => true)).toBe(true);
    expect(greenlitFor('local', 'applied', () => false)).toBe(false);
  });
});

describe('a personal task can be decided on at all', () => {
  // `projectFor` opened with `task.scope !== 'work'`, so every personal task
  // returned no project and `/api/decide` skipped it before anything else was
  // computed: 20 personal tasks, 0 cards, while the queue read "67 undecided".
  //
  // The runner never agreed with that. The mini enrols `rainforest-monorepo` as
  // `greenlit-only` with `stop_at: pr-ready`, and its greenlight file has been
  // maintained by hand since 2026-08-21 with `T-` ids in it. Personal
  // greenlighting was already the practice; only this screen refused to offer
  // it.
  it('maps the two components that live in rainforest-monorepo', () => {
    expect(GREENLIGHT_TARGETS['loop-engine']?.slug).toBe('rainforest-monorepo');
    expect(GREENLIGHT_TARGETS['loop-observatory']?.slug).toBe(
      'rainforest-monorepo',
    );
  });

  it('leaves the company components exactly as they were', () => {
    expect(GREENLIGHT_TARGETS['cloud-frontend']?.slug).toBe(
      'service-dashboard-frontend',
    );
    expect(GREENLIGHT_TARGETS['cloud-backend']?.slug).toBe(
      'service-cloud-backend',
    );
  });

  it.each(['usage-tracker', 'jobsmith', 'tooling', 'personal-infra'])(
    'does not map %s, which has nowhere to deliver a decision',
    (component) => {
      // usage-tracker lives in the vault, which is enrolled read-only; the rest
      // are separate repositories enrolled on no machine. A card for one would
      // offer a decision the runner is configured to refuse or cannot receive.
      expect(GREENLIGHT_TARGETS[component]).toBeUndefined();
    },
  );

  it('gates on the component map, not on scope', () => {
    // The two disagree the moment a personal component is mapped, and the scope
    // check wins silently. Only the map can say where a decision is delivered.
    const source = readFileSync(
      join(import.meta.dirname, 'taskDecision.ts'),
      'utf-8',
    );
    const fn = source.slice(
      source.indexOf('function projectFor'),
      source.indexOf('function taskFor'),
    );
    expect(fn).not.toContain("scope !== 'work'");
    expect(fn).toContain('GREENLIGHT_TARGETS');
  });
});
