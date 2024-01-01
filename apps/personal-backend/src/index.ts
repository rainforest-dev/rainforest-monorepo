import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { serverTiming } from '@elysiajs/server-timing';
import pkg from '../package.json';
// import { PrismaClient } from '@prisma/client';
import common, { passkey } from './controllers';
import { PORT } from './libs';

// const db = new PrismaClient();

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Personal Backend API',
          version: pkg.version,
        },
      },
    })
  )
  .use(serverTiming())
  .use(common)
  .use(passkey)
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
