import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { EventModel } from '../models/Event.js';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { fromDeploymentStatus } from '../services/githubNormalizer.js';

export default async function githubWebhook(app: FastifyInstance) {
  fastify.log.info({
    ghEvent: request.headers['x-github-event'],
    contentType: request.headers['content-type'],
    hasDeployment: !!(request.body as any)?.deployment,
    hasDeploymentStatus: !!(request.body as any)?.deployment_status,
  }, 'github webhook received');

  
  app.post('/webhooks/github', async (req, reply) => {
    try {
      // Validate GitHub signature if enabled
      if (config.validateWebhook) {
        const sigHeader = String((req.headers['x-hub-signature-256'] ?? '') as string);
        const raw: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body ?? {}));
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
      const delivery = String((req.headers['x-github-delivery'] ?? '') as string);

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

      if (payload.pull_request) {
        const pr = payload.pull_request;
        const baseRef = pr.base?.ref || '';
        if (payload.action === 'opened') {
          const ev: any = {
            ts: new Date(pr.created_at || now),
            type: 'pr_open',
            branch: baseRef,
            prId: payload.number,
            bodyPreview: String(pr.title || '').slice(0, 300),
            meta: {
              prNumber: payload.number,
              repoId: payload?.repository?.id != null ? String(payload.repository.id) : undefined,
              repoFullName:
                payload?.repository?.full_name ||
                (payload?.repository?.owner?.login && payload?.repository?.name
                  ? `${payload.repository.owner.login}/${payload.repository.name}`
                  : undefined),
              prCreatedAt: pr.created_at ? new Date(pr.created_at).getTime() : undefined,
            },
          };
          ev.dedupKey = delivery ? `${delivery}:${ev.type}` : `${pr.head?.sha || ''}:pr_open:${pr.created_at || ''}`;
          events.push(ev);
        }
        if (payload.action === 'closed' && pr.merged) {
          const ev: any = {
            ts: new Date(pr.merged_at || now),
            // normalize legacy type to canonical at save-time
            type: 'pr_merged',
            branch: baseRef,
            prId: payload.number,
            bodyPreview: String(pr.title || '').slice(0, 300),
            meta: {
              prNumber: payload.number,
              repoId: payload?.repository?.id != null ? String(payload.repository.id) : undefined,
              repoFullName:
                payload?.repository?.full_name ||
                (payload?.repository?.owner?.login && payload?.repository?.name
                  ? `${payload.repository.owner.login}/${payload.repository.name}`
                  : undefined),
              prCreatedAt: pr.created_at ? new Date(pr.created_at).getTime() : undefined,
            },
          };
          ev.dedupKey = delivery
            ? `${delivery}:${ev.type}`
            : `${pr.merge_commit_sha || pr.head?.sha || ''}:pr_merged:${pr.merged_at || pr.closed_at || ''}`;
          events.push(ev);
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
            env: 'prod',
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
          ev.dedupKey = delivery
            ? `${delivery}:${ev.type}`
            : `${wr.head_sha || ''}:${ev.type}:${wr.updated_at || wr.completed_at || ''}`;
          events.push(ev);
        }
      }

      // 4) Обязательные поля и сохранение
      const toInsert = events.map((e) => {
        const normalizedType = e.type === 'pr_merge' ? 'pr_merged' : e.type;
        const baseMeta = e.meta ?? {};
        const prId = typeof e.prId === 'number' ? e.prId : (baseMeta?.prNumber ?? undefined);
        const meta = { ...baseMeta };
        if (prId != null && meta.prNumber == null) {
          meta.prNumber = prId;
        }
        const docRepoId =
          repoId ?? (meta.repoId && Types.ObjectId.isValid(meta.repoId) ? new Types.ObjectId(meta.repoId) : undefined);
        return {
          ...e,
          type: normalizedType,
          prId,
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
                    prId: doc.prId,
                    bodyPreview: doc.bodyPreview,
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

      // temporary debug: log first 3 events about to be saved
      const debugSample = toInsert.slice(0, 3).map((e) => ({ type: e.type, prId: e.prId, meta: e.meta }));
      app.log.info({ sample: debugSample }, 'about to save events');
      const res = await (EventModel as any).bulkWrite(ops, { ordered: false });
      const inserted = (res?.upsertedCount || 0) + (res?.insertedCount || 0);
      return reply.send({ ok: true, inserted });
    } catch (err: any) {
      req.log.error(err, 'webhook error');
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });
}
