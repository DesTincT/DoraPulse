/* eslint-disable @typescript-eslint/no-misused-promises */
import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { EventModel } from '../models/Event.js';
import { getWeekly } from '../services/metricsService.js';
import { isoWeekString } from '../utils.js';
import { getCurrentIsoWeek } from '../utils/week.js';
import { createGithubInstallState } from '../services/githubInstallState.js';
import { computeProjectSelftest } from '../services/selftestService.js';

export default async function webappRoutes(app: FastifyInstance) {
  // Telegram-authenticated API
  app.get('/api/bootstrap', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const bypass = !!project.devBypass;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';

    const baseInstallUrl = config.githubAppSlug
      ? `https://github.com/apps/${config.githubAppSlug}/installations/new`
      : bypass
        ? 'https://example.com/install'
        : null;

    const state =
      baseInstallUrl && project.projectId && project.chatId > 0
        ? createGithubInstallState({ projectId: project.projectId, chatId: project.chatId })
        : null;
    const githubInstallUrl =
      baseInstallUrl && state ? `${baseInstallUrl}?state=${encodeURIComponent(state)}` : baseInstallUrl;

    const installationId = project.github.installationId;
    const installed = project.github.installed;

    if (noDb) {
      const selected = project.settings?.prodEnvironments?.length ? project.settings.prodEnvironments : ['production'];
      return reply.send({
        ok: true,
        projectId: project.projectId,
        installed,
        github: { installed, installationId },
        githubInstallUrl,
        seenEnvs: ['production'],
        selectedEnvs: selected,
        prodEnvironmentsText: selected.join(', '),
        serverNow: new Date().toISOString(),
      });
    }

    const seen = await EventModel.distinct('meta.deploymentEnvironment', { projectId: project.projectId });
    const selected = project.settings.prodEnvironments.length ? project.settings.prodEnvironments : ['production'];
    const filtered = (seen || []).filter(Boolean);

    const seenEnvs =
      bypass && filtered.length === 0 && selected.length === 0 ? ['Yandex Cloud', 'production'] : filtered;
    const selectedEnvs = bypass && filtered.length === 0 && selected.length === 0 ? ['Yandex Cloud'] : selected;

    return reply.send({
      ok: true,
      projectId: project.projectId,
      installed,
      github: { installed, installationId },
      githubInstallUrl,
      seenEnvs,
      selectedEnvs,
      prodEnvironmentsText: selectedEnvs.join(', '),
      serverNow: new Date().toISOString(),
    });
  });

  app.get('/api/me', { preHandler: app.telegramAuth }, async (req, reply) => {
    const project = req.project!;
    const bypass = !!project.devBypass;

    // Safe telemetry: initData length + telegram user id (never log full initData).
    try {
      req.log.info(
        {
          initDataLen: req.telegramInitDataInfo?.len ?? 0,
          telegramUserId: req.telegramInitDataInfo?.userId,
          chatId: req.telegramInitDataInfo?.chatId,
          projectId: project.projectId,
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
      baseInstallUrl && project.projectId && project.chatId > 0
        ? createGithubInstallState({ projectId: project.projectId, chatId: project.chatId })
        : null;
    const githubInstallUrl =
      baseInstallUrl && state ? `${baseInstallUrl}?state=${encodeURIComponent(state)}` : baseInstallUrl;

    const installationId = project.github.installationId;
    const installed = project.github.installed;

    return reply.send({
      ok: true,
      projectId: project.projectId,
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
    const bypass = !!project.devBypass;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';

    const now = new Date();
    const nowUtc = now.toISOString();

    const q: any = req.query || {};
    const weekParamRaw = typeof q.week === 'string' ? q.week.trim().toUpperCase() : '';
    const weekParam = weekParamRaw && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(weekParamRaw) ? weekParamRaw : '';

    if (noDb) {
      const weekUsed = weekParam || getCurrentIsoWeek(config.timezone);
      return reply.send({
        ok: true,
        recentEvents15m: 0,
        weekUsed,
        weekly: null,
        selftest: {
          ok: true,
          now: nowUtc,
          latestCompleteWeekKey: getCurrentIsoWeek(config.timezone),
          weekKey: weekUsed,
          weekRange: null,
          ingestion: {
            lastWebhookAt: null,
            webhooks15m: 0,
            webhooks24h: 0,
            duplicates15m: 0,
            duplicates24h: 0,
            failures15m: 0,
            failures24h: 0,
          },
          config: {
            prodEnvironments: project.settings?.prodEnvironments || ['prod', 'production'],
            githubInstallationPresent: project.github.installed,
            githubReposConfigured: false,
            repoMappingPresent: false,
          },
          dataPresence: {
            prsMergedInWeek: 0,
            deploysInWeekTotal: 0,
            deploysInWeekProd: 0,
            lastMergedPrAt: null,
            lastProdDeployAt: null,
            deployStatusEventsInWeek: 0,
          },
          diagnosticReasons: [
            {
              code: 'INSTALLATION_OR_PERMISSIONS_MISSING',
              severity: 'warn',
              message: 'DORA_DEV_NO_DB=true: selftest is running without MongoDB (limited signals).',
              fix: 'Run with MongoDB enabled to get ingestion + data diagnostics.',
            },
          ],
        },
        debug: {
          nowUtc,
          latestEventTs: null,
          latestEventWeek: null,
          isoWeekYear: Number(weekUsed.slice(0, 4)),
          isoWeek: Number(weekUsed.split('-W')[1]),
          githubInstalled: project.github.installed,
          note: 'DORA_DEV_NO_DB=true (no Mongo)',
        },
      });
    }

    const since = new Date(now.getTime() - 15 * 60 * 1000);
    const recent = await EventModel.countDocuments({ projectId: project.projectId, ts: { $gte: since } });

    const latest = await EventModel.findOne({ projectId: project.projectId }).select('ts').sort({ ts: -1 }).lean();
    const latestEventTs = latest?.ts ? new Date(latest.ts as any) : null;
    const latestEventWeek = latestEventTs ? isoWeekString(latestEventTs) : null;

    const weekUsed = weekParam || getCurrentIsoWeek(config.timezone);
    const weekly = await getWeekly(project.projectId, weekUsed);
    const selftest = await computeProjectSelftest(String(project.projectId), weekUsed);

    if (
      bypass &&
      (!recent || recent === 0) &&
      (!weekly || (typeof weekly === 'object' && Object.keys(weekly).length === 0))
    ) {
      return reply.send({
        ok: true,
        recentEvents15m: recent || 0,
        weekUsed,
        weekly,
        selftest,
        debug: {
          nowUtc,
          latestEventTs: latestEventTs ? latestEventTs.toISOString() : null,
          latestEventWeek,
          isoWeekYear: Number(weekUsed.slice(0, 4)),
          isoWeek: Number(weekUsed.split('-W')[1]),
          githubInstalled: project.github.installed,
          note: 'dev bypass mode response',
        },
      });
    }
    return reply.send({
      ok: true,
      recentEvents15m: recent || 0,
      weekUsed,
      weekly,
      selftest,
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
    const bypass = !!project.devBypass;
    const noDb = String(process.env.DORA_DEV_NO_DB || '').toLowerCase() === 'true';
    if (noDb) {
      return reply.send({ ok: true, seenEnvs: ['production'], selected: ['production'] });
    }

    const seen = await EventModel.distinct('meta.deploymentEnvironment', { projectId: project.projectId });
    const selected = project.settings.prodEnvironments.length ? project.settings.prodEnvironments : ['production'];
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
      const selectedRaw: any[] = Array.isArray(body.selected) ? body.selected : [];
      const parts = selectedRaw.map((x) => String(x).trim()).filter(Boolean);
      const dedup = Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values());
      if (!dedup.length) return reply.code(400).send({ ok: false, error: 'prodEnvironments required' });
      return reply.send({ ok: true, selected: dedup });
    }
    const body: any = req.body || {};
    const selectedRaw: any[] = Array.isArray(body.selected) ? body.selected : [];
    const parts = selectedRaw.map((x) => String(x).trim()).filter(Boolean);
    const dedup = Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values());
    if (!dedup.length) return reply.code(400).send({ ok: false, error: 'prodEnvironments required' });
    await ProjectModel.updateOne({ _id: project.projectId }, { $set: { 'settings.prodEnvironments': dedup } });
    // keep request context consistent for subsequent handlers in the same request lifecycle
    project.settings.prodEnvironments = dedup;
    return reply.send({ ok: true, selected: dedup });
  });
}
