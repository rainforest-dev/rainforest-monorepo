import { startCollections } from './collections';

export default async function globalSetup(): Promise<() => Promise<void>> {
  return startCollections();
}
