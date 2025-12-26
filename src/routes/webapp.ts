/* eslint-disable @typescript-eslint/no-misused-promises */
import { FastifyInstance } from 'fastify';
import { telegramAuth } from '../middleware/telegramAuth.js';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { EventModel } from '../models/Event.js';
import { getWeekly } from '../services/metricsService.js';
import { getLastIsoWeek } from '../utils.js';
import fastifyStatic from '@fastify/static';
import path from 'path';

export default async function webappRoutes(app: FastifyInstance) {
  // Serve /webapp as static folder
  const webappRoot = path.resolve(process.cwd(), 'webapp');
  await app.register(fastifyStatic, {
    root: webappRoot,
    prefix: '/webapp/',
    decorateReply: false,
  });
  app.get('/webapp', async (_req, reply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    return reply.sendFile('index.html');
  });

  // Telegram-authenticated API
  app.get('/api/me', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const githubInstallUrl = config.githubAppSlug
      ? `https://github.com/apps/${config.githubAppSlug}/installations/new`
      : null;
    return reply.send({
      ok: true,
      project: { _id: project._id, name: project.name },
      github: project.github || {},
      githubInstallUrl,
    });
  });

  app.get('/api/github/install-url', { preHandler: telegramAuth }, async (_req, reply) => {
    if (!config.githubAppSlug) return reply.send({ ok: false, url: null, error: 'GITHUB_APP_SLUG not set' });
    return reply.send({ ok: true, url: `https://github.com/apps/${config.githubAppSlug}/installations/new` });
  });

  app.get('/api/github/callback', { preHandler: telegramAuth }, async (req, reply) => {
    try {
      const project = (req as any).project;
      const installationId = Number((req.query as any)?.installation_id);
      if (!installationId) return reply.code(400).send({ ok: false, error: 'installation_id required' });
      await ProjectModel.updateOne(
        { _id: project._id },
        { $set: { github: { ...(project.github || {}), installationId } } },
      );
      return reply.send({ ok: true });
    } catch (e: any) {
      return reply.code(500).send({ ok: false, error: e.message || 'callback failed' });
    }
  });

  app.post('/api/selftest', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const now = new Date();
    const since = new Date(now.getTime() - 15 * 60 * 1000);
    const recent = await EventModel.countDocuments({ projectId: project._id, ts: { $gte: since } });
    const week = getLastIsoWeek();
    const weekly = await getWeekly(String(project._id), week);
    return reply.send({ ok: true, recentEvents15m: recent, weekly });
  });

  app.get('/api/envs', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const seen = await EventModel.distinct('meta.deploymentEnvironment', { projectId: project._id });
    const selected = project?.settings?.prodEnvironments || [];
    return reply.send({ ok: true, seenEnvs: (seen || []).filter(Boolean), selected });
  });

  app.post('/api/envs', { preHandler: telegramAuth }, async (req, reply) => {
    const project = (req as any).project;
    const body: any = req.body || {};
    const selected: string[] = Array.isArray(body.selected) ? body.selected : [];
    await ProjectModel.updateOne({ _id: project._id }, { $set: { 'settings.prodEnvironments': selected } });
    return reply.send({ ok: true });
  });
}
