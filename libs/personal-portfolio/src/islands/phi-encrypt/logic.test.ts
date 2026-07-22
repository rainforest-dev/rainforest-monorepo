import { describe, expect, it } from 'vitest';

import { advanceEncryptStage, nextEncryptStage, redactFor } from './logic';

const RECORD = {
  fullName: 'Jordan Avery',
  dob: '1990-04-12',
  mrn: 'MRN-7741-CGT',
  therapy: 'CAR-T · CTL019',
  protocol: 'PROT-CGT-204',
};

describe('phi-encrypt logic — redactFor', () => {
  it('shows every field in full for a phi grant', () => {
    const fields = redactFor('phi', RECORD);
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(byLabel['Full name']).toBe('Jordan Avery');
    expect(byLabel['Date of birth']).toBe('1990-04-12');
    expect(byLabel.MRN).toBe('MRN-7741-CGT');
  });

  it('redacts identity fields for a non-phi grant, but not the therapy fields', () => {
    const fields = redactFor('non-phi', RECORD);
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(byLabel['Full name']).not.toBe('Jordan Avery');
    expect(byLabel['Date of birth']).not.toBe('1990-04-12');
    expect(byLabel.MRN).not.toBe('MRN-7741-CGT');
    expect(byLabel.Therapy).toBe('CAR-T · CTL019');
    expect(byLabel.Protocol).toBe('PROT-CGT-204');
  });

  it('flags exactly the identity fields as phi-gated', () => {
    const fields = redactFor('phi', RECORD);
    const phiLabels = fields.filter((f) => f.phi).map((f) => f.label);
    expect(phiLabels).toEqual(['Full name', 'Date of birth', 'MRN']);
  });

  it('does not mutate the input record', () => {
    const copy = { ...RECORD };
    redactFor('non-phi', RECORD);
    expect(RECORD).toEqual(copy);
  });
});

describe('phi-encrypt logic — nextEncryptStage / advanceEncryptStage', () => {
  it('starts the pipeline from idle or done on an encrypt event', () => {
    expect(nextEncryptStage('idle', { type: 'encrypt' })).toBe('gen');
    expect(nextEncryptStage('done', { type: 'encrypt' })).toBe('gen');
  });

  it('ignores a second encrypt event mid-pipeline', () => {
    expect(nextEncryptStage('gen', { type: 'encrypt' })).toBe('gen');
    expect(nextEncryptStage('body', { type: 'encrypt' })).toBe('body');
  });

  it('advances gen -> body -> wrap -> done in order', () => {
    expect(advanceEncryptStage('gen')).toBe('body');
    expect(advanceEncryptStage('body')).toBe('wrap');
    expect(advanceEncryptStage('wrap')).toBe('done');
  });

  it('does not advance past done or out of idle', () => {
    expect(advanceEncryptStage('done')).toBe('done');
    expect(advanceEncryptStage('idle')).toBe('idle');
  });

  it('resets to idle from any stage', () => {
    expect(nextEncryptStage('wrap', { type: 'reset' })).toBe('idle');
    expect(nextEncryptStage('done', { type: 'reset' })).toBe('idle');
  });
});
