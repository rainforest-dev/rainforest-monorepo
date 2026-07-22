import { describe, expect, it } from 'vitest';

import {
  DEFAULT_POLICIES,
  enforce,
  g,
  GROUPINGS,
  isAllowed,
  keyMatch,
  regexMatch,
} from './logic';

describe('casbin-playground logic — keyMatch', () => {
  it('matches exactly when the policy object has no wildcard', () => {
    expect(keyMatch('/users', '/users')).toBe(true);
    expect(keyMatch('/users', '/patients')).toBe(false);
  });

  it('matches by path prefix when the wildcard is not at the start', () => {
    expect(keyMatch('/patients/123', '/patients/*')).toBe(true);
    expect(keyMatch('/materials/9', '/patients/*')).toBe(false);
  });

  it('matches anything when the object is the bare wildcard', () => {
    expect(keyMatch('/anything/at/all', '/*')).toBe(true);
    expect(keyMatch('/anything', '*')).toBe(true);
  });
});

describe('casbin-playground logic — regexMatch', () => {
  it('matches an action against a regex pattern', () => {
    expect(regexMatch('write', 'read|write')).toBe(true);
    expect(regexMatch('delete', 'read|write')).toBe(false);
  });

  it('is false for an invalid pattern instead of throwing', () => {
    expect(regexMatch('read', '(')).toBe(false);
  });
});

describe('casbin-playground logic — g (role grouping)', () => {
  it('is true when the request subject equals the policy subject', () => {
    expect(g('root', 'root', GROUPINGS)).toBe(true);
  });

  it('is true when a grouping maps the request subject to the policy subject', () => {
    expect(g('alice', 'hospital_admin', GROUPINGS)).toBe(true);
  });

  it('is false with no direct match and no grouping', () => {
    expect(g('alice', 'manufacturer_admin', GROUPINGS)).toBe(false);
  });
});

describe('casbin-playground logic — enforce / isAllowed', () => {
  it('allows root anything via the fixed root policy', () => {
    const rows = enforce(
      { sub: 'root', obj: '/patients/123', act: 'read' },
      DEFAULT_POLICIES,
    );
    expect(rows.some((r) => r.match)).toBe(true);
    expect(isAllowed({ sub: 'root', obj: '/users', act: 'delete' }, DEFAULT_POLICIES)).toBe(
      true,
    );
  });

  it('allows hospital_admin to read/write patients but not materials', () => {
    expect(
      isAllowed(
        { sub: 'hospital_admin', obj: '/patients/123', act: 'read' },
        DEFAULT_POLICIES,
      ),
    ).toBe(true);
    expect(
      isAllowed(
        { sub: 'hospital_admin', obj: '/materials/9', act: 'read' },
        DEFAULT_POLICIES,
      ),
    ).toBe(false);
  });

  it('denies manufacturer_admin write on shipments (policy only grants read)', () => {
    expect(
      isAllowed(
        { sub: 'manufacturer_admin', obj: '/shipments/1', act: 'write' },
        DEFAULT_POLICIES,
      ),
    ).toBe(false);
    expect(
      isAllowed(
        { sub: 'manufacturer_admin', obj: '/shipments/1', act: 'read' },
        DEFAULT_POLICIES,
      ),
    ).toBe(true);
  });

  it('allows manufacturer_admin any action on materials via the wildcard act', () => {
    expect(
      isAllowed(
        { sub: 'manufacturer_admin', obj: '/materials/9', act: 'delete' },
        DEFAULT_POLICIES,
      ),
    ).toBe(true);
  });

  it('grants alice hospital_admin access through the role grouping', () => {
    expect(
      isAllowed(
        { sub: 'alice', obj: '/patients/123', act: 'write' },
        DEFAULT_POLICIES,
      ),
    ).toBe(true);
  });

  it('flips DENY to ALLOW when a policy row is edited to widen its action', () => {
    const before = isAllowed(
      { sub: 'manufacturer_admin', obj: '/shipments/1', act: 'write' },
      DEFAULT_POLICIES,
    );
    expect(before).toBe(false);

    const widened = DEFAULT_POLICIES.map((row) =>
      row.sub === 'manufacturer_admin' && row.obj === '/shipments/*'
        ? { ...row, act: '*' }
        : row,
    );
    const after = isAllowed(
      { sub: 'manufacturer_admin', obj: '/shipments/1', act: 'write' },
      widened,
    );
    expect(after).toBe(true);
  });
});
