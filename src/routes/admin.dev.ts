// src/routes/admin.dev.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { EventModel } from '../models/Event.js';
import { RepoModel } from '../models/Repo.js';

export default async function adminDev(app: FastifyInstance) {
  // Вставить одно тестовое событие (deploy_succeeded) с валидным repoId
  app.post('/admin/dev-insert', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, owner = 'acme', name = 'checkout' } = (req.body as any) ?? {};
    if (!projectId) return reply.code(400).send({ ok: false, error: 'projectId required' });

    // 1) найдём/создадим репозиторий для проекта
    const repo = await RepoModel.findOneAndUpdate(
      { projectId, owner, name },
      { $setOnInsert: { defaultBranch: 'main' } },
      { new: true, upsert: true },
    );
    if (!repo) {
      return reply.code(500).send({ ok: false, error: 'repo upsert failed' });
    }

    // 2) создадим событие с repoId
    const doc = await EventModel.create({
      ts: new Date('2025-12-03T15:00:00+03:00'),
      source: 'github',
      type: 'deploy_succeeded',
      projectId: new Types.ObjectId(projectId),
      repoId: new Types.ObjectId(repo._id),
      env: 'prod',
      branch: 'main',
      meta: {
        workflowName: 'dev-insert',
        url: '',
        labels: [],
        durationMs: 0,
      },
      bodyPreview: 'dev insert check',
    });

    return reply.send({
      ok: true,
      insertedId: String(doc._id),
      repoId: String(repo._id),
      repo: `${owner}/${name}`,
    });
  });

  // на всякий — «последние события»
  app.get('/admin/events/last', async (_req: FastifyRequest, reply: FastifyReply) => {
    const total = await EventModel.countDocuments({});
    const last = await EventModel.find({})
      .sort({ ts: -1 })
      .limit(10)
      .select('ts type projectId repoId branch env meta bodyPreview')
      .lean();
    return reply.send({ total, last });
  });
}
