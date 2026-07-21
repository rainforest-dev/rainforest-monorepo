import { type JSX, useEffect, useState } from 'react';

import { useReducedMotion } from '../_shared/useReducedMotion';
import {
  buildMockJwt,
  decodeJwtPayload,
  getRolesFromJwt,
  PERSONA_ORDER,
  type PersonaId,
  PERSONAS,
} from './logic';

type LoginStage = 'idle' | 'hop' | 'decoded';

const HOPS = [
  'app → Auth0 /authorize',
  'Auth0 → /api/auth/callback',
  'NextAuth jwt() mints session',
];

const HOP_DELAY_MS = 520;

export function JwtDecode(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [personaId, setPersonaId] = useState<PersonaId>('hospital');
  const [stage, setStage] = useState<LoginStage>('idle');
  const [hop, setHop] = useState(-1);

  const persona = PERSONAS[personaId];
  const jwt = buildMockJwt(persona);
  const payload = decodeJwtPayload(jwt);
  const extractedRole = getRolesFromJwt(jwt);
  const [header, payloadSegment, signature] = jwt.split('.');
  const rolesClaimKey = payload
    ? Object.keys(payload).find((key) => key.toLowerCase().includes('roles'))
    : undefined;

  // The three-hop Auth0 handoff — under reduced motion it resolves in one
  // tick instead of animating each hop.
  useEffect(() => {
    if (stage !== 'hop') return undefined;
    if (reducedMotion) {
      setHop(2);
      setStage('decoded');
      return undefined;
    }
    if (hop >= 2) {
      setStage('decoded');
      return undefined;
    }
    const t = setTimeout(() => setHop((prev) => prev + 1), HOP_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage, hop, reducedMotion]);

  const handlePersona = (id: PersonaId) => {
    setPersonaId(id);
    setStage('idle');
    setHop(-1);
  };

  const handleLogin = () => {
    if (stage === 'hop') return;
    setStage('hop');
    setHop(0);
  };

  const decoded = stage === 'decoded';

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="text-muted-foreground mb-3 font-mono text-[11px] tracking-wide uppercase">
        Choose who signs in
      </div>
      <div className="flex flex-col gap-2">
        {PERSONA_ORDER.map((id) => {
          const option = PERSONAS[id];
          const selected = personaId === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => handlePersona(id)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  selected ? 'border-primary bg-primary' : 'border-border'
                }`}
              />
              {option.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleLogin}
        disabled={stage === 'hop'}
        className="bg-primary text-primary-foreground mt-4 h-10 rounded-md px-5 text-sm font-semibold disabled:opacity-60"
      >
        {stage === 'hop'
          ? 'Signing in…'
          : decoded
            ? 'Log in again'
            : 'Log in'}
      </button>

      <div className="my-5 flex flex-wrap items-stretch gap-0">
        {HOPS.map((text, i) => {
          const lit = decoded || (stage === 'hop' && hop >= i);
          const current = stage === 'hop' && hop === i;
          return (
            <div key={text} className="flex items-center">
              <div
                className={`flex min-w-[150px] items-center gap-2 rounded-lg border px-3 py-2 ${
                  lit
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    lit
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {lit && !current ? '✓' : i + 1}
                </span>
                <span className="font-mono text-[11px]">{text}</span>
              </div>
              {i < HOPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground px-2"
                >
                  →
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-border border-t pt-4">
        {!decoded ? (
          <div>
            <div className="text-muted-foreground mb-2 text-xs">
              access_token (opaque)
            </div>
            <div className="border-border bg-muted/30 rounded-lg border p-3 font-mono text-xs break-all">
              <span className="text-primary">{header}</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-foreground">{payloadSegment}</span>
              <span className="text-muted-foreground">.</span>
              <span className="text-muted-foreground">{signature}</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-muted-foreground mb-2 text-xs">
              decoded payload
            </div>
            <div className="border-border bg-muted/30 rounded-lg border p-3 font-mono text-xs leading-relaxed">
              <div>{'{'}</div>
              {payload
                ? Object.entries(payload).map(([key, value], i, arr) => {
                    const highlighted = key === rolesClaimKey;
                    return (
                      <div
                        key={key}
                        className={`rounded px-1 ${
                          highlighted ? 'bg-primary/10 text-primary' : ''
                        }`}
                      >
                        {'  "'}
                        {key}
                        {'": '}
                        {JSON.stringify(value)}
                        {i < arr.length - 1 ? ',' : ''}
                      </div>
                    );
                  })
                : null}
              <div>{'}'}</div>
            </div>
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="text-primary font-mono">roles claim</span>
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <span className="text-muted-foreground font-mono">
                getRolesFromJwt()
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 font-mono text-xs font-bold">
                {extractedRole ?? 'null'}
              </span>
            </div>
          </div>
        )}
      </div>
      <p className="text-muted-foreground mt-4 font-mono text-xs">
        Mirrors auth.ts · lib/getRolesFromJwt.ts
      </p>
    </div>
  );
}

export default JwtDecode;
