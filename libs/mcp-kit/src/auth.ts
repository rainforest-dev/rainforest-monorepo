import { createHash, timingSafeEqual } from 'node:crypto';

export type AuthResult =
  | { status: 'ok'; user?: string }
  | { status: 'unauthorized' }
  | { status: 'disabled' };

export type McpAuth = (request: Request) => AuthResult | Promise<AuthResult>;

export interface GatewayAuthOptions {
  header: string;
  secret: string | undefined;
  userHeader?: string;
}

const digest = (value: string): Buffer =>
  createHash('sha256').update(value, 'utf8').digest();

/**
 * Accepts only requests carrying `header: secret`, as set by the OAuth gateway Worker.
 *
 * Both values are SHA-256 hashed before `timingSafeEqual`, so the comparison takes the same time
 * whatever the presented value's length. A blank or unset `secret` answers `disabled` for every
 * request. With `userHeader`, a request without a non-empty value for it is `unauthorized`, and
 * an accepted request carries that value as `user`.
 */
export function gatewayAuth({
  header,
  secret,
  userHeader,
}: GatewayAuthOptions): McpAuth {
  if (!secret?.trim()) return () => ({ status: 'disabled' });
  const expected = digest(secret);

  return (request) => {
    const presented = request.headers.get(header);
    if (presented === null || !timingSafeEqual(digest(presented), expected)) {
      return { status: 'unauthorized' };
    }
    if (!userHeader) return { status: 'ok' };
    const user = request.headers.get(userHeader)?.trim();
    return user ? { status: 'ok', user } : { status: 'unauthorized' };
  };
}
