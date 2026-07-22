import { describe, expect, it } from 'vitest';

import {
  buildMockJwt,
  decodeJwtPayload,
  getRolesFromJwt,
  PERSONAS,
} from './logic';

describe('jwt-decode logic — buildMockJwt / decodeJwtPayload', () => {
  it('builds a structurally-real three-part dot-separated token', () => {
    const jwt = buildMockJwt(PERSONAS.hospital);
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('round-trips the payload back to the persona sub and org', () => {
    const jwt = buildMockJwt(PERSONAS.manufacturer);
    const payload = decodeJwtPayload(jwt);
    expect(payload).toMatchObject({
      sub: PERSONAS.manufacturer.sub,
      org_id: PERSONAS.manufacturer.org,
    });
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });
});

describe('jwt-decode logic — getRolesFromJwt', () => {
  it('extracts the correct role for each persona', () => {
    expect(getRolesFromJwt(buildMockJwt(PERSONAS.hospital))).toBe(
      'hospital_admin',
    );
    expect(getRolesFromJwt(buildMockJwt(PERSONAS.manufacturer))).toBe(
      'manufacturer_admin',
    );
    expect(getRolesFromJwt(buildMockJwt(PERSONAS.root))).toBe('root');
  });

  it("finds the claim by scanning keys for 'roles' regardless of the exact namespace", () => {
    // Auth0's roles claim key isn't stable — it's namespaced per tenant —
    // so getRolesFromJwt() must not hardcode the namespace string.
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      sub: 'auth0|whatever',
      'https://a-totally-different-tenant.example/app_roles': [
        'manufacturer_admin',
      ],
    };
    const encode = (v: unknown) =>
      btoa(JSON.stringify(v))
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const jwt = `${encode(header)}.${encode(payload)}.sig`;
    expect(getRolesFromJwt(jwt)).toBe('manufacturer_admin');
  });

  it('returns null when no key contains "roles"', () => {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { sub: 'auth0|no-roles-here' };
    const encode = (v: unknown) =>
      btoa(JSON.stringify(v))
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const jwt = `${encode(header)}.${encode(payload)}.sig`;
    expect(getRolesFromJwt(jwt)).toBeNull();
  });

  it('returns null when the roles claim holds a value outside RoleEnum', () => {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { sub: 'auth0|x', 'https://x/roles': ['superadmin'] };
    const encode = (v: unknown) =>
      btoa(JSON.stringify(v))
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const jwt = `${encode(header)}.${encode(payload)}.sig`;
    expect(getRolesFromJwt(jwt)).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(getRolesFromJwt('garbage')).toBeNull();
  });
});
