export type Role = 'hospital_admin' | 'manufacturer_admin' | 'root';

export interface NavItem {
  id: string;
  label: string;
  roles: Role[];
  description: string;
}

/** Mirrors the real per-role resource map — one source of truth for both the sidebar and the route guard. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    roles: ['hospital_admin', 'manufacturer_admin', 'root'],
    description: 'Program overview across every active therapy.',
  },
  {
    id: 'patients',
    label: 'Patients',
    roles: ['hospital_admin', 'root'],
    description: 'Chain-of-Identity for every enrolled patient.',
  },
  {
    id: 'enrollment',
    label: 'Enrollment',
    roles: ['hospital_admin', 'root'],
    description: 'Start and track a new patient enrollment.',
  },
  {
    id: 'materials',
    label: 'Materials',
    roles: ['manufacturer_admin', 'root'],
    description: 'Apheresis and drug-product lots.',
  },
  {
    id: 'shipments',
    label: 'Shipments',
    roles: ['manufacturer_admin', 'root'],
    description: 'Cryo shipments moving between sites.',
  },
  {
    id: 'orders',
    label: 'Orders',
    roles: ['hospital_admin', 'manufacturer_admin', 'root'],
    description: 'Treatment orders currently in flight.',
  },
  {
    id: 'users',
    label: 'Users & roles',
    roles: ['root'],
    description: 'Org members and their assigned roles.',
  },
];

/** The sidebar items a role's `<CanAccess>` wrapper lets through. */
export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Whether `routeId` is off-limits for `role` — an unknown route is always
 * forbidden. The same check backs both the client `<CanAccess>` gate and
 * the `middleware.ts` server rewrite, so a direct link can't bypass it.
 */
export function isForbidden(role: Role, routeId: string): boolean {
  const item = findNavItem(routeId);
  return !item || !item.roles.includes(role);
}

export function findNavItem(routeId: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.id === routeId);
}
