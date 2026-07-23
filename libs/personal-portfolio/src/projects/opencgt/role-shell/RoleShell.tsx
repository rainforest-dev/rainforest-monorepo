import { type JSX, useEffect, useState } from 'react';

import { cx, segment } from '../../../shared/ui';
import { useReducedMotion } from '../../../shared/useReducedMotion';
import { findNavItem, isForbidden, NAV_ITEMS, navFor, type Role } from './logic';

interface RoleOption {
  id: Role;
  label: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { id: 'hospital_admin', label: 'Hospital' },
  { id: 'manufacturer_admin', label: 'Manufacturer' },
  { id: 'root', label: 'Root' },
];

const ROLE_ACTIONS: { label: string; role: Role }[] = [
  { label: 'Enroll patient', role: 'hospital_admin' },
  { label: 'Register material lot', role: 'manufacturer_admin' },
  { label: 'Manage users', role: 'root' },
];

const DENY_STEP_DELAY_MS = 450;

export function RoleShell(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [role, setRole] = useState<Role>('hospital_admin');
  const [route, setRoute] = useState('dashboard');
  const [denyRoute, setDenyRoute] = useState<string | null>(null);
  const [denyStage, setDenyStage] = useState(0);

  // The forbidden-route "rewrite" plays out over two beats — middleware
  // rewriting, then the 404 body — so the disclosure reads as a real
  // server round-trip rather than an instant swap.
  useEffect(() => {
    if (denyRoute === null) return undefined;
    if (reducedMotion) {
      setDenyStage(2);
      return undefined;
    }
    if (denyStage >= 2) return undefined;
    const t = setTimeout(
      () => setDenyStage((prev) => prev + 1),
      DENY_STEP_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [denyRoute, denyStage, reducedMotion]);

  const handleRole = (next: Role) => {
    const stillOk = !isForbidden(next, route);
    setRole(next);
    setRoute(stillOk ? route : 'dashboard');
    setDenyRoute(null);
    setDenyStage(0);
  };

  const go = (routeId: string) => {
    if (isForbidden(role, routeId)) {
      setDenyRoute(routeId);
      setDenyStage(0);
    } else {
      setRoute(routeId);
      setDenyRoute(null);
      setDenyStage(0);
    }
  };

  const nav = navFor(role);
  const current = findNavItem(route);
  const actions = ROLE_ACTIONS.filter(
    (action) => role === 'root' || action.role === role,
  );

  return (
    <div className="border-border bg-card text-card-foreground overflow-hidden rounded-xl border">
      <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-muted-foreground text-xs">Signed in as</span>
        <div className="bg-muted inline-flex gap-1 rounded-lg p-1">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={role === option.id}
              onClick={() => handleRole(option.id)}
              className={segment(role === option.id, 'h-7 px-3 text-xs font-bold')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[220px]">
        <div className="border-border bg-muted/10 flex w-[168px] shrink-0 flex-col gap-1 border-r p-3">
          <div className="text-muted-foreground px-2 py-1 text-[10px] tracking-wide uppercase">
            Navigation
          </div>
          {nav.map((item) => {
            const selected = route === item.id && denyRoute === null;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => go(item.id)}
                className={cx(
                  'rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-5">
          {denyRoute !== null ? (
            <div className="font-mono text-xs leading-loose">
              <div className="text-muted-foreground">GET /{denyRoute}</div>
              {denyStage >= 1 ? (
                <div className="text-destructive">
                  middleware.ts → rewrite(&apos;/not-found&apos;)
                </div>
              ) : null}
              {denyStage >= 2 ? (
                <div
                  role="alert"
                  className="border-border bg-muted/30 mt-3 rounded-lg border p-6 text-center font-sans"
                >
                  <div className="text-foreground text-3xl font-extrabold">
                    404
                  </div>
                  <div className="text-muted-foreground mt-1 text-sm">
                    This page could not be found.
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-foreground text-lg font-bold">
                    {current?.label}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-sm">
                    {current?.description}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <span
                      key={action.label}
                      className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-bold"
                    >
                      {action.label}
                    </span>
                  ))}
                </div>
              </div>
              {route === 'patients' ? (
                <div className="border-border overflow-hidden rounded-lg border">
                  <div className="bg-muted/40 text-muted-foreground grid grid-cols-[1.4fr_1fr_0.8fr] px-3 py-2 text-[11px] tracking-wide uppercase">
                    <span>Patient (COI)</span>
                    <span>Therapy</span>
                    <span>Status</span>
                  </div>
                  <div className="grid grid-cols-[1.4fr_1fr_0.8fr] items-center px-3 py-2.5 text-sm">
                    <span className="font-mono">COI-8842 · redacted</span>
                    <span>CAR-T · CTL019</span>
                    <span className="text-primary font-semibold">
                      Enrolled
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  {current?.label} workspace
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-border bg-muted/30 border-t px-4 py-3">
        <div className="text-muted-foreground mb-2 text-[11px]">
          Try a direct link — middleware still guards it
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NAV_ITEMS.map((item) => {
            const allowed = !isForbidden(role, item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cx(
                  'h-7 rounded-md border px-2.5 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  allowed
                    ? 'border-primary/30 text-primary hover:bg-primary/10'
                    : 'border-border text-muted-foreground',
                )}
              >
                /{item.id}
                {allowed ? '' : ' ✕'}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-muted-foreground px-4 pt-3 pb-4 font-mono text-xs">
        Mirrors app/(protected)/layout.tsx · middleware.ts ·
        providers/accessControl.ts
      </p>
    </div>
  );
}

export default RoleShell;
