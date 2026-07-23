import { describe, expect, it } from 'vitest';

import { findNavItem, isForbidden, NAV_ITEMS, navFor } from './logic';

describe('role-shell logic — navFor', () => {
  it('returns the nav items a hospital_admin can see', () => {
    const ids = navFor('hospital_admin').map((item) => item.id);
    expect(ids).toEqual([
      'dashboard',
      'patients',
      'enrollment',
      'orders',
    ]);
  });

  it('returns the nav items a manufacturer_admin can see', () => {
    const ids = navFor('manufacturer_admin').map((item) => item.id);
    expect(ids).toEqual(['dashboard', 'materials', 'shipments', 'orders']);
  });

  it('returns every nav item for root', () => {
    expect(navFor('root')).toHaveLength(NAV_ITEMS.length);
  });
});

describe('role-shell logic — isForbidden', () => {
  it('lets hospital_admin into patients/enrollment but not materials/shipments/users', () => {
    expect(isForbidden('hospital_admin', 'patients')).toBe(false);
    expect(isForbidden('hospital_admin', 'enrollment')).toBe(false);
    expect(isForbidden('hospital_admin', 'materials')).toBe(true);
    expect(isForbidden('hospital_admin', 'shipments')).toBe(true);
    expect(isForbidden('hospital_admin', 'users')).toBe(true);
  });

  it('lets manufacturer_admin into materials/shipments but not patients/enrollment/users', () => {
    expect(isForbidden('manufacturer_admin', 'materials')).toBe(false);
    expect(isForbidden('manufacturer_admin', 'shipments')).toBe(false);
    expect(isForbidden('manufacturer_admin', 'patients')).toBe(true);
    expect(isForbidden('manufacturer_admin', 'enrollment')).toBe(true);
    expect(isForbidden('manufacturer_admin', 'users')).toBe(true);
  });

  it('never forbids root from a real route', () => {
    for (const item of NAV_ITEMS) {
      expect(isForbidden('root', item.id)).toBe(false);
    }
  });

  it('treats an unknown route id as forbidden for every role', () => {
    expect(isForbidden('root', 'not-a-real-route')).toBe(true);
    expect(isForbidden('hospital_admin', 'not-a-real-route')).toBe(true);
  });

  it('both hospital_admin and manufacturer_admin can reach dashboard and orders', () => {
    expect(isForbidden('hospital_admin', 'dashboard')).toBe(false);
    expect(isForbidden('hospital_admin', 'orders')).toBe(false);
    expect(isForbidden('manufacturer_admin', 'dashboard')).toBe(false);
    expect(isForbidden('manufacturer_admin', 'orders')).toBe(false);
  });
});

describe('role-shell logic — findNavItem', () => {
  it('resolves a known route id to its nav item', () => {
    expect(findNavItem('patients')?.label).toBe('Patients');
  });

  it('returns undefined for an unknown route id', () => {
    expect(findNavItem('nope')).toBeUndefined();
  });
});
