/**
 * Pure state transition mirroring `chrome.idle.setDetectionInterval`: once
 * accumulated idle time reaches the configured threshold, the wallet locks.
 * The boundary is inclusive — idle time equal to the threshold locks.
 */
export function nextLockState(
  idleMs: number,
  thresholdMs: number,
): 'active' | 'locked' {
  return idleMs >= thresholdMs ? 'locked' : 'active';
}
