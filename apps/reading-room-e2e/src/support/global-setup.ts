import { startFeedServer } from './feed-server';
import { resetKbVault } from './kb-vault';
import { resetVault } from './vault';

export default async function globalSetup(): Promise<() => Promise<void>> {
  resetVault();
  resetKbVault();
  return startFeedServer();
}
