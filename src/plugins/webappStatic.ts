import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

/**
 * Serve the Telegram Mini App UI as static files under /webapp/*
 *
 * - GET /webapp      -> 302 redirect to /webapp/
 * - GET /webapp/     -> index.html
 * - GET /webapp/app.js, /webapp/src/... -> static assets
 */
export default fp(async (app) => {
  const webappRoot = path.resolve(process.cwd(), 'webapp');

  await app.register(fastifyStatic, {
    root: webappRoot,
    prefix: '/webapp/',
    index: ['index.html'],
    decorateReply: true,
  });

  app.get('/webapp', async (_req, reply) => {
    return reply.redirect('/webapp/', 302);
  });

  // Ensure /webapp/ reliably serves HTML without accidentally sending an object payload.
  app.get('/webapp/', async (_req, reply) => {
    return reply.sendFile('index.html');
  });
});
