import fs from 'node:fs';

import { DATA_DIR } from './env';

export default function globalSetup(): void {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
