import { startFeedServer } from './feed-server';
import { resetVault } from './vault';

export default async function globalSetup(): Promise<() => Promise<void>> {
  resetVault();
  return startFeedServer();
}
