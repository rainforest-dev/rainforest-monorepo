import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deliveryModeFor, greenlitFor, REMOTE_EXECUTORS } from './taskDecision.js';

let savedConfig: string | undefined;

beforeEach(() => {
  savedConfig = process.env.LOOP_CONFIG_PATH;
  // Point at a path that cannot exist so executorReady() is false and the
  // remote branch is the one under test.
  process.env.LOOP_CONFIG_PATH = '/nonexistent/loop-config.yaml';
});

afterEach(() => {
  if (savedConfig === undefined) delete process.env.LOOP_CONFIG_PATH;
  else process.env.LOOP_CONFIG_PATH = savedConfig;
});

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
    expect(REMOTE_EXECUTORS['service-dashboard-frontend']).toBe('Angibles-MacBook-Air');
    expect(REMOTE_EXECUTORS['service-cloud-backend']).toBe('Angibles-MacBook-Air');
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
    for (const state of ['none', 'pending', 'applied', 'duplicate', 'failed'] as const) {
      greenlitFor('remote-queue', state, count);
    }
    expect(reads).toBe(0);
  });

  it('on the local path, defers to the allowlist and ignores the outbox', () => {
    expect(greenlitFor('local', 'none', () => true)).toBe(true);
    expect(greenlitFor('local', 'applied', () => false)).toBe(false);
  });
});
