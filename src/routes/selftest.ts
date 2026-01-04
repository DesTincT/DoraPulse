import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { computeProjectSelftest } from '../services/selftestService.js';

export default async function selftestRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/selftest', async (req, reply) => {
    const { projectId } = req.params as any;
    if (!Types.ObjectId.isValid(projectId)) return reply.code(400).send({ ok: false, error: 'Invalid project id' });
    const week =
      typeof (req.query as any)?.week === 'string'
        ? String((req.query as any).week)
            .trim()
            .toUpperCase()
        : '';
    try {
      const res = await computeProjectSelftest(projectId, week || undefined);
      return reply.send(res);
    } catch (e: any) {
      return reply.code(500).send({ ok: false, error: e?.message || 'selftest failed' });
    }
  });
}
