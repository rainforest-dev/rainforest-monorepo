import { cookies } from 'next/headers';

import { parsePrefs, type Prefs, PREFS_COOKIE } from '@/lib/prefs';

export async function readPrefs(): Promise<Prefs> {
  return parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
}
