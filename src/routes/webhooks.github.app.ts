import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { Types } from 'mongoose';
import { EventModel } from '../models/Event.js';
import { WebhookDeliveryModel } from '../models/WebhookDelivery.js';
import { upsertPullRequest } from '../services/pullRequestService.js';
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
      const deliveryId = String((req.headers['x-github-delivery'] ?? '') as string);
      const payload = req.body as any;
      const repoFullName: string | undefined = payload?.repository?.full_name;

      if (eventName === 'ping') {
        app.log.info({ eventName }, 'github app ping');
        return reply.send({ ok: true });
      }

      // Installation id must be a number; payload can contain it as string depending on middleware/serializer.
      const installationIdRaw = payload?.installation?.id ?? payload?.installationId;
      const installationId = Number(installationIdRaw);
      const hasInstallationId = Number.isFinite(installationId) && installationId > 0;

      app.log.info(
        { eventName, deliveryId, installationId: hasInstallationId ? installationId : null, repoFullName },
        'github app webhook received',
      );

      // Persist delivery before any filtering (idempotency + visibility).
      if (deliveryId) {
        const now = new Date();
        const res: any = await WebhookDeliveryModel.updateOne(
          { provider: 'github', deliveryId },
          {
            $setOnInsert: { provider: 'github', deliveryId, firstSeenAt: now },
            $set: {
              lastSeenAt: now,
              installationId: hasInstallationId ? installationId : undefined,
              repoFullName,
              eventName: eventName || undefined,
              status: 'received',
            },
            $inc: { seenCount: 1 },
          },
          { upsert: true },
        );
        const inserted = !!(res?.upsertedCount || res?.upsertedId);
        if (!inserted) {
          await WebhookDeliveryModel.updateOne(
            { provider: 'github', deliveryId },
            { $set: { lastSeenAt: now, status: 'duplicate' } },
          );
          app.log.info(
            { deliveryId, eventName, installationId: hasInstallationId ? installationId : null },
            'duplicate delivery skipped',
          );
          return reply.send({ ok: true, duplicate: true });
        }
      }

      if (!hasInstallationId) {
        app.log.warn(
          { eventName, deliveryId, installationIdRaw, repoFullName },
          'github app webhook: missing/invalid installation id',
        );
        if (deliveryId) {
          await WebhookDeliveryModel.updateOne(
            { provider: 'github', deliveryId },
            { $set: { status: 'failed', error: 'missing_installation_id', processedAt: new Date() } },
          );
        }
        return reply
          .code(202)
          .send({ ok: true, queued: true, reason: 'missing_installation_id', installationId: null });
      }

      const project = await ProjectModel.findOne({
        'settings.github.installationId': installationId,
      }).lean();
      if (!project?._id) {
        app.log.warn(
          { eventName, deliveryId, installationId, repoFullName },
          'github app webhook queued: unknown installation (not linked to any project)',
        );
        if (deliveryId) {
          await WebhookDeliveryModel.updateOne(
            { provider: 'github', deliveryId },
            { $set: { status: 'queued', error: 'unknown_installation', processedAt: new Date() } },
          );
        }
        return reply.code(202).send({ ok: true, queued: true, reason: 'unknown_installation', installationId });
      }
      // backfill delivery with projectId now that it is known
      if (deliveryId) {
        await WebhookDeliveryModel.updateOne({ provider: 'github', deliveryId }, { $set: { projectId: project._id } });
      }

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
              'settings.github.installationId': installationId,
              'settings.github.accountLogin': accountLogin,
              'settings.github.accountType': accountType,
              'settings.github.repos': repos,
              'settings.github.updatedAt': new Date(),
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
        try {
          await upsertPullRequest(project._id as any, payload);
        } catch (e: any) {
          app.log.warn(
            { err: e?.message || e, deliveryId, projectId: String(project._id) },
            'pull request upsert failed',
          );
        }
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
        // top-level env is deprecated; rely on meta.env and meta.deploymentEnvironment
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
      if (deliveryId) {
        await WebhookDeliveryModel.updateOne(
          { provider: 'github', deliveryId },
          { $set: { status: 'processed', processedAt: new Date(), error: undefined } },
        );
      }
      return reply.send({ ok: true, inserted });
    } catch (err: any) {
      req.log.error(err, 'github app webhook error');
      try {
        const deliveryId = String((req.headers['x-github-delivery'] ?? '') as string);
        if (deliveryId) {
          await WebhookDeliveryModel.updateOne(
            { provider: 'github', deliveryId },
            { $set: { status: 'failed', error: String(err?.message || err), processedAt: new Date() } },
          );
        }
      } catch {}
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
}
