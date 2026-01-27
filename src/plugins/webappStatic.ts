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
  const webappRoot = path.resolve(process.cwd(), 'webapp', 'dist');

  await app.register(fastifyStatic, {
    root: webappRoot,
    prefix: '/webapp/',
    index: ['index.html'],
    decorateReply: true,
    setHeaders: (res, filePath) => {
      // Cache-bust assets forever; keep HTML non-cached
      const rel = filePath.replace(webappRoot + path.sep, '').replace(/\\/g, '/');
      if (rel.startsWith('assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (rel === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
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
