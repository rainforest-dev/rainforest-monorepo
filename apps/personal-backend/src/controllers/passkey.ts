import { Elysia, t } from 'elysia';

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/typescript-types';
import { uint8ArrayToBase64 } from '../libs';

interface IAuthenticator {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  transports: AuthenticatorTransportFuture[];
}

let users: Record<string, IAuthenticator[]> = {};
let challenges: Record<string, any> = {};
const rpName = process.env.PASSKEY_RP_NAME || 'personal-backend';
const rpId = process.env.PASSKEY_RP_ID || 'localhost';
const expectedOrigin = `http://localhost:4321`;

const plugin = new Elysia().group('/passkey', (app) =>
  app
    .get('/', () => 'Passkey Endpoints')
    .post(
      '/register/options',
      async ({ body: { username } }) => {
        const options = await generateRegistrationOptions({
          rpName,
          rpID: rpId,
          userID: username,
          userName: username,
          timeout: 60000,
          attestationType: 'direct',
          authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
          },
        });
        challenges[username] = options.challenge;
        return options;
      },
      {
        body: t.Object({ username: t.String() }),
      }
    )
    .post(
      '/register',
      async ({ body: { username, data } }) => {
        const expectedChallenge = challenges[username];

        if (!expectedChallenge) {
          throw new Error('No challenge found for user');
        }

        const { verified, registrationInfo } = await verifyRegistrationResponse(
          {
            response: data,
            expectedChallenge,
            expectedOrigin,
            requireUserVerification: true,
          }
        );

        if (verified && registrationInfo) {
          const { credentialPublicKey, credentialID, counter } =
            registrationInfo;
          console.log(
            uint8ArrayToBase64(credentialPublicKey),
            uint8ArrayToBase64(credentialID),
            counter,
            data.response.transports
          );
          const authenticator = {
            credentialID: uint8ArrayToBase64(credentialID),
            credentialPublicKey: uint8ArrayToBase64(credentialPublicKey),
            counter,
            transports: data.response.transports || [],
          };
          users[username] = [...(users[username] || []), authenticator];
          console.log(users);
          return true;
        }

        return false;
      },
      {
        body: t.Object({
          username: t.String(),
          data: t.Object({
            id: t.String(),
            rawId: t.String(),
            response: t.Object({
              clientDataJSON: t.String(),
              attestationObject: t.String(),
              authenticatorData: t.Optional(t.String()),
              transports: t.Optional(
                t.Array(
                  t.Enum({
                    ble: 'ble',
                    cable: 'cable',
                    hybrid: 'hybrid',
                    internal: 'internal',
                    nfc: 'nfc',
                    smartCard: 'smart-card',
                    usb: 'usb',
                  })
                )
              ),
              publicKeyAlgorithm: t.Optional(t.Number()),
              publicKey: t.Optional(t.String()),
            }),
            authenticatorAttachment: t.Optional(
              t.Enum({ platform: 'platform', crossPlatform: 'cross-platform' })
            ),
            clientExtensionResults: t.Object({
              appid: t.Optional(t.Boolean()),
              credProps: t.Optional(
                t.Object({
                  rk: t.Optional(t.Boolean()),
                })
              ),
              hmacCreateSecret: t.Optional(t.Boolean()),
            }),
            type: t.Literal('public-key'),
          }),
        }),
      }
    )
);

export default plugin;
