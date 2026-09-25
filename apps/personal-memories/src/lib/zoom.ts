import { monthOf } from './months.ts';
import { type Place, placeOf } from './nav.ts';

export function morphKey(
  from: Place | undefined,
  to: Place | undefined,
): string | undefined {
  if (!from || !to || from.level === to.level) return undefined;
  const day =
    from.level === 'day' ? from.date : to.level === 'day' ? to.date : undefined;
  if (day) {
    const other = from.level === 'day' ? to : from;
    if (other.level === 'month' && other.month !== monthOf(day))
      return undefined;
    return `day-${day}`;
  }
  const month =
    from.level === 'month'
      ? from.month
      : to.level === 'month'
        ? to.month
        : undefined;
  return month ? `month-${month}` : undefined;
}

export function refererPath(
  referer: string | null,
  host: string | null,
): string | undefined {
  if (!referer || !host) return undefined;
  try {
    const url = new URL(referer);
    return url.host === host ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

export function morphFromRequest(
  request: Request,
  url: URL,
): string | undefined {
  // Behind the Cloudflare tunnel, url.origin is the server's own origin, not
  // the public one the browser puts in Referer — the Host header is.
  const from = refererPath(
    request.headers.get('referer'),
    request.headers.get('host') ?? url.host,
  );
  return from === undefined
    ? undefined
    : morphKey(placeOf(from), placeOf(url.pathname));
}

export const morphAttrs = (
  key: string,
  morph: string | undefined,
): Record<string, string> =>
  morph === key
    ? { style: `view-transition-name: ${key}`, 'data-morph-target': '' }
    : {};
