import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const asArray = (text) => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export const parseAffected = (stdout) => {
  const whole = asArray(stdout.trim());
  if (whole) return whole;
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const found = asArray(lines[i]);
    if (found) return found;
  }
  throw new Error('no affected-projects JSON array in nx output');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(parseAffected(readFileSync(0, 'utf8')).join(','));
  } catch (error) {
    console.error(error.message);
    process.exit(3);
  }
}
