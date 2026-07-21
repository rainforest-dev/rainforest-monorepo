export interface PolicyRow {
  sub: string;
  obj: string;
  act: string;
  /** `root`'s `/* / *` row is fixed — every other row's `act` is editable in the playground. */
  fixed?: boolean;
}

export interface EnforceRequest {
  sub: string;
  obj: string;
  act: string;
}

export interface EnforceResult {
  policy: PolicyRow;
  g: boolean;
  keyMatch: boolean;
  actMatch: boolean;
  match: boolean;
}

/** The real policy set — two real rows per role plus the fixed root row. */
export const DEFAULT_POLICIES: PolicyRow[] = [
  { sub: 'root', obj: '/*', act: '*', fixed: true },
  { sub: 'hospital_admin', obj: '/patients/*', act: 'read' },
  { sub: 'hospital_admin', obj: '/patients/*', act: 'write' },
  { sub: 'manufacturer_admin', obj: '/materials/*', act: '*' },
  { sub: 'manufacturer_admin', obj: '/shipments/*', act: 'read' },
];

/** `g` role groupings — casbin's role-inheritance relation, `[member, role]` pairs. */
export const GROUPINGS: [string, string][] = [['alice', 'hospital_admin']];

/**
 * `g(r.sub, p.sub)` — true if the request subject *is* the policy subject,
 * or inherits it through a grouping (e.g. alice is grouped into
 * hospital_admin).
 */
export function g(
  sub: string,
  policySub: string,
  groupings: [string, string][] = GROUPINGS,
): boolean {
  if (sub === policySub) return true;
  return groupings.some(([member, role]) => member === sub && role === policySub);
}

/**
 * `keyMatch(r.obj, p.obj)` — objects matched by path prefix. No `*` in the
 * policy object means an exact match; a `*` at the start matches anything;
 * otherwise everything before the `*` must match as a literal prefix.
 */
export function keyMatch(obj: string, policyObj: string): boolean {
  const starIndex = policyObj.indexOf('*');
  if (starIndex < 0) return obj === policyObj;
  if (starIndex === 0) return true;
  return obj.slice(0, starIndex) === policyObj.slice(0, starIndex);
}

/**
 * `regexMatch(r.act, p.act)` — actions matched by regex; an invalid pattern
 * fails closed (no match) rather than throwing.
 */
export function regexMatch(act: string, policyAct: string): boolean {
  try {
    return new RegExp(`^${policyAct}$`).test(act);
  } catch {
    return false;
  }
}

/**
 * The real matcher: `g(r.sub, p.sub) && keyMatch(r.obj, p.obj) &&
 * (p.act == '*' || regexMatch(r.act, p.act))` — evaluated against every
 * policy row so the playground can show which clause failed on each one.
 */
export function enforce(
  request: EnforceRequest,
  policies: PolicyRow[],
  groupings: [string, string][] = GROUPINGS,
): EnforceResult[] {
  return policies.map((policy) => {
    const gMatch = g(request.sub, policy.sub, groupings);
    const keyMatched = keyMatch(request.obj, policy.obj);
    const actMatch =
      policy.act === '*' || regexMatch(request.act, policy.act);
    return {
      policy,
      g: gMatch,
      keyMatch: keyMatched,
      actMatch,
      match: gMatch && keyMatched && actMatch,
    };
  });
}

/** ALLOW if any policy row matches, DENY otherwise — casbin's default `some` effect. */
export function isAllowed(
  request: EnforceRequest,
  policies: PolicyRow[],
  groupings: [string, string][] = GROUPINGS,
): boolean {
  return enforce(request, policies, groupings).some((row) => row.match);
}
