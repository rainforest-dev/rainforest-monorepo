export type PersonaId = 'hospital' | 'manufacturer' | 'root';

/** `RoleEnum` — the only three values `getRolesFromJwt()` will ever narrow to. */
export type RoleEnum = 'hospital_admin' | 'manufacturer_admin' | 'root';

export const ROLE_ENUM: RoleEnum[] = [
  'hospital_admin',
  'manufacturer_admin',
  'root',
];

export interface Persona {
  id: PersonaId;
  label: string;
  role: RoleEnum;
  org: string;
  sub: string;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  hospital: {
    id: 'hospital',
    label: "Dr. Lin · St. Mary's Hospital",
    role: 'hospital_admin',
    org: 'st-marys',
    sub: 'auth0|hosp_7f31',
  },
  manufacturer: {
    id: 'manufacturer',
    label: 'A. Rivera · Novacell Therapeutics',
    role: 'manufacturer_admin',
    org: 'novacell',
    sub: 'auth0|mfr_04ac',
  },
  root: {
    id: 'root',
    label: 'Platform operator · OpenCGT',
    role: 'root',
    org: 'opencgt',
    sub: 'auth0|root_0001',
  },
};

export const PERSONA_ORDER: PersonaId[] = ['hospital', 'manufacturer', 'root'];

/** Auth0's real, tenant-namespaced roles claim key on the token this mirrors. */
const ROLES_CLAIM_NAMESPACE = 'https://opencgt.app/roles';

/** Fixed so the fabricated token is reproducible — never a real issue time. */
const MOCK_ISSUED_AT = 1721500000;
const MOCK_EXPIRY_SECONDS = 86400;

/** Cosmetic only — a fabricated signature segment, never a real BLS/RSA signature. */
const MOCK_SIGNATURE = 'sHMa8xQ2v_Rk1p0d9F3nZ7wLtY6bC4eK2gJ0uWqN8s';

function base64UrlEncode(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  return atob(withPadding);
}

/**
 * Builds a structurally-real fabricated JWT for a persona — three base64url
 * segments, a namespaced roles claim in the payload — cosmetic only, never a
 * signed token, mirroring the shape of what NextAuth mints against Auth0.
 */
export function buildMockJwt(persona: Persona): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'ocgt_2024_09' };
  const payload: Record<string, unknown> = {
    iss: 'https://opencgt.us.auth0.com/',
    sub: persona.sub,
    aud: ['https://api.opencgt.app'],
    iat: MOCK_ISSUED_AT,
    exp: MOCK_ISSUED_AT + MOCK_EXPIRY_SECONDS,
    org_id: persona.org,
  };
  payload[ROLES_CLAIM_NAMESPACE] = [persona.role];
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${MOCK_SIGNATURE}`;
}

/** Decodes a JWT's payload segment into a plain object — null if malformed. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;
    const parsed: unknown = JSON.parse(base64UrlDecode(payloadSegment));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * `getRolesFromJwt()` — Auth0's roles claim key isn't stable (it's namespaced
 * per tenant, e.g. `https://opencgt.app/roles`), so instead of hardcoding
 * that namespace, this base64url-decodes the payload, scans the payload's
 * own keys for one containing "roles" (case-insensitive), then narrows
 * whatever it finds there to a known `RoleEnum` member. Returns null if the
 * token is malformed, no key matches, or the value isn't a real role.
 */
export function getRolesFromJwt(token: string): RoleEnum | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const claimKey = Object.keys(payload).find((key) =>
    key.toLowerCase().includes('roles'),
  );
  if (!claimKey) return null;
  const raw = payload[claimKey];
  const values = Array.isArray(raw) ? raw : [raw];
  return (
    values.find((value): value is RoleEnum =>
      ROLE_ENUM.includes(value as RoleEnum),
    ) ?? null
  );
}
