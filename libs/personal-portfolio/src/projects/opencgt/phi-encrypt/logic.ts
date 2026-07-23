export type Grant = 'phi' | 'non-phi';

export interface Org {
  name: string;
  grant: Grant;
}

export interface PatientRecord {
  fullName: string;
  dob: string;
  mrn: string;
  therapy: string;
  protocol: string;
}

export interface RedactedField {
  label: string;
  value: string;
  /** True for the identity fields that only a `phi` grant can decrypt. */
  phi: boolean;
}

const REDACTED_NAME = 'REDACTED';
const REDACTED_DOB = '••••-••-••';
const REDACTED_MRN = 'ct:… (no key)';

/**
 * The view an org sees once it opens the encrypted record: `phi` grants get
 * every field in the clear; `non-phi` grants get the therapy/protocol
 * fields (never encrypted per-recipient) but the identity fields come back
 * redacted, standing in for "no private key to unwrap this AES key."
 */
export function redactFor(
  grant: Grant,
  record: PatientRecord,
): RedactedField[] {
  const hasPhi = grant === 'phi';
  return [
    {
      label: 'Full name',
      value: hasPhi ? record.fullName : REDACTED_NAME,
      phi: true,
    },
    {
      label: 'Date of birth',
      value: hasPhi ? record.dob : REDACTED_DOB,
      phi: true,
    },
    { label: 'MRN', value: hasPhi ? record.mrn : REDACTED_MRN, phi: true },
    { label: 'Therapy', value: record.therapy, phi: false },
    { label: 'Protocol', value: record.protocol, phi: false },
  ];
}

export type EncryptStage = 'idle' | 'gen' | 'body' | 'wrap' | 'done';

export type EncryptEvent = { type: 'encrypt' } | { type: 'reset' };

/**
 * Starts (or resets) the three-step encrypt pipeline: generate the AES key,
 * AES-CBC encrypt the body, RSA-OAEP wrap the key per recipient. Re-running
 * `encrypt` mid-pipeline is a no-op — the pipeline can't be started twice at
 * once, only re-armed from `idle` or `done`.
 */
export function nextEncryptStage(
  stage: EncryptStage,
  event: EncryptEvent,
): EncryptStage {
  if (event.type === 'reset') return 'idle';
  if (event.type === 'encrypt') {
    return stage === 'idle' || stage === 'done' ? 'gen' : stage;
  }
  return stage;
}

const STAGE_ORDER: EncryptStage[] = ['gen', 'body', 'wrap', 'done'];

/** Steps the pipeline forward one tick — the animation's per-beat driver. */
export function advanceEncryptStage(stage: EncryptStage): EncryptStage {
  const index = STAGE_ORDER.indexOf(stage);
  if (index === -1 || index === STAGE_ORDER.length - 1) return stage;
  return STAGE_ORDER[index + 1];
}
