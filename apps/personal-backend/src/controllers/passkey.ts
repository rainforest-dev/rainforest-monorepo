import { Elysia, t } from 'elysia';

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
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
        const authenticators = users[username] || [];
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
          excludeCredentials: authenticators.map((authenticator) => ({
            id: Buffer.from(authenticator.credentialID, 'base64'),
            type: 'public-key',
            transports: authenticator.transports,
          })),
        });
        challenges[username] = options.challenge;
        console.log(options);
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
          const authenticator = {
            credentialID: uint8ArrayToBase64(credentialID),
            credentialPublicKey: uint8ArrayToBase64(credentialPublicKey),
            counter,
            transports: data.response.transports || [],
          };
          users[username] = [...(users[username] || []), authenticator];
          delete challenges[username];
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
    .post(
      '/login/options',
      async ({ body: { username } }) => {
        const authenticators = users[username] || [];
        const options = await generateAuthenticationOptions({
          allowCredentials: authenticators.map((authenticator) => ({
            id: Buffer.from(authenticator.credentialID, 'base64'),
            type: 'public-key',
            transports: authenticator.transports,
          })),
          userVerification: 'preferred',
        });
        challenges[username] = options.challenge;
        console.log(options);
        return options;
      },
      {
        body: t.Object({ username: t.String() }),
      }
    )
    .post(
      '/login',
      async ({ body: { username, data } }) => {
        const expectedChallenge = challenges[username];

        if (!expectedChallenge) {
          throw new Error('No challenge found for user');
        }

        const authenticators = users[username] || [];

        if (!authenticators.length) {
          throw new Error('No authenticators found for user');
        }

        console.log(data, authenticators);
        const authenticator = authenticators.find(
          (authenticator) => authenticator.credentialID === data.id
        );

        if (!authenticator) {
          throw new Error('Authenticator not found');
        }

        const { verified } = await verifyAuthenticationResponse({
          response: data,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpId,
          authenticator: {
            credentialID: Buffer.from(authenticator.credentialID, 'base64'),
            credentialPublicKey: Buffer.from(
              authenticator.credentialPublicKey,
              'base64'
            ),
            counter: authenticator.counter,
            transports: authenticator.transports,
          },
          requireUserVerification: true,
        });

        if (verified) {
          delete challenges[username];
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
              authenticatorData: t.String(),
              signature: t.String(),
              userHandle: t.Optional(t.String()),
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
