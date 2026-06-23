import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import { listCredentials, getCredential } from './db.js';

// In-memory challenge store — single user, 5-minute TTL
const challenges = new Map<string, { value: string; expiresAt: number }>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function storeChallenge(key: string, challenge: string): void {
  challenges.set(key, { value: challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

export function consumeChallenge(key: string): string | null {
  const entry = challenges.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    challenges.delete(key);
    return null;
  }
  challenges.delete(key);
  return entry.value;
}

export function getRpConfig(): { rpID: string; rpName: string; origin: string } {
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? 'rainforest.tools',
    rpName: 'Rainforest Tools',
    origin: process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools',
  };
}

export async function createRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = getRpConfig();
  const existingCredentials = listCredentials().map((c) => ({
    id: c.id,
    transports: c.transports as AuthenticatorTransportFuture[],
  }));
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode('rainforest'),
    userName: 'rainforest',
    attestationType: 'none',
    excludeCredentials: existingCredentials,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  storeChallenge('registration', options.challenge);
  return options;
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
): Promise<VerifiedRegistrationResponse> {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = consumeChallenge('registration');
  if (!expectedChallenge) throw new Error('No pending registration challenge');
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedRPID: rpID,
    expectedOrigin: origin,
    requireUserVerification: true,
  });
}

export async function createAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = getRpConfig();
  const allowCredentials = listCredentials().map((c) => ({
    id: c.id,
    transports: c.transports as AuthenticatorTransportFuture[],
  }));
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'required',
  });
  storeChallenge('authentication', options.challenge);
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<VerifiedAuthenticationResponse> {
  const { rpID, origin } = getRpConfig();
  const expectedChallenge = consumeChallenge('authentication');
  if (!expectedChallenge) throw new Error('No pending authentication challenge');
  const credential = getCredential(response.id);
  if (!credential) throw new Error('Credential not found');
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedRPID: rpID,
    expectedOrigin: origin,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: true,
  });
}
