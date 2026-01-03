import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import path from 'node:path';

/**
 * Serve the Telegram Mini App UI as static files under /webapp/*
 *
 * - GET /webapp      -> index.html (200, no redirect; redirects can break Telegram initData)
 * - GET /webapp/     -> index.html (200)
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
    // IMPORTANT: Telegram WebView can lose initData if we redirect here.
    return reply.sendFile('index.html');
  });

  // Ensure /webapp/ reliably serves HTML without accidentally sending an object payload.
  app.get('/webapp/', async (_req, reply) => {
    return reply.sendFile('index.html');
  });
});
