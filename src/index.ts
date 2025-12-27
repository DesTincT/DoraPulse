import 'dotenv/config';
import { config } from './config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import mongoose from 'mongoose';
import { initBotPolling } from './telegram/bot.js';
import metricsRoutes from './routes/metrics.js';
import githubWebhook from './routes/webhooks.github.js';
import githubAppWebhook from './routes/webhooks.github.app.js';
import incidentsRoutes from './routes/incidents.js';
import pulseRoutes from './routes/pulse.js';

const PORT = Number(process.env.PORT ?? 8080);

export async function buildServer() {
  const fastify = Fastify({ logger: true });

  // Capture raw JSON body for HMAC validation while still parsing JSON
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      (req as any).rawBody = body as Buffer;
      const parsed = body && (body as Buffer).length ? JSON.parse((body as Buffer).toString('utf8')) : {};
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined as any);
    }
  });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      try {
        if (!origin) return cb(null, true);
        const u = new URL(origin);
        if (u.hostname === 'localhost') return cb(null, true);
        return cb(new Error('Not allowed by CORS'), false);
      } catch {
        return cb(new Error('Not allowed by CORS'), false);
      }
    },
  });

  fastify.get('/', async () => ({ ok: true, name: 'dora-pulse-api' }));

  const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';
  if (!noDb) {
    // Mongo
    try {
      await mongoose.connect(config.mongoUri);
      fastify.log.info('MongoDB connected');
    } catch (err) {
      fastify.log.error({ err }, 'MongoDB connection error');
      process.exit(1);
    }
  } else {
    fastify.log.warn('DORA_DEV_NO_DB=true: MongoDB connection skipped (DB-less dev mode)');
  }

  // Регистрация роутов
  if (!noDb) {
    await fastify.register(githubWebhook);
    await fastify.register(githubAppWebhook);
    await fastify.register(metricsRoutes);
    await fastify.register(incidentsRoutes as any);
    await fastify.register(pulseRoutes as any);
  } else {
    // Lightweight placeholders for non-essential routes in DB-less mode
    fastify.all('/webhooks/*', async (_req, reply) => {
      return reply.code(503).send({ ok: false, error: 'webhooks disabled in DB-less dev mode' });
    });
    fastify.all('/metrics*', async (_req, reply) => {
      return reply.code(503).send({ ok: false, error: 'metrics disabled in DB-less dev mode' });
    });
    fastify.all('/incidents*', async (_req, reply) => {
      return reply.code(503).send({ ok: false, error: 'incidents disabled in DB-less dev mode' });
    });
    fastify.all('/pulse*', async (_req, reply) => {
      return reply.code(503).send({ ok: false, error: 'pulse disabled in DB-less dev mode' });
    });
  }
  try {
    const mod = await import('./routes/webapp.js');
    if (mod?.default && typeof mod.default === 'function') {
      await fastify.register(mod.default);
      fastify.log.info({ routeFile: 'webapp' }, 'route registered');
    }
  } catch {}
  if (!noDb) {
    await import('./cron/jobs.js');
  } else {
    fastify.log.warn('DORA_DEV_NO_DB=true: cron jobs not started');
  }

  // Админ/дебаг — только вне production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const mod = await import('./routes/admin.debug.js');
      if (mod?.default && typeof mod.default === 'function') {
        await fastify.register(mod.default);
        fastify.log.info({ routeFile: 'admin.debug' }, 'route registered (non-prod)');
      }
    } catch {}
  }

  return fastify;
}

buildServer()
  .then((fastify) => {
    fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
      if (err) {
        fastify.log.error(err);
        process.exit(1);
      }
      fastify.log.info(`Server listening at ${address}`);
    });
    if (String(process.env.DORA_DEV_NO_DB || '').toLowerCase() !== 'true') {
      initBotPolling();
    } else {
      fastify.log.warn('DORA_DEV_NO_DB=true: Telegram bot polling not started');
    }
  })
  .catch((err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
