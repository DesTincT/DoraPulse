/* eslint-disable @typescript-eslint/no-misused-promises */
import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { EventModel } from '../models/Event.js';
import { getWeekly } from '../services/metricsService.js';
import { currentIsoWeek, isoWeekString } from '../utils.js';
import { createGithubInstallState } from '../services/githubInstallState.js';

export default async function webappRoutes(app: FastifyInstance) {
  // Telegram-authenticated API
  app.get('/api/me', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const bypass = !!req.devBypass;

    // Safe telemetry: initData length + telegram user id (never log full initData).
    try {
      req.log.info(
        {
          initDataLen: req.telegramInitDataInfo?.len ?? 0,
          telegramUserId: req.telegramInitDataInfo?.userId,
          chatId: req.telegramInitDataInfo?.chatId,
          projectId: String((project as any)?._id),
        },
        'api/me',
      );
    } catch {}

    const baseInstallUrl = config.githubAppSlug
      ? `https://github.com/apps/${config.githubAppSlug}/installations/new`
      : bypass
        ? 'https://example.com/install'
        : null;

    // GitHub App install URL MUST include a signed state so /github/app/setup can bind it to a Project.
    const state =
      baseInstallUrl && (project as any)?._id && typeof (project as any)?.chatId === 'number'
        ? createGithubInstallState({ projectId: String((project as any)._id), chatId: (project as any).chatId })
        : null;
    const githubInstallUrl =
      baseInstallUrl && state ? `${baseInstallUrl}?state=${encodeURIComponent(state)}` : baseInstallUrl;

    const installationId: number | undefined =
      typeof (project as any)?.githubInstallationId === 'number'
        ? (project as any).githubInstallationId
        : typeof project?.settings?.github?.installationId === 'number'
          ? project.settings.github.installationId
          : typeof (project as any)?.github?.installationId === 'number'
            ? (project as any).github.installationId
            : undefined;

    const installed = !!installationId;

    return reply.send({
      ok: true,
      projectId: String(project._id),
      installed,
      github: { installed, installationId },
      githubInstallUrl,
    });
  });

  app.get('/api/github/install-url', { preHandler: app.telegramAuth }, async (_req, reply) => {
    if (!config.githubAppSlug) return reply.send({ ok: false, url: null, error: 'GITHUB_APP_SLUG not set' });
    return reply.send({ ok: true, url: `https://github.com/apps/${config.githubAppSlug}/installations/new` });
  });

  app.post('/api/selftest', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const bypass = !!req.devBypass;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';

    const now = new Date();
    const nowUtc = now.toISOString();

    const q: any = req.query || {};
    const weekParamRaw = typeof q.week === 'string' ? q.week.trim().toUpperCase() : '';
    const weekParam = weekParamRaw && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(weekParamRaw) ? weekParamRaw : '';

    if (noDb) {
      const installationId =
        typeof (project as any)?.githubInstallationId === 'number'
          ? (project as any).githubInstallationId
          : (project as any)?.settings?.github?.installationId;
      const weekUsed = weekParam || currentIsoWeek();
      return reply.send({
        ok: true,
        recentEvents15m: 0,
        weekUsed,
        weekly: null,
        debug: {
          nowUtc,
          latestEventTs: null,
          latestEventWeek: null,
          isoWeekYear: Number(weekUsed.slice(0, 4)),
          isoWeek: Number(weekUsed.split('-W')[1]),
          githubInstalled: !!installationId,
          note: 'DORA_DEV_NO_DB=true (no Mongo)',
        },
      });
    }

    const since = new Date(now.getTime() - 15 * 60 * 1000);
    const recent = await EventModel.countDocuments({ projectId: project._id, ts: { $gte: since } });

    const latest = await EventModel.findOne({ projectId: project._id }).select('ts').sort({ ts: -1 }).lean();
    const latestEventTs = latest?.ts ? new Date(latest.ts as any) : null;
    const latestEventWeek = latestEventTs ? isoWeekString(latestEventTs) : null;

    const weekUsed = weekParam || latestEventWeek || currentIsoWeek();
    const weekly = await getWeekly(String(project._id), weekUsed);

    if (
      bypass &&
      (!recent || recent === 0) &&
      (!weekly || (typeof weekly === 'object' && Object.keys(weekly).length === 0))
    ) {
      const installationId =
        typeof (project as any)?.githubInstallationId === 'number'
          ? (project as any).githubInstallationId
          : (project as any)?.settings?.github?.installationId;
      return reply.send({
        ok: true,
        recentEvents15m: recent || 0,
        weekUsed,
        weekly,
        debug: {
          nowUtc,
          latestEventTs: latestEventTs ? latestEventTs.toISOString() : null,
          latestEventWeek,
          isoWeekYear: Number(weekUsed.slice(0, 4)),
          isoWeek: Number(weekUsed.split('-W')[1]),
          githubInstalled: !!installationId,
          note: 'dev bypass mode response',
        },
      });
    }
    return reply.send({
      ok: true,
      recentEvents15m: recent || 0,
      weekUsed,
      weekly,
      debug: {
        nowUtc,
        latestEventTs: latestEventTs ? latestEventTs.toISOString() : null,
        latestEventWeek,
        isoWeekYear: Number(weekUsed.slice(0, 4)),
        isoWeek: Number(weekUsed.split('-W')[1]),
      },
    });
  });

  app.get('/api/envs', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const bypass = !!req.devBypass;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';
    if (noDb) {
      return reply.send({ ok: true, seenEnvs: ['production'], selected: ['production'] });
    }

    const seen = await EventModel.distinct('meta.deploymentEnvironment', { projectId: project._id });
    const selected = project?.settings?.prodEnvironments || ['production'];
    const filtered = (seen || []).filter(Boolean);
    if (bypass && filtered.length === 0 && selected.length === 0) {
      return reply.send({ ok: true, seenEnvs: ['Yandex Cloud', 'production'], selected: ['Yandex Cloud'] });
    }
    return reply.send({ ok: true, seenEnvs: filtered, selected });
  });

  app.post('/api/envs', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';
    if (noDb) {
      const body: any = req.body || {};
      const selected: string[] = Array.isArray(body.selected) ? body.selected : [];
      return reply.send({ ok: true, selected });
    }
    const body: any = req.body || {};
    const selected: string[] = Array.isArray(body.selected) ? body.selected : [];
    await ProjectModel.updateOne({ _id: project._id }, { $set: { 'settings.prodEnvironments': selected } });
    return reply.send({ ok: true });
  });
}
