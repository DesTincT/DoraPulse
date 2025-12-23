import { FastifyInstance } from 'fastify';
import { EventModel } from '../models/Event.js';
import { Types } from 'mongoose';
import { isoWeekRange } from '../utils.js';

export default async function adminDebug(app: FastifyInstance) {
  app.get('/admin/debug/weekly/:projectId', async (req, reply) => {
    const { projectId } = req.params as any;
    const { week = '2025-W49' } = req.query as any;
    const [from, to] = isoWeekRange(week);
    const pid = new Types.ObjectId(projectId);
    const events = await EventModel.find({ projectId: pid, ts: { $gte: from, $lt: to } })
      .select('ts type repoId branch env meta.workflowName bodyPreview')
      .sort({ ts: 1 })
      .lean();
    const byType = events.reduce((m: any, e: any) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
    const missingRepoId = events.filter((e: any) => !e.repoId).length;
    reply.send({ week, from, to, count: events.length, byType, missingRepoId, sample: events.slice(0, 5) });
  });
}
