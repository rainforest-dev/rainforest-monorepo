import { type JSX, useEffect, useState } from 'react';

import { button, cx } from '../../../shared/ui';
import { useReducedMotion } from '../../../shared/useReducedMotion';
import {
  advanceEncryptStage,
  type EncryptStage,
  nextEncryptStage,
  type Org,
  type PatientRecord,
  redactFor,
} from './logic';

const STAGE_LABELS: { stage: EncryptStage; label: string }[] = [
  { stage: 'gen', label: 'generate AES-256 key + IV' },
  { stage: 'body', label: 'AES-CBC encrypt record body' },
  { stage: 'wrap', label: 'RSA-OAEP wrap key · per recipient' },
];

const STAGE_DELAY_MS = 520;
const MAX_ORGS = 4;

/** Canned/cosmetic display strings — never real ciphertext or key material. */
const MOCK_BLOB =
  'ct.aes-cbc:U2FsdGVkX1+9kQ3mNf7pR2xLvB0hT8yWqEo4dZ6aJc1nP5rGiK9sYbM3wXfA7tHu';
const MOCK_WRAPS = [
  'rsa-oaep:9f3a…c71e',
  'rsa-oaep:41bd…a08f',
  'rsa-oaep:7c22…e5d0',
  'rsa-oaep:0ab6…f394',
];

const INITIAL_RECORD: PatientRecord = {
  fullName: 'Jordan Avery',
  dob: '1990-04-12',
  mrn: 'MRN-7741-CGT',
  therapy: 'CAR-T · CTL019',
  protocol: 'PROT-CGT-204',
};

const INITIAL_ORGS: Org[] = [
  { name: "St. Mary's Hospital", grant: 'phi' },
  { name: 'Novacell Therapeutics', grant: 'non-phi' },
];

export function PhiEncrypt(): JSX.Element {
  const reducedMotion = useReducedMotion();
  const [record, setRecord] = useState<PatientRecord>(INITIAL_RECORD);
  const [orgs, setOrgs] = useState<Org[]>(INITIAL_ORGS);
  const [stage, setStage] = useState<EncryptStage>('idle');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Runs the three-step pipeline on a short scripted delay — generate,
  // encrypt body, wrap key — cosmetic only, no real cryptography.
  useEffect(() => {
    if (stage === 'idle' || stage === 'done') return undefined;
    if (reducedMotion) {
      setStage('done');
      return undefined;
    }
    const t = setTimeout(
      () => setStage((prev) => advanceEncryptStage(prev)),
      STAGE_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [stage, reducedMotion]);

  const updateField = (field: keyof PatientRecord, value: string) => {
    setRecord((prev) => ({ ...prev, [field]: value }));
    setStage('idle');
    setOpenIndex(null);
  };

  const updateOrgName = (index: number, name: string) => {
    setOrgs((prev) =>
      prev.map((org, i) => (i === index ? { ...org, name } : org)),
    );
    setOpenIndex(null);
  };

  const toggleOrgGrant = (index: number) => {
    setOrgs((prev) =>
      prev.map((org, i) =>
        i === index
          ? { ...org, grant: org.grant === 'phi' ? 'non-phi' : 'phi' }
          : org,
      ),
    );
    setOpenIndex(null);
    if (stage === 'done') setStage('idle');
  };

  const addOrg = () => {
    if (orgs.length >= MAX_ORGS) return;
    setOrgs((prev) => [...prev, { name: 'New partner org', grant: 'non-phi' }]);
    setOpenIndex(null);
  };

  const removeOrg = (index: number) => {
    if (orgs.length <= 1) return;
    setOrgs((prev) => prev.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  const handleEncrypt = () => {
    setOpenIndex(null);
    setStage((prev) => nextEncryptStage(prev, { type: 'encrypt' }));
  };

  const encrypted = stage === 'done';
  const openOrg = openIndex != null ? orgs[openIndex] : null;
  const fields = openOrg ? redactFor(openOrg.grant, record) : [];

  return (
    <div className="border-border bg-card text-card-foreground rounded-xl border p-6">
      <div className="flex flex-wrap gap-6">
        <div className="min-w-[260px] flex-1">
          <div className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-wide uppercase">
            Patient record
          </div>
          <label className="mb-3 block text-xs">
            Full name
            <input
              value={record.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              className="border-border bg-background text-foreground mt-1.5 h-9 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
          <label className="mb-3 block text-xs">
            Date of birth
            <input
              value={record.dob}
              onChange={(e) => updateField('dob', e.target.value)}
              className="border-border bg-background text-foreground mt-1.5 h-9 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>
          <label className="mb-3 block text-xs">
            MRN
            <input
              value={record.mrn}
              onChange={(e) => updateField('mrn', e.target.value)}
              className="border-border bg-background text-foreground mt-1.5 h-9 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </label>

          <div className="mt-1 mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Orgs that can access
            </span>
            <button
              type="button"
              onClick={addOrg}
              disabled={orgs.length >= MAX_ORGS}
              className="text-primary rounded text-xs font-semibold transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              + add org
            </button>
          </div>
          {orgs.map((org, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input
                value={org.name}
                onChange={(e) => updateOrgName(i, e.target.value)}
                aria-label={`Org ${i + 1} name`}
                className="border-border bg-background text-foreground h-9 min-w-0 flex-1 rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <button
                type="button"
                onClick={() => toggleOrgGrant(i)}
                className={cx(
                  'h-9 shrink-0 rounded-md border px-2.5 font-mono text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  org.grant === 'phi'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {org.grant}
              </button>
              <button
                type="button"
                onClick={() => removeOrg(i)}
                disabled={orgs.length <= 1}
                aria-label={`Remove ${org.name || 'org'}`}
                className={button({ variant: 'outline', size: 'icon' })}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleEncrypt}
            disabled={stage !== 'idle' && stage !== 'done'}
            className={button({ className: 'mt-4' })}
          >
            {encrypted ? 'Re-encrypt & submit' : 'Encrypt & submit'}
          </button>
        </div>

        <div className="min-w-[260px] flex-1">
          <div className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-wide uppercase">
            Pipeline
          </div>
          <div className="flex flex-col gap-2">
            {STAGE_LABELS.map(({ stage: s, label }, i) => {
              const order: EncryptStage[] = ['gen', 'body', 'wrap', 'done'];
              const done = order.indexOf(stage) > i;
              const active = stage === s;
              const lit = done || active;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
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
                    {done ? '✓' : active ? '●' : i + 1}
                  </span>
                  <span className="font-mono text-xs">{label}</span>
                </div>
              );
            })}
          </div>

          {encrypted ? (
            <div className="mt-4">
              <div className="text-muted-foreground mb-1.5 text-xs">
                ciphertext (stored server-side)
              </div>
              <div className="border-border bg-muted/30 text-muted-foreground rounded-md border p-2.5 font-mono text-[11px] break-all">
                {MOCK_BLOB}
              </div>
              <div className="text-muted-foreground mt-3 mb-1.5 text-xs">
                wrapped AES key · per recipient
              </div>
              {orgs.map((org, i) => (
                <div key={i} className="py-0.5 font-mono text-[11px]">
                  {org.name}:{' '}
                  <span className="text-primary">
                    {MOCK_WRAPS[i % MOCK_WRAPS.length]}
                  </span>
                </div>
              ))}
              <div className="text-muted-foreground mt-3.5 mb-2 text-[11px] font-semibold tracking-wide uppercase">
                Open as…
              </div>
              <div className="flex flex-wrap gap-2">
                {orgs.map((org, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={openIndex === i}
                    onClick={() => setOpenIndex(i)}
                    className={cx(
                      'h-8 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      openIndex === i
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-primary/30 text-primary hover:bg-primary/10',
                    )}
                  >
                    open as {org.name} ({org.grant})
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {openOrg ? (
        <div className="border-border mt-5 border-t pt-4" role="status">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="text-foreground font-bold">
              Decrypted as {openOrg.name}
            </span>
            <span
              className={`rounded-md px-2.5 py-0.5 font-mono text-[11px] ${
                openOrg.grant === 'phi'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {openOrg.grant} access
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {fields.map((field) => {
              const masked = field.phi && openOrg.grant !== 'phi';
              return (
                <div
                  key={field.label}
                  className={`rounded-md border p-2.5 ${
                    masked
                      ? 'border-destructive/25 bg-destructive/5'
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <div className="text-muted-foreground text-[11px]">
                    {field.label}
                  </div>
                  <div
                    className={`mt-0.5 text-sm ${
                      masked ? 'text-destructive font-mono' : 'text-foreground'
                    }`}
                  >
                    {field.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <p className="text-muted-foreground mt-4 font-mono text-xs">
        Mirrors lib/crypto/e2ee.ts · app/enroll/AccessControlFields.tsx
      </p>
    </div>
  );
}

export default PhiEncrypt;
