import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { Types } from 'mongoose';
import { EventModel } from '../models/Event.js';
import {
  fromPullRequest,
  fromWorkflowRun,
  fromDeploymentStatus,
  fromPush,
  type NormalizedEvent,
} from '../services/githubNormalizer.js';

export default async function githubAppWebhook(app: FastifyInstance) {
  app.post('/webhooks/github/app', async (req, reply) => {
    try {
      // Signature validation (HMAC-SHA256)
      const sigHeader = String((req.headers['x-hub-signature-256'] ?? '') as string);
      const raw: Buffer = req.rawBody || Buffer.from(JSON.stringify(req.body ?? {}));
      const secret = process.env.GITHUB_APP_WEBHOOK_SECRET || config.webhookSecret;
      const digest = createHmac('sha256', secret).update(raw).digest('hex');
      const expected = `sha256=${digest}`;
      const ok =
        !!sigHeader &&
        sigHeader.length === expected.length &&
        timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
      if (!ok) return reply.code(401).send({ error: 'invalid signature' });

      const eventName = String((req.headers['x-github-event'] ?? '') as string).toLowerCase();
      const payload = req.body as any;

      if (eventName === 'ping') {
        app.log.info({ eventName }, 'github app ping');
        return reply.send({ ok: true });
      }

      const installationId: number | undefined =
        typeof payload?.installation?.id === 'number' ? payload.installation.id : undefined;
      if (!installationId) {
        app.log.info({ eventName }, 'github app webhook: missing installation id');
        return reply.code(202).send({ ok: true, ignored: true, reason: 'missing_installation_id' });
      }

      const project = await ProjectModel.findOne({
        $or: [{ 'settings.github.installationId': installationId }, { 'github.installationId': installationId }],
      }).lean();
      app.log.info({ eventName, installationId, matched: !!project?._id }, 'github app webhook received');
      if (!project?._id) return reply.code(202).send({ ok: true, ignored: true, reason: 'unknown_installation' });

      // Installation events: update linked repos/account metadata (MVP)
      if (eventName === 'installation' || eventName === 'installation_repositories') {
        const accountLogin: string | undefined = payload?.installation?.account?.login;
        const accountType: string | undefined = payload?.installation?.account?.type;
        const reposRaw = payload?.repositories || payload?.repositories_added || [];
        const repos: string[] = Array.isArray(reposRaw)
          ? reposRaw.map((r: any) => String(r?.full_name || '')).filter(Boolean)
          : [];
        await ProjectModel.updateOne(
          { _id: project._id },
          {
            $set: {
              githubInstallationId: installationId,
              githubAccountLogin: accountLogin,
              githubInstalledAt: new Date(),
              'settings.github.installationId': installationId,
              'settings.github.accountLogin': accountLogin,
              'settings.github.accountType': accountType,
              'settings.github.repos': repos,
              'settings.github.updatedAt': new Date(),
              // keep legacy location for backwards compatibility
              'github.installationId': installationId,
              'github.accountLogin': accountLogin,
              'github.accountType': accountType,
              'github.repos': repos,
              'github.updatedAt': new Date(),
            },
          },
        );
      }

      // resolve repoId if repository is present
      let repoId: Types.ObjectId | undefined;
      const full = payload?.repository?.full_name?.split('/');
      if (full?.length === 2) {
        const [owner, name] = full;
        const repo = await RepoModel.findOne({ projectId: project._id, owner, name });
        if (repo?._id) repoId = repo._id as any;
      }

      const events: NormalizedEvent[] = [];
      if (payload?.pull_request) {
        events.push(...fromPullRequest(payload, project));
      } else if (payload?.workflow_run) {
        events.push(...fromWorkflowRun(payload, project));
      } else if (payload?.deployment && payload?.deployment_status) {
        events.push(...fromDeploymentStatus(payload, project));
      } else if (payload?.ref && payload?.commits) {
        events.push(...fromPush(payload, project));
      }

      app.log.info({ eventName, count: events.length, projectId: String(project._id), installationId }, 'normalized');

      if (!events.length) return reply.send({ ok: true, inserted: 0, note: 'no events recognized' });

      const now = new Date();
      const toInsert = events.map((ev) => {
        const meta = ev.meta || {};
        const docRepoId =
          repoId ?? (meta.repoId && Types.ObjectId.isValid(meta.repoId) ? new Types.ObjectId(meta.repoId) : undefined);
        const doc: any = {
          ts: new Date(ev.ts || now),
          type: ev.type === 'pr_merge' ? 'pr_merged' : ev.type,
          meta,
          projectId: new Types.ObjectId(project._id),
          repoId: docRepoId,
          source: 'github',
        };
        if ((ev.meta as any)?.env === 'prod') doc.env = 'prod';
        if (ev.dedupKey) doc.dedupKey = ev.dedupKey;
        return doc;
      });

      const ops = toInsert.map((doc) => {
        if (doc.dedupKey) {
          return {
            updateOne: {
              filter: { projectId: doc.projectId, dedupKey: doc.dedupKey },
              update: [
                {
                  $set: {
                    type: doc.type,
                    ts: doc.ts,
                    source: doc.source,
                    projectId: doc.projectId,
                    repoId: doc.repoId,
                    env: doc.env,
                    dedupKey: doc.dedupKey,
                    meta: { $mergeObjects: [{ $ifNull: ['$meta', {}] }, doc.meta || {}] },
                  },
                },
              ],
              upsert: true,
            },
          } as const;
        }
        return { insertOne: { document: doc } } as const;
      });

      const res = await (EventModel as any).bulkWrite(ops, { ordered: false });
      const inserted = (res?.upsertedCount || 0) + (res?.insertedCount || 0);
      return reply.send({ ok: true, inserted });
    } catch (err: any) {
      req.log.error(err, 'github app webhook error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
}
