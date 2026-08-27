// apps/loop-observatory/src/lib/enroll/types.ts

/** What the owner declares about a host. Version-controlled, never probed. */
export interface HostDeclaration {
  host: string;
  home: string;
  roles: string[];
  scope: 'personal' | 'work';
  /**
   * Declared, never derived from a probe. Whether a machine opens a port to the
   * network must not be a side effect of what a probe happened to find. The mini
   * binds wide because its Alloy also serves a Docker bridge; a laptop that
   * joins untrusted networks must not.
   */
  otlpBind: '127.0.0.1' | '0.0.0.0';
  intervalSeconds: number;
}

/** What the device reports about itself. Re-read every run, never stored as truth. */
export interface HostFacts {
  tccICloud: 'permitted' | 'denied' | 'unknown';
  executors: string[];
  brewPrefix: string;
  otlpListening: boolean;
  vaultPath: string | null;
  accounts: {
    claudeAvailable: 'ok' | 'missing' | null;
    ghLogin: string | null;
  };
  probedAt: string;
}

export interface DerivedFile {
  /** Relative to the host's home directory. */
  path: string;
  contents: string;
}

/**
 * Thrown when derivation would have to guess. Guessing is how `vault_path()`
 * silently published a machine's entire run record to a retired clone.
 */
export class UnknownFact extends Error {
  constructor(readonly fact: string) {
    super(`cannot derive while ${fact} is unknown`);
    this.name = 'UnknownFact';
  }
}
