import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { EventModel } from '../models/Event.js';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { fromDeploymentStatus } from '../services/githubNormalizer.js';
import { WebhookDeliveryModel } from '../models/WebhookDelivery.js';
import { upsertPullRequest } from '../services/pullRequestService.js';

export default async function githubWebhook(app: FastifyInstance) {
  app.post('/webhooks/github', async (req, reply) => {
    app.log.info(
      {
        ghEvent: req.headers['x-github-event'],
        deliveryId: req.headers['x-github-delivery'],
        contentType: req.headers['content-type'],
        hasDeployment: !!(req.body as any)?.deployment,
        hasDeploymentStatus: !!(req.body as any)?.deployment_status,
      },
      'github webhook received',
    );

    try {
      // Validate GitHub signature if enabled
      if (config.validateWebhook) {
        const sigHeader = String((req.headers['x-hub-signature-256'] ?? '') as string);
        const raw: Buffer = req.rawBody || Buffer.from(JSON.stringify(req.body ?? {}));
        const digest = createHmac('sha256', config.webhookSecret).update(raw).digest('hex');
        const expected = `sha256=${digest}`;
        const ok =
          !!sigHeader &&
          sigHeader.length === expected.length &&
          timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader));
        if (!ok) return reply.code(401).send({ ok: false, error: 'invalid signature' });
      }

      const projectKey = (req.query as any).projectKey as string;
      if (!projectKey) return reply.code(400).send({ ok: false, error: 'projectKey required' });

      // 1) проект по PAK
      const project = await ProjectModel.findOne({ accessKey: projectKey }).lean();
      if (!project) return reply.code(404).send({ ok: false, error: 'project not found' });

      const payload = req.body as any;
      const ghEventHeader = String((req.headers['x-github-event'] ?? req.headers['X-GitHub-Event'] ?? '') as string);
      const ghEvent = ghEventHeader.toLowerCase();
      const deliveryId = String((req.headers['x-github-delivery'] ?? '') as string);

      // 2) repoId по repository.full_name
      let repoId: Types.ObjectId | undefined = undefined;
      const full = payload?.repository?.full_name?.split('/');
      if (full?.length === 2) {
        const [owner, name] = full;
        const repo = await RepoModel.findOne({ projectId: project._id, owner, name });
        if (repo?._id) repoId = repo._id as any;
      }

      // 3) Нормализация payload (фикстуры БЕЗ заголовка X-GitHub-Event → определяем по форме)
      const events: any[] = [];
      const now = new Date();

      // 2.5) Delivery-level idempotency (skip duplicates before any processing)
      if (deliveryId) {
        const repoFullName: string | undefined = payload?.repository?.full_name;
        const res: any = await WebhookDeliveryModel.updateOne(
          { provider: 'github', deliveryId },
          {
            $setOnInsert: { provider: 'github', deliveryId, firstSeenAt: now },
            $set: {
              lastSeenAt: now,
              projectId: project._id,
              repoFullName,
              eventName: ghEvent || undefined,
              status: 'processed',
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
          app.log.info({ deliveryId, ghEvent, projectId: String(project._id) }, 'duplicate delivery skipped');
          return reply.send({ ok: true, duplicate: true });
        }
      }

      // 3.0) deployment (ignore gracefully, we use deployment_status only)
      if (ghEvent === 'deployment') {
        return reply.send({ ok: true, ignored: true });
      }

      // 3.1) deployment_status (source of truth for prod deploys)
      if (ghEvent === 'deployment_status' || (payload?.deployment && payload?.deployment_status)) {
        try {
          const envName = String(payload?.deployment?.environment || '');
          const state = String(payload?.deployment_status?.state || '');
          const sha = String(payload?.deployment?.sha || '');
          const deploymentId = payload?.deployment?.id;
          const statusId = payload?.deployment_status?.id;
          app.log.info(
            { envName, state, sha, deploymentId, statusId, projectId: String(project._id) },
            'webhook: deployment_status received',
          );
        } catch {}
        const norm = fromDeploymentStatus(payload, project) || [];
        for (const ev of norm) {
          const e: any = {
            ts: new Date(ev.ts || now),
            type: ev.type,
            meta: ev.meta || {},
          };
          // canonical env on top-level for easier querying
          if ((ev.meta as any)?.env === 'prod') e.env = 'prod';
          if (ev.dedupKey) e.dedupKey = ev.dedupKey;
          events.push(e);
        }
      }

      // Store canonical PR state for debugging/selftest even if we don't emit an Event (e.g. closed-not-merged).
      if (payload?.pull_request) {
        try {
          await upsertPullRequest(project._id as any, payload);
        } catch (e: any) {
          app.log.warn(
            { err: e?.message || e, deliveryId, projectId: String(project._id) },
            'pull request upsert failed',
          );
        }
      }

      if (payload.pull_request) {
        const pr = payload.pull_request;
        const baseRef = pr.base?.ref || '';
        const repoFullName: string | undefined =
          payload?.repository?.full_name ||
          (payload?.repository?.owner?.login && payload?.repository?.name
            ? `${payload.repository.owner.login}/${payload.repository.name}`
            : undefined);
        const prNodeId: number | undefined = typeof pr?.id === 'number' ? pr.id : undefined;
        if (payload.action === 'opened') {
          const ev: any = {
            ts: new Date(pr.created_at || now),
            type: 'pr_open',
            branch: baseRef,
            bodyPreview: String(pr.title || '').slice(0, 300),
            meta: {
              prNumber: payload.number,
              pullRequestId: prNodeId,
              pullRequestNumber: payload.number,
              createdAt: pr.created_at || undefined,
              baseBranch: baseRef || undefined,
              headBranch: pr.head?.ref || undefined,
              url: pr.html_url || pr.url || undefined,
              state: pr.state || undefined,
              repoId: payload?.repository?.id != null ? String(payload.repository.id) : undefined,
              repoFullName,
              prCreatedAt: pr.created_at ? new Date(pr.created_at).getTime() : undefined,
            },
          };
          ev.dedupKey =
            repoFullName && prNodeId != null && pr.created_at
              ? `gh:pr_open:${repoFullName}:${String(prNodeId)}:${String(pr.created_at)}`
              : deliveryId
                ? `${deliveryId}:${ev.type}`
                : `${pr.head?.sha || ''}:pr_open:${pr.created_at || ''}`;
          events.push(ev);
        }
        if (payload.action === 'closed' && pr.merged) {
          const prodBranch = (project as any)?.settings?.prodRule?.branch;
          // Per project configuration: count merges only into the configured production branch.
          // Still upsert the PR domain model above for debugging/selftest.
          if (!prodBranch || baseRef === prodBranch) {
          const ev: any = {
              ts: new Date(pr.merged_at || now),
              // normalize legacy type to canonical at save-time
              type: 'pr_merged',
              branch: baseRef,
              bodyPreview: String(pr.title || '').slice(0, 300),
              meta: {
                prNumber: payload.number,
                pullRequestId: prNodeId,
                pullRequestNumber: payload.number,
                createdAt: pr.created_at || undefined,
                mergedAt: pr.merged_at || pr.closed_at || undefined,
                closedAt: pr.closed_at || undefined,
                baseBranch: baseRef || undefined,
                headBranch: pr.head?.ref || undefined,
                url: pr.html_url || pr.url || undefined,
                state: 'merged',
                repoId: payload?.repository?.id != null ? String(payload.repository.id) : undefined,
                repoFullName,
                prCreatedAt: pr.created_at ? new Date(pr.created_at).getTime() : undefined,
              },
            };
            const mergedAt = pr.merged_at || pr.closed_at || '';
            ev.dedupKey =
              repoFullName && prNodeId != null && mergedAt
                ? `gh:pr_merged:${repoFullName}:${String(prNodeId)}:${String(mergedAt)}`
                : deliveryId
                  ? `${deliveryId}:${ev.type}`
                  : `${pr.merge_commit_sha || pr.head?.sha || ''}:pr_merged:${mergedAt}`;
            events.push(ev);
          }
        }
      }

      if (payload.workflow_run) {
        const wr = payload.workflow_run;
        const name = wr.name || '';
        const conclusion = wr.conclusion;
        const isDeployProd = /deploy.*prod/i.test(name);
        if (payload.action === 'completed' && isDeployProd) {
          const ev: any = {
            ts: new Date(wr.updated_at || now),
            type: conclusion === 'success' ? 'deploy_succeeded' : 'deploy_failed',
            branch: wr.head_branch,
            bodyPreview: name.slice(0, 300),
            meta: {
              workflowName: name,
              env: 'prod',
              sha: wr.head_sha,
              repoFullName:
                payload?.repository?.full_name ||
                (payload?.repository?.owner?.login && payload?.repository?.name
                  ? `${payload.repository.owner.login}/${payload.repository.name}`
                  : undefined),
            },
          };
          ev.dedupKey = deliveryId
            ? `${deliveryId}:${ev.type}`
            : `${wr.head_sha || ''}:${ev.type}:${wr.updated_at || wr.completed_at || ''}`;
          events.push(ev);
        }
      }

      // 4) Обязательные поля и сохранение
      const toInsert = events.map((e) => {
        const normalizedType = e.type === 'pr_merge' ? 'pr_merged' : e.type;
        const baseMeta = e.meta ?? {};
        const meta = { ...baseMeta };
        const docRepoId =
          repoId ?? (meta.repoId && Types.ObjectId.isValid(meta.repoId) ? new Types.ObjectId(meta.repoId) : undefined);
        return {
          ...e,
          type: normalizedType,
          meta,
          ts: new Date(e.ts),
          projectId: new Types.ObjectId(project._id),
          repoId: docRepoId, // важно, чтобы НЕ был undefined
          source: 'github',
        };
      });

      app.log.info(
        { count: toInsert.length, types: toInsert.map((x) => x.type), repoId, projectId: String(project._id) },
        'normalized',
      );

      if (!toInsert.length) return reply.send({ ok: true, inserted: 0, note: 'no events recognized' });

      // Upsert by dedupKey for idempotency
      const ops = toInsert.map((doc) => {
        if (doc.dedupKey) {
          return {
            updateOne: {
              filter: { projectId: doc.projectId, dedupKey: doc.dedupKey },
              // Merge meta with existing to avoid dropping keys like labels
              update: [
                {
                  $set: {
                    type: doc.type,
                    ts: doc.ts,
                    source: doc.source,
                    projectId: doc.projectId,
                    repoId: doc.repoId,
                    branch: doc.branch,
                    bodyPreview: doc.bodyPreview,
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

      // temporary debug: log first 3 events about to be saved
      const debugSample = toInsert.slice(0, 3).map((e) => ({ type: e.type, prId: e.prId, meta: e.meta }));
      app.log.info({ sample: debugSample }, 'about to save events');
      const res = await (EventModel as any).bulkWrite(ops, { ordered: false });
      const inserted = (res?.upsertedCount || 0) + (res?.insertedCount || 0);
      if (deliveryId) {
        await WebhookDeliveryModel.updateOne(
          { provider: 'github', deliveryId },
          { $set: { status: 'processed', processedAt: new Date() } },
        );
      }
      return reply.send({ ok: true, inserted });
    } catch (err: any) {
      req.log.error(err, 'webhook error');
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
