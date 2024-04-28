import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { serverTiming } from '@elysiajs/server-timing';
import pkg from '../../../package.json';
import { PORT } from './constants';
import common from './controller';

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
    }),
  )
  .use(serverTiming());

// use controllers
app.use(common);

// start server
app.listen(PORT);

console.info(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
