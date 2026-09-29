import { FIXTURES_DIR, fixtureSize, seedFixtures } from './seed';

export default function globalSetup(): void {
  if (process.env['CALIBRE_SKIP_SEED'] === '1') return;
  const size = fixtureSize();
  seedFixtures(size);
  console.log(`[e2e] ${size} fixture library at ${FIXTURES_DIR}`);
}
